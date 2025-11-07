/**
 * Comprehensive unit tests for DDL parser
 */

import * as assert from 'assert';
import { parseDDL } from '../../../generator/parser/ddlParser';
import { ParseResult } from '../../../generator/type';

describe('DDL Parser', () => {
  describe('Basic MySQL parsing', () => {
    it('should parse simple MySQL CREATE TABLE statement', () => {
      const sql = `
        CREATE TABLE user_info (
          id INT PRIMARY KEY,
          user_name VARCHAR(50) NOT NULL,
          email VARCHAR(100),
          created_at DATETIME
        )
      `;

      const result = parseDDL(sql, { dbType: 'mysql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.tableName, 'user_info');
      assert.strictEqual(result.data.className, 'UserInfo');
      assert.strictEqual(result.data.databaseType, 'mysql');
      assert.strictEqual(result.data.columns.length, 4);

      // Check primary key
      assert.ok(result.data.primaryKey);
      assert.strictEqual(result.data.primaryKey.columnName, 'id');
      assert.strictEqual(result.data.primaryKey.isPrimaryKey, true);

      // Check column details
      const userNameCol = result.data.columns.find(c => c.columnName === 'user_name');
      assert.ok(userNameCol);
      assert.strictEqual(userNameCol.fieldName, 'userName');
      assert.strictEqual(userNameCol.nullable, false);
      assert.strictEqual(userNameCol.javaType, 'String');
    });

    it('should parse MySQL table with AUTO_INCREMENT', () => {
      const sql = `
        CREATE TABLE orders (
          order_id BIGINT AUTO_INCREMENT PRIMARY KEY,
          order_number VARCHAR(50),
          total_amount DECIMAL(10,2)
        )
      `;

      const result = parseDDL(sql, { dbType: 'mysql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.tableName, 'orders');

      const orderIdCol = result.data.columns.find(c => c.columnName === 'order_id');
      assert.ok(orderIdCol);
      assert.strictEqual(orderIdCol.isPrimaryKey, true);
      assert.strictEqual(orderIdCol.javaType, 'long');
    });

    it('should parse MySQL table with COMMENT', () => {
      const sql = `
        CREATE TABLE products (
          id INT PRIMARY KEY COMMENT 'Product ID',
          name VARCHAR(100) NOT NULL COMMENT 'Product name',
          price DECIMAL(10,2) COMMENT 'Price in USD'
        )
      `;

      const result = parseDDL(sql);

      assert.strictEqual(result.success, true);
      assert.ok(result.data);

      const nameCol = result.data.columns.find(c => c.columnName === 'name');
      assert.ok(nameCol);
      assert.strictEqual(nameCol.comment, 'Product name');
    });

    it('should parse MySQL table with DEFAULT values', () => {
      const sql = `
        CREATE TABLE settings (
          id INT PRIMARY KEY,
          status VARCHAR(20) DEFAULT 'active',
          retry_count INT DEFAULT 0,
          is_enabled BOOLEAN DEFAULT true
        )
      `;

      const result = parseDDL(sql, { dbType: 'mysql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);

      const statusCol = result.data.columns.find(c => c.columnName === 'status');
      assert.ok(statusCol);
      assert.strictEqual(statusCol.defaultValue, 'active');

      const retryCol = result.data.columns.find(c => c.columnName === 'retry_count');
      assert.ok(retryCol);
      assert.strictEqual(retryCol.defaultValue, '0');
    });
  });

  describe('Basic PostgreSQL parsing', () => {
    it('should parse simple PostgreSQL CREATE TABLE statement', () => {
      const sql = `
        CREATE TABLE user_accounts (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) NOT NULL,
          email TEXT,
          created_at TIMESTAMP
        )
      `;

      const result = parseDDL(sql, { dbType: 'postgresql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.tableName, 'user_accounts');
      assert.strictEqual(result.data.className, 'UserAccounts');
      assert.strictEqual(result.data.databaseType, 'postgresql');

      // Check SERIAL type mapping
      const idCol = result.data.columns.find(c => c.columnName === 'id');
      assert.ok(idCol);
      assert.strictEqual(idCol.javaType, 'long');
      assert.strictEqual(idCol.isPrimaryKey, true);
    });

    it('should parse PostgreSQL table with BIGSERIAL', () => {
      const sql = `
        CREATE TABLE logs (
          log_id BIGSERIAL PRIMARY KEY,
          message TEXT,
          logged_at TIMESTAMP
        )
      `;

      const result = parseDDL(sql, { dbType: 'postgresql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);

      const logIdCol = result.data.columns.find(c => c.columnName === 'log_id');
      assert.ok(logIdCol);
      assert.strictEqual(logIdCol.javaType, 'long');
    });

    it('should parse PostgreSQL table with BYTEA', () => {
      const sql = `
        CREATE TABLE files (
          id SERIAL PRIMARY KEY,
          file_name VARCHAR(255),
          file_data BYTEA
        )
      `;

      const result = parseDDL(sql, { dbType: 'postgresql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);

      const dataCol = result.data.columns.find(c => c.columnName === 'file_data');
      assert.ok(dataCol);
      assert.strictEqual(dataCol.javaType, 'byte[]');
    });
  });

  describe('Oracle parsing', () => {
    it('should parse Oracle CREATE TABLE statement', () => {
      const sql = `
        CREATE TABLE employees (
          employee_id NUMBER PRIMARY KEY,
          first_name VARCHAR2(50) NOT NULL,
          last_name VARCHAR2(50) NOT NULL,
          hire_date DATE
        )
      `;

      const result = parseDDL(sql, { dbType: 'oracle' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.tableName, 'employees');
      assert.strictEqual(result.data.databaseType, 'oracle');

      const idCol = result.data.columns.find(c => c.columnName === 'employee_id');
      assert.ok(idCol);
      assert.strictEqual(idCol.javaType, 'long');
    });

    it('should parse Oracle table with CLOB', () => {
      const sql = `
        CREATE TABLE documents (
          doc_id NUMBER PRIMARY KEY,
          title VARCHAR2(200),
          content CLOB
        )
      `;

      const result = parseDDL(sql, { dbType: 'oracle' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);

      const contentCol = result.data.columns.find(c => c.columnName === 'content');
      assert.ok(contentCol);
      assert.strictEqual(contentCol.javaType, 'String');
    });
  });

  describe('Database type detection', () => {
    it('should auto-detect MySQL from AUTO_INCREMENT', () => {
      const sql = `
        CREATE TABLE users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(50)
        )
      `;

      const result = parseDDL(sql); // No dbType specified

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.databaseType, 'mysql');
    });

    it('should auto-detect MySQL from ENGINE', () => {
      const sql = `
        CREATE TABLE users (
          id INT PRIMARY KEY,
          name VARCHAR(50)
        ) ENGINE=InnoDB
      `;

      const result = parseDDL(sql);

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.databaseType, 'mysql');
    });

    it('should auto-detect PostgreSQL from SERIAL', () => {
      const sql = `
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(50)
        )
      `;

      const result = parseDDL(sql);

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.databaseType, 'postgresql');
    });

    it('should auto-detect Oracle from VARCHAR2', () => {
      const sql = `
        CREATE TABLE users (
          id NUMBER PRIMARY KEY,
          name VARCHAR2(50)
        )
      `;

      const result = parseDDL(sql);

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.databaseType, 'oracle');
    });
  });

  describe('Java type mapping', () => {
    it('should map nullable columns to wrapper types', () => {
      const sql = `
        CREATE TABLE test_types (
          id INT PRIMARY KEY,
          nullable_int INT,
          nullable_bigint BIGINT,
          nullable_bool BOOLEAN
        )
      `;

      const result = parseDDL(sql, { dbType: 'mysql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);

      const nullableInt = result.data.columns.find(c => c.columnName === 'nullable_int');
      assert.ok(nullableInt);
      assert.strictEqual(nullableInt.javaType, 'Integer');
      assert.strictEqual(nullableInt.nullable, true);

      const nullableBigint = result.data.columns.find(c => c.columnName === 'nullable_bigint');
      assert.ok(nullableBigint);
      assert.strictEqual(nullableBigint.javaType, 'Long');

      const nullableBool = result.data.columns.find(c => c.columnName === 'nullable_bool');
      assert.ok(nullableBool);
      assert.strictEqual(nullableBool.javaType, 'Boolean');
    });

    it('should map NOT NULL columns to primitive types', () => {
      const sql = `
        CREATE TABLE test_types (
          id INT PRIMARY KEY,
          count INT NOT NULL,
          total BIGINT NOT NULL,
          active BOOLEAN NOT NULL
        )
      `;

      const result = parseDDL(sql, { dbType: 'mysql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);

      const count = result.data.columns.find(c => c.columnName === 'count');
      assert.ok(count);
      assert.strictEqual(count.javaType, 'int');
      assert.strictEqual(count.nullable, false);

      const total = result.data.columns.find(c => c.columnName === 'total');
      assert.ok(total);
      assert.strictEqual(total.javaType, 'long');

      const active = result.data.columns.find(c => c.columnName === 'active');
      assert.ok(active);
      assert.strictEqual(active.javaType, 'boolean');
    });

    it('should map date/time types correctly', () => {
      const sql = `
        CREATE TABLE time_test (
          id INT PRIMARY KEY,
          birth_date DATE,
          created_at DATETIME,
          updated_at TIMESTAMP,
          work_time TIME
        )
      `;

      const result = parseDDL(sql, { dbType: 'mysql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);

      const birthDate = result.data.columns.find(c => c.columnName === 'birth_date');
      assert.ok(birthDate);
      assert.strictEqual(birthDate.javaType, 'LocalDate');

      const createdAt = result.data.columns.find(c => c.columnName === 'created_at');
      assert.ok(createdAt);
      assert.strictEqual(createdAt.javaType, 'LocalDateTime');

      const workTime = result.data.columns.find(c => c.columnName === 'work_time');
      assert.ok(workTime);
      assert.strictEqual(workTime.javaType, 'LocalTime');
    });

    it('should map decimal types to BigDecimal', () => {
      const sql = `
        CREATE TABLE financial (
          id INT PRIMARY KEY,
          price DECIMAL(10,2),
          tax_rate NUMERIC(5,4),
          discount FLOAT
        )
      `;

      const result = parseDDL(sql, { dbType: 'mysql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);

      const price = result.data.columns.find(c => c.columnName === 'price');
      assert.ok(price);
      assert.strictEqual(price.javaType, 'BigDecimal');

      const taxRate = result.data.columns.find(c => c.columnName === 'tax_rate');
      assert.ok(taxRate);
      assert.strictEqual(taxRate.javaType, 'BigDecimal');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should reject non-CREATE-TABLE statements', () => {
      const sql = 'SELECT * FROM users';

      const result = parseDDL(sql);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.strictEqual(result.error.code, 'NOT_CREATE_TABLE');
    });

    it('should reject INSERT statements', () => {
      const sql = 'INSERT INTO users (id, name) VALUES (1, "test")';

      const result = parseDDL(sql);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.code, 'NOT_CREATE_TABLE');
    });

    it('should handle table with no primary key', () => {
      const sql = `
        CREATE TABLE logs (
          log_id INT,
          message TEXT,
          created_at TIMESTAMP
        )
      `;

      const result = parseDDL(sql, { dbType: 'mysql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.primaryKey, undefined);
      assert.ok(result.data.columns.every(c => !c.isPrimaryKey));
    });

    it('should reject composite primary keys', () => {
      const sql = `
        CREATE TABLE user_roles (
          user_id INT,
          role_id INT,
          PRIMARY KEY (user_id, role_id)
        )
      `;

      const result = parseDDL(sql, { dbType: 'mysql' });

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.strictEqual(result.error.code, 'COMPOSITE_PRIMARY_KEY');
      assert.ok(result.error.message.includes('user_id, role_id'));
    });

    it('should handle IF NOT EXISTS syntax', () => {
      const sql = `
        CREATE TABLE IF NOT EXISTS users (
          id INT PRIMARY KEY,
          name VARCHAR(50)
        )
      `;

      const result = parseDDL(sql, { dbType: 'mysql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.tableName, 'users');
    });

    it('should handle backticks in MySQL', () => {
      const sql = `
        CREATE TABLE \`user_info\` (
          \`id\` INT PRIMARY KEY,
          \`user_name\` VARCHAR(50)
        )
      `;

      const result = parseDDL(sql, { dbType: 'mysql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.tableName, 'user_info');
    });

    it('should handle complex column types with parameters', () => {
      const sql = `
        CREATE TABLE complex_types (
          id INT PRIMARY KEY,
          name VARCHAR(255),
          amount DECIMAL(19,4),
          data VARBINARY(500)
        )
      `;

      const result = parseDDL(sql, { dbType: 'mysql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);

      const amountCol = result.data.columns.find(c => c.columnName === 'amount');
      assert.ok(amountCol);
      assert.ok(amountCol.sqlType.includes('DECIMAL'));
    });

    it('should handle empty or malformed DDL gracefully', () => {
      const sql = 'CREATE TABLE';

      const result = parseDDL(sql);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.strictEqual(result.error.code, 'PARSE_FAILED');
    });
  });

  describe('Naming conversion', () => {
    it('should convert snake_case table names to PascalCase', () => {
      const sql = `
        CREATE TABLE user_order_details (
          id INT PRIMARY KEY
        )
      `;

      const result = parseDDL(sql, { dbType: 'mysql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.className, 'UserOrderDetails');
    });

    it('should convert snake_case column names to camelCase', () => {
      const sql = `
        CREATE TABLE test (
          id INT PRIMARY KEY,
          first_name VARCHAR(50),
          last_login_time DATETIME,
          is_active BOOLEAN
        )
      `;

      const result = parseDDL(sql, { dbType: 'mysql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);

      const firstName = result.data.columns.find(c => c.columnName === 'first_name');
      assert.ok(firstName);
      assert.strictEqual(firstName.fieldName, 'firstName');

      const lastLoginTime = result.data.columns.find(c => c.columnName === 'last_login_time');
      assert.ok(lastLoginTime);
      assert.strictEqual(lastLoginTime.fieldName, 'lastLoginTime');
    });
  });

  describe('Real-world scenarios', () => {
    it('should parse complex MySQL user table', () => {
      const sql = `
        CREATE TABLE users (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) NOT NULL COMMENT 'Unique username',
          email VARCHAR(100) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT true,
          login_count INT DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `;

      const result = parseDDL(sql);

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.tableName, 'users');
      assert.strictEqual(result.data.columns.length, 8);
      assert.ok(result.data.primaryKey);
      assert.strictEqual(result.data.primaryKey.columnName, 'id');
    });

    it('should parse PostgreSQL table with JSON', () => {
      const sql = `
        CREATE TABLE api_logs (
          id SERIAL PRIMARY KEY,
          request_data JSONB,
          response_data JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;

      const result = parseDDL(sql);

      assert.strictEqual(result.success, true);
      assert.ok(result.data);

      const requestData = result.data.columns.find(c => c.columnName === 'request_data');
      assert.ok(requestData);
      assert.strictEqual(requestData.javaType, 'String');
    });
  });
});
