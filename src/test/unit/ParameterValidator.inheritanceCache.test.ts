/**
 * Unit tests for ParameterValidator field caching with inherited fields (issue #50)
 *
 * Verifies that getClassFields resolves fields through the class hierarchy walker
 * and that editing a superclass invalidates cached entries of its subclasses.
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ParameterValidator } from '../../navigator/diagnostics/ParameterValidator';
import * as javaFieldHierarchy from '../../utils/javaFieldHierarchy';

describe('ParameterValidator Inherited Field Caching', () => {
    const CHILD_FQN = 'com.example.query.TaskQuery';
    const PARENT_FQN = 'com.example.entity.BaseEntity';

    let walkerStub: sinon.SinonStub;
    // Typed as any to reach the private getClassFields/invalidateFieldCache under test
    let validator: any;

    beforeEach(() => {
        walkerStub = sinon.stub(javaFieldHierarchy, 'getClassFieldsWithInheritance').resolves({
            fields: [
                {
                    field: { name: 'taskName', fieldType: 'String', line: 5, startColumn: 19, endColumn: 27 },
                    filePath: '/fake/TaskQuery.java',
                    className: CHILD_FQN
                },
                {
                    field: { name: 'createdBy', fieldType: 'String', line: 4, startColumn: 19, endColumn: 28 },
                    filePath: '/fake/BaseEntity.java',
                    className: PARENT_FQN
                }
            ],
            classChain: [CHILD_FQN, PARENT_FQN]
        });

        const mockContext = {
            subscriptions: { push: () => {} }
        };
        const mockFileMapper = {
            getJavaPath: () => Promise.resolve(null)
        };

        validator = new ParameterValidator(mockContext as any, mockFileMapper as any);
    });

    afterEach(() => {
        validator.dispose();
        sinon.restore();
    });

    it('should return own and inherited field names', async () => {
        const fields = await validator.getClassFields(CHILD_FQN);
        assert.deepStrictEqual(fields, ['taskName', 'createdBy']);
    });

    it('should cache results per class', async () => {
        await validator.getClassFields(CHILD_FQN);
        await validator.getClassFields(CHILD_FQN);
        assert.strictEqual(walkerStub.callCount, 1, 'Second call should hit the cache');
    });

    it('should invalidate the cached entry when the subclass file changes', async () => {
        await validator.getClassFields(CHILD_FQN);

        validator.invalidateFieldCache('/project/src/main/java/com/example/query/TaskQuery.java');

        await validator.getClassFields(CHILD_FQN);
        assert.strictEqual(walkerStub.callCount, 2, 'Cache entry should be gone after subclass edit');
    });

    it('should invalidate the subclass cached entry when a superclass file changes', async () => {
        await validator.getClassFields(CHILD_FQN);

        validator.invalidateFieldCache('/project/src/main/java/com/example/entity/BaseEntity.java');

        await validator.getClassFields(CHILD_FQN);
        assert.strictEqual(walkerStub.callCount, 2, 'Superclass edit should invalidate the subclass entry');
    });

    it('should keep the cached entry when an unrelated class changes', async () => {
        await validator.getClassFields(CHILD_FQN);

        validator.invalidateFieldCache('/project/src/main/java/com/example/Other.java');

        await validator.getClassFields(CHILD_FQN);
        assert.strictEqual(walkerStub.callCount, 1, 'Unrelated edit should not invalidate the entry');
    });

    it('should re-register hierarchy dependents after re-walking', async () => {
        await validator.getClassFields(CHILD_FQN);

        // First parent edit invalidates; re-walk must register dependents again
        validator.invalidateFieldCache('/project/src/main/java/com/example/entity/BaseEntity.java');
        await validator.getClassFields(CHILD_FQN);

        // Second parent edit must invalidate again
        validator.invalidateFieldCache('/project/src/main/java/com/example/entity/BaseEntity.java');
        await validator.getClassFields(CHILD_FQN);

        assert.strictEqual(walkerStub.callCount, 3);
    });

    it('should revalidate open XML documents when a Java file is saved', () => {
        const saveHandlers: ((doc: unknown) => void)[] = [];
        const originalOnSave = vscode.workspace.onDidSaveTextDocument;
        (vscode.workspace as any).onDidSaveTextDocument = (callback: (doc: unknown) => void) => {
            saveHandlers.push(callback);
            return { dispose: () => {} };
        };

        try {
            const mockContext = { subscriptions: { push: () => {} } };
            const mockFileMapper = { getJavaPath: () => Promise.resolve(null) };
            const localValidator: any = new ParameterValidator(mockContext as any, mockFileMapper as any);

            const revalidateSpy = sinon.spy(localValidator, 'revalidateOpenXmlDocuments');

            saveHandlers.forEach(handler => handler({
                languageId: 'java',
                uri: { fsPath: '/project/src/main/java/com/example/entity/BaseEntity.java' }
            }));

            assert.ok(revalidateSpy.called,
                'Saving a Java file must trigger revalidation of open XML documents');

            localValidator.dispose();
        } finally {
            (vscode.workspace as any).onDidSaveTextDocument = originalOnSave;
        }
    });
});
