/**
 * Unit tests for javaParser - extractMethodParameters
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import { extractMethodParameters } from '../../navigator/parsers/javaParser';
import * as fileUtils from '../../utils/fileUtils';

describe('javaParser - extractMethodParameters Unit Tests', () => {
    let readFileStub: sinon.SinonStub;

    beforeEach(() => {
        readFileStub = sinon.stub(fileUtils, 'readFile');
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('extractMethodParameters', () => {
        it('should extract parameters with @Param annotation', async () => {
            const mockContent = `
package com.example.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface UserMapper {
    User selectByAge(@Param("age") Integer age);
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractMethodParameters('/fake/path/UserMapper.java', 'selectByAge');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'age'); // From @Param annotation
            assert.strictEqual(result[0].paramType, 'Integer');
            assert.strictEqual(result[0].hasParamAnnotation, true);
        });

        it('should extract multiple parameters with @Param annotations', async () => {
            const mockContent = `
package com.example.mapper;

import org.apache.ibatis.annotations.Param;

public interface UserMapper {
    List<User> selectByAgeRange(@Param("minAge") Integer minAge, @Param("maxAge") Integer maxAge);
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractMethodParameters('/fake/path/UserMapper.java', 'selectByAgeRange');
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'minAge');
            assert.strictEqual(result[0].paramType, 'Integer');
            assert.strictEqual(result[0].hasParamAnnotation, true);
            assert.strictEqual(result[1].name, 'maxAge');
            assert.strictEqual(result[1].paramType, 'Integer');
            assert.strictEqual(result[1].hasParamAnnotation, true);
        });

        it('should extract parameters without @Param annotation', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    User selectById(Long id);
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractMethodParameters('/fake/path/UserMapper.java', 'selectById');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'id'); // From parameter name
            assert.strictEqual(result[0].paramType, 'Long');
            assert.strictEqual(result[0].hasParamAnnotation, false);
        });

        it('should handle mixed parameters (with and without @Param)', async () => {
            const mockContent = `
package com.example.mapper;

import org.apache.ibatis.annotations.Param;

public interface UserMapper {
    User selectByIdAndAge(@Param("userId") Long id, Integer age);
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractMethodParameters('/fake/path/UserMapper.java', 'selectByIdAndAge');
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'userId'); // From @Param
            assert.strictEqual(result[0].hasParamAnnotation, true);
            assert.strictEqual(result[1].name, 'age'); // From parameter name
            assert.strictEqual(result[1].hasParamAnnotation, false);
        });

        it('should handle generic type parameters', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    int insertBatch(List<User> users);
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractMethodParameters('/fake/path/UserMapper.java', 'insertBatch');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'users');
            assert.strictEqual(result[0].paramType, 'List');
        });

        it('should return empty array for methods with no parameters', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    List<User> selectAll();
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractMethodParameters('/fake/path/UserMapper.java', 'selectAll');
            assert.strictEqual(result.length, 0);
        });

        it('should handle multi-line method declarations', async () => {
            const mockContent = `
package com.example.mapper;

import org.apache.ibatis.annotations.Param;

public interface UserMapper {
    User selectByMultipleParams(
        @Param("id") Long id,
        @Param("name") String name,
        @Param("age") Integer age
    );
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractMethodParameters('/fake/path/UserMapper.java', 'selectByMultipleParams');
            assert.strictEqual(result.length, 3);
            assert.strictEqual(result[0].name, 'id');
            assert.strictEqual(result[1].name, 'name');
            assert.strictEqual(result[2].name, 'age');
        });

        it('should return empty array for non-existent method', async () => {
            const mockContent = `
package com.example.mapper;

public interface UserMapper {
    User selectById(Long id);
}
`;
            readFileStub.resolves(mockContent);

            const result = await extractMethodParameters('/fake/path/UserMapper.java', 'nonExistentMethod');
            assert.strictEqual(result.length, 0);
        });
    });
});
