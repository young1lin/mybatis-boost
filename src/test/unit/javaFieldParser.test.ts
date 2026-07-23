/**
 * Unit tests for javaFieldParser
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
    extractJavaFields,
    findJavaField,
    findJavaFieldPosition,
    extractSuperclassName
} from '../../navigator/parsers/javaFieldParser';
import * as fileUtils from '../../utils/fileUtils';
import * as javaTreeSitterParser from '../../navigator/parsers/javaTreeSitterParser';
import * as javaLSHelper from '../../utils/javaLSHelper';

describe('javaFieldParser Unit Tests', () => {
    let readFileStub: sinon.SinonStub;

    beforeEach(() => {
        readFileStub = sinon.stub(fileUtils, 'readFile');
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('extractJavaFields', () => {
        it('should extract all fields from a simple class', async () => {
            const mockContent = `
package com.example;

public class User {
    private Long id;
    private String name;
    private Integer age;
    private String email;
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaFields('/fake/path/User.java');
            assert.strictEqual(result.length, 4);
            assert.strictEqual(result[0].name, 'id');
            assert.strictEqual(result[0].fieldType, 'Long');
            assert.strictEqual(result[1].name, 'name');
            assert.strictEqual(result[1].fieldType, 'String');
            assert.strictEqual(result[2].name, 'age');
            assert.strictEqual(result[2].fieldType, 'Integer');
            assert.strictEqual(result[3].name, 'email');
            assert.strictEqual(result[3].fieldType, 'String');
        });

        it('should handle fields with different access modifiers', async () => {
            const mockContent = `
package com.example;

public class User {
    private Long id;
    protected String name;
    public Integer age;
    String email;
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaFields('/fake/path/User.java');
            assert.strictEqual(result.length, 4);
        });

        it('should handle fields with initialization', async () => {
            const mockContent = `
package com.example;

public class User {
    private Long id = 0L;
    private String name = "default";
    private Integer age = 18;
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaFields('/fake/path/User.java');
            assert.strictEqual(result.length, 3);
            assert.strictEqual(result[0].name, 'id');
            assert.strictEqual(result[1].name, 'name');
            assert.strictEqual(result[2].name, 'age');
        });

        it('should handle generic types', async () => {
            const mockContent = `
package com.example;

public class User {
    private List<String> hobbies;
    private Map<String, Object> metadata;
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaFields('/fake/path/User.java');
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'hobbies');
            assert.strictEqual(result[1].name, 'metadata');
        });

        it('should skip methods (declarations with parentheses)', async () => {
            const mockContent = `
package com.example;

public class User {
    private Long id;
    private String name;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaFields('/fake/path/User.java');
            assert.strictEqual(result.length, 2); // Only fields, not methods
            assert.strictEqual(result[0].name, 'id');
            assert.strictEqual(result[1].name, 'name');
        });

        it('should return empty array for non-class files', async () => {
            const mockContent = `
package com.example;

public interface UserMapper {
    User selectById(Long id);
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractJavaFields('/fake/path/UserMapper.java');
            assert.strictEqual(result.length, 0);
        });
    });

    describe('findJavaField', () => {
        it('should find specific field by name', async () => {
            const mockContent = `
package com.example;

public class User {
    private Long id;
    private String name;
    private Integer age;
}
`;
            readFileStub.resolves(mockContent);

            const result = await findJavaField('/fake/path/User.java', 'name');
            assert.ok(result !== null);
            assert.strictEqual(result.name, 'name');
            assert.strictEqual(result.fieldType, 'String');
        });

        it('should return null for non-existent field', async () => {
            const mockContent = `
package com.example;

public class User {
    private Long id;
    private String name;
}
`;
            readFileStub.resolves(mockContent);

            const result = await findJavaField('/fake/path/User.java', 'nonExistentField');
            assert.strictEqual(result, null);
        });
    });

    describe('findJavaFieldPosition', () => {
        it('should find field position with line and column', async () => {
            const mockContent = `
package com.example;

public class User {
    private Long id;
    private String name;
}
`;
            readFileStub.resolves(mockContent);

            const result = await findJavaFieldPosition('/fake/path/User.java', 'name');
            assert.ok(result !== null);
            assert.strictEqual(result.line, 5);
            const line = mockContent.split('\n')[5];
            const expectedStartColumn = line.indexOf('name');
            assert.strictEqual(result.startColumn, expectedStartColumn);
            assert.strictEqual(result.endColumn, expectedStartColumn + 'name'.length);
        });

        it('should return null for non-existent field', async () => {
            const mockContent = `
package com.example;

public class User {
    private Long id;
}
`;
            readFileStub.resolves(mockContent);

            const result = await findJavaFieldPosition('/fake/path/User.java', 'nonExistent');
            assert.strictEqual(result, null);
        });
    });

    // ==================== Three-tier fallback chain ====================

    describe('Three-tier fallback chain', () => {
        let extractFieldsFromASTStub: sinon.SinonStub;
        let getClassFieldsViaLSStub: sinon.SinonStub;

        const MOCK_CONTENT = `
package com.example;

public class User {
    private Long id;
    private String name;
}
`;

        const AST_FIELDS = [
            { name: 'id', fieldType: 'Long', line: 4, startColumn: 16, endColumn: 18 },
            { name: 'name', fieldType: 'String', line: 5, startColumn: 19, endColumn: 23 },
        ];

        const LS_FIELDS = [
            { name: 'id', fieldType: 'Long', line: 4, startColumn: 16, endColumn: 18 },
            { name: 'name', fieldType: 'String', line: 5, startColumn: 19, endColumn: 23 },
            { name: 'email', fieldType: 'String', line: 6, startColumn: 19, endColumn: 24 },
        ];

        beforeEach(() => {
            extractFieldsFromASTStub = sinon.stub(javaTreeSitterParser, 'extractFieldsFromAST');
            getClassFieldsViaLSStub = sinon.stub(javaLSHelper, 'getClassFieldsViaLS');
        });

        it('should use Tier 1 (AST) result and not call Tier 2', async () => {
            readFileStub.resolves(MOCK_CONTENT);
            extractFieldsFromASTStub.resolves(AST_FIELDS);

            const result = await extractJavaFields('/fake/User.java');
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'id');
            assert.strictEqual(getClassFieldsViaLSStub.called, false);
        });

        it('should fall to Tier 2 (LS) when Tier 1 throws', async () => {
            readFileStub.resolves(MOCK_CONTENT);
            extractFieldsFromASTStub.rejects(new Error('WASM not initialized'));
            getClassFieldsViaLSStub.resolves(LS_FIELDS);

            const result = await extractJavaFields('/fake/User.java');
            assert.strictEqual(result.length, 3);
            assert.strictEqual(result[2].name, 'email');
        });

        it('should fall to Tier 3 (Regex) when Tier 1 throws and Tier 2 returns null', async () => {
            readFileStub.resolves(MOCK_CONTENT);
            extractFieldsFromASTStub.rejects(new Error('WASM fail'));
            getClassFieldsViaLSStub.resolves(null);

            const result = await extractJavaFields('/fake/User.java');
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'id');
            assert.strictEqual(result[1].name, 'name');
        });

        it('should fall to Tier 3 (Regex) when both Tier 1 and Tier 2 throw', async () => {
            readFileStub.resolves(MOCK_CONTENT);
            extractFieldsFromASTStub.rejects(new Error('WASM fail'));
            getClassFieldsViaLSStub.rejects(new Error('LS crashed'));

            const result = await extractJavaFields('/fake/User.java');
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'id');
        });

        it('should NOT fallback when Tier 1 returns empty array', async () => {
            readFileStub.resolves(MOCK_CONTENT);
            extractFieldsFromASTStub.resolves([]);

            const result = await extractJavaFields('/fake/User.java');
            assert.strictEqual(result.length, 0);
            assert.strictEqual(getClassFieldsViaLSStub.called, false);
        });

        it('should preserve Tier 2 JavaField shape correctly', async () => {
            readFileStub.resolves(MOCK_CONTENT);
            extractFieldsFromASTStub.rejects(new Error('WASM fail'));
            getClassFieldsViaLSStub.resolves([
                { name: 'status', fieldType: 'Integer', line: 7, startColumn: 20, endColumn: 26 }
            ]);

            const result = await extractJavaFields('/fake/User.java');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'status');
            assert.strictEqual(result[0].fieldType, 'Integer');
            assert.strictEqual(result[0].line, 7);
            assert.strictEqual(result[0].startColumn, 20);
            assert.strictEqual(result[0].endColumn, 26);
        });

        it('should find specific field via Tier 2 fallback (findJavaField)', async () => {
            readFileStub.resolves(MOCK_CONTENT);
            extractFieldsFromASTStub.rejects(new Error('WASM fail'));
            getClassFieldsViaLSStub.resolves(LS_FIELDS);

            const result = await findJavaField('/fake/User.java', 'email');
            assert.ok(result !== null);
            assert.strictEqual(result.name, 'email');
            assert.strictEqual(result.fieldType, 'String');
        });

        it('should return null when Tier 2 has no matching field (findJavaField)', async () => {
            readFileStub.resolves(MOCK_CONTENT);
            extractFieldsFromASTStub.rejects(new Error('WASM fail'));
            getClassFieldsViaLSStub.resolves(LS_FIELDS);

            const result = await findJavaField('/fake/User.java', 'nonExistent');
            assert.strictEqual(result, null);
        });

        it('should return position from Tier 2 fallback (findJavaFieldPosition)', async () => {
            readFileStub.resolves(MOCK_CONTENT);
            extractFieldsFromASTStub.rejects(new Error('WASM fail'));
            getClassFieldsViaLSStub.resolves(LS_FIELDS);

            const result = await findJavaFieldPosition('/fake/User.java', 'name');
            assert.ok(result !== null);
            assert.strictEqual(result.line, 5);
            assert.strictEqual(result.startColumn, 19);
            assert.strictEqual(result.endColumn, 23);
        });
    });

    describe('extractJavaFieldsRegex - edge cases (both AST and LS forced to throw)', () => {
        let extractFieldsFromASTStub: sinon.SinonStub;
        let getClassFieldsViaLSStub: sinon.SinonStub;

        beforeEach(() => {
            extractFieldsFromASTStub = sinon.stub(javaTreeSitterParser, 'extractFieldsFromAST')
                .rejects(new Error('WASM fail'));
            getClassFieldsViaLSStub = sinon.stub(javaLSHelper, 'getClassFieldsViaLS')
                .rejects(new Error('LS fail'));
        });

        it('should extract field from "private static String instance;" (regex captures type=String, name=instance)', async () => {
            const mockContent = `
package com.example;

public class Config {
    private static String instance;
}
`;
            readFileStub.resolves(mockContent);
            const result = await extractJavaFields('/fake/Config.java');
            // Regex: matches "static String instance;" - type=String, name=instance
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'instance');
            assert.strictEqual(result[0].fieldType, 'String');
        });

        it('should extract field from "private final Long id;"', async () => {
            const mockContent = `
package com.example;

public class Entity {
    private final Long id;
}
`;
            readFileStub.resolves(mockContent);
            const result = await extractJavaFields('/fake/Entity.java');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'id');
            assert.strictEqual(result[0].fieldType, 'Long');
        });

        it('should SKIP inline-annotated field "@Column private String name;" (startsWith @ check)', async () => {
            // Line starts with @Column, so the entire line is skipped
            const mockContent = `
package com.example;

public class User {
    @Column private String name;
    private Long id;
}
`;
            readFileStub.resolves(mockContent);
            const result = await extractJavaFields('/fake/User.java');
            // @Column private String name; is skipped (starts with @)
            // but private Long id; is extracted
            const fieldNames = result.map(f => f.name);
            assert.ok(!fieldNames.includes('name'), 'Inline-annotated field should be skipped');
            assert.ok(fieldNames.includes('id'));
        });

        it('should NOT extract array type field "private String[] names;" (regex limitation)', async () => {
            // The regex /(?:...)?\s*(\w+(?:<[^>]+>)?)\s+(\w+)\s*[;=]/ does not match String[]
            const mockContent = `
package com.example;

public class Data {
    private String[] names;
    private Long id;
}
`;
            readFileStub.resolves(mockContent);
            const result = await extractJavaFields('/fake/Data.java');
            const fieldNames = result.map(f => f.name);
            assert.ok(!fieldNames.includes('names'), 'Array fields are a known regex limitation');
            assert.ok(fieldNames.includes('id'));
        });

        it('should extract field with no access modifier "String name;"', async () => {
            const mockContent = `
package com.example;

public class User {
    String name;
}
`;
            readFileStub.resolves(mockContent);
            const result = await extractJavaFields('/fake/User.java');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'name');
        });
    });

    // ==================== Superclass extraction ====================

    describe('extractSuperclassName (AST tier)', () => {
        it('should extract superclass name', async () => {
            const mockContent = `
package com.example;

public class Role extends BaseEntity {
    private String roleName;
}
`;
            readFileStub.resolves(mockContent);
            const result = await extractSuperclassName('/fake/Role.java');
            assert.strictEqual(result, 'BaseEntity');
        });

        it('should return null when class extends nothing', async () => {
            const mockContent = `
package com.example;

public class Role {
    private String roleName;
}
`;
            readFileStub.resolves(mockContent);
            const result = await extractSuperclassName('/fake/Role.java');
            assert.strictEqual(result, null);
        });
    });

    describe('extractSuperclassName (regex fallback, AST forced to throw)', () => {
        beforeEach(() => {
            sinon.stub(javaTreeSitterParser, 'extractSuperclassNameFromAST')
                .rejects(new Error('WASM fail'));
        });

        it('should extract simple superclass name', async () => {
            const mockContent = `
package com.example;

public class Role extends BaseEntity {
    private String roleName;
}
`;
            readFileStub.resolves(mockContent);
            const result = await extractSuperclassName('/fake/Role.java');
            assert.strictEqual(result, 'BaseEntity');
        });

        it('should extract superclass name without generic type arguments', async () => {
            const mockContent = `
package com.example;

public class Role extends BaseEntity<Long> {
    private String roleName;
}
`;
            readFileStub.resolves(mockContent);
            const result = await extractSuperclassName('/fake/Role.java');
            assert.strictEqual(result, 'BaseEntity');
        });

        it('should extract fully-qualified superclass name', async () => {
            const mockContent = `
package com.example;

public class Role extends com.example.entity.BaseEntity {
    private String roleName;
}
`;
            readFileStub.resolves(mockContent);
            const result = await extractSuperclassName('/fake/Role.java');
            assert.strictEqual(result, 'com.example.entity.BaseEntity');
        });

        it('should not capture bounded type parameter as superclass', async () => {
            const mockContent = `
package com.example;

public class Holder<T extends Number> extends BaseHolder {
    private T value;
}
`;
            readFileStub.resolves(mockContent);
            const result = await extractSuperclassName('/fake/Holder.java');
            assert.strictEqual(result, 'BaseHolder');
        });

        it('should return null for class that only implements interfaces', async () => {
            const mockContent = `
package com.example;

public class Role implements Serializable {
    private String roleName;
}
`;
            readFileStub.resolves(mockContent);
            const result = await extractSuperclassName('/fake/Role.java');
            assert.strictEqual(result, null);
        });

        it('should handle multi-line class declarations', async () => {
            const mockContent = `
package com.example;

public class Role
        extends BaseEntity {
    private String roleName;
}
`;
            readFileStub.resolves(mockContent);
            const result = await extractSuperclassName('/fake/Role.java');
            assert.strictEqual(result, 'BaseEntity');
        });
    });
});
