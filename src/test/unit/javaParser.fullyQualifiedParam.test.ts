/**
 * Unit test: Verify javaParser handles fully qualified class names in method parameters
 */

import * as assert from 'assert';
import * as path from 'path';
import { extractMethodParameters } from '../../navigator/parsers/javaParser';

describe('JavaParser - Fully Qualified Parameter Types', () => {
    const fixtureRoot = path.join(__dirname, '..', 'fixtures', 'parameter-validation');
    const mapperPath = path.join(fixtureRoot, 'FullyQualifiedParamMapper.java');

    it('should extract paramType for fully qualified class name (com.example.query.UserQuery)', async () => {
        const params = await extractMethodParameters(mapperPath, 'queryUsers');

        console.log('[Test] Extracted parameters:', JSON.stringify(params, null, 2));

        assert.strictEqual(params.length, 1, 'Should find 1 parameter');

        const param = params[0];
        assert.strictEqual(param.name, 'query', 'Parameter name should be "query"');

        // ❌ Current behavior: paramType is likely "com" or undefined
        // ✅ Expected behavior: paramType should be "com.example.query.UserQuery"
        console.log(`[Test] paramType = "${param.paramType}"`);

        // This test will FAIL with current implementation
        assert.ok(
            param.paramType.includes('UserQuery'),
            `Expected paramType to include "UserQuery", got "${param.paramType}"`
        );
    });

    it('should extract paramType for mixed FQN and simple types', async () => {
        const params = await extractMethodParameters(mapperPath, 'updateUser');

        console.log('[Test] Extracted parameters:', JSON.stringify(params, null, 2));

        assert.strictEqual(params.length, 2, 'Should find 2 parameters');

        // First parameter: Long id
        assert.strictEqual(params[0].name, 'id');
        assert.strictEqual(params[0].paramType, 'Long');

        // Second parameter: com.example.entity.UserUpdateRequest request
        assert.strictEqual(params[1].name, 'request');
        console.log(`[Test] Second param type = "${params[1].paramType}"`);

        // This will also FAIL with current implementation
        assert.ok(
            params[1].paramType.includes('UserUpdateRequest'),
            `Expected paramType to include "UserUpdateRequest", got "${params[1].paramType}"`
        );
    });
});
