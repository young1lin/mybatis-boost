/**
 * Unit tests for ParameterValidator
 * Tests the configuration toggle for enabling/disabling parameter validation
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

describe('ParameterValidator Configuration Toggle', () => {
    let sandbox: sinon.SinonSandbox;
    let originalGetConfiguration: typeof vscode.workspace.getConfiguration;
    let configValues: Map<string, any>;
    let configChangeHandlers: ((e: any) => void)[];

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        configValues = new Map();
        configChangeHandlers = [];

        // Set default config value
        configValues.set('enableParameterValidation', true);

        // Store original function
        originalGetConfiguration = vscode.workspace.getConfiguration;

        // Override getConfiguration
        (vscode.workspace as any).getConfiguration = function(section: string) {
            return {
                get: (key: string, defaultValue: any) => {
                    if (configValues.has(key)) {
                        return configValues.get(key);
                    }
                    return defaultValue;
                },
                update: () => Promise.resolve(),
                inspect: () => undefined,
                has: () => false
            };
        };

        // Store original onDidChangeConfiguration and override it
        const originalOnDidChangeConfig = vscode.workspace.onDidChangeConfiguration;
        (vscode.workspace as any).onDidChangeConfiguration = function(callback: any) {
            configChangeHandlers.push(callback);
            return { dispose: () => {} };
        };

        // Mock createFileSystemWatcher
        if (!(vscode.workspace as any).createFileSystemWatcher) {
            (vscode.workspace as any).createFileSystemWatcher = function() {
                return {
                    onDidChange: () => ({ dispose: () => {} }),
                    onDidCreate: () => ({ dispose: () => {} }),
                    onDidDelete: () => ({ dispose: () => {} }),
                    dispose: () => {}
                };
            };
        }

        // Clear module cache to get fresh instances
        delete require.cache[require.resolve('../../navigator/diagnostics/ParameterValidator')];
    });

    afterEach(() => {
        sandbox.restore();
        // Restore original function
        (vscode.workspace as any).getConfiguration = originalGetConfiguration;
        configChangeHandlers = [];
    });

    describe('Initial configuration state', () => {
        it('should be enabled when enableParameterValidation is true', () => {
            configValues.set('enableParameterValidation', true);

            const { ParameterValidator } = require('../../navigator/diagnostics/ParameterValidator');

            const mockContext = {
                subscriptions: { push: () => {} }
            };
            const mockFileMapper = {
                getJavaPath: () => Promise.resolve(null)
            };

            const validator = new ParameterValidator(mockContext, mockFileMapper);
            assert.strictEqual(validator.isEnabled(), true, 'Validator should be enabled when config is true');
            validator.dispose();
        });

        it('should be disabled when enableParameterValidation is false', () => {
            configValues.set('enableParameterValidation', false);

            // Need to re-require to get fresh instance
            delete require.cache[require.resolve('../../navigator/diagnostics/ParameterValidator')];
            const { ParameterValidator } = require('../../navigator/diagnostics/ParameterValidator');

            const mockContext = {
                subscriptions: { push: () => {} }
            };
            const mockFileMapper = {
                getJavaPath: () => Promise.resolve(null)
            };

            const validator = new ParameterValidator(mockContext, mockFileMapper);
            assert.strictEqual(validator.isEnabled(), false, 'Validator should be disabled when config is false');
            validator.dispose();
        });

        it('should default to enabled (true) when no config is explicitly set', () => {
            // Remove the config value to test default behavior
            configValues.delete('enableParameterValidation');

            delete require.cache[require.resolve('../../navigator/diagnostics/ParameterValidator')];
            const { ParameterValidator } = require('../../navigator/diagnostics/ParameterValidator');

            const mockContext = {
                subscriptions: { push: () => {} }
            };
            const mockFileMapper = {
                getJavaPath: () => Promise.resolve(null)
            };

            const validator = new ParameterValidator(mockContext, mockFileMapper);
            assert.strictEqual(validator.isEnabled(), true, 'Validator should be enabled by default');
            validator.dispose();
        });
    });

    describe('Configuration change handling', () => {
        it('should disable validation when configuration changes from true to false', () => {
            configValues.set('enableParameterValidation', true);

            delete require.cache[require.resolve('../../navigator/diagnostics/ParameterValidator')];
            const { ParameterValidator } = require('../../navigator/diagnostics/ParameterValidator');

            const mockContext = {
                subscriptions: { push: () => {} }
            };
            const mockFileMapper = {
                getJavaPath: () => Promise.resolve(null)
            };

            const validator = new ParameterValidator(mockContext, mockFileMapper);
            assert.strictEqual(validator.isEnabled(), true, 'Validator should start enabled');

            // Change configuration
            configValues.set('enableParameterValidation', false);

            // Fire the configuration change event
            const configChangeEvent = {
                affectsConfiguration: (section: string) => section === 'mybatis-boost.enableParameterValidation'
            };
            configChangeHandlers.forEach(handler => handler(configChangeEvent));

            assert.strictEqual(validator.isEnabled(), false, 'Validator should be disabled after config change');
            validator.dispose();
        });

        it('should enable validation when configuration changes from false to true', () => {
            configValues.set('enableParameterValidation', false);

            delete require.cache[require.resolve('../../navigator/diagnostics/ParameterValidator')];
            const { ParameterValidator } = require('../../navigator/diagnostics/ParameterValidator');

            const mockContext = {
                subscriptions: { push: () => {} }
            };
            const mockFileMapper = {
                getJavaPath: () => Promise.resolve(null)
            };

            const validator = new ParameterValidator(mockContext, mockFileMapper);
            assert.strictEqual(validator.isEnabled(), false, 'Validator should start disabled');

            // Change configuration
            configValues.set('enableParameterValidation', true);

            // Fire the configuration change event
            const configChangeEvent = {
                affectsConfiguration: (section: string) => section === 'mybatis-boost.enableParameterValidation'
            };
            configChangeHandlers.forEach(handler => handler(configChangeEvent));

            assert.strictEqual(validator.isEnabled(), true, 'Validator should be enabled after config change');
            validator.dispose();
        });

        it('should not react to unrelated configuration changes', () => {
            configValues.set('enableParameterValidation', true);

            delete require.cache[require.resolve('../../navigator/diagnostics/ParameterValidator')];
            const { ParameterValidator } = require('../../navigator/diagnostics/ParameterValidator');

            const mockContext = {
                subscriptions: { push: () => {} }
            };
            const mockFileMapper = {
                getJavaPath: () => Promise.resolve(null)
            };

            const validator = new ParameterValidator(mockContext, mockFileMapper);
            const initialEnabled = validator.isEnabled();

            // Fire an unrelated configuration change event
            const configChangeEvent = {
                affectsConfiguration: (section: string) => section === 'mybatis-boost.cacheSize'
            };
            configChangeHandlers.forEach(handler => handler(configChangeEvent));

            assert.strictEqual(validator.isEnabled(), initialEnabled, 'Enabled state should not change for unrelated config');
            validator.dispose();
        });
    });

    describe('Validation behavior when disabled', () => {
        it('should skip validation when disabled', async () => {
            configValues.set('enableParameterValidation', false);

            delete require.cache[require.resolve('../../navigator/diagnostics/ParameterValidator')];
            const { ParameterValidator } = require('../../navigator/diagnostics/ParameterValidator');

            const mockContext = {
                subscriptions: { push: () => {} }
            };
            let getJavaPathCalled = false;
            const mockFileMapper = {
                getJavaPath: () => {
                    getJavaPathCalled = true;
                    return Promise.resolve('/test/Mapper.java');
                }
            };

            const validator = new ParameterValidator(mockContext, mockFileMapper);

            const mockDoc = {
                languageId: 'xml',
                uri: { fsPath: '/test/mapper.xml', toString: () => '/test/mapper.xml' }
            };

            // Call validateDocument
            await validator.validateDocument(mockDoc);

            // Verify getJavaPath was not called (validation was skipped)
            assert.strictEqual(getJavaPathCalled, false, 'getJavaPath should not be called when validation is disabled');
            validator.dispose();
        });
    });

    describe('isEnabled public method', () => {
        it('should return current enabled state as boolean', () => {
            configValues.set('enableParameterValidation', true);

            delete require.cache[require.resolve('../../navigator/diagnostics/ParameterValidator')];
            const { ParameterValidator } = require('../../navigator/diagnostics/ParameterValidator');

            const mockContext = {
                subscriptions: { push: () => {} }
            };
            const mockFileMapper = {
                getJavaPath: () => Promise.resolve(null)
            };

            const validator = new ParameterValidator(mockContext, mockFileMapper);
            const result = validator.isEnabled();

            assert.strictEqual(typeof result, 'boolean', 'isEnabled should return a boolean');
            assert.strictEqual(result, true, 'isEnabled should return true when enabled');
            validator.dispose();
        });
    });
});
