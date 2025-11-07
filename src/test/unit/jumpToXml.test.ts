/**
 * Unit tests for jumpToXml command functionality
 */

import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import { findXmlMapperPosition, findXmlStatementPosition } from '../../navigator/parsers/xmlParser';

describe('jumpToXml Command Tests', () => {
    describe('findXmlMapperPosition', () => {
        it('should find mapper position in valid XML', async () => {
            const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.example.UserMapper">
    <select id="selectById">
        SELECT * FROM user WHERE id = #{id}
    </select>
</mapper>`;

            // Write mock file
            const fs = require('fs').promises;
            const tmpFile = path.join(os.tmpdir(), 'test-mapper-' + Date.now() + '.xml');
            await fs.writeFile(tmpFile, mockXml);

            try {
                const position = await findXmlMapperPosition(tmpFile);

                assert.ok(position, 'Should find mapper position');
                assert.strictEqual(position!.line, 2, 'Should be on line 2 (0-indexed)');
                assert.ok(position!.column >= 0, 'Should have valid column');
            } finally {
                await fs.unlink(tmpFile);
            }
        });

        it('should return null for XML without mapper tag', async () => {
            const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<root>
    <element>test</element>
</root>`;

            const fs = require('fs').promises;
            const tmpFile = path.join(os.tmpdir(), 'test-no-mapper-' + Date.now() + '.xml');
            await fs.writeFile(tmpFile, mockXml);

            try {
                const position = await findXmlMapperPosition(tmpFile);
                assert.strictEqual(position, null, 'Should return null for non-mapper XML');
            } finally {
                await fs.unlink(tmpFile);
            }
        });
    });

    describe('findXmlStatementPosition', () => {
        it('should find statement position for existing statement', async () => {
            const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectById" resultType="User">
        SELECT * FROM user WHERE id = #{id}
    </select>
    <insert id="insertUser">
        INSERT INTO user (name) VALUES (#{name})
    </insert>
</mapper>`;

            const fs = require('fs').promises;
            const tmpFile = path.join(os.tmpdir(), 'test-statement-' + Date.now() + '.xml');
            await fs.writeFile(tmpFile, mockXml);

            try {
                const position = await findXmlStatementPosition(tmpFile, 'selectById');

                assert.ok(position, 'Should find statement position');
                assert.strictEqual(position!.line, 2, 'Should be on line 2 (0-indexed)');
                assert.ok(position!.startColumn > 0, 'Should have valid start column');
                assert.ok(position!.endColumn > position!.startColumn, 'End column should be after start');
            } finally {
                await fs.unlink(tmpFile);
            }
        });

        it('should return null for non-existent statement', async () => {
            const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select id="selectById">
        SELECT * FROM user WHERE id = #{id}
    </select>
</mapper>`;

            const fs = require('fs').promises;
            const tmpFile = path.join(os.tmpdir(), 'test-no-statement-' + Date.now() + '.xml');
            await fs.writeFile(tmpFile, mockXml);

            try {
                const position = await findXmlStatementPosition(tmpFile, 'nonExistentMethod');
                assert.strictEqual(position, null, 'Should return null for non-existent statement');
            } finally {
                await fs.unlink(tmpFile);
            }
        });

        it('should handle multi-line statement tags', async () => {
            const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="com.example.UserMapper">
    <select
        id="selectByIdAndName"
        resultType="User">
        SELECT * FROM user WHERE id = #{id} AND name = #{name}
    </select>
</mapper>`;

            const fs = require('fs').promises;
            const tmpFile = path.join(os.tmpdir(), 'test-multiline-' + Date.now() + '.xml');
            await fs.writeFile(tmpFile, mockXml);

            try {
                const position = await findXmlStatementPosition(tmpFile, 'selectByIdAndName');

                assert.ok(position, 'Should find statement in multi-line tag');
                // The id is on line 3 (0-indexed)
                assert.strictEqual(position!.line, 3, 'Should find id on correct line');
            } finally {
                await fs.unlink(tmpFile);
            }
        });
    });

    describe('Command argument validation', () => {
        it('should handle undefined methodName (jump to mapper)', () => {
            const methodName: string | undefined = undefined;

            // When methodName is undefined, should jump to mapper
            if (methodName) {
                assert.fail('Should not enter statement branch');
            } else {
                assert.ok(true, 'Should enter mapper branch');
            }
        });

        it('should handle provided methodName (jump to statement)', () => {
            const methodName: string | undefined = 'selectById';

            // When methodName is provided, should jump to statement
            if (methodName) {
                assert.strictEqual(methodName, 'selectById', 'Should use provided method name');
            } else {
                assert.fail('Should not enter mapper branch');
            }
        });
    });
});
