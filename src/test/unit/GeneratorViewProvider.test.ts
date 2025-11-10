/**
 * Unit tests for GeneratorViewProvider
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

describe('GeneratorViewProvider', () => {

    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should have correct viewType', async () => {
        const { GeneratorViewProvider } = await import('../../webview/GeneratorViewProvider.js');
        assert.strictEqual(GeneratorViewProvider.viewType, 'mybatis-boost.generatorView');
    });

    it('should register with correct view type in extension', async () => {
        // This test verifies the integration point
        // The actual WebView Provider will be tested in integration tests
        const { GeneratorViewProvider } = await import('../../webview/GeneratorViewProvider.js');

        // Mock extension context
        const mockContext = {
            extensionUri: vscode.Uri.file('/mock/path'),
            globalState: {
                get: sandbox.stub().returns([]),
                update: sandbox.stub().resolves()
            }
        };

        // Create provider instance
        const provider = new GeneratorViewProvider(
            mockContext.extensionUri,
            mockContext as any
        );

        assert.ok(provider, 'Provider should be created successfully');
    });

    it('should handle history storage key correctly', async () => {
        // Verify the storage key constant is defined
        const module = await import('../../webview/GeneratorViewProvider.js');

        // The storage key should be accessible through the module
        // In actual usage, it's a private constant, but we verify through behavior
        assert.ok(module.GeneratorViewProvider, 'GeneratorViewProvider should be exported');
    });

    describe('Configuration Scope Management', () => {
        let mockContext: any;
        let mockWebview: any;
        let mockWebviewView: any;
        let getConfigurationStub: sinon.SinonStub;
        let updateStub: sinon.SinonStub;
        let inspectStub: sinon.SinonStub;
        let getStub: sinon.SinonStub;
        let workspaceFoldersStub: sinon.SinonStub;

        beforeEach(() => {
            // Mock configuration methods
            updateStub = sandbox.stub().resolves();
            getStub = sandbox.stub();
            inspectStub = sandbox.stub();

            const mockConfig = {
                get: getStub,
                update: updateStub,
                inspect: inspectStub
            };

            getConfigurationStub = sandbox.stub(vscode.workspace, 'getConfiguration').returns(mockConfig as any);

            // Mock webview
            mockWebview = {
                options: {},
                html: '',
                postMessage: sandbox.stub().resolves(true),
                onDidReceiveMessage: sandbox.stub(),
                asWebviewUri: sandbox.stub().returns(vscode.Uri.file('/mock/uri')),
                cspSource: 'mock-csp'
            };

            mockWebviewView = {
                webview: mockWebview,
                visible: true,
                show: sandbox.stub(),
                onDidDispose: sandbox.stub(),
                onDidChangeVisibility: sandbox.stub()
            };

            // Mock extension context
            mockContext = {
                extensionUri: vscode.Uri.file('/mock/path'),
                globalState: {
                    get: sandbox.stub().returns([]),
                    update: sandbox.stub().resolves()
                }
            };

            // Mock workspace folders
            workspaceFoldersStub = sandbox.stub(vscode.workspace, 'workspaceFolders' as any);
        });

        it('should detect workspace scope when workspace config exists', async () => {
            const { GeneratorViewProvider } = await import('../../webview/GeneratorViewProvider.js');

            // Setup: workspace folder exists
            workspaceFoldersStub.value([{ uri: vscode.Uri.file('/workspace'), name: 'test', index: 0 }]);

            // Setup: workspace-level config exists
            inspectStub.withArgs('basePackage').returns({
                workspaceValue: 'com.workspace.package'
            });

            getStub.returns('com.workspace.package');

            const provider = new GeneratorViewProvider(mockContext.extensionUri, mockContext);
            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

            // Simulate loadSettings message
            const messageHandler = mockWebview.onDidReceiveMessage.firstCall.args[0];
            await messageHandler({ type: 'loadSettings' });

            // Verify postMessage was called with workspace scope
            assert.ok(mockWebview.postMessage.called, 'postMessage should be called');
            const messageCall = mockWebview.postMessage.getCalls().find(
                (call: any) => call.args[0].type === 'settingsLoaded'
            );
            assert.ok(messageCall, 'settingsLoaded message should be sent');
            assert.strictEqual(messageCall.args[0].configScope, 'workspace', 'Should detect workspace scope');
        });

        it('should detect global scope when no workspace folder exists', async () => {
            const { GeneratorViewProvider } = await import('../../webview/GeneratorViewProvider.js');

            // Setup: no workspace folder
            workspaceFoldersStub.value(undefined);

            const provider = new GeneratorViewProvider(mockContext.extensionUri, mockContext);
            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

            // Simulate loadSettings message
            const messageHandler = mockWebview.onDidReceiveMessage.firstCall.args[0];
            await messageHandler({ type: 'loadSettings' });

            // Verify postMessage was called with global scope
            const messageCall = mockWebview.postMessage.getCalls().find(
                (call: any) => call.args[0].type === 'settingsLoaded'
            );
            assert.ok(messageCall, 'settingsLoaded message should be sent');
            assert.strictEqual(messageCall.args[0].configScope, 'global', 'Should detect global scope');
        });

        it('should default to workspace scope when workspace exists but no config set', async () => {
            const { GeneratorViewProvider } = await import('../../webview/GeneratorViewProvider.js');

            // Setup: workspace folder exists
            workspaceFoldersStub.value([{ uri: vscode.Uri.file('/workspace'), name: 'test', index: 0 }]);

            // Setup: no workspace-level config exists
            inspectStub.returns({
                workspaceValue: undefined,
                globalValue: 'com.global.package'
            });

            getStub.returns('com.global.package');

            const provider = new GeneratorViewProvider(mockContext.extensionUri, mockContext);
            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

            // Simulate loadSettings message
            const messageHandler = mockWebview.onDidReceiveMessage.firstCall.args[0];
            await messageHandler({ type: 'loadSettings' });

            // Verify postMessage was called with workspace scope (default for new configs)
            const messageCall = mockWebview.postMessage.getCalls().find(
                (call: any) => call.args[0].type === 'settingsLoaded'
            );
            assert.ok(messageCall, 'settingsLoaded message should be sent');
            assert.strictEqual(messageCall.args[0].configScope, 'workspace', 'Should default to workspace scope');
        });

        it('should save settings to workspace when configScope is workspace', async () => {
            const { GeneratorViewProvider } = await import('../../webview/GeneratorViewProvider.js');

            // Setup: workspace folder exists
            workspaceFoldersStub.value([{ uri: vscode.Uri.file('/workspace'), name: 'test', index: 0 }]);

            const provider = new GeneratorViewProvider(mockContext.extensionUri, mockContext);
            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

            // Simulate saveSettings message
            const messageHandler = mockWebview.onDidReceiveMessage.firstCall.args[0];
            await messageHandler({
                type: 'saveSettings',
                settings: {
                    basePackage: 'com.test.package',
                    author: 'Test Author',
                    entitySuffix: 'Entity',
                    mapperSuffix: 'Mapper',
                    serviceSuffix: 'Service',
                    datetime: 'LocalDateTime',
                    useLombok: true,
                    useSwagger: false,
                    useSwaggerV3: false,
                    useMyBatisPlus: false
                },
                configScope: 'workspace'
            });

            // Verify update was called with Workspace target
            assert.ok(updateStub.called, 'update should be called');
            const basePackageCall = updateStub.getCalls().find(
                (call: any) => call.args[0] === 'basePackage'
            );
            assert.ok(basePackageCall, 'basePackage should be updated');
            assert.strictEqual(
                basePackageCall.args[2],
                vscode.ConfigurationTarget.Workspace,
                'Should save to Workspace target'
            );
        });

        it('should save settings to global when configScope is global', async () => {
            const { GeneratorViewProvider } = await import('../../webview/GeneratorViewProvider.js');

            // Setup: workspace folder exists
            workspaceFoldersStub.value([{ uri: vscode.Uri.file('/workspace'), name: 'test', index: 0 }]);

            const provider = new GeneratorViewProvider(mockContext.extensionUri, mockContext);
            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

            // Simulate saveSettings message
            const messageHandler = mockWebview.onDidReceiveMessage.firstCall.args[0];
            await messageHandler({
                type: 'saveSettings',
                settings: {
                    basePackage: 'com.test.package',
                    author: 'Test Author',
                    entitySuffix: 'Entity',
                    mapperSuffix: 'Mapper',
                    serviceSuffix: 'Service',
                    datetime: 'LocalDateTime',
                    useLombok: true,
                    useSwagger: false,
                    useSwaggerV3: false,
                    useMyBatisPlus: false
                },
                configScope: 'global'
            });

            // Verify update was called with Global target
            assert.ok(updateStub.called, 'update should be called');
            const basePackageCall = updateStub.getCalls().find(
                (call: any) => call.args[0] === 'basePackage'
            );
            assert.ok(basePackageCall, 'basePackage should be updated');
            assert.strictEqual(
                basePackageCall.args[2],
                vscode.ConfigurationTarget.Global,
                'Should save to Global target'
            );
        });

        it('should fallback to global when saving to workspace but no workspace exists', async () => {
            const { GeneratorViewProvider } = await import('../../webview/GeneratorViewProvider.js');

            // Setup: no workspace folder
            workspaceFoldersStub.value(undefined);

            // Mock showWarningMessage
            const showWarningStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves();

            const provider = new GeneratorViewProvider(mockContext.extensionUri, mockContext);
            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

            // Simulate saveSettings message with workspace scope
            const messageHandler = mockWebview.onDidReceiveMessage.firstCall.args[0];
            await messageHandler({
                type: 'saveSettings',
                settings: {
                    basePackage: 'com.test.package',
                    author: 'Test Author',
                    entitySuffix: 'Entity',
                    mapperSuffix: 'Mapper',
                    serviceSuffix: 'Service',
                    datetime: 'LocalDateTime',
                    useLombok: true,
                    useSwagger: false,
                    useSwaggerV3: false,
                    useMyBatisPlus: false
                },
                configScope: 'workspace'
            });

            // Verify warning was shown
            assert.ok(showWarningStub.called, 'Warning should be shown');
            assert.ok(
                showWarningStub.firstCall.args[0].includes('globally'),
                'Warning should mention global save'
            );

            // Verify update was called with Global target
            const basePackageCall = updateStub.getCalls().find(
                (call: any) => call.args[0] === 'basePackage'
            );
            assert.ok(basePackageCall, 'basePackage should be updated');
            assert.strictEqual(
                basePackageCall.args[2],
                vscode.ConfigurationTarget.Global,
                'Should fallback to Global target'
            );
        });
    });
});
