# i18n Examples

This document shows examples of how the internationalization works in MyBatis Boost.

## Command Palette - English

When VS Code is set to English:

```
Command Palette:
> MyBatis Boost: Clear Cache and Rebuild
> MyBatis Boost: Refresh Mappings
> MyBatis Boost: Jump to MyBatis XML
```

## Command Palette - 中文

When VS Code is set to Chinese (zh-cn):

```
命令面板：
> MyBatis Boost: 清除缓存并重建
> MyBatis Boost: 刷新映射
> MyBatis Boost: 跳转到 MyBatis XML
```

## Settings - English

```json
{
  "mybatis-boost.cacheSize": {
    "description": "Maximum number of mapper file pairs to cache in memory (LRU cache size)"
  },
  "mybatis-boost.showBindingIcons": {
    "description": "Show gutter icons for MyBatis bindings between Java methods and XML statements"
  }
}
```

## Settings - 中文

```json
{
  "mybatis-boost.cacheSize": {
    "description": "内存中缓存的映射器文件对的最大数量（LRU 缓存大小）"
  },
  "mybatis-boost.showBindingIcons": {
    "description": "在 Java 方法和 XML 语句之间显示 MyBatis 绑定的装订线图标"
  }
}
```

## Notification Messages - English

```
✓ MyBatis Boost cache cleared and rebuilt
✓ MyBatis mappings refreshed successfully
⚠ MyBatis Boost: No corresponding XML file found
⚠ MyBatis statement "findById" not found in XML
```

## Notification Messages - 中文

```
✓ MyBatis Boost 缓存已清除并重建
✓ MyBatis 映射已成功刷新
⚠ MyBatis Boost：未找到对应的 XML 文件
⚠ MyBatis 语句 "findById" 在 XML 中未找到
```

## Console Output - English

```
[MyBatis Boost] Activating extension...
[MyBatis Boost] Java project detected, initializing...
[MyBatis Boost] Navigation mode: CodeLens
[MyBatis Boost] Parameter validator initialized
[MyBatis Boost] Binding decorator initialized
[MyBatis Boost] Extension activated in 250ms
```

## Console Output - 中文

```
[MyBatis Boost] 正在激活扩展...
[MyBatis Boost] 检测到 Java 项目，正在初始化...
[MyBatis Boost] 导航模式：CodeLens
[MyBatis Boost] 参数验证器已初始化
[MyBatis Boost] 绑定装饰器已初始化
[MyBatis Boost] 扩展已在 250 毫秒内激活
```

## Mode Names

### English
- DefinitionProvider
- CodeLens

### 中文
- 定义提供程序
- CodeLens

## Switching Languages

### Using VS Code UI

1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. Type "Configure Display Language"
3. Select from available languages:
   - English
   - 中文（简体）
4. Click "Restart" to apply changes

### Using settings.json

```json
{
  "locale": "zh-cn"  // or "en" for English
}
```

## Testing Translations

### 1. Test English (Default)

1. Set VS Code to English
2. Restart VS Code
3. Open a Java project with MyBatis
4. Run command: "MyBatis Boost: Clear Cache and Rebuild"
5. Check notification: "MyBatis Boost cache cleared and rebuilt"

### 2. Test Chinese

1. Set VS Code to Chinese (Simplified)
2. Restart VS Code
3. Open a Java project with MyBatis
4. Run command: "MyBatis Boost: 清除缓存并重建"
5. Check notification: "MyBatis Boost 缓存已清除并重建"

## Adding More Languages

See [i18n.md](i18n.md) for instructions on adding support for additional languages like:
- French (fr)
- German (de)
- Japanese (ja)
- Korean (ko)
- Spanish (es)

Each language requires:
1. `package.nls.{locale}.json` - Package strings
2. `l10n/bundle.l10n.{locale}.json` - Runtime strings
