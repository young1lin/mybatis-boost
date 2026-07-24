/**
 * Unit tests for javaFieldHierarchy - inherited field resolution (issue #50)
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    getClassFieldsWithInheritance,
    findFieldInHierarchy
} from '../../utils/javaFieldHierarchy';
import * as navigationUtils from '../../utils/navigationUtils';
import * as javaTypeResolver from '../../utils/javaTypeResolver';
import * as fileUtils from '../../utils/fileUtils';

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures', 'parameter-validation');

const TASK_QUERY_PATH = path.join(FIXTURES_DIR, 'TaskQuery.java');
const AUDIT_ENTITY_PATH = path.join(FIXTURES_DIR, 'AuditEntity.java');
const BASE_ENTITY_PATH = path.join(FIXTURES_DIR, 'BaseEntity.java');

const TASK_QUERY_FQN = 'com.example.query.TaskQuery';
const AUDIT_ENTITY_FQN = 'com.example.audit.AuditEntity';
const BASE_ENTITY_FQN = 'com.example.entity.BaseEntity';

describe('javaFieldHierarchy Unit Tests', () => {
    afterEach(() => {
        sinon.restore();
    });

    /**
     * These tests use the real fixture files on disk. Only class-file lookup is
     * stubbed (the mocha vscode mock cannot glob the workspace); field extraction
     * and superclass FQN resolution run the real code paths.
     */
    describe('with real fixture files (three-level hierarchy)', () => {
        beforeEach(() => {
            const classFiles: Record<string, string> = {
                [TASK_QUERY_FQN]: TASK_QUERY_PATH,
                [AUDIT_ENTITY_FQN]: AUDIT_ENTITY_PATH,
                [BASE_ENTITY_FQN]: BASE_ENTITY_PATH
            };
            sinon.stub(navigationUtils, 'findJavaClassFile').callsFake(
                async (className: string) => {
                    const filePath = classFiles[className];
                    return filePath ? vscode.Uri.file(filePath) : null;
                }
            );
        });

        it('should collect own and inherited fields across the whole chain', async () => {
            const result = await getClassFieldsWithInheritance(TASK_QUERY_FQN);

            const fieldNames = result.fields.map(f => f.field.name);
            assert.deepStrictEqual(
                fieldNames.sort(),
                ['astOnlyField', 'createTime', 'createdBy', 'id', 'status', 'taskName', 'updatedBy']
            );
        });

        it('should record the declaring file for each field', async () => {
            const result = await getClassFieldsWithInheritance(TASK_QUERY_FQN);
            const byName = new Map(result.fields.map(f => [f.field.name, f]));

            assert.strictEqual(byName.get('taskName')?.filePath, TASK_QUERY_PATH);
            assert.strictEqual(byName.get('taskName')?.className, TASK_QUERY_FQN);
            assert.strictEqual(byName.get('updatedBy')?.filePath, AUDIT_ENTITY_PATH);
            assert.strictEqual(byName.get('updatedBy')?.className, AUDIT_ENTITY_FQN);
            assert.strictEqual(byName.get('createdBy')?.filePath, BASE_ENTITY_PATH);
            assert.strictEqual(byName.get('createdBy')?.className, BASE_ENTITY_FQN);
            // Field declared with the class's own generic type parameter
            assert.strictEqual(byName.get('id')?.filePath, BASE_ENTITY_PATH);
        });

        it('should report the visited class chain (subclass first)', async () => {
            const result = await getClassFieldsWithInheritance(TASK_QUERY_FQN);
            assert.deepStrictEqual(result.classChain, [
                TASK_QUERY_FQN,
                AUDIT_ENTITY_FQN,
                BASE_ENTITY_FQN
            ]);
        });

        it('findFieldInHierarchy should find an inherited field in its declaring file', async () => {
            const result = await findFieldInHierarchy(TASK_QUERY_FQN, 'createdBy');

            assert.ok(result !== null);
            assert.strictEqual(result.field.name, 'createdBy');
            assert.strictEqual(result.filePath, BASE_ENTITY_PATH);
            assert.strictEqual(result.className, BASE_ENTITY_FQN);
            assert.ok(result.field.line > 0);
        });

        it('findFieldInHierarchy should find own fields without walking further', async () => {
            const result = await findFieldInHierarchy(TASK_QUERY_FQN, 'taskName');

            assert.ok(result !== null);
            assert.strictEqual(result.filePath, TASK_QUERY_PATH);
        });

        it('findFieldInHierarchy should return null for unknown fields', async () => {
            const result = await findFieldInHierarchy(TASK_QUERY_FQN, 'doesNotExist');
            assert.strictEqual(result, null);
        });

        it('should return empty result for a class that cannot be found', async () => {
            const result = await getClassFieldsWithInheritance('com.example.Missing');
            assert.deepStrictEqual(result.fields, []);
            assert.deepStrictEqual(result.classChain, []);
        });
    });

    /**
     * Edge cases with fully stubbed file contents and type resolution.
     */
    describe('edge cases (stubbed contents)', () => {
        let readFileStub: sinon.SinonStub;
        let resolveTypeStub: sinon.SinonStub;
        let findClassStub: sinon.SinonStub;

        beforeEach(() => {
            readFileStub = sinon.stub(fileUtils, 'readFile');
            resolveTypeStub = sinon.stub(javaTypeResolver, 'resolveFullyQualifiedType');
            findClassStub = sinon.stub(navigationUtils, 'findJavaClassFile');
        });

        function setupClasses(classes: Record<string, string>): void {
            // Key: simple class name; value: file content
            findClassStub.callsFake(async (className: string) => {
                const simpleName = className.substring(className.lastIndexOf('.') + 1);
                return classes[simpleName] !== undefined
                    ? vscode.Uri.file(`/fake/${simpleName}.java`)
                    : null;
            });
            readFileStub.callsFake(async (filePath: string) => {
                const simpleName = path.basename(filePath, '.java');
                return classes[simpleName] ?? '';
            });
            resolveTypeStub.callsFake(async (_javaPath: string, simpleTypeName: string) =>
                simpleTypeName.includes('.') ? simpleTypeName : `com.example.${simpleTypeName}`
            );
        }

        it('subclass fields should shadow same-named superclass fields', async () => {
            setupClasses({
                Child: `
package com.example;

public class Child extends Parent {
    private String remark;
}
`,
                Parent: `
package com.example;

public class Parent {
    private String remark;
    private Long id;
}
`
            });

            const result = await getClassFieldsWithInheritance('com.example.Child');
            const remarkFields = result.fields.filter(f => f.field.name === 'remark');

            assert.strictEqual(remarkFields.length, 1);
            assert.strictEqual(remarkFields[0].filePath, '/fake/Child.java');
            assert.ok(result.fields.some(f => f.field.name === 'id'));
        });

        it('should stop when the superclass has no source file in the workspace', async () => {
            setupClasses({
                Child: `
package com.example;

public class Child extends LibraryBase {
    private String name;
}
`
                // LibraryBase intentionally missing (third-party class)
            });

            const result = await getClassFieldsWithInheritance('com.example.Child');

            assert.deepStrictEqual(result.fields.map(f => f.field.name), ['name']);
            assert.deepStrictEqual(result.classChain, ['com.example.Child']);
        });

        it('should stop when the superclass name cannot be resolved to a FQN', async () => {
            setupClasses({
                Child: `
package com.example;

public class Child extends Unresolvable {
    private String name;
}
`,
                Unresolvable: 'public class Unresolvable { private Long x; }'
            });
            resolveTypeStub.resolves(null);

            const result = await getClassFieldsWithInheritance('com.example.Child');

            assert.deepStrictEqual(result.fields.map(f => f.field.name), ['name']);
            assert.deepStrictEqual(result.classChain, ['com.example.Child']);
        });

        it('should stop when the superclass resolves to a java.lang type', async () => {
            setupClasses({
                Child: `
package com.example;

public class Child extends Object {
    private String name;
}
`
            });
            resolveTypeStub.callsFake(async (_javaPath: string, simpleTypeName: string) =>
                simpleTypeName === 'Object' ? 'java.lang.Object' : `com.example.${simpleTypeName}`
            );

            const result = await getClassFieldsWithInheritance('com.example.Child');

            assert.deepStrictEqual(result.classChain, ['com.example.Child']);
            assert.strictEqual(findClassStub.callCount, 1);
        });

        it('should walk user classes that shadow java.lang names', async () => {
            // java.lang.Integer is final, so `extends Integer` can only refer
            // to a user class shadowing the name
            setupClasses({
                Child: `
package com.example;

public class Child extends Integer {
    private String name;
}
`,
                Integer: `
package com.example;

public class Integer {
    private Long shadowField;
}
`
            });

            const result = await getClassFieldsWithInheritance('com.example.Child');

            assert.deepStrictEqual(result.classChain, ['com.example.Child', 'com.example.Integer']);
            assert.ok(result.fields.some(f => f.field.name === 'shadowField'),
                'fields of the shadowing user class must be inherited');
        });

        it('should not attribute a secondary class\'s superclass to the visited class', async () => {
            setupClasses({
                Plain: `
package com.example;

public class Plain {
    private Long id;
}

class PlainHelper extends HelperBase {
    private String helperField;
}
`,
                HelperBase: `
package com.example;

public class HelperBase {
    private String wrongField;
}
`
            });

            const result = await getClassFieldsWithInheritance('com.example.Plain');

            assert.deepStrictEqual(result.classChain, ['com.example.Plain']);
            assert.ok(!result.fields.some(f => f.field.name === 'wrongField'),
                'HelperBase fields must not leak into Plain\'s hierarchy');
            assert.ok(!result.fields.some(f => f.field.name === 'helperField'),
                'Same-file sibling class fields must not leak into Plain\'s hierarchy');
            assert.deepStrictEqual(result.fields.map(f => f.field.name), ['id']);
        });

        it('should terminate on cyclic extends chains', async () => {
            setupClasses({
                CycleA: `
package com.example;

public class CycleA extends CycleB {
    private Long aField;
}
`,
                CycleB: `
package com.example;

public class CycleB extends CycleA {
    private Long bField;
}
`
            });

            const result = await getClassFieldsWithInheritance('com.example.CycleA');

            assert.deepStrictEqual(
                result.fields.map(f => f.field.name).sort(),
                ['aField', 'bField']
            );
            assert.deepStrictEqual(result.classChain, ['com.example.CycleA', 'com.example.CycleB']);
        });

        it('should cap the walk at the maximum hierarchy depth', async () => {
            const classes: Record<string, string> = {};
            const chainLength = 15;
            for (let i = 0; i < chainLength; i++) {
                const extendsClause = i < chainLength - 1 ? ` extends C${i + 1}` : '';
                classes[`C${i}`] = `
package com.example;

public class C${i}${extendsClause} {
    private Long field${i};
}
`;
            }
            setupClasses(classes);

            const result = await getClassFieldsWithInheritance('com.example.C0');

            assert.strictEqual(result.classChain.length, 10);
            assert.strictEqual(result.fields.length, 10);
        });
    });
});
