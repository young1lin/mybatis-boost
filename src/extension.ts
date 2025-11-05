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
    XmlToJavaDefinitionProvider,
    JavaClassDefinitionProvider,
    XmlSqlFragmentDefinitionProvider,
    XmlResultMapPropertyDefinitionProvider,
    XmlResultMapDefinitionProvider
} from './navigator';
import { MybatisBindingDecorator } from './decorator';

let fileMapper: FileMapper;
let bindingDecorator: MybatisBindingDecorator;

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

    // Register Definition providers
    context.subscriptions.push(
        // Java method -> XML statement navigation
        vscode.languages.registerDefinitionProvider(
            { language: 'java', pattern: '**/*.java' },
            new JavaToXmlDefinitionProvider(fileMapper)
        ),

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
        )
    );

    console.log('[MyBatis Boost] Definition providers registered');

    // Initialize binding decorator if enabled
    const showBindingIcons = config.get<boolean>('showBindingIcons', true);
    if (showBindingIcons) {
        bindingDecorator = new MybatisBindingDecorator(context, fileMapper);
        console.log('[MyBatis Boost] Binding decorator initialized');
    } else {
        console.log('[MyBatis Boost] Binding decorator disabled by configuration');
    }

    // Register dispose handler
    context.subscriptions.push({
        dispose: () => {
            if (fileMapper) {
                fileMapper.dispose();
            }
            if (bindingDecorator) {
                bindingDecorator.dispose();
            }
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
}
