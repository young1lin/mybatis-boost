# 更新日志

[English](CHANGELOG.md) | 简体中文

"mybatis-boost" 扩展的所有重要更改都将记录在此文件中。

查看 [Keep a Changelog](http://keepachangelog.com/) 了解如何组织此文件的建议。

## [0.2.0] - 2025-11-09

### 新增

- ✨ **MyBatis 代码生成器 WebView**：交互式 UI 面板，用于从 DDL SQL 语句生成 MyBatis 代码
  - 生成完整的 MyBatis 样板代码（实体类、Mapper 接口、XML 映射文件、Service 类）
  - 支持 MySQL、PostgreSQL 和 Oracle DDL 解析
  - 丰富的配置选项：
    - `mybatis-boost.generator.basePackage`：生成代码的基础包名（例如：`com.example.mybatis`）
    - `mybatis-boost.generator.author`：代码注释中的作者名称
    - `mybatis-boost.generator.entitySuffix`：实体类后缀（默认：`PO`）
    - `mybatis-boost.generator.mapperSuffix`：Mapper 接口后缀（默认：`Mapper`）
    - `mybatis-boost.generator.serviceSuffix`：Service 类后缀（默认：`Service`）
    - `mybatis-boost.generator.datetime`：日期时间类型映射（`Date` | `LocalDateTime` | `Instant`）
    - `mybatis-boost.generator.useLombok`：启用 Lombok 注解（`@Data`、`@Getter`、`@Setter`）
    - `mybatis-boost.generator.useSwagger`：启用 Swagger 2 注解（`@ApiModel`、`@ApiModelProperty`）
    - `mybatis-boost.generator.useSwaggerV3`：启用 Swagger 3 (OpenAPI) 注解
  - 导出前预览生成的代码
  - 一键导出到适当的目录结构
  - 生成历史记录跟踪，包含 SQL 和文件预览
  - 支持从 DDL 中提取表和列注释

- ✨ **Cursor IDE MCP 集成**：模型上下文协议支持，用于 AI 驱动的代码生成
  - 自动 IDE 检测（VS Code vs Cursor）
  - 配置选项 `mybatis-boost.mcp.enable` 用于启用/禁用 MCP 功能（默认：`true`）
  - 无需重启扩展即可动态启用/禁用
  - VS Code：使用 Language Model Tools API (`vscode.lm.registerTool`)
  - Cursor IDE：使用 MCP Extension API 和 stdio 服务器
  - 提供四个 MCP 工具：
    1. `mybatis_parse_sql_and_generate`：解析 DDL 并生成代码（内存预览）
    2. `mybatis_export_generated_files`：将生成的文件导出到文件系统
    3. `mybatis_query_generation_history`：查询生成历史记录和预览
    4. `mybatis_parse_and_export`：一次操作完成解析和导出
  - Cursor IDE 独立 stdio MCP 服务器 (`dist/mcp/stdio/server.js`)
  - 继承所有 `mybatis-boost.generator.*` 配置

### 修复

- 🐛 **JSON-RPC 协议合规性**：修复 Cursor IDE 的 stdio MCP 服务器响应格式
  - 在所有响应中强制使用严格的 `id` 字段类型（`string | number`，永不为 `null`）
  - 对于无法获取请求 id 的解析错误，使用哨兵值 `-1`
  - 正确处理 JSON-RPC 通知（无 id 的请求）
  - 修复 Zod 验证错误："Expected number, received null"

### 技术细节

- 核心服务层抽象（`GeneratorService`、`FileExportService`、`HistoryService`）
- 双 MCP 传输支持（Language Model Tools + stdio）
- stdio 服务器基于环境变量的配置
- 独立服务器基于文件系统的历史记录存储
- esbuild 同时打包扩展和 stdio 服务器
- 为所有新服务提供全面的单元测试

## [0.1.4] - 2025-01-07

### 性能优化
- ⚡ **ParameterValidator 防抖处理**：为 XML 文本变化验证添加 500ms 防抖，消除快速输入时的卡顿
  - 验证现在仅在用户停止输入后触发
  - 文件保存时立即验证以确保准确性
  - 显著改善大型 XML 文件的编辑体验

- ⚡ **LRU 字段缓存**：实现 Java 类字段查找的智能缓存，性能提升 10 倍
  - 为 `parameterType` 类字段添加了 200 条目的 LRU 缓存
  - 在典型项目中缓存命中率 >90%
  - 对于使用相同 `parameterType` 的多个语句，验证时间从 2000ms 降至约 210ms
  - Java 文件修改时智能缓存失效
  - 自动缓存"未找到"结果以防止重复搜索

- ⚡ **优化 FileMapper**：移除文件监听器中不必要的防抖
  - 文件更改时立即更新缓存，响应更快
  - 防止可能触发昂贵工作区扫描的陈旧缓存问题
  - 更快的 CodeLens 和装饰器更新

### 技术细节
- 添加了带 LRU 淘汰策略的 `FieldCache` 类
- 实现了 `getClassNameFromPath()` 用于智能缓存失效
- 支持标准 Java 源码根目录（`src/main/java`、`src/test/java` 等）
- 支持非标准项目结构的回退方案

### 影响
- 对于具有重复 `parameterType` 的文件，参数验证速度提升 10 倍
- 流畅的输入体验，无可感知的延迟
- 在活跃编辑期间降低 CPU 使用率
- 在大型项目（5000+ Java 文件）中性能更好

## [0.1.0] - 初始版本

### 新增
- ✨ **10 种跳转到定义的导航方式**（F12/Ctrl+点击）：
  1. Java 接口名称 → XML `<mapper>` 标签
  2. Java 方法名称 → XML SQL 语句
  3. XML 命名空间属性 → Java 接口
  4. XML 语句 ID → Java 方法
  5. XML 中的 Java 类引用 → Java 类定义
  6. `<include refid>` → `<sql id>` 片段定义
  7. `<sql id>` → 所有 `<include>` 引用（显示所有用法）
  8. `<result property>` → Java 类字段定义
  9. `resultMap` 引用 ↔ `<resultMap>` 定义（双向）
  10. XML 参数（`#{paramName}`、`${paramName}`）→ Java 字段或 `@Param` 注解

- ✨ **SQL 组合与悬停预览**：自动解析 `<include>` 并预览完整 SQL
  - **在 XML 语句 ID 上悬停**：鼠标悬停在 statement 的 `id` 属性值上时，查看完整拼接后的 SQL
  - **在 Java 映射器方法上悬停**：鼠标悬停在方法名上时，查看对应的完整 SQL
  - **自动解析 `<include>`**：递归解析所有 `<include refid="xxx">` 引用
  - **支持嵌套 include**：处理 SQL 片段中包含其他 include 的情况
  - **循环引用检测**：防止无限循环，并显示有用的错误消息
  - **缺失片段处理**：显示清晰的"Fragment not found"消息
  - **所有语句类型**：支持 `<select>`、`<insert>`、`<update>`、`<delete>`
  - **保留动态 SQL**：保留 MyBatis 标签（`<if>`、`<where>`、`<trim>` 等）以提供上下文
  - **非侵入式 UI**：使用悬停提示，无 CodeLens 或装饰器
  - **实时组合**：按需组合 SQL，无性能影响

- ✨ **参数验证**：对 XML 映射器文件中的 `#{param}` 和 `${param}` 引用进行实时验证
  - 针对 `parameterType` 类字段进行验证
  - 针对带有 `@Param` 注解的方法参数进行验证
  - 针对动态 SQL 标签（`foreach`、`bind`）中的局部变量进行验证
  - 为未定义的参数显示错误诊断（红色下划线）和有用的错误消息
  - 支持嵌套属性（例如，`#{user.name}` 验证基础对象 `user`）
  - 适用于 `<select>`、`<insert>`、`<update>`、`<delete>` 语句
  - 在文件打开、更改和保存时自动验证

- ✨ **灵活的导航模式**：在 CodeLens 或 DefinitionProvider 之间选择
  - **CodeLens 模式**（默认，推荐）：非侵入式，保留原生 Java F12 行为
  - **DefinitionProvider 模式**（可选）：直接 F12 导航到 XML 语句
  - 通过 `mybatis-boost.useDefinitionProvider` 设置切换
  - 更改立即生效，无需重启

- ✨ **CodeLens 提供程序**：智能可点击导航链接
  - 在 Java 映射器接口和方法上方显示 "jumpToXml"
  - 对于带有 SQL 注解（`@Select`、`@Insert` 等）的方法自动隐藏
  - 仅在存在对应的 XML 语句时显示
  - 支持多行方法声明和泛型类型

- ✨ **手动跳转命令**：`mybatis-boost.jumpToXml` 命令
  - 自动检测上下文：接口名称 vs 方法名称
  - 根据光标位置跳转到映射器命名空间或特定语句
  - 可通过命令面板或 CodeLens 调用

- ✨ **增强的解析器**：4 个专用解析器
  - `javaParser.ts`：方法参数、`@Param` 注解、返回类型
  - `javaFieldParser.ts`：从 Java 类中提取字段
  - `xmlParser.ts`：多行标签、精确位置跟踪
  - `parameterParser.ts`：参数引用、局部变量、嵌套属性

- ✨ **可视化绑定指示器** - 装订线图标显示 Java 方法 ↔ XML 语句绑定
- ✨ **可配置大小的 LRU 缓存**（默认：5000 条目）
- ✨ **文件更改时自动缓存失效**
- ✨ **用于增量更新的文件系统监视器**
- ✨ **智能 MyBatis 映射器检测**（基于内容，而非仅文件名）
- ✨ **5 层智能 XML 文件匹配策略**
- ✨ **自定义 XML 目录支持**（匹配中的优先级 1）
- ✨ **多行标签解析支持**
- ✨ **可配置设置**
