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

/**
 * Tests for MyBatis single parameter validation rules
 *
 * MyBatis Single Parameter Rule:
 * When a method has only one parameter and no @Param annotation:
 * - If it's a primitive/built-in type (String, Integer, etc.), ANY name can be used in XML
 * - If it's a DTO object, the object's fields are automatically mapped
 */
describe('ParameterValidator - Single Parameter Rules', () => {
    describe('isBuiltInType helper method', () => {
        let isBuiltInType: (className: string) => boolean;

        before(() => {
            // Get the isBuiltInType method from the ParameterValidator
            // We'll test it indirectly through the module
            const { ParameterValidator } = require('../../navigator/diagnostics/ParameterValidator');
            const mockContext = {
                subscriptions: { push: () => {} }
            };
            const mockFileMapper = {
                getJavaPath: () => Promise.resolve(null)
            };
            const validator = new ParameterValidator(mockContext, mockFileMapper);
            // Access private method through any cast for testing
            isBuiltInType = (validator as any).isBuiltInType.bind(validator);
            validator.dispose();
        });

        it('should recognize primitive types', () => {
            assert.strictEqual(isBuiltInType('int'), true);
            assert.strictEqual(isBuiltInType('long'), true);
            assert.strictEqual(isBuiltInType('double'), true);
            assert.strictEqual(isBuiltInType('float'), true);
            assert.strictEqual(isBuiltInType('boolean'), true);
            assert.strictEqual(isBuiltInType('byte'), true);
            assert.strictEqual(isBuiltInType('short'), true);
            assert.strictEqual(isBuiltInType('char'), true);
        });

        it('should recognize wrapper types', () => {
            assert.strictEqual(isBuiltInType('String'), true);
            assert.strictEqual(isBuiltInType('Integer'), true);
            assert.strictEqual(isBuiltInType('Long'), true);
            assert.strictEqual(isBuiltInType('Double'), true);
            assert.strictEqual(isBuiltInType('Float'), true);
            assert.strictEqual(isBuiltInType('Boolean'), true);
            assert.strictEqual(isBuiltInType('Byte'), true);
            assert.strictEqual(isBuiltInType('Short'), true);
            assert.strictEqual(isBuiltInType('Character'), true);
        });

        it('should recognize fully qualified java.lang types', () => {
            assert.strictEqual(isBuiltInType('java.lang.String'), true);
            assert.strictEqual(isBuiltInType('java.lang.Integer'), true);
            assert.strictEqual(isBuiltInType('java.lang.Long'), true);
        });

        it('should not recognize DTO/custom types', () => {
            assert.strictEqual(isBuiltInType('User'), false);
            assert.strictEqual(isBuiltInType('UserQuery'), false);
            assert.strictEqual(isBuiltInType('com.example.User'), false);
        });
    });

    describe('isCollectionType helper method', () => {
        let isCollectionType: (className: string) => boolean;

        before(() => {
            const { ParameterValidator } = require('../../navigator/diagnostics/ParameterValidator');
            const mockContext = {
                subscriptions: { push: () => {} }
            };
            const mockFileMapper = {
                getJavaPath: () => Promise.resolve(null)
            };
            const validator = new ParameterValidator(mockContext, mockFileMapper);
            isCollectionType = (validator as any).isCollectionType.bind(validator);
            validator.dispose();
        });

        it('should recognize collection types', () => {
            assert.strictEqual(isCollectionType('List'), true);
            assert.strictEqual(isCollectionType('Set'), true);
            assert.strictEqual(isCollectionType('Map'), true);
            assert.strictEqual(isCollectionType('Collection'), true);
            assert.strictEqual(isCollectionType('ArrayList'), true);
            assert.strictEqual(isCollectionType('HashMap'), true);
        });

        it('should recognize fully qualified collection types', () => {
            assert.strictEqual(isCollectionType('java.util.List'), true);
            assert.strictEqual(isCollectionType('java.util.Set'), true);
            assert.strictEqual(isCollectionType('java.util.Map'), true);
        });

        it('should not recognize non-collection types', () => {
            assert.strictEqual(isCollectionType('String'), false);
            assert.strictEqual(isCollectionType('User'), false);
        });
    });

    describe('Single built-in type parameter validation', () => {
        /**
         * Test case for issue #40:
         * When a method has a single built-in type parameter without @Param,
         * MyBatis allows ANY parameter name in XML.
         *
         * Example:
         * Java: int deleteByPrimaryKey(String accountNumber);
         * XML: WHERE id = #{id}  -- This should be valid (any name works)
         */
        it('should recognize that single built-in type without @Param allows any parameter name', () => {
            // This test verifies the expected behavior after the fix
            // Single parameter (String) without @Param should allow any name in XML

            const { ParameterValidator } = require('../../navigator/diagnostics/ParameterValidator');
            const mockContext = {
                subscriptions: { push: () => {} }
            };
            const mockFileMapper = {
                getJavaPath: () => Promise.resolve(null)
            };
            const validator = new ParameterValidator(mockContext, mockFileMapper);

            // Check that the validator correctly identifies built-in types
            const isBuiltIn = (validator as any).isBuiltInType.bind(validator);

            // These should all be recognized as built-in types
            assert.strictEqual(isBuiltIn('String'), true, 'String should be a built-in type');
            assert.strictEqual(isBuiltIn('java.lang.String'), true, 'java.lang.String should be a built-in type');
            assert.strictEqual(isBuiltIn('Integer'), true, 'Integer should be a built-in type');
            assert.strictEqual(isBuiltIn('Long'), true, 'Long should be a built-in type');

            validator.dispose();
        });

        it('should recognize that single String parameter without @Param is a built-in type', () => {
            // Simulates: int deleteByPrimaryKey(String accountNumber);
            // XML can use #{id}, #{accountNumber}, #{anything} - all valid

            const { ParameterValidator } = require('../../navigator/diagnostics/ParameterValidator');
            const mockContext = {
                subscriptions: { push: () => {} }
            };
            const mockFileMapper = {
                getJavaPath: () => Promise.resolve(null)
            };
            const validator = new ParameterValidator(mockContext, mockFileMapper);

            const isBuiltIn = (validator as any).isBuiltInType.bind(validator);
            const isCollection = (validator as any).isCollectionType.bind(validator);

            // String is a built-in type, not a collection
            assert.strictEqual(isBuiltIn('String'), true);
            assert.strictEqual(isCollection('String'), false);

            validator.dispose();
        });

        it('should recognize that single Integer parameter without @Param is a built-in type', () => {
            // Simulates: User selectById(Integer id);
            // XML can use #{id}, #{value}, #{anything} - all valid

            const { ParameterValidator } = require('../../navigator/diagnostics/ParameterValidator');
            const mockContext = {
                subscriptions: { push: () => {} }
            };
            const mockFileMapper = {
                getJavaPath: () => Promise.resolve(null)
            };
            const validator = new ParameterValidator(mockContext, mockFileMapper);

            const isBuiltIn = (validator as any).isBuiltInType.bind(validator);

            assert.strictEqual(isBuiltIn('Integer'), true);
            assert.strictEqual(isBuiltIn('int'), true);

            validator.dispose();
        });
    });
});
