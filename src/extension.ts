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
    console.log('[MyBatis Boost] Activating extension...');
    const activationStart = Date.now();

    // Register commands first (always available)
    registerCommands(context);

    // Quick check if this is a Java project
    const isJava = await isJavaProject();
    if (!isJava) {
        console.log('[MyBatis Boost] Not a Java project, navigation features disabled');
        return;
    }

    console.log('[MyBatis Boost] Java project detected, initializing...');

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

    console.log(`[MyBatis Boost] Navigation mode: ${useDefinitionProvider ? 'DefinitionProvider' : 'CodeLens'}`);

    // Initialize parameter validator
    parameterValidator = new ParameterValidator(context, fileMapper);
    console.log('[MyBatis Boost] Parameter validator initialized');

    // Initialize binding decorator if enabled
    const showBindingIcons = config.get<boolean>('showBindingIcons', true);
    if (showBindingIcons) {
        bindingDecorator = new MybatisBindingDecorator(context, fileMapper);
        console.log('[MyBatis Boost] Binding decorator initialized');
    } else {
        console.log('[MyBatis Boost] Binding decorator disabled by configuration');
    }

    // Listen for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('mybatis-boost.useDefinitionProvider')) {
                const newUseDefinitionProvider = vscode.workspace
                    .getConfiguration('mybatis-boost')
                    .get<boolean>('useDefinitionProvider', false);

                console.log(`[MyBatis Boost] Configuration changed: useDefinitionProvider = ${newUseDefinitionProvider}`);

                // Unregister old provider
                unregisterJavaToXmlNavigationProvider();

                // Register new provider
                registerJavaToXmlNavigationProvider(context, newUseDefinitionProvider);

                vscode.window.showInformationMessage(
                    `MyBatis Boost: Switched to ${newUseDefinitionProvider ? 'DefinitionProvider' : 'CodeLens'} mode`
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
    console.log(`[MyBatis Boost] Extension activated in ${activationTime}ms`);
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
                vscode.window.showWarningMessage('MyBatis Boost is not active. Open a Java project to use this feature.');
                return;
            }
            fileMapper.clearCache();
            await fileMapper.initialize();
            if (bindingDecorator) {
                bindingDecorator.refresh();
            }
            vscode.window.showInformationMessage('MyBatis Boost cache cleared and rebuilt');
        })
    );

    // Refresh mappings command
    context.subscriptions.push(
        vscode.commands.registerCommand('mybatis-boost.refreshMappings', async () => {
            if (!fileMapper) {
                vscode.window.showWarningMessage('MyBatis Boost is not active. Open a Java project to use this feature.');
                return;
            }
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Refreshing MyBatis mappings...',
                cancellable: false
            }, async () => {
                fileMapper.clearCache();
                await fileMapper.initialize();
                if (bindingDecorator) {
                    bindingDecorator.refresh();
                }
            });
            vscode.window.showInformationMessage('MyBatis mappings refreshed successfully');
        })
    );

    // Go to XML Mapper command (used by CodeLens)
    context.subscriptions.push(
        vscode.commands.registerCommand('mybatis-boost.goToXmlMapper', async (javaUri: vscode.Uri, xmlPath: string) => {
            const { findXmlMapperPosition } = await import('./navigator/parsers/xmlParser.js');
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
        })
    );

    // Go to XML Statement command (used by CodeLens)
    context.subscriptions.push(
        vscode.commands.registerCommand('mybatis-boost.goToXmlStatement', async (javaUri: vscode.Uri, xmlPath: string, methodName: string) => {
            const { findXmlStatementPosition } = await import('./navigator/parsers/xmlParser.js');
            const statementPosition = await findXmlStatementPosition(xmlPath, methodName);

            if (statementPosition) {
                const xmlUri = vscode.Uri.file(xmlPath);
                const position = new vscode.Position(statementPosition.line, statementPosition.startColumn);
                await vscode.window.showTextDocument(xmlUri, { selection: new vscode.Range(position, position) });
            } else {
                vscode.window.showWarningMessage(`MyBatis statement "${methodName}" not found in XML`);
            }
        })
    );

    console.log('[MyBatis Boost] Commands registered');
}

export function deactivate() {
    console.log('[MyBatis Boost] Deactivating extension...');

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

    console.log('[MyBatis Boost] XML definition providers registered');
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
        console.log('[MyBatis Boost] Java-to-XML DefinitionProvider registered');
    } else {
        // Use CodeLens mode (non-invasive, preserves native Java behavior)
        const codeLensProvider = new JavaToXmlCodeLensProvider(fileMapper);
        javaToXmlCodeLensProvider = vscode.languages.registerCodeLensProvider(
            { language: 'java', pattern: '**/*.java' },
            codeLensProvider
        );
        context.subscriptions.push(javaToXmlCodeLensProvider);
        console.log('[MyBatis Boost] Java-to-XML CodeLensProvider registered');
    }
}

/**
 * Unregister Java-to-XML navigation provider
 */
function unregisterJavaToXmlNavigationProvider() {
    if (javaToXmlDefinitionProvider) {
        javaToXmlDefinitionProvider.dispose();
        javaToXmlDefinitionProvider = undefined;
        console.log('[MyBatis Boost] Java-to-XML DefinitionProvider unregistered');
    }
    if (javaToXmlCodeLensProvider) {
        javaToXmlCodeLensProvider.dispose();
        javaToXmlCodeLensProvider = undefined;
        console.log('[MyBatis Boost] Java-to-XML CodeLensProvider unregistered');
    }
}
