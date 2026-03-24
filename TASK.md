# Fix Multi-Module Same-Namespace XML Navigation Bug

## Context

单工作区内存在多个模块（如 Maven multi-module），不同模块中有同名 Mapper（相同 namespace）。从 A 模块的 Java 文件 `jumpToXml` 时，可能跳转到 B 模块的 XML 文件。

**示例结构：**
```
workspace/
  module-a/src/main/java/com/test/mapper/TestMapper.java
  module-a/src/main/resources/TestMapper.xml        ← namespace: com.test.mapper.TestMapper
  module-b/src/main/java/com/test/mapper/TestMapper.java
  module-b/src/main/resources/TestMapper.xml        ← namespace: com.test.mapper.TestMapper
```

## Root Cause

### 1. Quick Paths 未覆盖常见 XML 放置模式

`getQuickPaths()` 生成的 resources 路径保留了完整包结构：
- `javaPath.replace(/java/, 'resources/')` → `/module-a/src/main/resources/com/test/mapper/TestMapper.xml`
- 但实际 XML 位于 `/module-a/src/main/resources/TestMapper.xml`（无子目录结构）

Quick Paths 缺少以下常见模式：
- `src/main/resources/TestMapper.xml`（resources 根目录）
- `src/main/resources/mapper/TestMapper.xml`（resources/mapper/ 无包路径）
- `src/main/resources/mappers/TestMapper.xml`
- `src/main/resources/mybatis/TestMapper.xml`

### 2. 全局扫描返回第一个匹配

Quick Paths 未命中后，`findXmlFile()` 执行全工作区 `findFiles('**/*.xml')`，返回第一个 namespace 匹配的 XML——可能是错误模块中的文件。`getJavaPath()` 和 `handleXmlFileCreate()` 存在同样问题。

## Fix

### 策略：两层防御

1. **增强 Quick Paths**：补充模块 resources 根目录下的常见放置模式，大多数情况在 Quick Paths 阶段就命中，不走全局扫描
2. **修复全局扫描**：用最长公共路径前缀选择最亲近的文件作为兜底

### File: `src/navigator/core/FileMapper.ts`

**1. 添加最长公共路径前缀方法：**

通过按目录级别比较两个路径的公共前缀长度，选择路径最亲近的文件：
```typescript
private getCommonPrefixLength(path1: string, path2: string): number {
    const a = path1.replace(/\\/g, '/');
    const b = path2.replace(/\\/g, '/');
    let lastSep = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] !== b[i]) break;
        if (a[i] === '/') lastSep = i;
    }
    return lastSep;
}
```

优势（对比 `getModuleRoot` 方案）：
- 不依赖任何项目结构假设（无需 `/src/` 规则）
- 适用于任意目录布局（Maven、Gradle、自定义结构）
- 纯函数，易于测试

**2. 增强 `getQuickPaths()`：**

补充模块 resources 根目录下的常见模式：
```typescript
// Resources root (without package structure)
const srcMainMatch = normalizedJavaPath.match(/^(.*\/src\/main\/)java\//);
if (srcMainMatch) {
    const resourcesRoot = srcMainMatch[1] + 'resources';
    paths.push(path.join(resourcesRoot, xmlFileName));
    paths.push(path.join(resourcesRoot, 'mapper', xmlFileName));
    paths.push(path.join(resourcesRoot, 'mappers', xmlFileName));
    paths.push(path.join(resourcesRoot, 'mybatis', xmlFileName));
}
```

Quick Paths 天然从 Java 路径派生，本身就是模块内的，不存在跨模块问题。

**3. 修改 `findXmlFile()`（全局扫描部分）：**

收集所有 namespace 匹配的 XML，选最长公共前缀的：
```typescript
const xmlFiles = await vscode.workspace.findFiles('**/*.xml', WORKSPACE_EXCLUDE_PATTERN);
const javaPathNormalized = javaPath.replace(/\\/g, '/');
let bestXmlPath: string | null = null;
let bestPrefixLen = -1;

for (const xmlUri of xmlFiles) {
    const xmlPath = xmlUri.fsPath;
    if (await this.verifyXmlFile(xmlPath, namespace)) {
        const prefixLen = this.getCommonPrefixLength(javaPathNormalized, xmlPath);
        if (prefixLen > bestPrefixLen) {
            bestPrefixLen = prefixLen;
            bestXmlPath = xmlPath;
        }
    }
}

return bestXmlPath;
```

**4. 同样修改 `getJavaPath()`：** XML→Java 方向也需同模块优先。

**5. 同样修改 `handleXmlFileCreate()`：** 新建 XML 时也需同模块优先。

## Files to Modify

| File | Change |
|------|--------|
| `src/navigator/core/FileMapper.ts` | 添加 `getCommonPrefixLength()`，增强 `getQuickPaths()`，修改 `findXmlFile()`、`getJavaPath()`、`handleXmlFileCreate()` |

## Tests

### Unit Tests (`src/test/unit/FileMapper.test.ts`)

- `getCommonPrefixLength`: 各种路径格式（Linux/Windows、同模块、跨模块、无公共前缀）
- `getQuickPaths`: 验证新增的 resources 根目录路径
- `findXmlFile`: mock 两个模块同 namespace XML，验证返回同模块
- `getJavaPath`: mock 两个模块同 namespace Java，验证返回同模块
- `handleXmlFileCreate`: 同上

### Integration Test Fixtures (`src/test/fixtures/multi-module-project/`)

```
multi-module-project/
  pom.xml
  module-a/
    pom.xml
    src/main/java/com/test/mapper/TestMapper.java   ← namespace: com.test.mapper.TestMapper
    src/main/resources/TestMapper.xml                ← namespace: com.test.mapper.TestMapper
  module-b/
    pom.xml
    src/main/java/com/test/mapper/TestMapper.java   ← namespace: com.test.mapper.TestMapper
    src/main/resources/TestMapper.xml                ← namespace: com.test.mapper.TestMapper
```

## Verification

1. `pnpm run check-types`
2. `pnpm run test:unit`
3. 手动测试：多模块项目中同名 Mapper 的 jumpToXml 跳转正确性
