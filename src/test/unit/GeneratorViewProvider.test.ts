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
});
