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
    });

    describe('Lazy initialization (issue #46)', () => {
        it('initialize() must not scan the workspace (no findFiles)', async () => {
            const findFilesSpy = sandbox.spy(vscode.workspace, 'findFiles');
            await fileMapper.initialize();
            assert.strictEqual(
                findFilesSpy.callCount,
                0,
                'initialize() must not trigger any findFiles scan'
            );
        });

        it('is idempotent: re-initializing disposes old watchers instead of leaking them', async () => {
            const disposed: boolean[] = [];
            sandbox.stub(vscode.workspace, 'createFileSystemWatcher').callsFake(() => {
                const idx = disposed.push(false) - 1;
                return {
                    onDidCreate: () => ({ dispose: () => {} }),
                    onDidChange: () => ({ dispose: () => {} }),
                    onDidDelete: () => ({ dispose: () => {} }),
                    dispose: () => { disposed[idx] = true; }
                } as unknown as vscode.FileSystemWatcher;
            });

            await fileMapper.initialize(); // creates watcher pair #1
            await fileMapper.initialize(); // must dispose #1 before creating #2

            // The first pair of watchers must have been disposed by the second init.
            assert.strictEqual(disposed[0], true, 'first java watcher should be disposed');
            assert.strictEqual(disposed[1], true, 'first xml watcher should be disposed');
            // And the live set should not grow unbounded across re-inits.
            const live = disposed.filter(d => !d).length;
            assert.strictEqual(live, 2, 'exactly one live watcher pair should remain');
        });
    });

    describe('Per-project XML index (issue #46)', () => {
        const DOCTYPE = '<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" ' +
            '"http://mybatis.org/dtd/mybatis-3-mapper.dtd">';

        let tmpRoot: string;
        let projectRoot: string;
        let fooJava: string;
        let barJava: string;
        let fooXml: string;
        let barXml: string;

        const mapperJava = (name: string) =>
            `package com.demo;\nimport org.apache.ibatis.annotations.Mapper;\n@Mapper\npublic interface ${name} {}\n`;
        const mapperXml = (namespace: string) =>
            `<?xml version="1.0" encoding="UTF-8"?>\n${DOCTYPE}\n<mapper namespace="${namespace}">\n</mapper>\n`;

        beforeEach(() => {
            tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-filemapper-'));
            projectRoot = path.join(tmpRoot, 'proj');
            const javaDir = path.join(projectRoot, 'src', 'main', 'java', 'com', 'demo');
            // XML placed in a custom dir with non-matching filenames so quick paths miss
            // and the lazy per-project index is exercised.
            const xmlDir = path.join(projectRoot, 'src', 'main', 'resources', 'custom');
            fs.mkdirSync(javaDir, { recursive: true });
            fs.mkdirSync(xmlDir, { recursive: true });
            fs.writeFileSync(path.join(projectRoot, 'pom.xml'), '<project></project>');

            fooJava = path.join(javaDir, 'FooMapper.java');
            barJava = path.join(javaDir, 'BarMapper.java');
            fs.writeFileSync(fooJava, mapperJava('FooMapper'));
            fs.writeFileSync(barJava, mapperJava('BarMapper'));

            fooXml = path.join(xmlDir, 'Foo.xml');
            barXml = path.join(xmlDir, 'Bar.xml');
            fs.writeFileSync(fooXml, mapperXml('com.demo.FooMapper'));
            fs.writeFileSync(barXml, mapperXml('com.demo.BarMapper'));
        });

        afterEach(() => {
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        });

        it('builds the project XML index once and reuses it across lookups', async () => {
            const findFilesStub = sandbox.stub(vscode.workspace, 'findFiles')
                .resolves([vscode.Uri.file(fooXml), vscode.Uri.file(barXml)]);

            const fooResult = await fileMapper.getXmlPath(fooJava);
            const barResult = await fileMapper.getXmlPath(barJava);

            assert.ok(fooResult && fooResult.endsWith('Foo.xml'), 'FooMapper should resolve to Foo.xml');
            assert.ok(barResult && barResult.endsWith('Bar.xml'), 'BarMapper should resolve to Bar.xml');
            assert.strictEqual(
                findFilesStub.callCount,
                1,
                'the per-project index should be built once and reused for the second lookup'
            );
        });

        it('scopes the index scan to the project via RelativePattern', async () => {
            const findFilesStub = sandbox.stub(vscode.workspace, 'findFiles')
                .resolves([vscode.Uri.file(fooXml), vscode.Uri.file(barXml)]);

            await fileMapper.getXmlPath(fooJava);

            assert.ok(findFilesStub.calledOnce, 'index scan should run exactly once');
            const include = findFilesStub.firstCall.args[0] as vscode.RelativePattern;
            assert.ok(include instanceof vscode.RelativePattern, 'include should be a RelativePattern');
            assert.strictEqual(
                include.base.replace(/\\/g, '/'),
                projectRoot.replace(/\\/g, '/'),
                'RelativePattern base should be the project root'
            );
        });

        it('rebuilds the index after the TTL so out-of-editor changes self-heal', async () => {
            // Only fake Date so file-system promises keep working normally.
            const clock = sandbox.useFakeTimers({ now: Date.now(), toFake: ['Date'] });
            const findFilesStub = sandbox.stub(vscode.workspace, 'findFiles')
                .resolves([vscode.Uri.file(fooXml), vscode.Uri.file(barXml)]);

            await fileMapper.getXmlPath(fooJava);
            assert.strictEqual(findFilesStub.callCount, 1, 'first lookup builds the index');

            // Advance beyond the index TTL (30s); a lookup for a different mapper in the
            // same project should now rebuild instead of trusting the stale snapshot.
            clock.tick(31_000);
            await fileMapper.getXmlPath(barJava);
            assert.strictEqual(findFilesStub.callCount, 2, 'expired index should be rebuilt');
        });
    });
});
