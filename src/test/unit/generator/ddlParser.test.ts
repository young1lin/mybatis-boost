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
      assert.strictEqual(result.data.databaseType, 'mysql');
      assert.strictEqual(result.data.columns.length, 4);

      // Check primary key
      assert.ok(result.data.primaryKey);
      assert.strictEqual(result.data.primaryKey.columnName, 'id');
      assert.strictEqual(result.data.primaryKey.isPrimaryKey, true);

      // Check column details
      const userNameCol = result.data.columns.find(c => c.columnName === 'user_name');
      assert.ok(userNameCol);
      assert.strictEqual(userNameCol.nullable, false);
      assert.strictEqual(userNameCol.javaType, 'String');
      assert.strictEqual(userNameCol.javaTypeFullName, ''); // java.lang types don't need import
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
      assert.strictEqual(orderIdCol.javaType, 'Long');
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

    it('should extract MySQL table comment from table options', () => {
      const tableComment = "User account table";
      const sql = `
        CREATE TABLE users (
          id INT PRIMARY KEY,
          username VARCHAR(50) NOT NULL,
          email VARCHAR(100)
        ) ENGINE=InnoDB COMMENT='${tableComment}'
      `;

      const result = parseDDL(sql, { dbType: 'mysql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.tableName, 'users');
      assert.strictEqual(result.data.comment, tableComment);
    });

    it('should extract MySQL table comment without ENGINE clause', () => {
      const tableComment = "Product categories";
      const sql = `
        CREATE TABLE categories (
          id INT PRIMARY KEY,
          name VARCHAR(100)
        ) COMMENT='${tableComment}'
      `;

      const result = parseDDL(sql, { dbType: 'mysql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.comment, tableComment);
    });

    it('should extract MySQL table comment with COMMENT= syntax', () => {
      const tableComment = "Application logs";
      const sql = `
        CREATE TABLE logs (
          log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
          message TEXT,
          created_at DATETIME
        ) COMMENT='${tableComment}'
      `;

      const result = parseDDL(sql);

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.comment, tableComment);
    });

    it('should extract both MySQL table and column comments', () => {
      const tableComment = "Order records";
      const sql = `
        CREATE TABLE orders (
          order_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'Order identifier',
          order_number VARCHAR(50) NOT NULL COMMENT 'Human-readable order number',
          total_amount DECIMAL(10,2) COMMENT 'Total order amount',
          created_at DATETIME COMMENT 'Order creation time'
        ) ENGINE=InnoDB COMMENT='${tableComment}'
      `;

      const result = parseDDL(sql, { dbType: 'mysql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.comment, tableComment);

      const idCol = result.data.columns.find(c => c.columnName === 'order_id');
      assert.ok(idCol);
      assert.strictEqual(idCol.comment, 'Order identifier');

      const numberCol = result.data.columns.find(c => c.columnName === 'order_number');
      assert.ok(numberCol);
      assert.strictEqual(numberCol.comment, 'Human-readable order number');

      const amountCol = result.data.columns.find(c => c.columnName === 'total_amount');
      assert.ok(amountCol);
      assert.strictEqual(amountCol.comment, 'Total order amount');
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
      assert.strictEqual(result.data.databaseType, 'postgresql');

      // Check SERIAL type mapping
      const idCol = result.data.columns.find(c => c.columnName === 'id');
      assert.ok(idCol);
      assert.strictEqual(idCol.javaType, 'Long');
      assert.strictEqual(idCol.javaTypeFullName, ''); // java.lang types don't need import
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
      assert.strictEqual(logIdCol.javaType, 'Long');
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

    it('should parse PostgreSQL table without inline COMMENT support', () => {
      // PostgreSQL does not support inline COMMENT='...' syntax (MySQL-specific)
      // Use COMMENT ON TABLE instead
      const sql = `
        CREATE TABLE sessions (
          session_id SERIAL PRIMARY KEY,
          user_id INT NOT NULL,
          token VARCHAR(255),
          expires_at TIMESTAMP
        )
      `;

      const result = parseDDL(sql, { dbType: 'postgresql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.tableName, 'sessions');
      assert.strictEqual(result.data.comment, undefined); // No comment since inline COMMENT not supported
    });

    it('should extract PostgreSQL column comments', () => {
      const sql = `
        CREATE TABLE events (
          event_id SERIAL PRIMARY KEY COMMENT 'Event identifier',
          event_name VARCHAR(100) COMMENT 'Event name',
          event_date TIMESTAMP COMMENT 'Event timestamp'
        )
      `;

      const result = parseDDL(sql, { dbType: 'postgresql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);

      const idCol = result.data.columns.find(c => c.columnName === 'event_id');
      assert.ok(idCol);
      assert.strictEqual(idCol.comment, 'Event identifier');

      const nameCol = result.data.columns.find(c => c.columnName === 'event_name');
      assert.ok(nameCol);
      assert.strictEqual(nameCol.comment, 'Event name');

      const dateCol = result.data.columns.find(c => c.columnName === 'event_date');
      assert.ok(dateCol);
      assert.strictEqual(dateCol.comment, 'Event timestamp');
    });

    it('should extract PostgreSQL inline column comments', () => {
      // PostgreSQL regex parser supports inline COMMENT as fallback (non-standard)
      const sql = `
        CREATE TABLE products (
          product_id BIGSERIAL PRIMARY KEY COMMENT 'Product ID',
          product_name VARCHAR(200) NOT NULL COMMENT 'Product name',
          price NUMERIC(10,2) COMMENT 'Product price',
          created_at TIMESTAMP COMMENT 'Creation time'
        )
      `;

      const result = parseDDL(sql, { dbType: 'postgresql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.comment, undefined); // Inline table COMMENT not supported

      const idCol = result.data.columns.find(c => c.columnName === 'product_id');
      assert.ok(idCol);
      assert.strictEqual(idCol.comment, 'Product ID');

      const nameCol = result.data.columns.find(c => c.columnName === 'product_name');
      assert.ok(nameCol);
      assert.strictEqual(nameCol.comment, 'Product name');

      const priceCol = result.data.columns.find(c => c.columnName === 'price');
      assert.ok(priceCol);
      assert.strictEqual(priceCol.comment, 'Product price');
    });

    it('should extract PostgreSQL column comments from COMMENT ON COLUMN statements', () => {
      const sql = `
        BEGIN;

        CREATE TABLE orders (
          order_id BIGSERIAL PRIMARY KEY,
          order_no VARCHAR(64) NOT NULL UNIQUE,
          user_id BIGINT NOT NULL,
          product_id BIGINT NOT NULL,
          product_name VARCHAR(255) NOT NULL,
          product_price DECIMAL(10, 2) NOT NULL,
          quantity INT NOT NULL DEFAULT 1,
          total_amount DECIMAL(10, 2) NOT NULL,
          discount_amount DECIMAL(10, 2) DEFAULT 0.00,
          actual_amount DECIMAL(10, 2) NOT NULL,
          order_status SMALLINT NOT NULL DEFAULT 0,
          payment_method SMALLINT,
          payment_time TIMESTAMP,
          shipping_address VARCHAR(500),
          receiver_name VARCHAR(100),
          receiver_phone VARCHAR(20),
          remark TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP
        );

        COMMENT ON COLUMN orders.order_id IS '订单主键ID';
        COMMENT ON COLUMN orders.order_no IS '订单编号';
        COMMENT ON COLUMN orders.user_id IS '用户ID';
        COMMENT ON COLUMN orders.product_name IS '商品名称';
        COMMENT ON COLUMN orders.quantity IS '购买数量';
        COMMENT ON COLUMN orders.discount_amount IS '优惠金额';
        COMMENT ON COLUMN orders.order_status IS '订单状态：0-待支付 1-已支付 2-已发货 3-已完成 4-已取消';
        COMMENT ON COLUMN orders.payment_time IS '支付时间';
        COMMENT ON COLUMN orders.receiver_name IS '收货人姓名';
        COMMENT ON COLUMN orders.remark IS '订单备注';

        COMMIT;
      `;

      const result = parseDDL(sql, { dbType: 'postgresql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.tableName, 'orders');

      const orderIdCol = result.data.columns.find(c => c.columnName === 'order_id');
      assert.ok(orderIdCol);
      assert.strictEqual(orderIdCol.comment, '订单主键ID');

      const orderNoCol = result.data.columns.find(c => c.columnName === 'order_no');
      assert.ok(orderNoCol);
      assert.strictEqual(orderNoCol.comment, '订单编号');

      const userIdCol = result.data.columns.find(c => c.columnName === 'user_id');
      assert.ok(userIdCol);
      assert.strictEqual(userIdCol.comment, '用户ID');

      const productNameCol = result.data.columns.find(c => c.columnName === 'product_name');
      assert.ok(productNameCol);
      assert.strictEqual(productNameCol.comment, '商品名称');

      const quantityCol = result.data.columns.find(c => c.columnName === 'quantity');
      assert.ok(quantityCol);
      assert.strictEqual(quantityCol.comment, '购买数量');

      const discountCol = result.data.columns.find(c => c.columnName === 'discount_amount');
      assert.ok(discountCol);
      assert.strictEqual(discountCol.comment, '优惠金额');

      const statusCol = result.data.columns.find(c => c.columnName === 'order_status');
      assert.ok(statusCol);
      assert.strictEqual(statusCol.comment, '订单状态：0-待支付 1-已支付 2-已发货 3-已完成 4-已取消');

      const paymentTimeCol = result.data.columns.find(c => c.columnName === 'payment_time');
      assert.ok(paymentTimeCol);
      assert.strictEqual(paymentTimeCol.comment, '支付时间');

      const receiverNameCol = result.data.columns.find(c => c.columnName === 'receiver_name');
      assert.ok(receiverNameCol);
      assert.strictEqual(receiverNameCol.comment, '收货人姓名');

      const remarkCol = result.data.columns.find(c => c.columnName === 'remark');
      assert.ok(remarkCol);
      assert.strictEqual(remarkCol.comment, '订单备注');

      // Verify columns without comments have undefined comment
      const productIdCol = result.data.columns.find(c => c.columnName === 'product_id');
      assert.ok(productIdCol);
      assert.strictEqual(productIdCol.comment, undefined);
    });

    it('should extract both PostgreSQL table and column comments from COMMENT ON statements', () => {
      const sql = `
        CREATE TABLE users (
          user_id SERIAL PRIMARY KEY,
          username VARCHAR(50) NOT NULL,
          email VARCHAR(100)
        );

        COMMENT ON TABLE users IS 'User accounts table';
        COMMENT ON COLUMN users.user_id IS 'User ID';
        COMMENT ON COLUMN users.username IS 'Login username';
        COMMENT ON COLUMN users.email IS 'Email address';
      `;

      const result = parseDDL(sql, { dbType: 'postgresql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.tableName, 'users');
      assert.strictEqual(result.data.comment, 'User accounts table');

      const userIdCol = result.data.columns.find(c => c.columnName === 'user_id');
      assert.ok(userIdCol);
      assert.strictEqual(userIdCol.comment, 'User ID');

      const usernameCol = result.data.columns.find(c => c.columnName === 'username');
      assert.ok(usernameCol);
      assert.strictEqual(usernameCol.comment, 'Login username');

      const emailCol = result.data.columns.find(c => c.columnName === 'email');
      assert.ok(emailCol);
      assert.strictEqual(emailCol.comment, 'Email address');
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
      assert.strictEqual(idCol.javaType, 'Long');
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

    it('should extract Oracle table comment from COMMENT ON TABLE statement', () => {
      const tableComment = "User information table";
      const sql = `
        CREATE TABLE user_info (
          id NUMBER(10) PRIMARY KEY,
          user_name VARCHAR2(50) NOT NULL,
          email VARCHAR2(100)
        );

        COMMENT ON TABLE user_info IS '${tableComment}';
      `;

      const result = parseDDL(sql, { dbType: 'oracle' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.tableName, 'user_info');
      assert.strictEqual(result.data.comment, tableComment);
    });

    it('should extract Oracle column comments from COMMENT ON COLUMN statements', () => {
      const sql = `
        CREATE TABLE products (
          product_id NUMBER(10) PRIMARY KEY,
          product_name VARCHAR2(100) NOT NULL,
          price NUMBER(10,2),
          created_date DATE
        );

        COMMENT ON COLUMN products.product_id IS 'Primary key';
        COMMENT ON COLUMN products.product_name IS 'Product name';
        COMMENT ON COLUMN products.price IS 'Product price in USD';
        COMMENT ON COLUMN products.created_date IS 'Creation timestamp';
      `;

      const result = parseDDL(sql, { dbType: 'oracle' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);

      const idCol = result.data.columns.find(c => c.columnName === 'product_id');
      assert.ok(idCol);
      assert.strictEqual(idCol.comment, 'Primary key');

      const nameCol = result.data.columns.find(c => c.columnName === 'product_name');
      assert.ok(nameCol);
      assert.strictEqual(nameCol.comment, 'Product name');

      const priceCol = result.data.columns.find(c => c.columnName === 'price');
      assert.ok(priceCol);
      assert.strictEqual(priceCol.comment, 'Product price in USD');

      const dateCol = result.data.columns.find(c => c.columnName === 'created_date');
      assert.ok(dateCol);
      assert.strictEqual(dateCol.comment, 'Creation timestamp');
    });

    it('should extract both table and column comments for Oracle', () => {
      const sql = `
        CREATE TABLE orders (
          order_id NUMBER(20) PRIMARY KEY,
          order_number VARCHAR2(50),
          total_amount NUMBER(10,2),
          status VARCHAR2(20) DEFAULT 'PENDING'
        );

        COMMENT ON TABLE orders IS 'Order records table';
        COMMENT ON COLUMN orders.order_id IS 'Unique order identifier';
        COMMENT ON COLUMN orders.order_number IS 'Human-readable order number';
        COMMENT ON COLUMN orders.total_amount IS 'Total order amount';
        COMMENT ON COLUMN orders.status IS 'Order status';
      `;

      const result = parseDDL(sql, { dbType: 'oracle' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.tableName, 'orders');
      assert.strictEqual(result.data.comment, 'Order records table');

      const idCol = result.data.columns.find(c => c.columnName === 'order_id');
      assert.ok(idCol);
      assert.strictEqual(idCol.comment, 'Unique order identifier');

      const numberCol = result.data.columns.find(c => c.columnName === 'order_number');
      assert.ok(numberCol);
      assert.strictEqual(numberCol.comment, 'Human-readable order number');

      const amountCol = result.data.columns.find(c => c.columnName === 'total_amount');
      assert.ok(amountCol);
      assert.strictEqual(amountCol.comment, 'Total order amount');

      const statusCol = result.data.columns.find(c => c.columnName === 'status');
      assert.ok(statusCol);
      assert.strictEqual(statusCol.comment, 'Order status');
    });

    it('should handle Oracle DDL with quoted identifiers in comments', () => {
      const sql = `
        CREATE TABLE "DEPT_INFO" (
          "DEPT_ID" NUMBER(10) PRIMARY KEY,
          "DEPT_NAME" VARCHAR2(50)
        );

        COMMENT ON TABLE "DEPT_INFO" IS 'Department information';
        COMMENT ON COLUMN "DEPT_INFO"."DEPT_ID" IS 'Department ID';
        COMMENT ON COLUMN "DEPT_INFO"."DEPT_NAME" IS 'Department name';
      `;

      const result = parseDDL(sql, { dbType: 'oracle' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.tableName, 'DEPT_INFO');
      assert.strictEqual(result.data.comment, 'Department information');

      const idCol = result.data.columns.find(c => c.columnName === 'DEPT_ID');
      assert.ok(idCol);
      assert.strictEqual(idCol.comment, 'Department ID');

      const nameCol = result.data.columns.find(c => c.columnName === 'DEPT_NAME');
      assert.ok(nameCol);
      assert.strictEqual(nameCol.comment, 'Department name');
    });

    it('should merge inline comments with COMMENT ON COLUMN statements for Oracle', () => {
      const sql = `
        CREATE TABLE inventory (
          item_id NUMBER(10) PRIMARY KEY COMMENT 'Item identifier',
          item_name VARCHAR2(100),
          quantity NUMBER(10)
        );

        COMMENT ON COLUMN inventory.item_name IS 'Item description';
        COMMENT ON COLUMN inventory.quantity IS 'Stock quantity';
      `;

      const result = parseDDL(sql, { dbType: 'oracle' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);

      // Inline comment should be preserved
      const idCol = result.data.columns.find(c => c.columnName === 'item_id');
      assert.ok(idCol);
      assert.strictEqual(idCol.comment, 'Item identifier');

      // COMMENT ON COLUMN should be applied
      const nameCol = result.data.columns.find(c => c.columnName === 'item_name');
      assert.ok(nameCol);
      assert.strictEqual(nameCol.comment, 'Item description');

      const qtyCol = result.data.columns.find(c => c.columnName === 'quantity');
      assert.ok(qtyCol);
      assert.strictEqual(qtyCol.comment, 'Stock quantity');
    });

    it('should handle Oracle DDL without any comments', () => {
      const sql = `
        CREATE TABLE simple_table (
          id NUMBER(10) PRIMARY KEY,
          name VARCHAR2(50)
        )
      `;

      const result = parseDDL(sql, { dbType: 'oracle' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.tableName, 'simple_table');
      assert.strictEqual(result.data.comment, undefined);

      const idCol = result.data.columns.find(c => c.columnName === 'id');
      assert.ok(idCol);
      assert.strictEqual(idCol.comment, undefined);

      const nameCol = result.data.columns.find(c => c.columnName === 'name');
      assert.ok(nameCol);
      assert.strictEqual(nameCol.comment, undefined);
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

    it('should map NOT NULL columns to wrapper types', () => {
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
      assert.strictEqual(count.javaType, 'Integer');
      assert.strictEqual(count.nullable, false);

      const total = result.data.columns.find(c => c.columnName === 'total');
      assert.ok(total);
      assert.strictEqual(total.javaType, 'Long');

      const active = result.data.columns.find(c => c.columnName === 'active');
      assert.ok(active);
      assert.strictEqual(active.javaType, 'Boolean');
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


  describe('Date/Time type configuration', () => {
    it('should use LocalDateTime by default', () => {
      const sql = `
        CREATE TABLE events (
          id INT PRIMARY KEY,
          created_at DATETIME,
          updated_at TIMESTAMP
        )
      `;

      const result = parseDDL(sql, { dbType: 'mysql' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);

      const createdAt = result.data.columns.find(c => c.columnName === 'created_at');
      assert.ok(createdAt);
      assert.strictEqual(createdAt.javaType, 'LocalDateTime');

      const updatedAt = result.data.columns.find(c => c.columnName === 'updated_at');
      assert.ok(updatedAt);
      assert.strictEqual(updatedAt.javaType, 'LocalDateTime');
    });

    it('should support Date type configuration', () => {
      const sql = `
        CREATE TABLE events (
          id INT PRIMARY KEY,
          created_at DATETIME
        )
      `;

      const result = parseDDL(sql, { dbType: 'mysql', dateTimeType: 'Date' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);

      const createdAt = result.data.columns.find(c => c.columnName === 'created_at');
      assert.ok(createdAt);
      assert.strictEqual(createdAt.javaType, 'Date');
    });

    it('should support Instant type configuration', () => {
      const sql = `
        CREATE TABLE events (
          id INT PRIMARY KEY,
          created_at TIMESTAMP
        )
      `;

      const result = parseDDL(sql, { dbType: 'mysql', dateTimeType: 'Instant' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);

      const createdAt = result.data.columns.find(c => c.columnName === 'created_at');
      assert.ok(createdAt);
      assert.strictEqual(createdAt.javaType, 'Instant');
    });

    it('should always map DATE to LocalDate regardless of dateTimeType', () => {
      const sql = `
        CREATE TABLE events (
          id INT PRIMARY KEY,
          event_date DATE,
          created_at DATETIME
        )
      `;

      const result = parseDDL(sql, { dbType: 'mysql', dateTimeType: 'Date' });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);

      // DATE always maps to LocalDate
      const eventDate = result.data.columns.find(c => c.columnName === 'event_date');
      assert.ok(eventDate);
      assert.strictEqual(eventDate.javaType, 'LocalDate');

      // DATETIME respects dateTimeType configuration
      const createdAt = result.data.columns.find(c => c.columnName === 'created_at');
      assert.ok(createdAt);
      assert.strictEqual(createdAt.javaType, 'Date');
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
