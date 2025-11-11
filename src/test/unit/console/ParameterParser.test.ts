/**
 * Unit tests for ParameterParser
 */

import * as assert from 'assert';
import { ParameterParser } from '../../../console/parser/ParameterParser';

describe('ParameterParser', () => {
    describe('parse', () => {
        it('should parse simple parameters', () => {
            const paramString = '1(Integer), active(String)';
            const params = ParameterParser.parse(paramString);

            assert.strictEqual(params.length, 2);
            assert.deepStrictEqual(params[0], { value: '1', type: 'Integer' });
            assert.deepStrictEqual(params[1], { value: 'active', type: 'String' });
        });

        it('should parse multiple string parameters', () => {
            const paramString = 'MATIC(String), 0(String), 1(String)';
            const params = ParameterParser.parse(paramString);

            assert.strictEqual(params.length, 3);
            assert.deepStrictEqual(params[0], { value: 'MATIC', type: 'String' });
            assert.deepStrictEqual(params[1], { value: '0', type: 'String' });
            assert.deepStrictEqual(params[2], { value: '1', type: 'String' });
        });

        it('should handle null parameter', () => {
            const paramString = 'null';
            const params = ParameterParser.parse(paramString);

            assert.strictEqual(params.length, 1);
            assert.deepStrictEqual(params[0], { value: 'null', type: 'Unknown' });
        });

        it('should handle mixed parameters with null', () => {
            const paramString = '1(Integer), null, active(String)';
            const params = ParameterParser.parse(paramString);

            assert.strictEqual(params.length, 3);
            assert.deepStrictEqual(params[0], { value: '1', type: 'Integer' });
            assert.deepStrictEqual(params[1], { value: 'null', type: 'Unknown' });
            assert.deepStrictEqual(params[2], { value: 'active', type: 'String' });
        });

        it('should handle date/time parameters', () => {
            const paramString = '2025-01-15 10:30:45(Timestamp), 123(Long)';
            const params = ParameterParser.parse(paramString);

            assert.strictEqual(params.length, 2);
            assert.deepStrictEqual(params[0], { value: '2025-01-15 10:30:45', type: 'Timestamp' });
            assert.deepStrictEqual(params[1], { value: '123', type: 'Long' });
        });

        it('should handle numeric types', () => {
            const paramString = '1(Integer), 2(Long), 3.14(Double), 9.99(BigDecimal)';
            const params = ParameterParser.parse(paramString);

            assert.strictEqual(params.length, 4);
            assert.deepStrictEqual(params[0], { value: '1', type: 'Integer' });
            assert.deepStrictEqual(params[1], { value: '2', type: 'Long' });
            assert.deepStrictEqual(params[2], { value: '3.14', type: 'Double' });
            assert.deepStrictEqual(params[3], { value: '9.99', type: 'BigDecimal' });
        });

        it('should handle empty string', () => {
            const params = ParameterParser.parse('');
            assert.strictEqual(params.length, 0);
        });

        it('should handle whitespace', () => {
            const paramString = '  1(Integer)  ,  active(String)  ';
            const params = ParameterParser.parse(paramString);

            assert.strictEqual(params.length, 2);
            assert.deepStrictEqual(params[0], { value: '1', type: 'Integer' });
            assert.deepStrictEqual(params[1], { value: 'active', type: 'String' });
        });

        it('should handle single parameter', () => {
            const paramString = '123(Long)';
            const params = ParameterParser.parse(paramString);

            assert.strictEqual(params.length, 1);
            assert.deepStrictEqual(params[0], { value: '123', type: 'Long' });
        });
    });

    describe('validateParameterCount', () => {
        it('should validate matching counts', () => {
            const sql = 'SELECT * FROM user WHERE id = ? AND status = ?';
            const params = [
                { value: '1', type: 'Integer' },
                { value: 'active', type: 'String' }
            ];

            assert.strictEqual(ParameterParser.validateParameterCount(sql, params), true);
        });

        it('should reject mismatched counts - too few parameters', () => {
            const sql = 'SELECT * FROM user WHERE id = ? AND status = ?';
            const params = [{ value: '1', type: 'Integer' }];

            assert.strictEqual(ParameterParser.validateParameterCount(sql, params), false);
        });

        it('should reject mismatched counts - too many parameters', () => {
            const sql = 'SELECT * FROM user WHERE id = ?';
            const params = [
                { value: '1', type: 'Integer' },
                { value: 'active', type: 'String' }
            ];

            assert.strictEqual(ParameterParser.validateParameterCount(sql, params), false);
        });

        it('should handle SQL with no placeholders', () => {
            const sql = 'SELECT * FROM user';
            const params: any[] = [];

            assert.strictEqual(ParameterParser.validateParameterCount(sql, params), true);
        });

        it('should handle IN clause with multiple placeholders', () => {
            const sql = 'SELECT * FROM user WHERE status IN (?, ?, ?)';
            const params = [
                { value: '0', type: 'String' },
                { value: '1', type: 'String' },
                { value: '2', type: 'String' }
            ];

            assert.strictEqual(ParameterParser.validateParameterCount(sql, params), true);
        });
    });
});
