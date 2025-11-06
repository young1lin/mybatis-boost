/**
 * MyBatis Boost Extension
 * Provides bidirectional navigation between MyBatis mapper interfaces and XML files
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
    FileMapper,
    JavaToXmlDefinitionProvider,
    JavaToXmlCodeLensProvider,
    XmlToJavaDefinitionProvider,
    JavaClassDefinitionProvider,
    XmlSqlFragmentDefinitionProvider,
    XmlResultMapPropertyDefinitionProvider,
    XmlResultMapDefinitionProvider,
    XmlParameterDefinitionProvider,
    ParameterValidator
} from './navigator';
import { MybatisBindingDecorator } from './decorator';

let fileMapper: FileMapper;
let bindingDecorator: MybatisBindingDecorator;
let parameterValidator: ParameterValidator;

// Navigation providers (disposable based on configuration)
let javaToXmlDefinitionProvider: vscode.Disposable | undefined;
let javaToXmlCodeLensProvider: vscode.Disposable | undefined;

export async function activate(context: vscode.ExtensionContext) {
    console.log(`[MyBatis Boost] ${vscode.l10n.t('extension.activating')}`);
    const activationStart = Date.now();

    // Register commands first (always available)
    registerCommands(context);

    // Quick check if this is a Java project
    const isJava = await isJavaProject();
    if (!isJava) {
        console.log(`[MyBatis Boost] ${vscode.l10n.t('extension.notJavaProject')}`);
        return;
    }

    console.log(`[MyBatis Boost] ${vscode.l10n.t('extension.javaProjectDetected')}`);

    // Get configuration
    const config = vscode.workspace.getConfiguration('mybatis-boost');
    const cacheSize = config.get<number>('cacheSize', 1000);

    // Initialize file mapper
    fileMapper = new FileMapper(context, cacheSize);
    await fileMapper.initialize();

    // Register XML-related definition providers (always enabled)
    registerXmlDefinitionProviders(context);

    // Register Java-to-XML navigation providers based on configuration
    const useDefinitionProvider = config.get<boolean>('useDefinitionProvider', false);
    registerJavaToXmlNavigationProvider(context, useDefinitionProvider);

    const mode = useDefinitionProvider ? vscode.l10n.t('mode.definitionProvider') : vscode.l10n.t('mode.codeLens');
    console.log(`[MyBatis Boost] ${vscode.l10n.t('extension.navigationMode', mode)}`);

    // Initialize parameter validator
    parameterValidator = new ParameterValidator(context, fileMapper);
    console.log(`[MyBatis Boost] ${vscode.l10n.t('extension.parameterValidatorInitialized')}`);

    // Initialize binding decorator if enabled
    const showBindingIcons = config.get<boolean>('showBindingIcons', true);
    if (showBindingIcons) {
        bindingDecorator = new MybatisBindingDecorator(context, fileMapper);
        console.log(`[MyBatis Boost] ${vscode.l10n.t('extension.bindingDecoratorInitialized')}`);
    } else {
        console.log(`[MyBatis Boost] ${vscode.l10n.t('extension.bindingDecoratorDisabled')}`);
    }

    // Listen for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('mybatis-boost.useDefinitionProvider')) {
                const newUseDefinitionProvider = vscode.workspace
                    .getConfiguration('mybatis-boost')
                    .get<boolean>('useDefinitionProvider', false);

                console.log(`[MyBatis Boost] ${vscode.l10n.t('extension.configChanged', String(newUseDefinitionProvider))}`);

                // Unregister old provider
                unregisterJavaToXmlNavigationProvider();

                // Register new provider
                registerJavaToXmlNavigationProvider(context, newUseDefinitionProvider);

                const newMode = newUseDefinitionProvider ? vscode.l10n.t('mode.definitionProvider') : vscode.l10n.t('mode.codeLens');
                vscode.window.showInformationMessage(
                    vscode.l10n.t('extension.switchedMode', newMode)
                );
            }
        })
    );

    // Register dispose handler
    context.subscriptions.push({
        dispose: () => {
            if (fileMapper) {
                fileMapper.dispose();
            }
            if (bindingDecorator) {
                bindingDecorator.dispose();
            }
            if (parameterValidator) {
                parameterValidator.dispose();
            }
            unregisterJavaToXmlNavigationProvider();
        }
    });

    const activationTime = Date.now() - activationStart;
    console.log(`[MyBatis Boost] ${vscode.l10n.t('extension.activated', String(activationTime))}`);
}

/**
 * Quick check if workspace contains a Java project
 */
async function isJavaProject(): Promise<boolean> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return false;
    }

    for (const folder of workspaceFolders) {
        const folderPath = folder.uri.fsPath;

        // Check for common Java project indicators
        const indicators = [
            path.join(folderPath, 'pom.xml'),
            path.join(folderPath, 'build.gradle'),
            path.join(folderPath, 'build.gradle.kts'),
            path.join(folderPath, 'src', 'main', 'java')
        ];

        for (const indicator of indicators) {
            if (fs.existsSync(indicator)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Register all commands
 */
function registerCommands(context: vscode.ExtensionContext) {
    // Clear cache command
    context.subscriptions.push(
        vscode.commands.registerCommand('mybatis-boost.clearCache', async () => {
            if (!fileMapper) {
                vscode.window.showWarningMessage(vscode.l10n.t('command.notActive'));
                return;
            }
            fileMapper.clearCache();
            await fileMapper.initialize();
            if (bindingDecorator) {
                bindingDecorator.refresh();
            }
            vscode.window.showInformationMessage(vscode.l10n.t('command.cacheCleared'));
        })
    );

    // Refresh mappings command
    context.subscriptions.push(
        vscode.commands.registerCommand('mybatis-boost.refreshMappings', async () => {
            if (!fileMapper) {
                vscode.window.showWarningMessage(vscode.l10n.t('command.notActive'));
                return;
            }
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: vscode.l10n.t('command.refreshingMappings'),
                cancellable: false
            }, async () => {
                fileMapper.clearCache();
                await fileMapper.initialize();
                if (bindingDecorator) {
                    bindingDecorator.refresh();
                }
            });
            vscode.window.showInformationMessage(vscode.l10n.t('command.mappingsRefreshed'));
        })
    );

    // Jump to XML command (used by CodeLens and manual invocation)
    // Automatically detects whether to jump to mapper namespace or statement based on cursor position
    context.subscriptions.push(
        vscode.commands.registerCommand('mybatis-boost.jumpToXml', async (javaUri?: vscode.Uri, xmlPath?: string, methodName?: string) => {
            // If called without arguments (manual invocation), detect cursor position
            if (!javaUri || !xmlPath) {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showWarningMessage(vscode.l10n.t('command.noActiveEditor'));
                    return;
                }

                if (!fileMapper) {
                    vscode.window.showWarningMessage(vscode.l10n.t('command.notActive'));
                    return;
                }

                const document = editor.document;
                const position = editor.selection.active;

                // Get the word at cursor position
                const wordRange = document.getWordRangeAtPosition(position);
                if (!wordRange) {
                    vscode.window.showWarningMessage(vscode.l10n.t('command.noWordAtCursor'));
                    return;
                }

                const word = document.getText(wordRange);
                const line = document.lineAt(position.line).text;

                // Get corresponding XML file
                const javaPath = document.uri.fsPath;
                const detectedXmlPath = await fileMapper.getXmlPath(javaPath);

                if (!detectedXmlPath) {
                    vscode.window.showWarningMessage(vscode.l10n.t('command.noXmlFound'));
                    return;
                }

                // Set the detected values
                javaUri = document.uri;
                xmlPath = detectedXmlPath;

                // Check if this is an interface declaration
                const interfacePattern = /(?:public\s+)?interface\s+\w+/;
                if (interfacePattern.test(line) && line.includes(word)) {
                    // Jump to mapper namespace (no methodName)
                    methodName = undefined;
                } else {
                    // Check if this looks like a method declaration
                    const currentLineHasMethodName = /\w+\s+\w+\s*\(/.test(line);
                    const wordFollowedByParen = line.includes(`${word}(`);

                    if (currentLineHasMethodName || wordFollowedByParen) {
                        // Verify this is actually a method by checking if it has a closing ';' within next few lines
                        let hasMethodEnd = line.includes(';') || line.includes(')');

                        if (!hasMethodEnd) {
                            // Look ahead up to 10 lines
                            const text = document.getText();
                            const lines = text.split('\n');
                            for (let i = position.line + 1; i < Math.min(position.line + 10, lines.length); i++) {
                                if (lines[i].includes(';') || lines[i].includes('}')) {
                                    hasMethodEnd = true;
                                    break;
                                }
                            }
                        }

                        if (hasMethodEnd) {
                            // Jump to XML statement
                            methodName = word;
                        } else {
                            vscode.window.showWarningMessage(vscode.l10n.t('command.notOnMethodOrInterface'));
                            return;
                        }
                    } else {
                        vscode.window.showWarningMessage(vscode.l10n.t('command.notOnMethodOrInterface'));
                        return;
                    }
                }
            }

            const { findXmlMapperPosition, findXmlStatementPosition } = await import('./navigator/parsers/xmlParser.js');

            // If methodName is provided, jump to statement; otherwise jump to mapper
            if (methodName) {
                // Jump to XML statement
                const statementPosition = await findXmlStatementPosition(xmlPath, methodName);

                if (statementPosition) {
                    const xmlUri = vscode.Uri.file(xmlPath);
                    const position = new vscode.Position(statementPosition.line, statementPosition.startColumn);
                    await vscode.window.showTextDocument(xmlUri, { selection: new vscode.Range(position, position) });
                } else {
                    vscode.window.showWarningMessage(vscode.l10n.t('command.statementNotFound', methodName));
                }
            } else {
                // Jump to XML mapper namespace
                const position = await findXmlMapperPosition(xmlPath);

                if (position) {
                    const xmlUri = vscode.Uri.file(xmlPath);
                    const vscodePosition = new vscode.Position(position.line, position.column);
                    await vscode.window.showTextDocument(xmlUri, { selection: new vscode.Range(vscodePosition, vscodePosition) });
                } else {
                    // Fallback: open at first line
                    const xmlUri = vscode.Uri.file(xmlPath);
                    await vscode.window.showTextDocument(xmlUri);
                }
            }
        })
    );

    console.log(`[MyBatis Boost] ${vscode.l10n.t('extension.commandsRegistered')}`);
}

export function deactivate() {
    console.log(`[MyBatis Boost] ${vscode.l10n.t('extension.deactivating')}`);

    if (fileMapper) {
        fileMapper.dispose();
    }
    if (bindingDecorator) {
        bindingDecorator.dispose();
    }
    if (parameterValidator) {
        parameterValidator.dispose();
    }
    unregisterJavaToXmlNavigationProvider();
}

/**
 * Register XML-related definition providers (always enabled)
 */
function registerXmlDefinitionProviders(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        // XML statement -> Java method navigation
        vscode.languages.registerDefinitionProvider(
            { language: 'xml', pattern: '**/*.xml' },
            new XmlToJavaDefinitionProvider(fileMapper)
        ),

        // Java class reference navigation in XML
        vscode.languages.registerDefinitionProvider(
            { language: 'xml', pattern: '**/*.xml' },
            new JavaClassDefinitionProvider()
        ),

        // SQL fragment reference navigation within XML
        vscode.languages.registerDefinitionProvider(
            { language: 'xml', pattern: '**/*.xml' },
            new XmlSqlFragmentDefinitionProvider()
        ),

        // ResultMap property -> Java field navigation
        vscode.languages.registerDefinitionProvider(
            { language: 'xml', pattern: '**/*.xml' },
            new XmlResultMapPropertyDefinitionProvider()
        ),

        // ResultMap reference navigation within XML
        vscode.languages.registerDefinitionProvider(
            { language: 'xml', pattern: '**/*.xml' },
            new XmlResultMapDefinitionProvider()
        ),

        // Parameter reference navigation in XML to Java
        vscode.languages.registerDefinitionProvider(
            { language: 'xml', pattern: '**/*.xml' },
            new XmlParameterDefinitionProvider(fileMapper)
        )
    );

    console.log(`[MyBatis Boost] ${vscode.l10n.t('extension.xmlDefinitionProvidersRegistered')}`);
}

/**
 * Register Java-to-XML navigation provider based on configuration
 * @param context Extension context
 * @param useDefinitionProvider Whether to use DefinitionProvider (true) or CodeLens (false)
 */
function registerJavaToXmlNavigationProvider(context: vscode.ExtensionContext, useDefinitionProvider: boolean) {
    if (useDefinitionProvider) {
        // Use DefinitionProvider mode (F12 jumps to XML)
        javaToXmlDefinitionProvider = vscode.languages.registerDefinitionProvider(
            { language: 'java', pattern: '**/*.java' },
            new JavaToXmlDefinitionProvider(fileMapper)
        );
        context.subscriptions.push(javaToXmlDefinitionProvider);
        console.log(`[MyBatis Boost] ${vscode.l10n.t('extension.javaToXmlDefinitionProviderRegistered')}`);
    } else {
        // Use CodeLens mode (non-invasive, preserves native Java behavior)
        const codeLensProvider = new JavaToXmlCodeLensProvider(fileMapper);
        javaToXmlCodeLensProvider = vscode.languages.registerCodeLensProvider(
            { language: 'java', pattern: '**/*.java' },
            codeLensProvider
        );
        context.subscriptions.push(javaToXmlCodeLensProvider);
        console.log(`[MyBatis Boost] ${vscode.l10n.t('extension.javaToXmlCodeLensProviderRegistered')}`);
    }
}

/**
 * Unregister Java-to-XML navigation provider
 */
function unregisterJavaToXmlNavigationProvider() {
    if (javaToXmlDefinitionProvider) {
        javaToXmlDefinitionProvider.dispose();
        javaToXmlDefinitionProvider = undefined;
        console.log(`[MyBatis Boost] ${vscode.l10n.t('extension.javaToXmlDefinitionProviderUnregistered')}`);
    }
    if (javaToXmlCodeLensProvider) {
        javaToXmlCodeLensProvider.dispose();
        javaToXmlCodeLensProvider = undefined;
        console.log(`[MyBatis Boost] ${vscode.l10n.t('extension.javaToXmlCodeLensProviderUnregistered')}`);
    }
}
