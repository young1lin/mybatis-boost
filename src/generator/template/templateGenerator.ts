import * as ejs from 'ejs';
import * as path from 'path';
import * as fs from 'fs';
import {
    ParsedSchema,
    ColumnInfo,
    EntityGenerateMetadata,
    FiledInfo,
    MapperGenerateMetadata,
    XmlGenerateMetadata,
    ServiceGenerateMetadata,
    GenerateReuslt,
} from '../type';
import {
    snakeToPascal,
    snakeToCamel,
    toFullyQualifiedType,
    sortImports,
} from '../utils';

export interface GeneratorConfig {
    basePackage: string;          // like com.young1lin.mybatis.boost
    author: string;               // author name
    outputDir: string;            // output directory
    useLombok?: boolean;          // default true
    useSwagger?: boolean;         // default false
    useSwaggerV3?: boolean;       // default false
    useMyBatisPlus?: boolean;     // default false
    entitySuffix?: string;        // Entity suffix, default 'PO'
    mapperSuffix?: string;        // Mapper suffix, default 'Mapper'
    serviceSuffix?: string;       // Service suffix, default 'Service'
}

export class CodeGenerator {

    private config: GeneratorConfig;
    private parsedSchema: ParsedSchema;

    // Cached parsed metadata
    private readonly domainName: string;
    private readonly fields: FiledInfo[];
    private readonly primaryKey: FiledInfo;
    private readonly tableName: string;
    private readonly comment?: string;

    constructor(config: GeneratorConfig, parsedSchema: ParsedSchema) {
        this.config = {
            useLombok: true,
            useSwagger: false,
            useSwaggerV3: false,
            useMyBatisPlus: false,
            entitySuffix: 'PO',
            mapperSuffix: 'Mapper',
            serviceSuffix: 'Service',
            ...config,
        };

        // Store parsedSchema
        this.parsedSchema = parsedSchema;

        // Parse and cache metadata once
        this.domainName = snakeToPascal(parsedSchema.tableName);
        this.fields = this.convertToFieldInfos(parsedSchema.columns);
        this.primaryKey = this.fields.find(f => f.isPrimaryKey) || this.fields[0];
        this.tableName = parsedSchema.tableName;
        this.comment = parsedSchema.comment;
    }

    generateEntity(templatePath: string = path.join(__dirname, 'entity.ejs')): GenerateReuslt {
        const metadata = this.buildEntityMetadata();
        const templateData = this.prepareEntityTemplateData(metadata);
        const content = this.renderTemplate(templatePath, templateData);

        const className = metadata.domainName + metadata.classSuffix;
        const outputPath = this.buildOutputPath(metadata.packageName, className, 'java');

        return {
            name: `${className}.java`,
            outputPath,
            content,
            type: 'java',
            metadata,
        };
    }

    generateMapper(templatePath: string = path.join(__dirname, 'mapper.ejs')): GenerateReuslt {
        const metadata = this.buildMapperMetadata();
        const templateData = this.prepareMapperTemplateData(metadata);
        const content = this.renderTemplate(templatePath, templateData);

        const className = metadata.domainName + metadata.classSuffix;
        const outputPath = this.buildOutputPath(metadata.packageName, className, 'java');

        return {
            name: `${className}.java`,
            outputPath,
            content,
            type: 'java',
            metadata,
        };
    }

    generateMapperXml(templatePath: string = path.join(__dirname, 'mapper-xml.ejs')): GenerateReuslt {
        const metadata = this.buildXmlMetadata();
        const templateData = this.prepareXmlTemplateData(metadata);
        const content = this.renderTemplate(templatePath, templateData);

        const className = metadata.domainName + this.config.mapperSuffix!;
        const outputPath = this.buildXmlOutputPath(className);

        return {
            name: `${className}.xml`,
            outputPath,
            content,
            type: 'xml',
            metadata,
        };
    }

    generateService(templatePath: string = path.join(__dirname, 'service.ejs')): GenerateReuslt {
        const metadata = this.buildServiceMetadata();
        const templateData = this.prepareServiceTemplateData(metadata);
        const content = this.renderTemplate(templatePath, templateData);

        const className = metadata.domainName + metadata.classSuffix;
        const outputPath = this.buildOutputPath(metadata.packageName, className, 'java');

        return {
            name: `${className}.java`,
            outputPath,
            content,
            type: 'java',
            metadata,
        };
    }

    generateAll(): GenerateReuslt[] {
        return [
            this.generateEntity(),
            this.generateMapper(),
            this.generateMapperXml(),
            this.generateService(),
        ];
    }

    private buildEntityMetadata(): EntityGenerateMetadata {
        const packageName = `${this.config.basePackage}.entity`;
        const imports = this.collectEntityImports(this.fields);

        return {
            kind: 'entity',
            basePackage: this.config.basePackage,
            packageName,
            imports,
            comment: this.comment,
            author: this.config.author,
            since: this.getCurrentDate(),
            useMyBatisPlus: this.config.useMyBatisPlus!,
            domainName: this.domainName,
            classSuffix: this.config.entitySuffix!,
            tableName: this.tableName,
            useLombok: this.config.useLombok!,
            useSwagger: this.config.useSwagger!,
            useSwaggerV3: this.config.useSwaggerV3!,
            primaryKey: this.primaryKey,
            fileds: this.fields,
        };
    }

    private buildMapperMetadata(): MapperGenerateMetadata {
        const packageName = `${this.config.basePackage}.mapper`;
        const imports = this.collectMapperImports(this.domainName, this.primaryKey.javaType);

        return {
            kind: 'mapper',
            basePackage: this.config.basePackage,
            packageName,
            imports,
            comment: this.comment,
            author: this.config.author,
            since: this.getCurrentDate(),
            useMyBatisPlus: this.config.useMyBatisPlus!,
            domainName: this.domainName,
            classSuffix: this.config.mapperSuffix!,
            entityName: this.domainName + this.config.entitySuffix!,
            primaryKeyType: this.primaryKey.javaType,
        };
    }

    private buildXmlMetadata(): XmlGenerateMetadata {
        const mapperClassName = `${this.config.basePackage}.mapper.${this.domainName}${this.config.mapperSuffix!}`;

        return {
            kind: 'xml',
            basePackage: this.config.basePackage,
            packageName: `${this.config.basePackage}.mapper`,
            imports: [],
            comment: this.comment,
            author: this.config.author,
            since: this.getCurrentDate(),
            useMyBatisPlus: this.config.useMyBatisPlus!,
            domainName: this.domainName,
            classSuffix: this.config.mapperSuffix!,
            namespace: mapperClassName,
            tableName: this.tableName,
            primaryKey: this.primaryKey,
            fileds: this.fields,
        };
    }

    private buildServiceMetadata(): ServiceGenerateMetadata {
        const mapperClassName = this.domainName + this.config.mapperSuffix!;
        const mapperClassNameFiled = mapperClassName.charAt(0).toLowerCase() + mapperClassName.slice(1);
        const packageName = `${this.config.basePackage}.service`;
        const imports = this.collectServiceImports(this.domainName, mapperClassName);

        return {
            kind: 'service',
            basePackage: this.config.basePackage,
            packageName,
            imports,
            comment: this.comment,
            author: this.config.author,
            since: this.getCurrentDate(),
            useMyBatisPlus: this.config.useMyBatisPlus!,
            domainName: this.domainName,
            classSuffix: this.config.serviceSuffix!,
            entityClassName: this.domainName + this.config.entitySuffix!,
            mapperClassName,
            mapperClassNameFiled,
            useLombok: this.config.useLombok!,
        };
    }

    private convertToFieldInfos(columns: ColumnInfo[]): FiledInfo[] {
        const fields = columns.map(col => this.convertToFieldInfo(col));
        return fields.sort((a, b) => (b.isPrimaryKey ? 1 : 0) - (a.isPrimaryKey ? 1 : 0));
    }

    private convertToFieldInfo(column: ColumnInfo): FiledInfo {
        const name = snakeToCamel(column.columnName);
        return {
            columnName: column.columnName,
            name,
            comment: column.comment,
            isPrimaryKey: column.isPrimaryKey,
            javaType: column.javaType,
            javaTypeFullName: column.javaTypeFullName,
            sqlType: column.sqlType,
            getterName: this.buildGetterName(name, column.javaType),
            setterName: this.buildSetterName(name),
        };
    }

    private buildGetterName(fieldName: string, javaType: string): string {
        const prefix = javaType === 'Boolean' ? 'is' : 'get';
        return prefix + fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
    }

    private buildSetterName(fieldName: string): string {
        return 'set' + fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
    }

    private collectEntityImports(fields: FiledInfo[]): string[] {
        const imports = new Set<string>();

        // Lombok
        if (this.config.useLombok) {
            imports.add('lombok.Data');
        }

        // MyBatis-Plus
        if (this.config.useMyBatisPlus) {
            imports.add('com.baomidou.mybatisplus.annotation.TableName');
            if (fields.some(f => f.isPrimaryKey)) {
                imports.add('com.baomidou.mybatisplus.annotation.TableId');
                imports.add('com.baomidou.mybatisplus.annotation.IdType');
            }
            imports.add('com.baomidou.mybatisplus.annotation.TableField');
        }

        // Swagger
        if (this.config.useSwagger) {
            if (this.config.useSwaggerV3) {
                imports.add('io.swagger.v3.oas.annotations.media.Schema');
            } else {
                imports.add('io.swagger.annotations.ApiModel');
                imports.add('io.swagger.annotations.ApiModelProperty');
            }
        }

        fields.forEach(field => {
            const qualifiedType = toFullyQualifiedType(field.javaType);
            if (qualifiedType && qualifiedType !== '') {
                imports.add(qualifiedType);
            }
        });

        return sortImports(imports);
    }

    private collectMapperImports(domainName: string, primaryKeyType: string): string[] {
        const imports = new Set<string>();

        // Entity import
        const entityClassName = domainName + this.config.entitySuffix!;
        imports.add(`${this.config.basePackage}.entity.${entityClassName}`);

        // MyBatis-Plus BaseMapper
        if (this.config.useMyBatisPlus) {
            imports.add('com.baomidou.mybatisplus.core.mapper.BaseMapper');
        } else {
            imports.add('java.util.List');
            imports.add('org.apache.ibatis.annotations.Mapper');
        }

        // primary key type import
        const qualifiedType = toFullyQualifiedType(primaryKeyType);
        if (qualifiedType && qualifiedType !== '') {
            imports.add(qualifiedType);
        }

        return sortImports(imports);
    }

    private collectServiceImports(domainName: string, mapperClassName: string): string[] {
        const imports = new Set<string>();

        // Entity import
        const entityClassName = domainName + this.config.entitySuffix!;
        imports.add(`${this.config.basePackage}.entity.${entityClassName}`);

        // Mapper import
        imports.add(`${this.config.basePackage}.mapper.${mapperClassName}`);

        // Spring Service
        imports.add('org.springframework.stereotype.Service');

        // Dependency injection
        if (this.config.useLombok) {
            imports.add('lombok.RequiredArgsConstructor');
        } else {
            imports.add('org.springframework.beans.factory.annotation.Autowired');
        }

        if (!this.config.useMyBatisPlus) {
            imports.add('java.util.List');
        }
        return sortImports(imports);
    }

    private prepareEntityTemplateData(metadata: EntityGenerateMetadata): any {
        return {
            packageName: metadata.packageName,
            imports: metadata.imports,
            className: metadata.domainName + metadata.classSuffix,
            tableName: metadata.tableName,
            comment: metadata.comment,
            author: metadata.author,
            date: metadata.since,
            useLombok: metadata.useLombok,
            useSwagger: metadata.useSwagger,
            useSwaggerV3: metadata.useSwaggerV3,
            useMyBatisPlus: metadata.useMyBatisPlus,
            fields: metadata.fileds,
        };
    }

    private prepareMapperTemplateData(metadata: MapperGenerateMetadata): any {
        return {
            packageName: metadata.packageName,
            imports: metadata.imports,
            className: metadata.domainName + metadata.classSuffix,
            comment: metadata.comment,
            author: metadata.author,
            date: metadata.since,
            useMyBatisPlus: metadata.useMyBatisPlus,
            entityClassName: metadata.entityName,
            primaryKeyType: metadata.primaryKeyType,
        };
    }

    private prepareXmlTemplateData(metadata: XmlGenerateMetadata): any {
        return {
            namespace: metadata.namespace,
            entityClassName: `${this.config.basePackage}.entity.${metadata.domainName}${this.config.entitySuffix!}`,
            tableName: metadata.tableName,
            primaryKey: metadata.primaryKey,
            fields: metadata.fileds,
            author: metadata.author,
            date: metadata.since,
            useMyBatisPlus: metadata.useMyBatisPlus,
        };
    }

    private prepareServiceTemplateData(metadata: ServiceGenerateMetadata): any {
        return {
            packageName: metadata.packageName,
            imports: metadata.imports,
            className: metadata.domainName + metadata.classSuffix,
            comment: metadata.comment,
            author: metadata.author,
            date: metadata.since,
            entityClassName: metadata.entityClassName,
            mapperClassName: metadata.mapperClassName,
            mapperFieldName: metadata.mapperClassNameFiled,
            useLombok: metadata.useLombok,
        };
    }

    private renderTemplate(templatePath: string, data: any): string {
        let template: string;
        try {
            template = fs.readFileSync(templatePath, 'utf-8');
        } catch (err) {
            throw new Error(`Failed to read template file: ${templatePath}, error: ${(err as Error).message}`);
        }
        return ejs.render(template, data);
    }

    private buildOutputPath(packageName: string, className: string, ext: string): string {
        const packagePath = packageName.replace(/\./g, path.sep);
        return path.join(this.config.outputDir, 'src', 'main', 'java', packagePath, `${className}.${ext}`);
    }

    private buildXmlOutputPath(className: string): string {
        return path.join(this.config.outputDir, 'src', 'main', 'resources', 'mapper', `${className}.xml`);
    }

    private getCurrentDate(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

}
