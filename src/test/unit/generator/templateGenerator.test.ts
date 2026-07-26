import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { CodeGenerator, GeneratorConfig } from '../../../generator/template/templateGenerator';
import { ParsedSchema } from '../../../generator/type';

describe('CodeGenerator', () => {
    let generator: CodeGenerator;
    let config: GeneratorConfig;
    let mockParsedSchema: ParsedSchema;

    beforeEach(() => {
        config = {
            basePackage: 'com.example.mybatis',
            author: 'Test Author',
            outputDir: '/tmp/output',
            useLombok: true,
            useSwagger: false,
            useSwaggerV3: false,
            useMyBatisPlus: false,
            entitySuffix: 'PO',
            mapperSuffix: 'Mapper',
            serviceSuffix: 'Service',
        };

        mockParsedSchema = {
            tableName: 'user_info',
            databaseType: 'mysql',
            comment: 'User information table',
            columns: [
                {
                    columnName: 'id',
                    sqlType: 'BIGINT',
                    typeParams: '',
                    javaType: 'Long',
                    javaTypeFullName: '',
                    nullable: false,
                    isPrimaryKey: true,
                    comment: 'Primary key ID',
                },
                {
                    columnName: 'user_name',
                    sqlType: 'VARCHAR',
                    typeParams: '',
                    javaType: 'String',
                    javaTypeFullName: '',
                    nullable: false,
                    isPrimaryKey: false,
                    comment: 'User name',
                },
                {
                    columnName: 'age',
                    sqlType: 'INT',
                    typeParams: '',
                    javaType: 'Integer',
                    javaTypeFullName: '',
                    nullable: true,
                    isPrimaryKey: false,
                    comment: 'User age',
                },
                {
                    columnName: 'email',
                    sqlType: 'VARCHAR',
                    typeParams: '',
                    javaType: 'String',
                    javaTypeFullName: '',
                    nullable: true,
                    isPrimaryKey: false,
                    comment: 'Email address',
                },
                {
                    columnName: 'created_at',
                    sqlType: 'DATETIME',
                    typeParams: '',
                    javaType: 'LocalDateTime',
                    javaTypeFullName: 'java.time.LocalDateTime',
                    nullable: false,
                    isPrimaryKey: false,
                    comment: 'Creation time',
                },
                {
                    columnName: 'balance',
                    sqlType: 'DECIMAL',
                    typeParams: '',
                    javaType: 'BigDecimal',
                    javaTypeFullName: 'java.math.BigDecimal',
                    nullable: true,
                    isPrimaryKey: false,
                    comment: 'Account balance',
                },
            ],
            primaryKey: {
                columnName: 'id',
                sqlType: 'BIGINT',
                typeParams: '',
                javaType: 'Long',
                javaTypeFullName: '',
                nullable: false,
                isPrimaryKey: true,
                comment: 'Primary key ID',
            },
        };

        generator = new CodeGenerator(config, mockParsedSchema);
    });

    describe('generateEntity', () => {
        it('should generate entity with Lombok', () => {
            const templatePath = path.join(__dirname, '../../../generator/template/entity.ejs');
            const result = generator.generateEntity(templatePath);

            assert.strictEqual(result.name, 'UserInfoPO.java');
            assert.strictEqual(result.type, 'java');
            assert.ok(result.content.includes('package com.example.mybatis.entity;'));
            assert.ok(result.content.includes('@Data'));
            assert.ok(result.content.includes('public class UserInfoPO'));
            assert.ok(result.content.includes('private Long id;'));
            assert.ok(result.content.includes('private String userName;'));
            assert.ok(result.content.includes('private Integer age;'));
            assert.ok(result.content.includes('private LocalDateTime createdAt;'));
            assert.ok(result.content.includes('private BigDecimal balance;'));
            assert.ok(result.content.includes('import java.time.LocalDateTime;'));
            assert.ok(result.content.includes('import java.math.BigDecimal;'));

            // Should NOT have getter/setter methods when using Lombok
            assert.ok(!result.content.includes('public Long getId()'));
            assert.ok(!result.content.includes('public void setId('));

            console.log('\n=== Generated Entity (with Lombok) ===');
            console.log(result.content);
        });

        it('should generate entity without Lombok', () => {
            const configNoLombok = {
                ...config,
                useLombok: false,
            };
            const generatorNoLombok = new CodeGenerator(configNoLombok, mockParsedSchema);
            const templatePath = path.join(__dirname, '../../../generator/template/entity.ejs');
            const result = generatorNoLombok.generateEntity(templatePath);

            assert.ok(!result.content.includes('@Data'));
            assert.ok(result.content.includes('public Long getId()'));
            assert.ok(result.content.includes('public void setId(Long id)'));
            assert.ok(result.content.includes('public String getUserName()'));
            assert.ok(result.content.includes('public void setUserName(String userName)'));

            console.log('\n=== Generated Entity (without Lombok) ===');
            console.log(result.content);
        });

        it('should generate entity with MyBatis-Plus annotations', () => {
            const configWithMBP = {
                ...config,
                useMyBatisPlus: true,
            };
            const generatorWithMBP = new CodeGenerator(configWithMBP, mockParsedSchema);
            const templatePath = path.join(__dirname, '../../../generator/template/entity.ejs');
            const result = generatorWithMBP.generateEntity(templatePath);

            assert.ok(result.content.includes('@TableName("user_info")'));
            assert.ok(result.content.includes('@TableId(type = IdType.AUTO)'));
            assert.ok(result.content.includes('import com.baomidou.mybatisplus.annotation.TableName;'));
            assert.ok(result.content.includes('import com.baomidou.mybatisplus.annotation.TableId;'));

            console.log('\n=== Generated Entity (with MyBatis-Plus) ===');
            console.log(result.content);
        });

        it('should generate entity with Swagger annotations', () => {
            const configWithSwagger = {
                ...config,
                useSwagger: true,
            };
            const generatorWithSwagger = new CodeGenerator(configWithSwagger, mockParsedSchema);
            const templatePath = path.join(__dirname, '../../../generator/template/entity.ejs');
            const result = generatorWithSwagger.generateEntity(templatePath);

            assert.ok(result.content.includes('@ApiModel(value = "UserInfoPO")'));
            assert.ok(result.content.includes('@ApiModelProperty(value ='));
            assert.ok(result.content.includes('import io.swagger.annotations.ApiModel;'));

            console.log('\n=== Generated Entity (with Swagger v2) ===');
            console.log(result.content);
        });

        it('should generate entity with Swagger V3 annotations', () => {
            const configWithSwaggerV3 = {
                ...config,
                useSwagger: true,
                useSwaggerV3: true,
            };
            const generatorWithSwaggerV3 = new CodeGenerator(configWithSwaggerV3, mockParsedSchema);
            const templatePath = path.join(__dirname, '../../../generator/template/entity.ejs');
            const result = generatorWithSwaggerV3.generateEntity(templatePath);

            assert.ok(result.content.includes('@Schema(description = "UserInfoPO")'));
            assert.ok(result.content.includes('import io.swagger.v3.oas.annotations.media.Schema;'));

            console.log('\n=== Generated Entity (with Swagger v3) ===');
            console.log(result.content);
        });
    });

    describe('generateMapper', () => {
        it('should generate Mapper interface without MyBatis-Plus', () => {
            const templatePath = path.join(__dirname, '../../../generator/template/mapper.ejs');
            const result = generator.generateMapper(templatePath);

            assert.strictEqual(result.name, 'UserInfoMapper.java');
            assert.strictEqual(result.type, 'java');
            assert.ok(result.content.includes('package com.example.mybatis.mapper;'));
            assert.ok(result.content.includes('@Mapper'));
            assert.ok(result.content.includes('public interface UserInfoMapper'));
            assert.ok(result.content.includes('UserInfoPO selectById(Long id);'));
            assert.ok(result.content.includes('List<UserInfoPO> selectAll();'));
            assert.ok(result.content.includes('int insert(UserInfoPO entity);'));
            assert.ok(result.content.includes('int updateById(UserInfoPO entity);'));
            assert.ok(result.content.includes('int deleteById(Long id);'));

            console.log('\n=== Generated Mapper (without MyBatis-Plus) ===');
            console.log(result.content);
        });

        it('should generate Mapper interface with MyBatis-Plus', () => {
            const configWithMBP = {
                ...config,
                useMyBatisPlus: true,
            };
            const generatorWithMBP = new CodeGenerator(configWithMBP, mockParsedSchema);
            const templatePath = path.join(__dirname, '../../../generator/template/mapper.ejs');
            const result = generatorWithMBP.generateMapper(templatePath);

            assert.ok(!result.content.includes('@Mapper'));
            assert.ok(result.content.includes('extends BaseMapper<UserInfoPO>'));
            assert.ok(result.content.includes('import com.baomidou.mybatisplus.core.mapper.BaseMapper;'));

            // Should NOT have CRUD methods when using MyBatis-Plus
            assert.ok(!result.content.includes('UserInfoPO selectById'));

            console.log('\n=== Generated Mapper (with MyBatis-Plus) ===');
            console.log(result.content);
        });
    });

    describe('generateMapperXml', () => {
        it('should generate Mapper XML', () => {
            const templatePath = path.join(__dirname, '../../../generator/template/mapper-xml.ejs');
            const result = generator.generateMapperXml(templatePath);

            assert.strictEqual(result.name, 'UserInfoMapper.xml');
            assert.strictEqual(result.type, 'xml');
            assert.ok(result.content.includes('<?xml version="1.0" encoding="UTF-8"?>'));
            assert.ok(result.content.includes('<mapper namespace="com.example.mybatis.mapper.UserInfoMapper">'));
            assert.ok(result.content.includes('<resultMap id="baseResultMap"'));
            assert.ok(result.content.includes('type="com.example.mybatis.entity.UserInfoPO"'));
            assert.ok(result.content.includes('<id column="id"'));
            assert.ok(result.content.includes('<result column="user_name"'));
            assert.ok(result.content.includes('<select id="selectById"'));
            assert.ok(result.content.includes('<select id="selectAll"'));
            assert.ok(result.content.includes('<insert id="insert"'));
            assert.ok(result.content.includes('<update id="updateById"'));
            assert.ok(result.content.includes('<delete id="deleteById"'));
            assert.ok(result.content.includes('FROM user_info'));

            console.log('\n=== Generated Mapper XML ===');
            console.log(result.content);
        });
    });

    describe('generateService', () => {
        it('should generate Service class with Lombok', () => {
            const templatePath = path.join(__dirname, '../../../generator/template/service.ejs');
            const result = generator.generateService(templatePath);

            assert.strictEqual(result.name, 'UserInfoService.java');
            assert.strictEqual(result.type, 'java');
            assert.ok(result.content.includes('package com.example.mybatis.service;'));
            assert.ok(result.content.includes('@Service'));
            assert.ok(result.content.includes('@RequiredArgsConstructor'));
            assert.ok(result.content.includes('public class UserInfoService'));
            assert.ok(result.content.includes('private final UserInfoMapper userInfoMapper;'));
            assert.ok(result.content.includes('public UserInfoPO getById(Long id)'));
            assert.ok(result.content.includes('public List<UserInfoPO> listAll()'));
            assert.ok(result.content.includes('public boolean save(UserInfoPO entity)'));
            assert.ok(result.content.includes('public boolean updateById(UserInfoPO entity)'));
            assert.ok(result.content.includes('public boolean removeById(Long id)'));
            assert.ok(result.content.includes('import lombok.RequiredArgsConstructor;'));

            // Should NOT have @Autowired when using Lombok
            assert.ok(!result.content.includes('@Autowired'));

            console.log('\n=== Generated Service (with Lombok) ===');
            console.log(result.content);
        });

        it('should generate Service class without Lombok', () => {
            const configNoLombok = {
                ...config,
                useLombok: false,
            };
            const generatorNoLombok = new CodeGenerator(configNoLombok, mockParsedSchema);
            const templatePath = path.join(__dirname, '../../../generator/template/service.ejs');
            const result = generatorNoLombok.generateService(templatePath);

            assert.ok(!result.content.includes('@RequiredArgsConstructor'));
            assert.ok(result.content.includes('@Autowired'));
            assert.ok(result.content.includes('private UserInfoMapper userInfoMapper;'));
            assert.ok(!result.content.includes('private final'));

            console.log('\n=== Generated Service (without Lombok) ===');
            console.log(result.content);
        });
    });

    describe('generateAll', () => {
        it('should generate all files (Entity, Mapper, XML, Service)', () => {
            const results = generator.generateAll();

            assert.strictEqual(results.length, 4);

            const [entity, mapper, xml, service] = results;

            assert.strictEqual(entity.name, 'UserInfoPO.java');
            assert.strictEqual(entity.type, 'java');
            assert.ok(entity.outputPath.includes('entity'));

            assert.strictEqual(mapper.name, 'UserInfoMapper.java');
            assert.strictEqual(mapper.type, 'java');
            assert.ok(mapper.outputPath.includes('mapper'));

            assert.strictEqual(xml.name, 'UserInfoMapper.xml');
            assert.strictEqual(xml.type, 'xml');
            assert.ok(xml.outputPath.includes('resources'));

            assert.strictEqual(service.name, 'UserInfoService.java');
            assert.strictEqual(service.type, 'java');
            assert.ok(service.outputPath.includes('service'));

            console.log('\n=== Generated All Files Summary ===');
            results.forEach(result => {
                console.log(`\nFile: ${result.name}`);
                console.log(`Path: ${result.outputPath}`);
                console.log(`Type: ${result.type}`);
                console.log('---');
            });
        });

        it('generates MyBatis-Plus service, implementation, and controller without extra configuration', () => {
            const generatorWithMBP = new CodeGenerator({ ...config, useMyBatisPlus: true }, mockParsedSchema);
            const results = generatorWithMBP.generateAll();

            assert.strictEqual(results.length, 6);
            const [, , , service, serviceImpl, controller] = results;

            assert.strictEqual(service.name, 'UserInfoService.java');
            assert.ok(service.content.includes('extends IService<UserInfoPO>'));
            assert.ok(!service.content.includes('import com.example.mybatis.mapper.UserInfoMapper;'));
            assert.strictEqual(serviceImpl.name, 'UserInfoServiceImpl.java');
            assert.ok(serviceImpl.outputPath.includes(path.join('service', 'impl')));
            assert.ok(serviceImpl.content.includes('extends ServiceImpl<UserInfoMapper, UserInfoPO>'));
            assert.ok(serviceImpl.content.includes('implements UserInfoService'));
            assert.strictEqual(controller.name, 'UserInfoController.java');
            assert.ok(controller.outputPath.includes('controller'));
            assert.ok(controller.content.includes('@RequestMapping("/user-info")'));
            assert.ok(controller.content.includes('private final UserInfoService userInfoService;'));
            assert.ok(controller.content.includes('public UserInfoPO getById(@PathVariable Long id)'));
        });
    });

    describe('Edge Cases', () => {
        it('should handle table with only primary key', () => {
            const minimalSchema: ParsedSchema = {
                tableName: 'simple_table',
                databaseType: 'mysql',
                columns: [
                    {
                        columnName: 'id',
                        sqlType: 'BIGINT',
                        typeParams: '',
                        javaType: 'Long',
                        javaTypeFullName: '',
                        nullable: false,
                        isPrimaryKey: true,
                    },
                ],
                primaryKey: {
                    columnName: 'id',
                    sqlType: 'BIGINT',
                    typeParams: '',
                    javaType: 'Long',
                    javaTypeFullName: '',
                    nullable: false,
                    isPrimaryKey: true,
                },
            };

            const minimalGenerator = new CodeGenerator(config, minimalSchema);
            const templatePath = path.join(__dirname, '../../../generator/template/entity.ejs');
            const result = minimalGenerator.generateEntity(templatePath);

            assert.ok(result.content.includes('public class SimpleTablePO'));
            assert.ok(result.content.includes('private Long id;'));

            console.log('\n=== Generated Entity (minimal schema) ===');
            console.log(result.content);
        });

        it('should handle snake_case to camelCase conversion correctly', () => {
            const schemaWithSnakeCase: ParsedSchema = {
                tableName: 'order_detail_info',
                databaseType: 'mysql',
                columns: [
                    {
                        columnName: 'order_detail_id',
                        sqlType: 'BIGINT',
                        typeParams: '',
                        javaType: 'Long',
                        javaTypeFullName: '',
                        nullable: false,
                        isPrimaryKey: true,
                    },
                    {
                        columnName: 'order_item_name',
                        sqlType: 'VARCHAR',
                        typeParams: '',
                        javaType: 'String',
                        javaTypeFullName: '',
                        nullable: false,
                        isPrimaryKey: false,
                    },
                ],
                primaryKey: {
                    columnName: 'order_detail_id',
                    sqlType: 'BIGINT',
                    typeParams: '',
                    javaType: 'Long',
                    javaTypeFullName: '',
                    nullable: false,
                    isPrimaryKey: true,
                },
            };

            const snakeCaseGenerator = new CodeGenerator(config, schemaWithSnakeCase);
            const templatePath = path.join(__dirname, '../../../generator/template/entity.ejs');
            const result = snakeCaseGenerator.generateEntity(templatePath);

            assert.ok(result.content.includes('public class OrderDetailInfoPO'));
            assert.ok(result.content.includes('private Long orderDetailId;'));
            assert.ok(result.content.includes('private String orderItemName;'));

            console.log('\n=== Generated Entity (snake_case conversion) ===');
            console.log(result.content);
        });

        it('should handle Boolean field getter correctly', () => {
            const schemaWithBoolean: ParsedSchema = {
                tableName: 'user_status',
                databaseType: 'mysql',
                columns: [
                    {
                        columnName: 'id',
                        sqlType: 'BIGINT',
                        typeParams: '',
                        javaType: 'Long',
                        javaTypeFullName: '',
                        nullable: false,
                        isPrimaryKey: true,
                    },
                    {
                        columnName: 'is_active',
                        sqlType: 'BOOLEAN',
                        typeParams: '',
                        javaType: 'Boolean',
                        javaTypeFullName: '',
                        nullable: false,
                        isPrimaryKey: false,
                    },
                ],
                primaryKey: {
                    columnName: 'id',
                    sqlType: 'BIGINT',
                    typeParams: '',
                    javaType: 'Long',
                    javaTypeFullName: '',
                    nullable: false,
                    isPrimaryKey: true,
                },
            };

            const configNoLombok = {
                ...config,
                useLombok: false,
            };
            const generatorNoLombok = new CodeGenerator(configNoLombok, schemaWithBoolean);
            const templatePath = path.join(__dirname, '../../../generator/template/entity.ejs');
            const result = generatorNoLombok.generateEntity(templatePath);

            assert.ok(result.content.includes('public Boolean isIsActive()'));
            assert.ok(result.content.includes('public void setIsActive(Boolean isActive)'));

            console.log('\n=== Generated Entity (Boolean getter) ===');
            console.log(result.content);
        });
    });

    describe('Output Path Generation', () => {
        it('should generate correct output paths for all file types', () => {
            const results = generator.generateAll();
            const [entity, mapper, xml, service] = results;

            // Normalize paths to work across different OS
            const entityExpected = path.join('src', 'main', 'java', 'com', 'example', 'mybatis', 'entity', 'UserInfoPO.java');
            const mapperExpected = path.join('src', 'main', 'java', 'com', 'example', 'mybatis', 'mapper', 'UserInfoMapper.java');
            const xmlExpected = path.join('src', 'main', 'resources', 'mapper', 'UserInfoMapper.xml');
            const serviceExpected = path.join('src', 'main', 'java', 'com', 'example', 'mybatis', 'service', 'UserInfoService.java');

            assert.ok(entity.outputPath.endsWith(entityExpected), `Expected entity path to end with ${entityExpected}, got ${entity.outputPath}`);
            assert.ok(mapper.outputPath.endsWith(mapperExpected), `Expected mapper path to end with ${mapperExpected}, got ${mapper.outputPath}`);
            assert.ok(xml.outputPath.endsWith(xmlExpected), `Expected xml path to end with ${xmlExpected}, got ${xml.outputPath}`);
            assert.ok(service.outputPath.endsWith(serviceExpected), `Expected service path to end with ${serviceExpected}, got ${service.outputPath}`);
        });
    });
});
