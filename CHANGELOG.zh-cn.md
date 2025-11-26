# 更新日志

[English](CHANGELOG.md) | 简体中文

"mybatis-boost" 扩展的所有重要更改都将记录在此文件中。

查看 [Keep a Changelog](http://keepachangelog.com/) 了解如何组织此文件的建议。

## [0.3.9] - 2025-11-26

### 变更

- 🎨 **SQL 日志显示重构**：用交互式 WebView 面板替换输出通道，提供更好的 SQL 日志查看体验
  - **之前**：SQL 日志显示在 VS Code 输出通道中（纯文本，交互有限）
  - **现在**：SQL 日志显示在专用的 WebView 侧边栏面板中，功能丰富
  - **功能特性**：
    - **卡片式布局**：每次 SQL 执行以卡片形式显示，视觉分离清晰
    - **实时过滤**：按 Mapper 名称或 SQL 内容搜索/过滤 SQL 日志
    - **自动滚动控制**：通过浮动按钮切换自动滚动到最新 SQL（默认启用）
    - **一键复制**：一键复制 SQL 到剪贴板，带视觉反馈
    - **执行元数据**：在卡片头部显示 Mapper 名称、执行时间和时间戳
    - **慢查询高亮**：慢查询的视觉指示（执行时间显示）
    - **清空所有记录**：一键清空所有 SQL 日志
    - **空状态提示**：当没有捕获到 SQL 日志时显示友好的空状态消息
  - **实现细节**：
    - 创建 `MybatisLogViewProvider` 类，实现 `vscode.WebviewViewProvider`
    - 移除 `SqlOutputChannel` 类（由 WebView 替代）
    - 更新 `ConsoleInterceptor` 和 `DebugTrackerFactory` 以使用新的 WebView 提供程序
    - 在 `extension.ts` 中添加 WebView 视图注册
    - WebView 面板可通过侧边栏访问（视图类型：`mybatis-boost.logView`）
  - **优势**：
    - SQL 日志的视觉组织更好
    - 搜索和过滤能力提升
    - 更交互式和用户友好的界面
    - 与现代 VS Code 扩展 UX 模式保持一致
    - 处理大量 SQL 日志时性能更好

### 修复

- 🔧 **单元测试修复**：修复单元测试并改进代码质量
  - 修复 `DynamicSqlHighlighter.test.ts` 测试用例
  - 修复 `GeneratorViewProvider.test.ts` 测试用例
  - 添加全面的 VS Code 模拟辅助工具（`vscode-mock.js`）以改善测试隔离
  - 改进 `parameterParser.ts` 的注释和文档

### 重构

- 📁 **文档组织优化**：将文档文件移动到 `/docs` 目录，改善项目结构
  - 移动 `CURSOR_MCP_SETUP.md` → `docs/CURSOR_MCP_SETUP.md`
  - 移动 `MCP_SERVER.md` → `docs/MCP_SERVER.md`
  - 移动 `PRD.md` → `docs/PRD.md`
  - 改善项目组织和文档可发现性

## [0.3.8] - 2025-11-17

### 新增

- ✨ **动态 SQL 语法高亮**：MyBatis XML 映射文件中的 SQL 关键字现在使用 IntelliJ IDEA 风格的颜色高亮显示
  - 在 **SQL 语句标签**（`<select>`、`<insert>`、`<update>`、`<delete>`、`<sql>`）和**动态 SQL 标签**（`<if>`、`<where>`、`<set>`、`<foreach>` 等）中高亮显示 SQL 关键字
  - 默认颜色：`#CC7832`（IntelliJ IDEA 风格橙色）
  - 关键字：`SELECT`、`FROM`、`WHERE`、`AND`、`OR`、`JOIN`、`UPDATE`、`DELETE`、`INSERT`、`FOR`、`NULL` 等
  - **智能过滤**：排除 XML 标签属性中的关键字（如 `test="category != null"`）和 OGNL 表达式（如 `#{name and value}`）
  - **可配置**：
    - `mybatis-boost.highlightDynamicSql`：启用/禁用高亮显示（默认：`true`）
    - `mybatis-boost.dynamicSqlKeywordColor`：自定义关键字颜色（默认：`#CC7832`）
  - 配置更改时自动更新
  - 支持 MySQL/PostgreSQL/Oracle 中用于行锁定的 `FOR UPDATE` 子句

## [0.3.7] - 2025-11-13

### 修复

- 🔧 **SQL 格式化器幂等性问题**：修复空格累积和逗号位置错误，确保格式化结果一致
  - **问题 #1：逗号单独占一行**
    - **问题描述**：sql-formatter v15 将逗号放置在单独的行上（leading comma 风格）
      ```sql
      SET
        name = #{name}
      ,
        age = #{age}
      ```
    - **解决方案**：在 `cleanupFormatting()` 中添加 `postprocessCommas()` 方法，将行首逗号移动到前一行末尾
    - **效果**：逗号现在正确放置在行尾
      ```sql
      SET
        name = #{name},
        age = #{age},
      ```

  - **问题 #2：重复格式化时空格累积（XML Provider 层级）**
    - **问题描述**：多次格式化而不保存时，前导空格呈指数级累积
    - **根本原因**：`trim()` 只移除外部空白，不移除每行的缩进
    - **解决方案**：在 `MybatisXmlFormattingProvider.formatStatementTags()` 中添加 `normalizeIndentation()` 方法
      - 查找所有行的最小缩进
      - 格式化前移除基线缩进
      - 防止累积的同时保留相对缩进

  - **问题 #3：重复格式化时空格累积（CST Formatter 层级）**
    - **问题描述**：即使有 XML provider 的修复，重复按格式化键时空格仍在累积
      - 第 1 次格式化：`user` 行有 16 个空格
      - 第 2 次格式化：`user` 行有 24 个空格（+8）
      - 第 3 次格式化：`user` 行有 32 个空格（+8）
      - 持续累积到 88+ 个空格...
    - **根本原因**：
      - CST formatter 的 `formatSql()` 保留了之前格式化的缩进
      - 当类似 `INSERT INTO\n        user`（第二行有 8 个空格）的 SQL 传递给 sql-formatter 时
      - sql-formatter 在现有 8 个空格的基础上又添加了更多空格
      - 下一轮循环：保留的空格增加，造成指数级增长
    - **解决方案**：修改 `MybatisCstFormatter.formatSql()` 中的 `normalizeSqlIndentation()` 方法：
      - 使用 `trimStart()` 移除每行的所有前导空格
      - 确保 sql-formatter 接收完全干净的输入，没有预先存在的缩进
      - sql-formatter 然后应用其自己的一致缩进规则

  - **问题 #4：SQL 操作符和 MyBatis 参数之间缺少空格**
    - **问题描述**：SQL 格式化为 `id =#{id}` 而不是 `id = #{id}`（参数前缺少空格）
      ```sql
      WHERE
          id =#{id}
      AND name =#{name}
      ```
    - **根本原因**：
      - CST parser 为 SQL 文本（`"WHERE id ="`）和参数（`"#{id}"`）创建独立的节点
      - `formatRoot()` 和 `formatTag()` 直接拼接节点，未检查是否需要空格
      - 结果：拼接产生 `"WHERE id =#{id}"`，缺少空格
    - **解决方案**：创建 `formatChildren()` 辅助方法，包含智能空格处理逻辑
      - 当前节点为 'param' 类型且前一个节点为 'sql' 类型时
      - 检查前一个节点是否以空白字符结尾
      - 在参数前添加空格：`"WHERE id =" + " " + "#{id}" = "WHERE id = #{id}"`
      - 应用于 `formatRoot()` 和 `formatTag()`
    - **效果**：操作符和参数之间有正确的空格
      ```sql
      WHERE
          id = #{id}
      AND name = #{name}
      ```

  - **实现细节**：
    - **MybatisSqlFormatter.postprocessCommas()**：将 leading comma 风格转换为 trailing comma 风格
    - **MybatisXmlFormattingProvider.normalizeIndentation()**：从提取的 XML 内容中移除基线缩进
    - **MybatisCstFormatter.normalizeSqlIndentation()**：在 sql-formatter 处理前移除所有前导空格
    - **MybatisCstFormatter.formatChildren()**：确保 SQL 节点和参数节点之间有正确的空格

  - **测试**：
    - ✅ 手动验证：10 次重复格式化保持稳定的空格（最多 4 个空格）
    - ✅ 幂等性测试：`format(format(x)) === format(x)`
    - ✅ 所有 243 个单元测试通过
    - ✅ 格式化现在真正幂等，无论输入缩进如何

  - **影响**：
    - 用户可以多次按格式化键而不会累积空格
    - 无论格式化干净的 SQL 还是预格式化的 SQL，输出都一致
    - 修复了报告的空格增长到 88+ 个空格的问题
    - 不再出现逗号单独占一行的情况

## [0.3.6] - 2025-11-13

### 变更

- 🎨 **MyBatis SQL 控制台输出格式重构**：现代化 SQL 日志输出为 SQL 注释风格
  - **之前的格式**：
    ```
    [2025-11-13T20:29:01.648+08:00]
    Mapper: c.y.m.b.i.t.m.U.listAllByUserId
    Thread: 166244 [main]
    SQL:
    SELECT ...
    Time: 0ms
    ```
  - **新格式**（SQL 注释风格）：
    ```sql
    -- Mapper: com.example.mapper.UserMapper.updateById
    -- Thread: [http-nio-8080-exec-1]
    -- Execution Time: 12ms
    -- Rows Affected: 1

    UPDATE `user_info`
    SET `username` = 'john_doe',
        `email` = 'john@example.com'
    WHERE `id` = 123;
    ```
  - **改动点**：
    - 所有元数据现在格式化为 SQL 注释（`--` 前缀）
    - 移除了时间戳（更简洁的显示）
    - 线程信息简化为仅显示线程名（用方括号包围）
    - 将 "Time" 重命名为 "Execution Time"（更清晰）
    - 添加了 "Rows Affected" 字段（从 Total/Updates 行提取）
    - 在元数据和 SQL 之间添加了空行分隔符
    - 移除了 "SQL:" 标签（SQL 本身就能说明）
  - **实现细节**：
    - 添加了 `extractThreadName()` 辅助方法来解析线程信息
    - 添加了 `extractRowsAffected()` 辅助方法从 Total/Updates 行提取行数
    - 更新了 `SqlOutputChannel.ts` 中的 `show()` 方法以使用新格式
  - **优势**：
    - 更专业的 SQL 注释风格
    - 复制 SQL 到数据库工具时可读性更好
    - 与行业标准 SQL 日志记录实践保持一致
    - 元数据不会干扰 SQL 语法高亮

### 新增

- ⚙️ **可配置的历史记录大小限制**：为 SQL 日志历史添加内存管理
  - **配置项**：`mybatis-boost.console.historyLimit`
    - **类型**：number
    - **默认值**：5000
    - **范围**：100 - 50000
    - **说明**：历史记录中保留的最大 SQL 日志条数（用于导出功能）
  - **实现细节**：
    - 添加了私有方法 `addToHistory()` 来集中管理历史记录
    - 当超过限制时自动删除最旧的条目（先进先出）
    - 更新了 `show()`、`showError()` 和 `showInfo()` 以使用 `addToHistory()`
  - **优势**：
    - 防止长时间运行会话中的内存无限增长
    - 可配置的限制允许用户在内存使用和历史深度之间取得平衡
    - 在控制资源消耗的同时保持导出功能
  - **测试**：所有 243 个单元测试通过

## [0.3.4] - 2025-11-13

### 修复

- 🔧 **SQL 格式化器架构重构**：从基于占位符的架构迁移到基于 CST（具体语法树）的架构
  - **问题**：之前基于占位符的格式化器无法保持嵌套动态标签的正确缩进
    - 嵌套标签如 `<trim><if></if></trim>` 被放在同一行
    - 子标签（`<if>`）在父标签（`<trim>`）下没有缩进
    - 多层嵌套结构丢失了层级缩进
  - **根本原因**：
    - MybatisSqlFormatter 使用占位符替换，破坏了标签的层级结构
    - MybatisXmlFormattingProvider 使用 `line.trim()` 移除了所有缩进，包括嵌套标签的相对缩进
  - **解决方案**：
    - **基于 CST 的架构**：实现了具体语法树解析器和格式化器
      - 创建了 4 种节点类型：`RootNode`、`TagNode`、`SqlNode`、`ParamNode`
      - 每个节点跟踪其深度，用于正确计算缩进
      - 格式化器将 CST 渲染回带有基于深度缩进的文本
    - **保留相对缩进**：修复了 MybatisXmlFormattingProvider 中的 `buildFormattedContent()`
      - 找到所有行的最小缩进作为基准
      - 仅移除基准缩进，保留相对缩进差异
      - 添加目标缩进的同时保持层级结构
  - **实现细节**：
    - `MybatisSqlParser`：将 SQL 和动态标签解析为 CST 结构
    - `MybatisCstFormatter`：使用正确的层级缩进渲染 CST
    - `formatTag()`：区分嵌套标签和纯文本内容，为嵌套结构保留所有格式
    - `buildFormattedContent()`：使用 `line.substring(minIndent)` 而不是 `line.trim()`
  - **功能特性**：
    - ✅ 正确处理任意深度的嵌套标签
    - ✅ 保持正确的缩进层级（默认每层 4 个空格）
    - ✅ 支持可配置的制表符宽度（例如，通过 `tabWidth: 4` 设置 4 个空格）
    - ✅ 保留所有 MyBatis 参数和动态 SQL 标签
    - ✅ 添加了 `debugPrintCst()` 方法用于调试 CST 结构
  - **测试**：
    - 新增 13 个嵌套标签缩进的综合测试
    - 所有 243 个单元测试通过
    - 验证了 4+ 层深度的正确缩进
  - **结果**：嵌套动态 SQL 标签的完美层级缩进

### 示例

**修复前：**
```xml
<insert id="insertSelective" parameterType="com.example.DemoItemPO">
INSERT INTO demo_item <trim prefix="(" suffix=")" suffixOverrides=","><if test="id != null">id,</if><if test="actId != null">act_id,</if></trim> VALUES ...
</insert>
```
❌ 问题：
- `<trim>` 和 `<if>` 在同一行
- `<if>` 在 `<trim>` 下没有缩进
- 所有内容被压扁到同一缩进层级

**修复后（4 个空格缩进）：**
```xml
<insert id="insertSelective" parameterType="com.example.DemoItemPO">
    INSERT INTO demo_item
    <trim prefix="(" suffix=")" suffixOverrides=",">
        <if test="id != null">
            id,
        </if>
        <if test="actId != null">
            act_id,
        </if>
    </trim>
    VALUES
    <trim prefix="(" suffix=")" suffixOverrides=",">
        <if test="id != null">
            #{id},
        </if>
    </trim>
</insert>
```
✅ 完美：
- 每个标签独占一行
- `<if>` 在 `<trim>` 下缩进 4 个空格
- 内容在 `<if>` 下再缩进 4 个空格
- 整个层级缩进保持一致

## [0.3.3] - 2025-11-13

### 修复

- 🐛 **XML 注释中的参数校验问题**：修复 XML 注释内参数错误校验的问题
  - **问题**：参数校验器错误地检查 XML 注释（`<!-- -->`）内的参数，导致被注释的代码出现错误的诊断提示
  - **解决方案**：添加 `removeXmlComments()` 函数，在参数提取前移除所有 XML 注释
  - **实现细节**：
    - 使用正则表达式 `<!--[\s\S]*?-->` 移除单行和多行 XML 注释
    - 在 `extractParametersFromLine()`、`extractLocalVariables()` 和 `extractAttributeReferences()` 中应用注释移除
    - 正确处理注释内的 CDATA 部分
  - **结果**：注释内的参数（如 `#{startDate}` 和 `#{endTime}`）不再被校验
  - **测试**：在 `parameterParser.xmlComments.test.ts` 中添加全面的单元测试，覆盖各种注释场景
  - **所有测试通过**：243 个单元测试全部通过

### 示例

**修复前：**
```xml
<select id="selectAgeByUserId" resultType="java.math.BigDecimal">
    select sum(age) from user where id = #{id}
    <!-- <if test="startDate != null ">
        <![CDATA[AND close_time >= #{startDate}]]>
    </if> -->
</select>
```
❌ 错误提示：参数 'startDate' 未定义（即使它已被注释）

**修复后：**
```xml
<select id="selectAgeByUserId" resultType="java.math.BigDecimal">
    select sum(age) from user where id = #{id}
    <!-- <if test="startDate != null ">
        <![CDATA[AND close_time >= #{startDate}]]>
    </if> -->
</select>
```
✅ 无错误：注释的参数被正确忽略

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
