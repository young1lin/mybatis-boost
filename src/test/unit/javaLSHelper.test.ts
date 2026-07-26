/**
 * Unit tests for javaLSHelper
 * Tests the Java Language Server integration layer (Tier 2 of three-tier fallback)
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as javaExtensionAPI from '../../utils/javaExtensionAPI';
import { isJavaLSReady, resolveTypeViaLS, getClassFieldsViaLS } from '../../utils/javaLSHelper';

describe('javaLSHelper Unit Tests', () => {
    let getJavaExtensionAPIStub: sinon.SinonStub;
    let executeCommandStub: sinon.SinonStub;

    beforeEach(() => {
        getJavaExtensionAPIStub = sinon.stub(javaExtensionAPI, 'getJavaExtensionAPI');
        executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
    });

    afterEach(() => {
        sinon.restore();
    });

    // ==================== isJavaLSReady ====================

    describe('isJavaLSReady', () => {
        it('should return true when Java LS is ready', async () => {
            getJavaExtensionAPIStub.resolves({
                serverReady: () => Promise.resolve()
            });

            const result = await isJavaLSReady();
            assert.strictEqual(result, true);
        });

        it('should return false when extension is not installed', async () => {
            getJavaExtensionAPIStub.resolves(null);

            const result = await isJavaLSReady();
            assert.strictEqual(result, false);
        });

        it('should return false when getJavaExtensionAPI throws', async () => {
            getJavaExtensionAPIStub.rejects(new Error('Extension load failed'));

            const result = await isJavaLSReady();
            assert.strictEqual(result, false);
        });

        it('should return false when serverReady times out', async function () {
            this.timeout(10000);
            const clock = sinon.useFakeTimers({
                shouldAdvanceTime: false,
                toFake: ['setTimeout']
            });
            getJavaExtensionAPIStub.resolves({
                serverReady: () => new Promise(() => { /* never resolves */ })
            });

            const readyPromise = isJavaLSReady();
            await clock.tickAsync(5001);
            const result = await readyPromise;
            assert.strictEqual(result, false);

            clock.restore();
        });

        it('should return false when serverReady rejects', async () => {
            getJavaExtensionAPIStub.resolves({
                serverReady: () => Promise.reject(new Error('Server crashed'))
            });

            const result = await isJavaLSReady();
            assert.strictEqual(result, false);
        });
    });

    // ==================== resolveTypeViaLS ====================

    describe('resolveTypeViaLS', () => {
        function createSymbolInfo(
            name: string,
            kind: number,
            containerName: string | undefined
        ) {
            return {
                name,
                kind,
                containerName,
                location: {
                    uri: vscode.Uri.file('/fake/path'),
                    range: new vscode.Range(
                        new vscode.Position(0, 0),
                        new vscode.Position(0, 0)
                    )
                }
            };
        }

        function stubLSReady() {
            getJavaExtensionAPIStub.resolves({
                serverReady: () => Promise.resolve()
            });
        }

        it('should resolve Class symbol (kind=4) to FQN', async () => {
            stubLSReady();
            executeCommandStub.resolves([
                createSymbolInfo('User', vscode.SymbolKind.Class, 'com.example.entity')
            ]);

            const result = await resolveTypeViaLS('User');
            assert.strictEqual(result, 'com.example.entity.User');
        });

        it('should resolve Interface symbol (kind=10) to FQN', async () => {
            stubLSReady();
            executeCommandStub.resolves([
                createSymbolInfo('UserMapper', vscode.SymbolKind.Interface, 'com.example.mapper')
            ]);

            const result = await resolveTypeViaLS('UserMapper');
            assert.strictEqual(result, 'com.example.mapper.UserMapper');
        });

        it('should resolve Enum symbol (kind=9) to FQN', async () => {
            stubLSReady();
            executeCommandStub.resolves([
                createSymbolInfo('Status', vscode.SymbolKind.Enum, 'com.example.enums')
            ]);

            const result = await resolveTypeViaLS('Status');
            assert.strictEqual(result, 'com.example.enums.Status');
        });

        it('should return null for empty symbols array', async () => {
            stubLSReady();
            executeCommandStub.resolves([]);

            const result = await resolveTypeViaLS('User');
            assert.strictEqual(result, null);
        });

        it('should return null for undefined symbols', async () => {
            stubLSReady();
            executeCommandStub.resolves(undefined);

            const result = await resolveTypeViaLS('User');
            assert.strictEqual(result, null);
        });

        it('should filter non-Class/Interface/Enum symbols (Method kind=5)', async () => {
            stubLSReady();
            executeCommandStub.resolves([
                createSymbolInfo('User', vscode.SymbolKind.Method, 'com.example')
            ]);

            const result = await resolveTypeViaLS('User');
            assert.strictEqual(result, null);
        });

        it('should filter non-exact name matches', async () => {
            stubLSReady();
            executeCommandStub.resolves([
                createSymbolInfo('UserInfo', vscode.SymbolKind.Class, 'com.example')
            ]);

            const result = await resolveTypeViaLS('User');
            assert.strictEqual(result, null);
        });

        it('should return null when containerName is empty string', async () => {
            stubLSReady();
            executeCommandStub.resolves([
                createSymbolInfo('User', vscode.SymbolKind.Class, '')
            ]);

            const result = await resolveTypeViaLS('User');
            assert.strictEqual(result, null);
        });

        it('should return null when containerName is undefined', async () => {
            stubLSReady();
            executeCommandStub.resolves([
                createSymbolInfo('User', vscode.SymbolKind.Class, undefined)
            ]);

            const result = await resolveTypeViaLS('User');
            assert.strictEqual(result, null);
        });

        it('should return first match when multiple symbols found', async () => {
            stubLSReady();
            executeCommandStub.resolves([
                createSymbolInfo('User', vscode.SymbolKind.Class, 'com.example.entity'),
                createSymbolInfo('User', vscode.SymbolKind.Class, 'com.other.model')
            ]);

            const result = await resolveTypeViaLS('User');
            assert.strictEqual(result, 'com.example.entity.User');
        });

        it('should return null when LS is not available', async () => {
            getJavaExtensionAPIStub.resolves(null);

            const result = await resolveTypeViaLS('User');
            assert.strictEqual(result, null);
        });

        it('should return null when executeCommand throws', async () => {
            stubLSReady();
            executeCommandStub.rejects(new Error('Command failed'));

            const result = await resolveTypeViaLS('User');
            assert.strictEqual(result, null);
        });
    });

    // ==================== getClassFieldsViaLS ====================

    describe('getClassFieldsViaLS', () => {
        function createDocumentSymbol(
            name: string,
            detail: string | undefined,
            kind: number,
            startLine: number,
            startChar: number,
            endChar: number,
            children: any[]
        ) {
            return {
                name,
                detail: detail,
                kind,
                range: new vscode.Range(
                    new vscode.Position(startLine, 0),
                    new vscode.Position(startLine + 10, 0)
                ),
                selectionRange: new vscode.Range(
                    new vscode.Position(startLine, startChar),
                    new vscode.Position(startLine, endChar)
                ),
                children
            };
        }

        function stubLSReady() {
            getJavaExtensionAPIStub.resolves({
                serverReady: () => Promise.resolve()
            });
        }

        const USER_CLASS_SYMBOL = () => createDocumentSymbol(
            'User', '', vscode.SymbolKind.Class, 3, 13, 17, [
                createDocumentSymbol('id', 'Long', vscode.SymbolKind.Field, 4, 16, 18, []),
                createDocumentSymbol('name', 'String', vscode.SymbolKind.Field, 5, 19, 23, []),
                createDocumentSymbol('email', 'String', vscode.SymbolKind.Field, 6, 19, 24, []),
                createDocumentSymbol('getId', 'Long', vscode.SymbolKind.Method, 8, 16, 21, []),
                createDocumentSymbol('setId', 'void', vscode.SymbolKind.Method, 12, 16, 21, []),
            ]
        );

        it('should extract fields from User class (skipping Methods)', async () => {
            stubLSReady();
            executeCommandStub.resolves([USER_CLASS_SYMBOL()]);

            const result = await getClassFieldsViaLS('/fake/User.java');
            assert.ok(result !== null);
            assert.strictEqual(result.length, 3);
            assert.strictEqual(result[0].name, 'id');
            assert.strictEqual(result[1].name, 'name');
            assert.strictEqual(result[2].name, 'email');
        });

        it('should only return the named class symbol\'s fields when className is given', async () => {
            stubLSReady();
            const helperSymbol = createDocumentSymbol(
                'Helper', '', vscode.SymbolKind.Class, 20, 13, 19, [
                    createDocumentSymbol('helperField', 'String', vscode.SymbolKind.Field, 21, 19, 30, []),
                ]
            );
            executeCommandStub.resolves([USER_CLASS_SYMBOL(), helperSymbol]);

            const result = await getClassFieldsViaLS('/fake/User.java', 'User');
            assert.ok(result !== null);
            assert.deepStrictEqual(result.map(f => f.name), ['id', 'name', 'email']);
        });

        it('should map detail to fieldType correctly', async () => {
            stubLSReady();
            executeCommandStub.resolves([USER_CLASS_SYMBOL()]);

            const result = await getClassFieldsViaLS('/fake/User.java');
            assert.ok(result !== null);
            assert.strictEqual(result[0].fieldType, 'Long');
            assert.strictEqual(result[1].fieldType, 'String');
            assert.strictEqual(result[2].fieldType, 'String');
        });

        it('should map selectionRange to line/startColumn/endColumn', async () => {
            stubLSReady();
            executeCommandStub.resolves([USER_CLASS_SYMBOL()]);

            const result = await getClassFieldsViaLS('/fake/User.java');
            assert.ok(result !== null);
            assert.strictEqual(result[0].line, 4);
            assert.strictEqual(result[0].startColumn, 16);
            assert.strictEqual(result[0].endColumn, 18);
        });

        it('should use "unknown" when detail is empty string', async () => {
            stubLSReady();
            const classSymbol = createDocumentSymbol(
                'Foo', '', vscode.SymbolKind.Class, 0, 0, 3, [
                    createDocumentSymbol('bar', '', vscode.SymbolKind.Field, 1, 4, 7, [])
                ]
            );
            executeCommandStub.resolves([classSymbol]);

            const result = await getClassFieldsViaLS('/fake/Foo.java');
            assert.ok(result !== null);
            assert.strictEqual(result[0].fieldType, 'unknown');
        });

        it('should use "unknown" when detail is undefined', async () => {
            stubLSReady();
            const classSymbol = createDocumentSymbol(
                'Foo', '', vscode.SymbolKind.Class, 0, 0, 3, [
                    createDocumentSymbol('bar', undefined, vscode.SymbolKind.Field, 1, 4, 7, [])
                ]
            );
            executeCommandStub.resolves([classSymbol]);

            const result = await getClassFieldsViaLS('/fake/Foo.java');
            assert.ok(result !== null);
            assert.strictEqual(result[0].fieldType, 'unknown');
        });

        it('should extract fields from Interface symbol (kind=10)', async () => {
            stubLSReady();
            const interfaceSymbol = createDocumentSymbol(
                'UserDTO', '', vscode.SymbolKind.Interface, 0, 0, 7, [
                    createDocumentSymbol('name', 'String', vscode.SymbolKind.Field, 1, 4, 8, [])
                ]
            );
            executeCommandStub.resolves([interfaceSymbol]);

            const result = await getClassFieldsViaLS('/fake/UserDTO.java');
            assert.ok(result !== null);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'name');
        });

        it('should skip Enum symbol (kind=9) — code only handles Class/Interface', async () => {
            stubLSReady();
            const enumSymbol = createDocumentSymbol(
                'Status', '', vscode.SymbolKind.Enum, 0, 0, 6, [
                    createDocumentSymbol('ACTIVE', 'Status', vscode.SymbolKind.Field, 1, 4, 10, [])
                ]
            );
            executeCommandStub.resolves([enumSymbol]);

            const result = await getClassFieldsViaLS('/fake/Status.java');
            assert.strictEqual(result, null);
        });

        it('should return null for empty symbols array', async () => {
            stubLSReady();
            executeCommandStub.resolves([]);

            const result = await getClassFieldsViaLS('/fake/User.java');
            assert.strictEqual(result, null);
        });

        it('should return null for undefined symbols', async () => {
            stubLSReady();
            executeCommandStub.resolves(undefined);

            const result = await getClassFieldsViaLS('/fake/User.java');
            assert.strictEqual(result, null);
        });

        it('should return null when LS is not available', async () => {
            getJavaExtensionAPIStub.resolves(null);

            const result = await getClassFieldsViaLS('/fake/User.java');
            assert.strictEqual(result, null);
        });

        it('should return null when executeCommand throws', async () => {
            stubLSReady();
            executeCommandStub.rejects(new Error('Command failed'));

            const result = await getClassFieldsViaLS('/fake/User.java');
            assert.strictEqual(result, null);
        });

        it('should merge fields from multiple Class symbols', async () => {
            stubLSReady();
            const class1 = createDocumentSymbol(
                'User', '', vscode.SymbolKind.Class, 0, 0, 4, [
                    createDocumentSymbol('id', 'Long', vscode.SymbolKind.Field, 1, 4, 6, [])
                ]
            );
            const class2 = createDocumentSymbol(
                'Address', '', vscode.SymbolKind.Class, 10, 0, 7, [
                    createDocumentSymbol('city', 'String', vscode.SymbolKind.Field, 11, 4, 8, [])
                ]
            );
            executeCommandStub.resolves([class1, class2]);

            const result = await getClassFieldsViaLS('/fake/User.java');
            assert.ok(result !== null);
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'id');
            assert.strictEqual(result[1].name, 'city');
        });

        it('should handle children being undefined', async () => {
            stubLSReady();
            const classSymbol = {
                name: 'Empty',
                detail: '',
                kind: vscode.SymbolKind.Class,
                range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(5, 0)),
                selectionRange: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 5)),
                children: undefined as any
            };
            executeCommandStub.resolves([classSymbol]);

            const result = await getClassFieldsViaLS('/fake/Empty.java');
            assert.strictEqual(result, null);
        });

        it('should return null when Class has only Methods, no Fields', async () => {
            stubLSReady();
            const classSymbol = createDocumentSymbol(
                'Service', '', vscode.SymbolKind.Class, 0, 0, 7, [
                    createDocumentSymbol('doWork', 'void', vscode.SymbolKind.Method, 1, 4, 10, []),
                    createDocumentSymbol('init', 'void', vscode.SymbolKind.Method, 5, 4, 8, []),
                ]
            );
            executeCommandStub.resolves([classSymbol]);

            const result = await getClassFieldsViaLS('/fake/Service.java');
            assert.strictEqual(result, null);
        });
    });
});
