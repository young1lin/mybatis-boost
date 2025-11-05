/**
 * Unit tests for javaFieldParser
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import {
    extractJavaFields,
    findJavaField,
    findJavaFieldPosition
} from '../../navigator/parsers/javaFieldParser';
import * as fileUtils from '../../utils/fileUtils';

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
});
