# 更新日志

[English](CHANGELOG.md) | 简体中文

"mybatis-boost" 扩展的所有重要更改都将记录在此文件中。

查看 [Keep a Changelog](http://keepachangelog.com/) 了解如何组织此文件的建议。

## [未发布]

### 新增
- ✨ **参数验证**：对 XML 映射器文件中的 `#{param}` 和 `${param}` 引用进行实时验证
  - 针对 `parameterType` 类字段进行验证
  - 针对带有 `@Param` 注解的方法参数进行验证
  - 针对动态 SQL 标签（`foreach`、`bind`）中的局部变量进行验证
  - 为未定义的参数显示错误诊断（红色下划线）和有用的错误消息
  - 支持嵌套属性（例如，`#{user.name}` 验证基础对象 `user`）
  - 适用于 `<select>`、`<insert>`、`<update>`、`<delete>` 语句
  - 在文件打开、更改和保存时自动验证

- ✨ **参数导航**：从 XML 参数跳转到 Java（F12）（类型 10）
  - 从 `#{paramName}` 导航到 `parameterType` 类中的 Java 类字段
  - 从 `#{paramName}` 导航到方法参数中的 `@Param` 注解
  - 支持嵌套属性导航
  - 完整的参数解析器实现

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

### 修复
- 🐛 **导航精度**：XML 语句到 Java 方法的导航现在仅在光标特别位于 `id="methodName"` 属性时才有效。以前，在语句块内的任何地方点击都会触发导航，这太宽松了，可能会导致意外导航。
- 🐛 **API 使用**：修复了对 `getByXmlPath()` 的错误使用 - 现在正确使用 `getJavaPath()` API 方法
- 🐛 **命令调用**：修复了 `jumpToXml` 命令，使其可以与 CodeLens 和手动调用一起使用，并具有正确的光标位置检测

### 更改
- 📝 **默认导航模式**：将默认值从 DefinitionProvider 更改为 CodeLens，以保留原生 Java 导航行为
- ⚡ **性能**：通过更好的缓存和延迟加载提高了解析器性能

## [0.0.1] - 初始版本

### 新增
- ✨ **9 种跳转到定义的导航方式**（F12/Ctrl+点击）：
  1. Java 接口名称 → XML `<mapper>` 标签
  2. Java 方法名称 → XML SQL 语句
  3. XML 命名空间属性 → Java 接口
  4. XML 语句 ID → Java 方法
  5. XML 中的 Java 类引用 → Java 类定义
  6. `<include refid>` → `<sql id>` 片段定义
  7. `<sql id>` → 所有 `<include>` 引用（显示所有用法）
  8. `<result property>` → Java 类字段定义
  9. `resultMap` 引用 ↔ `<resultMap>` 定义（双向）
- ✨ 可视化绑定指示器 - 装订线图标显示 Java 方法 ↔ XML 语句绑定
- ✨ 可配置大小的 LRU 缓存（默认：5000 条目）
- ✨ 文件更改时自动缓存失效
- ✨ 用于增量更新的文件系统监视器
- ✨ 智能 MyBatis 映射器检测（基于内容，而非仅文件名）
- ✨ 5 层智能 XML 文件匹配策略
- ✨ 自定义 XML 目录支持（匹配中的优先级 1）
- ✨ 多行标签解析支持
- ✨ 可配置设置
