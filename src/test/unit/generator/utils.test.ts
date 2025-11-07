/**
 * Unit tests for utility functions
 */

import * as assert from 'assert';
import { snakeToPascal, snakeToCamel, mapSqlTypeToJavaType } from '../../../generator/parser/utils';

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
      assert.strictEqual(mapSqlTypeToJavaType('VARCHAR(50)', true, 'mysql'), 'String');
      assert.strictEqual(mapSqlTypeToJavaType('CHAR(10)', true, 'mysql'), 'String');
      assert.strictEqual(mapSqlTypeToJavaType('TEXT', true, 'mysql'), 'String');
      assert.strictEqual(mapSqlTypeToJavaType('LONGTEXT', true, 'mysql'), 'String');
    });

    it('should map integer types correctly based on nullability', () => {
      assert.strictEqual(mapSqlTypeToJavaType('INT', false, 'mysql'), 'int');
      assert.strictEqual(mapSqlTypeToJavaType('INT', true, 'mysql'), 'Integer');
      assert.strictEqual(mapSqlTypeToJavaType('TINYINT', false, 'mysql'), 'int');
      assert.strictEqual(mapSqlTypeToJavaType('SMALLINT', true, 'mysql'), 'Integer');
    });

    it('should map BIGINT to Long/long', () => {
      assert.strictEqual(mapSqlTypeToJavaType('BIGINT', false, 'mysql'), 'long');
      assert.strictEqual(mapSqlTypeToJavaType('BIGINT', true, 'mysql'), 'Long');
    });

    it('should map decimal types to BigDecimal', () => {
      assert.strictEqual(mapSqlTypeToJavaType('DECIMAL(10,2)', true, 'mysql'), 'BigDecimal');
      assert.strictEqual(mapSqlTypeToJavaType('NUMERIC(5,4)', true, 'mysql'), 'BigDecimal');
      assert.strictEqual(mapSqlTypeToJavaType('FLOAT', true, 'mysql'), 'BigDecimal');
      assert.strictEqual(mapSqlTypeToJavaType('DOUBLE', true, 'mysql'), 'BigDecimal');
    });

    it('should map boolean types correctly', () => {
      assert.strictEqual(mapSqlTypeToJavaType('BOOLEAN', false, 'mysql'), 'boolean');
      assert.strictEqual(mapSqlTypeToJavaType('BOOLEAN', true, 'mysql'), 'Boolean');
      assert.strictEqual(mapSqlTypeToJavaType('BOOL', true, 'mysql'), 'Boolean');
    });

    it('should map date/time types', () => {
      assert.strictEqual(mapSqlTypeToJavaType('DATE', true, 'mysql'), 'LocalDate');
      assert.strictEqual(mapSqlTypeToJavaType('DATETIME', true, 'mysql'), 'LocalDateTime');
      assert.strictEqual(mapSqlTypeToJavaType('TIMESTAMP', true, 'mysql'), 'LocalDateTime');
      assert.strictEqual(mapSqlTypeToJavaType('TIME', true, 'mysql'), 'LocalTime');
    });

    it('should map binary types to byte array', () => {
      assert.strictEqual(mapSqlTypeToJavaType('BLOB', true, 'mysql'), 'byte[]');
      assert.strictEqual(mapSqlTypeToJavaType('BINARY', true, 'mysql'), 'byte[]');
      assert.strictEqual(mapSqlTypeToJavaType('VARBINARY(100)', true, 'mysql'), 'byte[]');
    });

    it('should map JSON to String', () => {
      assert.strictEqual(mapSqlTypeToJavaType('JSON', true, 'mysql'), 'String');
    });
  });

  describe('mapSqlTypeToJavaType - PostgreSQL', () => {
    it('should map TEXT to String', () => {
      assert.strictEqual(mapSqlTypeToJavaType('TEXT', true, 'postgresql'), 'String');
    });

    it('should map SERIAL to long', () => {
      assert.strictEqual(mapSqlTypeToJavaType('SERIAL', false, 'postgresql'), 'long');
    });

    it('should map BIGSERIAL to long', () => {
      assert.strictEqual(mapSqlTypeToJavaType('BIGSERIAL', false, 'postgresql'), 'long');
    });

    it('should map BYTEA to byte array', () => {
      assert.strictEqual(mapSqlTypeToJavaType('BYTEA', true, 'postgresql'), 'byte[]');
    });

    it('should map JSONB to String', () => {
      assert.strictEqual(mapSqlTypeToJavaType('JSONB', true, 'postgresql'), 'String');
    });
  });

  describe('mapSqlTypeToJavaType - Oracle', () => {
    it('should map VARCHAR2 to String', () => {
      assert.strictEqual(mapSqlTypeToJavaType('VARCHAR2(100)', true, 'oracle'), 'String');
    });

    it('should map NUMBER to Long/long', () => {
      assert.strictEqual(mapSqlTypeToJavaType('NUMBER', false, 'oracle'), 'long');
      assert.strictEqual(mapSqlTypeToJavaType('NUMBER', true, 'oracle'), 'Long');
    });

    it('should map CLOB to String', () => {
      assert.strictEqual(mapSqlTypeToJavaType('CLOB', true, 'oracle'), 'String');
    });
  });

  describe('mapSqlTypeToJavaType - Edge cases', () => {
    it('should default unknown types to String', () => {
      assert.strictEqual(mapSqlTypeToJavaType('UNKNOWN_TYPE', true, 'mysql'), 'String');
      assert.strictEqual(mapSqlTypeToJavaType('CUSTOM_TYPE', true, 'postgresql'), 'String');
    });

    it('should handle types with parameters', () => {
      assert.strictEqual(mapSqlTypeToJavaType('VARCHAR(255)', true, 'mysql'), 'String');
      assert.strictEqual(mapSqlTypeToJavaType('DECIMAL(19,4)', true, 'mysql'), 'BigDecimal');
    });

    it('should be case-insensitive', () => {
      assert.strictEqual(mapSqlTypeToJavaType('varchar(50)', true, 'mysql'), 'String');
      assert.strictEqual(mapSqlTypeToJavaType('INT', true, 'mysql'), 'Integer');
      assert.strictEqual(mapSqlTypeToJavaType('int', true, 'mysql'), 'Integer');
    });
  });
});
