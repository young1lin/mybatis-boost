
/**
 * Supported SQL types union type
 * This type represents all SQL types that can be mapped to Java types
 */
export type SqlType =
  // String types - Common across databases
  | 'VARCHAR'
  | 'CHAR'
  | 'TEXT'
  | 'LONGTEXT'
  | 'MEDIUMTEXT'
  | 'TINYTEXT'
  // Oracle specific string types
  | 'VARCHAR2'
  | 'CLOB'
  | 'NVARCHAR'
  | 'NCHAR'
  | 'NCLOB'
  // Integer types
  | 'TINYINT'
  | 'SMALLINT'
  | 'MEDIUMINT'
  | 'INT'
  | 'INTEGER'
  // Long types
  | 'BIGINT'
  | 'SERIAL'
  | 'BIGSERIAL'
  | 'NUMBER'
  // Decimal types
  | 'DECIMAL'
  | 'NUMERIC'
  | 'FLOAT'
  | 'DOUBLE'
  | 'REAL'
  | 'MONEY'
  // Boolean types
  | 'BOOLEAN'
  | 'BOOL'
  | 'BIT'
  // Binary types
  | 'BLOB'
  | 'BYTEA'
  | 'BINARY'
  | 'VARBINARY'
  | 'RAW'
  | 'LONG RAW'
  // JSON types
  | 'JSON'
  | 'JSONB'
  // Date type
  | 'DATE'
  // Date/Time types
  | 'DATETIME'
  | 'TIMESTAMP'
  | 'TIMESTAMP WITH TIME ZONE'
  | 'TIMESTAMP WITHOUT TIME ZONE'
  | 'TIMESTAMPTZ'
  // Time-only types
  | 'TIME'
  | 'TIME WITH TIME ZONE'
  | 'TIME WITHOUT TIME ZONE'
  | 'TIMETZ';

/**
 * Represents the parsed database schema from DDL SQL statement
 */
export interface ParsedSchema {
  tableName: string;           // e.g., user_info (use snakeToPascal to get class name when needed)
  columns: ColumnInfo[];
  primaryKey?: ColumnInfo;     // Single primary key only (composite keys not supported)
  databaseType: 'mysql' | 'postgresql' | 'oracle';
  comment?: string;
}

/**
 * Represents column metadata extracted from DDL
 */
export interface ColumnInfo {
  columnName: string;           // e.g., user_name (use snakeToCamel to get field name when needed)
  sqlType: SqlType;             // e.g., VARCHAR
  typeParams: string;           // like '255', '10,9', '1', etc. (type parameters extracted from parentheses), empty string if not present
  javaType: string;            // e.g., String, Integer, Long (simple type name)
  javaTypeFullName: string;    // e.g., '', 'java.math.BigDecimal', 'java.time.LocalDateTime' (empty for java.lang types)
  nullable: boolean;
  comment?: string;
  isPrimaryKey: boolean;
  defaultValue?: string;
}

/**
 * Result of DDL parsing operation
 */
export interface ParseResult {
  success: boolean;
  data?: ParsedSchema;
  error?: {
    code: 'NOT_CREATE_TABLE' | 'PARSE_FAILED' | 'UNSUPPORTED_DB' | 'COMPOSITE_PRIMARY_KEY';
    message: string;
  };
}

/**
 * Date/Time type mapping strategy
 */
export type DateTimeType = 'Date' | 'LocalDateTime' | 'Instant';

/**
 * Options for DDL parsing
 */
export interface ParseOptions {
  dbType?: 'mysql' | 'postgresql' | 'oracle';
  dateTimeType?: DateTimeType;  // Default: 'LocalDateTime'
}

export interface GenerateMetadata {
  basePackage: string; // like com.young1lin.mybatis.boost
  packageName: string; // like com.young1lin.mybatis.boost.mapper
  imports: string[];

  comment?: string;
  author: string;
  since: string; // default current date, format: yyyy-MM-dd, like @since 2025-01-01
  useMyBatisPlus: boolean; // default false

  domainName: string; // like User, Order etc.  from tableName like user_info convert to UserInfo, order convert to Order
  classSuffix: string; // like PO, Entity, Mapper, Dao, Service

}

export interface EntityGenerateMetadata extends GenerateMetadata {
  kind: 'entity'; // Discriminator field for type narrowing
  tableName: string;
  useLombok: boolean; // default true
  useSwagger: boolean; // default false
  useSwaggerV3: boolean; // default false

  primaryKey: FiledInfo;
  fileds: FiledInfo[]; // id first, so need compared to other fields with isPrimaryKey
}

export interface FiledInfo {
  columnName: string; // like user_name, created_at etc.
  name: string; // like userName, createdAt etc.
  comment?: string;

  isPrimaryKey: boolean;

  javaType: string; // like String, Integer, Long, BigDecimal, LocalDateTime, etc.
  javaTypeFullName: string; // like java.lang.String, java.lang.Integer, java.lang.Long, java.math.BigDecimal, java.time.LocalDateTime, etc.
  sqlType: SqlType; // like VARCHAR, INT, BIGINT, etc. (normalized base type without parameters)

  getterName?: string; // if useLombok is false, getterName is required
  setterName?: string; // if useLombok is false, setterName is required
}

export interface MapperGenerateMetadata extends GenerateMetadata {
  kind: 'mapper'; // Discriminator field for type narrowing
  entityName: string; // like UserEntity, UserPO etc.
  primaryKeyType: string // like Long, Integer, String, etc.
}

export interface XmlGenerateMetadata extends GenerateMetadata {
  kind: 'xml'; // Discriminator field for type narrowing
  namespace: string; // mapper's full class name like com.young1lin.mybatis.boost.mapper.UserMapper
  tableName: string;
  primaryKey: FiledInfo;
  fileds: FiledInfo[]; // id first, so need compared to other fields with isPrimaryKey
}

export interface ServiceGenerateMetadata extends GenerateMetadata {
  kind: 'service'; // Discriminator field for type narrowing
  entityClassName: string; // like UserEntity, UserPO etc.
  mapperClassName: string; // like UserMapper, UserDao etc.
  mapperClassNameFiled: string // like userMapper, userDao etc. mapperClassName.charAt(0).toLowerCase() + mapperClassName.slice(1)

  /**
   * default true, if true, will import with lombok.RequiredArgsConstructor, and mapper will be private final field
   * like
   * ```java
   * import lombok.RequiredArgsConstructor;
   *
   * @RequiredArgsConstructor
   * public class UserService {
   *   private final UserMapper userMapper;
   * }
   * ```
   *
   * if false, will import with org.springframework.beans.factory.annotation.Autowired, and mapper will be public field
   * like
   *
   *
   * ```java
   * import org.springframework.beans.factory.annotation.Autowired;
   *
   * public class UserService {
   *   @Autowired
   *   private UserMapper userMapper;
   * }
   * ```
   */
  useLombok: boolean;
}

export interface ServiceImplGenerateMetadata extends GenerateMetadata {
  kind: 'serviceImpl';
  entityClassName: string;
  mapperClassName: string;
  serviceClassName: string;
}

export interface ControllerGenerateMetadata extends GenerateMetadata {
  kind: 'controller';
  entityClassName: string;
  serviceClassName: string;
  primaryKeyType: string;
  requestPath: string;
  useLombok: boolean;
}

/**
 * Union type of all metadata types for type-safe narrowing
 */
export type GenerateMetadataUnion =
  | EntityGenerateMetadata
  | MapperGenerateMetadata
  | XmlGenerateMetadata
  | ServiceGenerateMetadata
  | ServiceImplGenerateMetadata
  | ControllerGenerateMetadata;

/**
 * Type guard functions for runtime type checking
 */
export function isEntityMetadata(metadata: GenerateMetadata): metadata is EntityGenerateMetadata {
  return 'kind' in metadata && metadata.kind === 'entity';
}

export function isMapperMetadata(metadata: GenerateMetadata): metadata is MapperGenerateMetadata {
  return 'kind' in metadata && metadata.kind === 'mapper';
}

export function isXmlMetadata(metadata: GenerateMetadata): metadata is XmlGenerateMetadata {
  return 'kind' in metadata && metadata.kind === 'xml';
}

export function isServiceMetadata(metadata: GenerateMetadata): metadata is ServiceGenerateMetadata {
  return 'kind' in metadata && metadata.kind === 'service';
}

export function isServiceImplMetadata(metadata: GenerateMetadata): metadata is ServiceImplGenerateMetadata {
  return 'kind' in metadata && metadata.kind === 'serviceImpl';
}

export function isControllerMetadata(metadata: GenerateMetadata): metadata is ControllerGenerateMetadata {
  return 'kind' in metadata && metadata.kind === 'controller';
}

export interface GenerateReuslt {
  name: string; // e.g., UserMapper.java
  outputPath: string; // e.g., src/main/java/com/young1lin/mybatis/boost/mapper/UserMapper.java
  content: string;
  type: 'java' | 'xml';
  metadata: GenerateMetadataUnion; // Use union type for type-safe narrowing
}
