/**
 * Unit tests for javaTypeResolver
 * Tests the three-tier fallback orchestrator: WASM → Java LS → Regex
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as javaTreeSitterParser from '../../navigator/parsers/javaTreeSitterParser';
import * as javaLSHelper from '../../utils/javaLSHelper';
import { resolveFullyQualifiedType } from '../../utils/javaTypeResolver';

describe('javaTypeResolver Unit Tests', () => {
    let initTreeSitterStub: sinon.SinonStub;
    let resolveTypeViaLSStub: sinon.SinonStub;
    let findFilesStub: sinon.SinonStub;
    let fsReadFileStub: sinon.SinonStub;
    // fs module reference for stubbing dynamic import
    let fsModule: typeof import('fs');

    const JAVA_CONTENT_WITH_IMPORT = `package com.example.mapper;

import com.example.entity.User;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper {
    User selectById(Long id);
}
`;

    const JAVA_CONTENT_NO_IMPORT = `package com.example.mapper;

import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper {
    User selectById(Long id);
}
`;

    const JAVA_CONTENT_IMPORT_AFTER_CLASS = `package com.example.mapper;

public interface UserMapper {
    User selectById(Long id);
}
import com.example.entity.User;
`;

    const JAVA_CONTENT_WILDCARD_IMPORT = `package com.example.mapper;

import com.example.*;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper {
    User selectById(Long id);
}
`;

    const JAVA_CONTENT_WRONG_IMPORT = `package com.example.mapper;

import com.example.entity.UserInfo;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper {
    User selectById(Long id);
}
`;

    before(async () => {
        // Pre-load fs module so we can stub it (dynamic import returns cached singleton)
        fsModule = await import('fs');
    });

    beforeEach(() => {
        initTreeSitterStub = sinon.stub(javaTreeSitterParser, 'initTreeSitter');
        resolveTypeViaLSStub = sinon.stub(javaLSHelper, 'resolveTypeViaLS');
        findFilesStub = sinon.stub(vscode.workspace, 'findFiles');
        fsReadFileStub = sinon.stub(fsModule.promises, 'readFile');

        // Default: findFiles returns nothing (no same-package match)
        findFilesStub.resolves([]);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should return as-is when type is already fully qualified', async () => {
        fsReadFileStub.resolves(JAVA_CONTENT_WITH_IMPORT);

        const result = await resolveFullyQualifiedType('/fake/UserMapper.java', 'com.example.User');
        assert.strictEqual(result, 'com.example.User');
        // Should not even call initTreeSitter
        assert.strictEqual(initTreeSitterStub.called, false);
    });

    it('should resolve via WASM tier when import matches', async () => {
        fsReadFileStub.resolves(JAVA_CONTENT_WITH_IMPORT);
        initTreeSitterStub.resolves(true);

        const result = await resolveFullyQualifiedType('/fake/UserMapper.java', 'User');
        assert.strictEqual(result, 'com.example.entity.User');
        assert.strictEqual(resolveTypeViaLSStub.called, false);
    });

    it('should fall through to LS when WASM succeeds but no import match', async () => {
        fsReadFileStub.resolves(JAVA_CONTENT_NO_IMPORT);
        initTreeSitterStub.resolves(true);
        resolveTypeViaLSStub.resolves('com.other.entity.User');

        const result = await resolveFullyQualifiedType('/fake/UserMapper.java', 'User');
        assert.strictEqual(result, 'com.other.entity.User');
    });

    it('should fall through to LS when WASM init fails', async () => {
        fsReadFileStub.resolves(JAVA_CONTENT_NO_IMPORT);
        initTreeSitterStub.resolves(false);
        resolveTypeViaLSStub.resolves('com.other.entity.User');

        const result = await resolveFullyQualifiedType('/fake/UserMapper.java', 'User');
        assert.strictEqual(result, 'com.other.entity.User');
    });

    it('should fall through to LS when WASM throws', async () => {
        fsReadFileStub.resolves(JAVA_CONTENT_NO_IMPORT);
        initTreeSitterStub.rejects(new Error('WASM load failed'));
        resolveTypeViaLSStub.resolves('com.other.entity.User');

        const result = await resolveFullyQualifiedType('/fake/UserMapper.java', 'User');
        assert.strictEqual(result, 'com.other.entity.User');
    });

    it('should fall through to Regex when LS returns null', async () => {
        fsReadFileStub.resolves(JAVA_CONTENT_WITH_IMPORT);
        initTreeSitterStub.resolves(false);
        resolveTypeViaLSStub.resolves(null);

        const result = await resolveFullyQualifiedType('/fake/UserMapper.java', 'User');
        assert.strictEqual(result, 'com.example.entity.User');
    });

    it('should fall through to Regex when LS throws', async () => {
        fsReadFileStub.resolves(JAVA_CONTENT_WITH_IMPORT);
        initTreeSitterStub.resolves(false);
        resolveTypeViaLSStub.rejects(new Error('LS crashed'));

        const result = await resolveFullyQualifiedType('/fake/UserMapper.java', 'User');
        assert.strictEqual(result, 'com.example.entity.User');
    });

    it('should resolve via same-package when all tiers fail', async () => {
        fsReadFileStub.resolves(JAVA_CONTENT_NO_IMPORT);
        initTreeSitterStub.resolves(false);
        resolveTypeViaLSStub.resolves(null);
        findFilesStub.resolves([vscode.Uri.file('/fake/com/example/mapper/User.java')]);

        const result = await resolveFullyQualifiedType('/fake/UserMapper.java', 'User');
        assert.strictEqual(result, 'com.example.mapper.User');
    });

    it('should return null when all resolution paths fail', async () => {
        fsReadFileStub.resolves(JAVA_CONTENT_NO_IMPORT);
        initTreeSitterStub.resolves(false);
        resolveTypeViaLSStub.resolves(null);
        findFilesStub.resolves([]);

        const result = await resolveFullyQualifiedType('/fake/UserMapper.java', 'User');
        assert.strictEqual(result, null);
    });

    it('should not call LS when WASM tier succeeds', async () => {
        fsReadFileStub.resolves(JAVA_CONTENT_WITH_IMPORT);
        initTreeSitterStub.resolves(true);

        await resolveFullyQualifiedType('/fake/UserMapper.java', 'User');
        assert.strictEqual(resolveTypeViaLSStub.called, false);
    });

    it('should not match partial name (UserInfo != User)', async () => {
        fsReadFileStub.resolves(JAVA_CONTENT_WRONG_IMPORT);
        initTreeSitterStub.resolves(true);
        resolveTypeViaLSStub.resolves(null);

        const result = await resolveFullyQualifiedType('/fake/UserMapper.java', 'User');
        assert.strictEqual(result, null);
    });

    it('should ignore imports after class declaration', async () => {
        fsReadFileStub.resolves(JAVA_CONTENT_IMPORT_AFTER_CLASS);
        initTreeSitterStub.resolves(true);
        resolveTypeViaLSStub.resolves(null);

        const result = await resolveFullyQualifiedType('/fake/UserMapper.java', 'User');
        assert.strictEqual(result, null);
    });

    it('should not resolve wildcard import when the package has no matching file', async () => {
        fsReadFileStub.resolves(JAVA_CONTENT_WILDCARD_IMPORT);
        initTreeSitterStub.resolves(true);
        resolveTypeViaLSStub.resolves(null);

        const result = await resolveFullyQualifiedType('/fake/UserMapper.java', 'User');
        assert.strictEqual(result, null);
    });

    it('should resolve via wildcard import when the package contains the type', async () => {
        fsReadFileStub.resolves(JAVA_CONTENT_WILDCARD_IMPORT);
        initTreeSitterStub.resolves(true);
        resolveTypeViaLSStub.resolves(null);
        findFilesStub.callsFake(async (include: string) =>
            include === '**/com/example/User.java'
                ? [vscode.Uri.file('/fake/com/example/User.java')]
                : []
        );

        const result = await resolveFullyQualifiedType('/fake/UserMapper.java', 'User');
        assert.strictEqual(result, 'com.example.User');
    });

    it('should prefer same-package resolution over wildcard imports', async () => {
        const content = `package com.example.mapper;

import com.example.common.*;

public interface UserMapper {
    User selectById(Long id);
}
`;
        fsReadFileStub.resolves(content);
        initTreeSitterStub.resolves(true);
        resolveTypeViaLSStub.resolves(null);
        // Both the same-package file and the wildcard-package file exist
        findFilesStub.callsFake(async (include: string) =>
            include === '**/com/example/mapper/User.java' || include === '**/com/example/common/User.java'
                ? [vscode.Uri.file('/fake/' + include.substring(3))]
                : []
        );

        const result = await resolveFullyQualifiedType('/fake/UserMapper.java', 'User');
        assert.strictEqual(result, 'com.example.mapper.User');
    });

    it('should ignore static wildcard imports', async () => {
        const content = `package com.example.mapper;

import static com.example.util.Constants.*;

public interface UserMapper {
    User selectById(Long id);
}
`;
        fsReadFileStub.resolves(content);
        initTreeSitterStub.resolves(true);
        resolveTypeViaLSStub.resolves(null);
        findFilesStub.callsFake(async (include: string) =>
            include === '**/com/example/util/Constants/User.java' || include === '**/com/example/util/Constants.User.java'
                ? [vscode.Uri.file('/fake/should-not-happen.java')]
                : []
        );

        const result = await resolveFullyQualifiedType('/fake/UserMapper.java', 'User');
        assert.strictEqual(result, null);
    });
});
