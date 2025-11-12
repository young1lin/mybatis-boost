# 更新日志

[English](CHANGELOG.md) | 简体中文

"mybatis-boost" 扩展的所有重要更改都将记录在此文件中。

查看 [Keep a Changelog](http://keepachangelog.com/) 了解如何组织此文件的建议。

## [0.3.2] - 2025-11-12

### 新增

- ✨ **MyBatis XML 格式化器**：为 MyBatis Mapper XML 文件提供专业的 SQL 格式化
  - **触发方式**：按 `Alt+Shift+F`（Windows/Linux）或 `Cmd+Shift+F`（Mac）格式化 XML 文件
  - **智能格式化**：
    - 格式化 `<select>`、`<insert>`、`<update>`、`<delete>` 标签中的 SQL 内容
    - 保留所有 MyBatis 动态 SQL 标签（`<if>`、`<foreach>`、`<where>`、`<set>`、`<trim>`、`<bind>`、`<include>`、`<choose>`、`<when>`、`<otherwise>`）
    - 递归处理嵌套动态标签（从内到外）
    - 跳过 `<sql>` 片段标签（保留原始格式）
    - 跳过 CDATA 块（保留原始格式）
  - **IDEA 风格格式化**：匹配 IntelliJ IDEA 的默认 SQL 格式化行为
    - 关键字（SELECT、FROM、WHERE、AND、SET）独占一行
    - 关键字后正确缩进（默认 2 个空格）
    - 逻辑运算符（AND/OR）在条件前换行
    - 每列/条件单独一行以提高可读性
  - **MyBatis 参数保留**：
    - 完全保留 `#{paramName}` 和 `${paramName}` 语法
    - 维护参数顺序和内容
    - 格式化期间将参数转换为 `?` 占位符以更好地识别 SQL 结构
    - 格式化后还原原始 MyBatis 参数
  - **自动检测**：自动检测 SQL 方言（MySQL、PostgreSQL、Oracle、SQL Server）

- ⚙️ **配置选项**（`mybatis-boost.formatter.*`）：
  - `enabled`（默认：`true`）：启用/禁用 XML 格式化器（更改立即生效）
  - `language`（默认：`auto`）：SQL 方言用于格式化
    - 选项：`auto`、`mysql`、`postgresql`、`plsql`、`tsql`、`db2`、`hive`、`mariadb`、`n1ql`、`redshift`、`spark`、`snowflake`、`bigquery`
  - `keywordCase`（默认：`upper`）：关键字大小写转换（upper/lower/preserve）
  - `tabWidth`（默认：`2`）：缩进宽度（IDEA 默认：2 个空格）
  - `indentStyle`（默认：`standard`）：缩进风格（standard/tabularLeft/tabularRight）
  - `denseOperators`（默认：`false`）：移除操作符周围的空格

### 修复

- 🐛 **格式化器间距问题**：解决多余空行和缩进问题
  - 修复：关键字和动态标签之间的多余空行（例如 `SELECT` 和 `<include>`）
  - 修复：关键字和内容之间的多余空行（例如 `VALUES` 和 `<foreach>`）
  - 修复：动态标签内缺少缩进
  - **解决方案**：检测占位符是否独占一行，跳过添加前导换行符
  - **结果**：干净的格式化，没有不必要的空行，并具有正确的缩进（风格 A：动态标签内额外 2 个空格缩进）

### 技术细节

- **5 步格式化流程**：
  1. 提取动态标签 → 替换为占位符
  2. 替换 MyBatis 参数（`#{name}`、`${param}`）→ `?` 占位符（新增）
  3. 使用 sql-formatter 库格式化 SQL
  4. 将 `?` 还原为原始 MyBatis 参数（新增）
  5. 还原动态标签并正确缩进

- **核心组件**：
  - `MybatisSqlFormatter`：采用占位符替换策略的核心格式化引擎
    - `extractDynamicTags()`：递归标签提取（处理嵌套标签）
    - `replaceMyBatisParams()`：将 MyBatis 参数转换为 `?` 以实现更好的格式化
    - `restoreMyBatisParams()`：还原原始 MyBatis 参数
    - `restoreDynamicTags()`：还原标签并正确缩进（风格 A）
    - `detectDialect()`：从语法模式自动检测 SQL 方言
  - `MybatisXmlFormattingProvider`：VS Code DocumentFormattingEditProvider
    - 实现 `provideDocumentFormattingEdits()` 接口
    - 通过 namespace 属性检测 MyBatis mapper XML 文件
    - 仅对语句标签应用格式化
    - 保留 XML 结构和属性

- **动态配置**：
  - 配置更改立即生效，无需重新加载扩展
  - 监听 `onDidChangeConfiguration` 事件
  - 动态注册/取消注册格式化器提供程序
  - 状态更改时显示用户通知

### 性能

- **高效处理**：基于正则表达式的快速提取和替换
- **错误处理**：格式化失败时返回原始内容（优雅降级）
- **所有测试通过**：42 个格式化器单元测试 + 201 个现有测试 = 243 个测试全部通过

### 示例

**格式化前：**
```xml
<update id="updateById">
    UPDATE `user` SET `name` = #{name}, age = #{age}, update_time = #{updateTime}, version = version + 1 WHERE id = #{id} AND version = #{version}
</update>
```

**格式化后（IDEA 风格）：**
```xml
<update id="updateById">
    UPDATE `user`
    SET
      `name` = #{name},
      age = #{age},
      update_time = #{updateTime},
      version = version + 1
    WHERE
      id = #{id}
      AND version = #{version}
</update>
```

## [0.3.1] - 2025-11-12

### 新增

- ✨ **自定义模板路径支持**：用户现在可以指定自定义 EJS 模板文件用于代码生成
  - 新增自定义模板路径配置选项：
    - `mybatis-boost.generator.template-path.entity`：实体类生成的自定义模板
    - `mybatis-boost.generator.template-path.mapper`：Mapper 接口生成的自定义模板
    - `mybatis-boost.generator.template-path.mapper-xml`：Mapper XML 生成的自定义模板
    - `mybatis-boost.generator.template-path.service`：Service 类生成的自定义模板
  - 所有模板路径默认为空字符串，使用内置模板
  - 如果提供了自定义路径，则会覆盖默认模板
  - 在生成器设置 UI 中新增"自定义模板路径"部分
  - 完全支持项目级别和全局级别的模板配置

### 技术细节

- 更新 `SettingsConfig` 接口，新增 4 个模板路径字段
- 修改 `GeneratorViewProvider._getSettings()` 从配置中加载模板路径
- 修改 `GeneratorViewProvider._handleSaveSettings()` 以持久化模板路径
- 增强 `GeneratorViewProvider._handlePreview()` 在生成代码时使用自定义模板
- 为自定义模板路径功能添加 4 个全面的单元测试
- 所有 114 个单元测试成功通过

### 优势

- **灵活性**：团队可以自定义代码生成模板以匹配其编码标准
- **可重用性**：自定义模板可以通过项目设置在团队成员之间共享
- **向后兼容**：空模板路径自动回退到内置模板
- **无破坏性变更**：现有用户无需任何配置即可继续使用默认模板

## [0.3.0] - 2025-11-11

### 新增

- ✨ **MyBatis SQL 控制台拦截器**：实时 SQL 日志记录和导出功能
  - 自动拦截控制台输出的 MyBatis 调试日志
  - 支持多种日志格式：Logback、Log4j、Log4j2、java.util.logging
  - 智能日志解析器提取准备语句、参数和执行结果
  - 基于线程的会话跟踪，匹配 SQL 语句与其参数
  - 将 MyBatis 参数占位符（`?`）转换为实际值
  - **SQL 导出**：将组合后的 SQL 导出到剪贴板或文件，可直接在数据库中执行
  - 专用输出通道："MyBatis SQL Output"，用于查看所有拦截的 SQL
  - 支持所有语句类型：`SELECT`、`INSERT`、`UPDATE`、`DELETE`
  - 显示执行时间和受影响的行数（对于 DML 操作）

- 🎯 **多数据库支持**：智能数据库方言检测和转换
  - 从 SQL 语法模式自动检测数据库类型
  - 支持的数据库：**MySQL**、**PostgreSQL**、**Oracle**、**SQL Server**
  - 数据库特定的 SQL 语法转换：
    - **MySQL**：反引号标识符、`LIMIT` 语法
    - **PostgreSQL**：双引号标识符、`LIMIT/OFFSET` 语法
    - **Oracle**：双引号标识符、`ROWNUM` 分页
    - **SQL Server**：方括号标识符、`TOP/OFFSET FETCH` 语法
  - 正确处理字符串字面量、日期时间值和 NULL 参数

- ⚙️ **配置选项**（`mybatis-boost.console.*`）：
  - `enabled`（默认：`true`）：启用/禁用 SQL 控制台拦截器
  - `autoDetectDatabase`（默认：`true`）：从 SQL 自动检测数据库类型
  - `defaultDatabase`（默认：`mysql`）：自动检测失败时的默认数据库
  - `showExecutionTime`（默认：`true`）：在输出中显示 SQL 执行时间
  - `sessionTimeout`（默认：`5000`ms）：清理不完整日志会话的超时时间
  - `formatSql`（默认：`true`）：格式化 SQL 输出以提高可读性

### 技术细节

- **架构组件**：
  - `ConsoleInterceptor`：调试控制台输出拦截器
  - `DebugTrackerFactory`：管理调试会话跟踪
  - `LogParser`：解析 MyBatis 日志条目（准备、参数、总计/更新）
  - `ParameterParser`：提取参数类型和值
  - `ThreadSessionManager`：按线程 ID 管理 SQL 会话，用于多线程应用
  - `SqlConverter`：将参数化 SQL 转换为可执行 SQL
  - `DatabaseDialect`：数据库特定的 SQL 语法处理
  - `SqlOutputChannel`：专用 VS Code 输出通道用于 SQL 显示

- **日志格式支持**：
  - 各种日志框架的灵活模式匹配
  - 提取线程信息以进行准确的会话跟踪
  - 处理多行 SQL 语句
  - 支持自定义日志格式和模式

- **会话管理**：
  - 基于线程的会话跟踪防止 SQL/参数不匹配
  - 超时后自动清理会话（默认：5 秒）
  - 处理多线程环境中的并发请求

### 性能

- 轻量级控制台拦截，开销最小
- 基于会话的缓存减少冗余解析
- 自动清理过期会话防止内存泄漏

## [0.2.2] - 2025-11-10

### 新增

- ✨ **项目级配置支持**：生成器设置现在可以在项目级别或全局级别保存
  - 在设置对话框中新增配置范围选择器（项目/全局）
  - 项目设置保存到 `.vscode/settings.json` 以实现工作区隔离
  - 全局设置作为没有本地配置的项目的默认值
  - 基于现有配置的智能默认选择
  - 当工作区不可用时自动降级为全局配置
  - 每个项目可以拥有独立的生成器配置
  - 防止不同项目之间的配置冲突

### 技术细节

- 添加 `_getConfigurationScope()` 方法检测当前配置来源
- 修改 `_handleSaveSettings()` 以支持 `ConfigurationTarget.Workspace` 和 `ConfigurationTarget.Global`
- 增强 `_handleLoadSettings()` 返回配置范围信息
- 为配置范围管理添加 6 个全面的单元测试
- 所有配置读取遵循 VS Code 的优先级：项目 > 全局 > 默认值

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
