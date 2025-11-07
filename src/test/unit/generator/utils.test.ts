/**
 * Unit tests for utility functions
 */

import * as assert from 'assert';
import { snakeToPascal, snakeToCamel, mapSqlTypeToJavaType, toFullyQualifiedType } from '../../../generator/parser/utils';

describe('Utility Functions', () => {
  describe('snakeToPascal', () => {
    it('should convert single word', () => {
      assert.strictEqual(snakeToPascal('user'), 'User');
    });

    it('should convert snake_case to PascalCase', () => {
      assert.strictEqual(snakeToPascal('user_info'), 'UserInfo');
      assert.strictEqual(snakeToPascal('user_order_details'), 'UserOrderDetails');
    });

    it('should handle uppercase input', () => {
      assert.strictEqual(snakeToPascal('USER_INFO'), 'UserInfo');
    });

    it('should handle mixed case input', () => {
      assert.strictEqual(snakeToPascal('User_Info'), 'UserInfo');
    });
  });

  describe('snakeToCamel', () => {
    it('should convert single word to lowercase', () => {
      assert.strictEqual(snakeToCamel('user'), 'user');
    });

    it('should convert snake_case to camelCase', () => {
      assert.strictEqual(snakeToCamel('user_name'), 'userName');
      assert.strictEqual(snakeToCamel('first_name'), 'firstName');
      assert.strictEqual(snakeToCamel('last_login_time'), 'lastLoginTime');
    });

    it('should handle uppercase input', () => {
      assert.strictEqual(snakeToCamel('USER_NAME'), 'userName');
    });
  });

  describe('mapSqlTypeToJavaType - MySQL', () => {
    it('should map string types to String', () => {
      assert.strictEqual(mapSqlTypeToJavaType('VARCHAR(50)'), 'String');
      assert.strictEqual(mapSqlTypeToJavaType('CHAR(10)'), 'String');
      assert.strictEqual(mapSqlTypeToJavaType('TEXT'), 'String');
      assert.strictEqual(mapSqlTypeToJavaType('LONGTEXT'), 'String');
    });

    it('should map integer types to wrapper types', () => {
      assert.strictEqual(mapSqlTypeToJavaType('INT'), 'Integer');
      assert.strictEqual(mapSqlTypeToJavaType('INT'), 'Integer');
      assert.strictEqual(mapSqlTypeToJavaType('TINYINT'), 'Integer');
      assert.strictEqual(mapSqlTypeToJavaType('SMALLINT'), 'Integer');
    });

    it('should map BIGINT to Long wrapper type', () => {
      assert.strictEqual(mapSqlTypeToJavaType('BIGINT'), 'Long');
      assert.strictEqual(mapSqlTypeToJavaType('BIGINT'), 'Long');
    });

    it('should map decimal types to BigDecimal', () => {
      assert.strictEqual(mapSqlTypeToJavaType('DECIMAL(10,2)'), 'BigDecimal');
      assert.strictEqual(mapSqlTypeToJavaType('NUMERIC(5,4)'), 'BigDecimal');
      assert.strictEqual(mapSqlTypeToJavaType('FLOAT'), 'BigDecimal');
      assert.strictEqual(mapSqlTypeToJavaType('DOUBLE'), 'BigDecimal');
    });

    it('should map boolean types to wrapper type', () => {
      assert.strictEqual(mapSqlTypeToJavaType('BOOLEAN'), 'Boolean');
      assert.strictEqual(mapSqlTypeToJavaType('BOOLEAN'), 'Boolean');
      assert.strictEqual(mapSqlTypeToJavaType('BOOL'), 'Boolean');
    });

    it('should map date/time types', () => {
      assert.strictEqual(mapSqlTypeToJavaType('DATE'), 'LocalDate');
      assert.strictEqual(mapSqlTypeToJavaType('DATETIME'), 'LocalDateTime');
      assert.strictEqual(mapSqlTypeToJavaType('TIMESTAMP'), 'LocalDateTime');
      assert.strictEqual(mapSqlTypeToJavaType('TIME'), 'LocalTime');
    });

    it('should map binary types to byte array', () => {
      assert.strictEqual(mapSqlTypeToJavaType('BLOB'), 'byte[]');
      assert.strictEqual(mapSqlTypeToJavaType('BINARY'), 'byte[]');
      assert.strictEqual(mapSqlTypeToJavaType('VARBINARY(100)'), 'byte[]');
    });

    it('should map JSON to String', () => {
      assert.strictEqual(mapSqlTypeToJavaType('JSON'), 'String');
    });
  });

  describe('mapSqlTypeToJavaType - PostgreSQL', () => {
    it('should map TEXT to String', () => {
      assert.strictEqual(mapSqlTypeToJavaType('TEXT'), 'String');
    });

    it('should map SERIAL to Long wrapper type', () => {
      assert.strictEqual(mapSqlTypeToJavaType('SERIAL'), 'Long');
    });

    it('should map BIGSERIAL to Long wrapper type', () => {
      assert.strictEqual(mapSqlTypeToJavaType('BIGSERIAL'), 'Long');
    });

    it('should map BYTEA to byte array', () => {
      assert.strictEqual(mapSqlTypeToJavaType('BYTEA'), 'byte[]');
    });

    it('should map JSONB to String', () => {
      assert.strictEqual(mapSqlTypeToJavaType('JSONB'), 'String');
    });
  });

  describe('mapSqlTypeToJavaType - Oracle', () => {
    it('should map VARCHAR2 to String', () => {
      assert.strictEqual(mapSqlTypeToJavaType('VARCHAR2(100)'), 'String');
    });

    it('should map NUMBER to Long wrapper type', () => {
      assert.strictEqual(mapSqlTypeToJavaType('NUMBER'), 'Long');
      assert.strictEqual(mapSqlTypeToJavaType('NUMBER'), 'Long');
    });

    it('should map CLOB to String', () => {
      assert.strictEqual(mapSqlTypeToJavaType('CLOB'), 'String');
    });
  });

  describe('mapSqlTypeToJavaType - Edge cases', () => {
    it('should default unknown types to String', () => {
      assert.strictEqual(mapSqlTypeToJavaType('UNKNOWN_TYPE'), 'String');
      assert.strictEqual(mapSqlTypeToJavaType('CUSTOM_TYPE'), 'String');
    });

    it('should handle types with parameters', () => {
      assert.strictEqual(mapSqlTypeToJavaType('VARCHAR(255)'), 'String');
      assert.strictEqual(mapSqlTypeToJavaType('DECIMAL(19,4)'), 'BigDecimal');
    });

    it('should be case-insensitive', () => {
      assert.strictEqual(mapSqlTypeToJavaType('varchar(50)'), 'String');
      assert.strictEqual(mapSqlTypeToJavaType('INT'), 'Integer');
      assert.strictEqual(mapSqlTypeToJavaType('int'), 'Integer');
    });
  });

  describe('toFullyQualifiedType', () => {
    it('should return empty string for java.lang types (no import needed)', () => {
      assert.strictEqual(toFullyQualifiedType('String'), '');
      assert.strictEqual(toFullyQualifiedType('Integer'), '');
      assert.strictEqual(toFullyQualifiedType('Long'), '');
      assert.strictEqual(toFullyQualifiedType('Boolean'), '');
    });

    it('should convert java.math types', () => {
      assert.strictEqual(toFullyQualifiedType('BigDecimal'), 'java.math.BigDecimal');
      assert.strictEqual(toFullyQualifiedType('BigInteger'), 'java.math.BigInteger');
    });

    it('should convert java.time types', () => {
      assert.strictEqual(toFullyQualifiedType('LocalDate'), 'java.time.LocalDate');
      assert.strictEqual(toFullyQualifiedType('LocalTime'), 'java.time.LocalTime');
      assert.strictEqual(toFullyQualifiedType('LocalDateTime'), 'java.time.LocalDateTime');
      assert.strictEqual(toFullyQualifiedType('Instant'), 'java.time.Instant');
    });

    it('should convert java.util types', () => {
      assert.strictEqual(toFullyQualifiedType('Date'), 'java.util.Date');
      assert.strictEqual(toFullyQualifiedType('UUID'), 'java.util.UUID');
    });

    it('should handle array types', () => {
      assert.strictEqual(toFullyQualifiedType('String[]'), ''); // java.lang array, no import needed
      assert.strictEqual(toFullyQualifiedType('Integer[]'), ''); // java.lang array, no import needed
      assert.strictEqual(toFullyQualifiedType('byte[]'), 'byte[]'); // primitive array
    });

    it('should return unknown types as-is', () => {
      assert.strictEqual(toFullyQualifiedType('CustomType'), 'CustomType');
      assert.strictEqual(toFullyQualifiedType('com.example.MyClass'), 'com.example.MyClass');
    });
  });
});
