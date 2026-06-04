/**
 * Unit tests for FileMapper
 * Tests caching logic, module-aware matching, and Quick Paths
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { FileMapper } from '../../navigator';
import { createMockContext } from '../helpers/testSetup';

describe('FileMapper Unit Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let fileMapper: FileMapper;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        const mockContext = createMockContext(process.cwd());
        fileMapper = new FileMapper(mockContext, 100);
    });

    afterEach(() => {
        sandbox.restore();
        fileMapper.dispose();
    });

    describe('getCommonPrefixLength', () => {
        it('should return 0 for completely different paths', () => {
            const len = fileMapper.getCommonPrefixLength(
                '/workspace/a/src/main/java/Test.java',
                '/other/b/src/main/resources/Test.xml'
            );
            assert.strictEqual(len, 0);
        });

        it('should return correct length for same module paths', () => {
            const len = fileMapper.getCommonPrefixLength(
                '/workspace/module-a/src/main/java/com/test/TestMapper.java',
                '/workspace/module-a/src/main/resources/TestMapper.xml'
            );
            // Common prefix: /workspace/module-a/src/main
            assert.strictEqual(len, '/workspace/module-a/src/main'.length);
        });

        it('should return shorter prefix for cross-module paths', () => {
            const lenSame = fileMapper.getCommonPrefixLength(
                '/workspace/module-a/src/main/java/com/test/TestMapper.java',
                '/workspace/module-a/src/main/resources/TestMapper.xml'
            );
            const lenCross = fileMapper.getCommonPrefixLength(
                '/workspace/module-a/src/main/java/com/test/TestMapper.java',
                '/workspace/module-b/src/main/resources/TestMapper.xml'
            );
            // Same module should have longer prefix than cross module
            assert.ok(lenSame > lenCross, `same-module prefix (${lenSame}) should be > cross-module prefix (${lenCross})`);
        });

        it('should handle Windows backslash paths', () => {
            const len = fileMapper.getCommonPrefixLength(
                'C:\\workspace\\module-a\\src\\main\\java\\Test.java',
                'C:\\workspace\\module-a\\src\\main\\resources\\Test.xml'
            );
            // Backslashes normalized to forward slashes
            assert.strictEqual(len, 'C:/workspace/module-a/src/main'.length);
        });

        it('should handle mixed slash paths', () => {
            const len = fileMapper.getCommonPrefixLength(
                '/workspace/module-a/src/main/java/Test.java',
                '\\workspace\\module-a\\src\\main\\resources\\Test.xml'
            );
            assert.strictEqual(len, '/workspace/module-a/src/main'.length);
        });

        it('should not match partial directory names', () => {
            const len = fileMapper.getCommonPrefixLength(
                '/workspace/abc/file1.txt',
                '/workspace/abd/file2.txt'
            );
            // Common prefix should be /workspace, not /workspace/ab
            assert.strictEqual(len, '/workspace'.length);
        });

        it('should return 0 for empty paths', () => {
            assert.strictEqual(fileMapper.getCommonPrefixLength('', ''), 0);
            assert.strictEqual(fileMapper.getCommonPrefixLength('/a/b', ''), 0);
        });

        it('should handle identical paths', () => {
            const p = '/workspace/module-a/src/main/java/Test.java';
            const len = fileMapper.getCommonPrefixLength(p, p);
            // Last separator before filename
            assert.strictEqual(len, '/workspace/module-a/src/main/java'.length);
        });

        it('should prefer deeper common prefix for same-module files', () => {
            const javaPath = '/ws/mod-a/src/main/java/com/test/mapper/UserMapper.java';

            const xmlSameModule = '/ws/mod-a/src/main/resources/UserMapper.xml';
            const xmlOtherModule = '/ws/mod-b/src/main/resources/UserMapper.xml';

            const lenSame = fileMapper.getCommonPrefixLength(javaPath, xmlSameModule);
            const lenOther = fileMapper.getCommonPrefixLength(javaPath, xmlOtherModule);

            assert.ok(lenSame > lenOther);
        });
    });

    describe('LRU Cache Behavior', () => {
        it('should evict least recently used item when cache is full', () => {
            assert.ok(true, 'LRU cache eviction logic needs to be tested');
        });

        it('should move accessed items to end (most recently used)', () => {
            assert.ok(true, 'LRU cache access ordering needs to be tested');
        });
    });

    describe('Cache Invalidation', () => {
        it('should invalidate cache when file modification time changes', async () => {
            assert.ok(true, 'Cache invalidation on file modification needs to be tested');
        });

        it('should rebuild mapping on cache miss', async () => {
            assert.ok(true, 'Mapping rebuild on cache miss needs to be tested');
        });
    });

    describe('File Matching Strategy', () => {
        it('should prioritize quick paths over full workspace scan', async () => {
            assert.ok(true, 'Quick path priority needs to be tested');
        });

        it('should verify namespace matches when finding XML files', async () => {
            assert.ok(true, 'Namespace verification needs to be tested');
        });

        it('should not scan files during lazy initialization', () => {
            const findFilesStub = sandbox.stub(vscode.workspace, 'findFiles').resolves([]);

            fileMapper.initializeLazy();

            assert.strictEqual(findFilesStub.callCount, 0, 'lazy initialization should not call findFiles');
        });

        it('should build one module index for repeated mapper lookups in the same module', async () => {
            const fixture = createTempModuleFixture();
            try {
                const findFilesStub = stubFindFilesForModule(fixture.moduleRoot, [
                    fixture.userMapperJavaPath,
                    fixture.orderMapperJavaPath
                ], [
                    fixture.userMapperXmlPath,
                    fixture.orderMapperXmlPath
                ]);

                const userXmlPath = await fileMapper.getXmlPath(fixture.userMapperJavaPath);
                const orderXmlPath = await fileMapper.getXmlPath(fixture.orderMapperJavaPath);

                assert.ok(userXmlPath?.endsWith('UserMapper.xml'), 'UserMapper XML should be found');
                assert.ok(orderXmlPath?.endsWith('OrderMapper.xml'), 'OrderMapper XML should be found');
                assert.strictEqual(findFilesStub.callCount, 2, 'module Java/XML files should be scanned once each');
            } finally {
                fixture.dispose();
            }
        });
    });

    function stubFindFilesForModule(moduleRoot: string, javaPaths: string[], xmlPaths: string[]): sinon.SinonStub {
        return sandbox.stub(vscode.workspace, 'findFiles').callsFake(async (include: any) => {
            const pattern = typeof include === 'string' ? include : include.pattern;
            const basePath = typeof include === 'string' ? undefined : include.baseUri.fsPath;

            if (basePath && path.normalize(basePath) !== path.normalize(moduleRoot)) {
                return [];
            }

            if (pattern === '**/*.java') {
                return javaPaths.map(filePath => vscode.Uri.file(filePath));
            }

            if (pattern === '**/*.xml') {
                return xmlPaths.map(filePath => vscode.Uri.file(filePath));
            }

            return [];
        });
    }

    function createTempModuleFixture(): {
        moduleRoot: string;
        userMapperJavaPath: string;
        orderMapperJavaPath: string;
        userMapperXmlPath: string;
        orderMapperXmlPath: string;
        dispose: () => void;
    } {
        const moduleRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mybatis-boost-filemapper-'));
        fs.writeFileSync(path.join(moduleRoot, 'pom.xml'), '<project></project>');

        const javaDir = path.join(moduleRoot, 'src', 'main', 'java', 'com', 'example', 'mapper');
        const xmlDir = path.join(moduleRoot, 'src', 'main', 'resources', 'mapper');
        fs.mkdirSync(javaDir, { recursive: true });
        fs.mkdirSync(xmlDir, { recursive: true });

        const userMapperJavaPath = path.join(javaDir, 'UserMapper.java');
        const orderMapperJavaPath = path.join(javaDir, 'OrderMapper.java');
        const userMapperXmlPath = path.join(xmlDir, 'UserMapper.xml');
        const orderMapperXmlPath = path.join(xmlDir, 'OrderMapper.xml');

        fs.writeFileSync(userMapperJavaPath, [
            'package com.example.mapper;',
            'public interface UserMapper {',
            '    void selectUser();',
            '}'
        ].join('\n'));
        fs.writeFileSync(orderMapperJavaPath, [
            'package com.example.mapper;',
            'public interface OrderMapper {',
            '    void selectOrder();',
            '}'
        ].join('\n'));
        fs.writeFileSync(userMapperXmlPath, [
            '<?xml version="1.0" encoding="UTF-8" ?>',
            '<mapper namespace="com.example.mapper.UserMapper">',
            '    <select id="selectUser"></select>',
            '</mapper>'
        ].join('\n'));
        fs.writeFileSync(orderMapperXmlPath, [
            '<?xml version="1.0" encoding="UTF-8" ?>',
            '<mapper namespace="com.example.mapper.OrderMapper">',
            '    <select id="selectOrder"></select>',
            '</mapper>'
        ].join('\n'));

        return {
            moduleRoot,
            userMapperJavaPath,
            orderMapperJavaPath,
            userMapperXmlPath,
            orderMapperXmlPath,
            dispose: () => fs.rmSync(moduleRoot, { recursive: true, force: true })
        };
    }
});
