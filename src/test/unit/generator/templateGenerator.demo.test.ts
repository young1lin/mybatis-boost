import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { CodeGenerator, GeneratorConfig } from '../../../generator/template/templateGenerator';
import { ParsedSchema, GenerateReuslt } from '../../../generator/type';

/**
 * 这是一个演示测试文件，用于展示代码生成器生成的所有内容
 * 运行命令: pnpm exec mocha --require ts-node/register src/test/unit/generator/templateGenerator.demo.test.ts
 *
 * 生成的文件会保存在: src/test/unit/generator/generated-samples/ 目录下
 */
describe('CodeGenerator - Demo Showcase', () => {
    let mockParsedSchema: ParsedSchema;
    const OUTPUT_DIR = path.join(__dirname, 'generated-samples');

    // 确保输出目录存在
    before(() => {
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }
    });

    /**
     * 保存生成的文件到磁盘
     * @param results 生成结果数组
     * @param suffix 文件名后缀，例如 'lombok', 'no-lombok', 'mybatis-plus'
     */
    function saveGeneratedFiles(results: GenerateReuslt[], suffix: string = '') {
        results.forEach(result => {
            const fileName = suffix
                ? result.name.replace(/\.(java|xml)$/, `-${suffix}.$1`)
                : result.name;

            const filePath = path.join(OUTPUT_DIR, fileName);
            fs.writeFileSync(filePath, result.content, 'utf-8');
            console.log(`✅ 已保存: ${fileName}`);
        });
    }

    beforeEach(() => {
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
    });

    describe('【场景1】标准 MyBatis 项目（使用 Lombok）', () => {
        it('生成完整的 Entity + Mapper + XML + Service', () => {
            const config: GeneratorConfig = {
                basePackage: 'com.example.mybatis',
                author: 'Code Generator',
                outputDir: path.join(__dirname, '../../../output'),
                useLombok: true,
                useSwagger: false,
                useSwaggerV3: false,
                useMyBatisPlus: false,
            };

            const generator = new CodeGenerator(config, mockParsedSchema);
            const results = generator.generateAll();

            console.log('\n' + '='.repeat(80));
            console.log('【场景1】标准 MyBatis 项目（使用 Lombok）');
            console.log('='.repeat(80));

            // 保存文件
            saveGeneratedFiles(results, 'standard-lombok');

            results.forEach((result, index) => {
                console.log(`\n${'─'.repeat(80)}`);
                console.log(`文件 ${index + 1}: ${result.name}`);
                console.log(`路径: ${result.outputPath}`);
                console.log(`类型: ${result.type}`);
                console.log('─'.repeat(80));
                console.log(result.content);
            });

            assert.strictEqual(results.length, 4);
        });
    });

    describe('【场景2】标准 MyBatis 项目（不使用 Lombok）', () => {
        it('生成带 Getter/Setter 和 @Autowired 的代码', () => {
            const config: GeneratorConfig = {
                basePackage: 'com.example.mybatis',
                author: 'Code Generator',
                outputDir: path.join(__dirname, '../../../output'),
                useLombok: false,
                useSwagger: false,
                useSwaggerV3: false,
                useMyBatisPlus: false,
            };

            const generator = new CodeGenerator(config, mockParsedSchema);
            const entityTemplate = path.join(__dirname, '../../../generator/template/entity.ejs');
            const serviceTemplate = path.join(__dirname, '../../../generator/template/service.ejs');

            const entity = generator.generateEntity(entityTemplate);
            const service = generator.generateService(serviceTemplate);

            console.log('\n' + '='.repeat(80));
            console.log('【场景2】标准 MyBatis 项目（不使用 Lombok）');
            console.log('='.repeat(80));

            // 保存文件
            saveGeneratedFiles([entity, service], 'standard-no-lombok');

            console.log(`\n${'─'.repeat(80)}`);
            console.log(`Entity: ${entity.name}`);
            console.log('─'.repeat(80));
            console.log(entity.content);

            console.log(`\n${'─'.repeat(80)}`);
            console.log(`Service: ${service.name}`);
            console.log('─'.repeat(80));
            console.log(service.content);
        });
    });

    describe('【场景3】MyBatis-Plus 项目（使用 Lombok）', () => {
        it('生成继承 BaseMapper 的代码', () => {
            const config: GeneratorConfig = {
                basePackage: 'com.example.mybatisplus',
                author: 'Code Generator',
                outputDir: path.join(__dirname, '../../../output'),
                useLombok: true,
                useSwagger: false,
                useSwaggerV3: false,
                useMyBatisPlus: true,
            };

            const generator = new CodeGenerator(config, mockParsedSchema);
            const results = generator.generateAll();

            console.log('\n' + '='.repeat(80));
            console.log('【场景3】MyBatis-Plus 项目（使用 Lombok）');
            console.log('='.repeat(80));

            // 保存文件
            saveGeneratedFiles(results, 'mybatis-plus');

            results.forEach((result, index) => {
                console.log(`\n${'─'.repeat(80)}`);
                console.log(`文件 ${index + 1}: ${result.name}`);
                console.log(`路径: ${result.outputPath}`);
                console.log(`类型: ${result.type}`);
                console.log('─'.repeat(80));
                console.log(result.content);
            });

            assert.strictEqual(results.length, 6);
        });
    });

    describe('【场景4】使用 Swagger v2 注解', () => {
        it('生成带 @ApiModel 和 @ApiModelProperty 的 Entity', () => {
            const config: GeneratorConfig = {
                basePackage: 'com.example.swagger',
                author: 'Code Generator',
                outputDir: path.join(__dirname, '../../../output'),
                useLombok: true,
                useSwagger: true,
                useSwaggerV3: false,
                useMyBatisPlus: false,
            };

            const generator = new CodeGenerator(config, mockParsedSchema);
            const templatePath = path.join(__dirname, '../../../generator/template/entity.ejs');
            const entity = generator.generateEntity(templatePath);

            console.log('\n' + '='.repeat(80));
            console.log('【场景4】使用 Swagger v2 注解');
            console.log('='.repeat(80));

            // 保存文件
            saveGeneratedFiles([entity], 'swagger-v2');

            console.log(`\n${'─'.repeat(80)}`);
            console.log(`Entity: ${entity.name}`);
            console.log('─'.repeat(80));
            console.log(entity.content);
        });
    });

    describe('【场景5】使用 Swagger v3 注解', () => {
        it('生成带 @Schema 的 Entity', () => {
            const config: GeneratorConfig = {
                basePackage: 'com.example.swagger3',
                author: 'Code Generator',
                outputDir: path.join(__dirname, '../../../output'),
                useLombok: true,
                useSwagger: true,
                useSwaggerV3: true,
                useMyBatisPlus: false,
            };

            const generator = new CodeGenerator(config, mockParsedSchema);
            const templatePath = path.join(__dirname, '../../../generator/template/entity.ejs');
            const entity = generator.generateEntity(templatePath);

            console.log('\n' + '='.repeat(80));
            console.log('【场景5】使用 Swagger v3 注解');
            console.log('='.repeat(80));

            // 保存文件
            saveGeneratedFiles([entity], 'swagger-v3');

            console.log(`\n${'─'.repeat(80)}`);
            console.log(`Entity: ${entity.name}`);
            console.log('─'.repeat(80));
            console.log(entity.content);
        });
    });

    describe('【场景6】自定义后缀名', () => {
        it('生成自定义后缀的类名', () => {
            const config: GeneratorConfig = {
                basePackage: 'com.example.custom',
                author: 'Code Generator',
                outputDir: path.join(__dirname, '../../../output'),
                useLombok: true,
                useSwagger: false,
                useSwaggerV3: false,
                useMyBatisPlus: false,
                entitySuffix: 'Entity',
                mapperSuffix: 'Dao',
                serviceSuffix: 'ServiceImpl',
            };

            const generator = new CodeGenerator(config, mockParsedSchema);
            const results = generator.generateAll();

            console.log('\n' + '='.repeat(80));
            console.log('【场景6】自定义后缀名（Entity、Dao、ServiceImpl）');
            console.log('='.repeat(80));

            // 保存文件
            saveGeneratedFiles(results, 'custom-suffix');

            results.forEach((result, index) => {
                console.log(`\n${'─'.repeat(80)}`);
                console.log(`文件 ${index + 1}: ${result.name}`);
                console.log(`路径: ${result.outputPath}`);
                console.log('─'.repeat(80));
                console.log(result.content.substring(0, 500) + '\n... (省略部分内容)');
            });

            assert.strictEqual(results.length, 4);
            assert.strictEqual(results[0].name, 'UserInfoEntity.java');
            assert.strictEqual(results[1].name, 'UserInfoDao.java');
            assert.strictEqual(results[3].name, 'UserInfoServiceImpl.java');
        });
    });

    describe('【场景7】复杂表结构 - 订单表', () => {
        it('生成订单表的代码', () => {
            const orderSchema: ParsedSchema = {
                tableName: 'order_detail_info',
                databaseType: 'mysql',
                comment: 'Order detail information',
                columns: [
                    {
                        columnName: 'order_id',
                        sqlType: 'BIGINT',
                        typeParams: '',
                        javaType: 'Long',
                        javaTypeFullName: '',
                        nullable: false,
                        isPrimaryKey: true,
                        comment: 'Order ID',
                    },
                    {
                        columnName: 'order_number',
                        sqlType: 'VARCHAR',
                        typeParams: '',
                        javaType: 'String',
                        javaTypeFullName: '',
                        nullable: false,
                        isPrimaryKey: false,
                        comment: 'Order number',
                    },
                    {
                        columnName: 'total_amount',
                        sqlType: 'DECIMAL',
                        typeParams: '',
                        javaType: 'BigDecimal',
                        javaTypeFullName: 'java.math.BigDecimal',
                        nullable: false,
                        isPrimaryKey: false,
                        comment: 'Total amount',
                    },
                    {
                        columnName: 'is_paid',
                        sqlType: 'BOOLEAN',
                        typeParams: '',
                        javaType: 'Boolean',
                        javaTypeFullName: '',
                        nullable: false,
                        isPrimaryKey: false,
                        comment: 'Payment status',
                    },
                    {
                        columnName: 'created_at',
                        sqlType: 'TIMESTAMP',
                        typeParams: '',
                        javaType: 'LocalDateTime',
                        javaTypeFullName: 'java.time.LocalDateTime',
                        nullable: false,
                        isPrimaryKey: false,
                        comment: 'Created time',
                    },
                ],
                primaryKey: {
                    columnName: 'order_id',
                    sqlType: 'BIGINT',
                    typeParams: '',
                    javaType: 'Long',
                    javaTypeFullName: '',
                    nullable: false,
                    isPrimaryKey: true,
                    comment: 'Order ID',
                },
            };

            const config: GeneratorConfig = {
                basePackage: 'com.example.order',
                author: 'Code Generator',
                outputDir: path.join(__dirname, '../../../output'),
                useLombok: false,
                useSwagger: false,
                useSwaggerV3: false,
                useMyBatisPlus: false,
            };

            const generator = new CodeGenerator(config, orderSchema);
            const entityTemplate = path.join(__dirname, '../../../generator/template/entity.ejs');
            const entity = generator.generateEntity(entityTemplate);

            console.log('\n' + '='.repeat(80));
            console.log('【场景7】复杂表结构 - 订单表（snake_case 转 camelCase）');
            console.log('='.repeat(80));

            // 保存文件
            saveGeneratedFiles([entity], 'order-table');

            console.log(`\n${'─'.repeat(80)}`);
            console.log(`Entity: ${entity.name}`);
            console.log('─'.repeat(80));
            console.log(entity.content);

            // 验证 snake_case 转换
            assert.ok(entity.content.includes('public class OrderDetailInfoPO'));
            assert.ok(entity.content.includes('private Long orderId;'));
            assert.ok(entity.content.includes('private String orderNumber;'));
            assert.ok(entity.content.includes('private BigDecimal totalAmount;'));
            assert.ok(entity.content.includes('public Boolean isIsPaid()'));
        });
    });

    describe('【场景8】完整的 Mapper XML 配置', () => {
        it('生成包含所有 SQL 语句的 XML', () => {
            const config: GeneratorConfig = {
                basePackage: 'com.example.xml',
                author: 'Code Generator',
                outputDir: path.join(__dirname, '../../../output'),
                useLombok: true,
                useMyBatisPlus: false,
            };

            const generator = new CodeGenerator(config, mockParsedSchema);
            const xmlTemplate = path.join(__dirname, '../../../generator/template/mapper-xml.ejs');
            const xml = generator.generateMapperXml(xmlTemplate);

            console.log('\n' + '='.repeat(80));
            console.log('【场景8】完整的 Mapper XML 配置');
            console.log('='.repeat(80));

            // 保存文件
            saveGeneratedFiles([xml], 'full-xml');

            console.log(`\n${'─'.repeat(80)}`);
            console.log(`XML: ${xml.name}`);
            console.log('─'.repeat(80));
            console.log(xml.content);

            assert.ok(xml.content.includes('<resultMap id="baseResultMap"'));
            assert.ok(xml.content.includes('<select id="selectById"'));
            assert.ok(xml.content.includes('<insert id="insert"'));
            assert.ok(xml.content.includes('<update id="updateById"'));
            assert.ok(xml.content.includes('<delete id="deleteById"'));
        });
    });

    describe('【总结】文件输出路径展示', () => {
        it('展示所有文件的输出路径结构', () => {
            const outputDir = path.join(__dirname, '../../../output');
            const config: GeneratorConfig = {
                basePackage: 'com.example.demo',
                author: 'Code Generator',
                outputDir: outputDir,
                useLombok: true,
                useMyBatisPlus: false,
            };

            const generator = new CodeGenerator(config, mockParsedSchema);
            const results = generator.generateAll();

            console.log('\n' + '='.repeat(80));
            console.log('【总结】文件输出路径展示');
            console.log('='.repeat(80));
            console.log('\n项目结构：');
            console.log(`${outputDir}/`);
            console.log('└── src/main/');
            console.log('    ├── java/com/example/demo/');
            console.log('    │   ├── entity/');
            console.log('    │   │   └── UserInfoPO.java');
            console.log('    │   ├── mapper/');
            console.log('    │   │   └── UserInfoMapper.java');
            console.log('    │   └── service/');
            console.log('    │       └── UserInfoService.java');
            console.log('    └── resources/mapper/');
            console.log('        └── UserInfoMapper.xml');

            console.log('\n完整路径列表：');
            results.forEach((result, index) => {
                console.log(`${index + 1}. ${result.outputPath}`);
            });

            assert.strictEqual(results.length, 4);
        });
    });
});
