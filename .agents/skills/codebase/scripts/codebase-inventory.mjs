#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function findRepoRoot(start) {
  let current = path.resolve(start);
  while (true) {
    if (
      fs.existsSync(path.join(current, 'package.json')) &&
      fs.existsSync(path.join(current, 'src', 'extension.ts'))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error('Could not find the MyBatis Boost repository root');
    }
    current = parent;
  }
}

function parseArgs(argv) {
  let format = 'markdown';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      return { help: true, format };
    }
    if (arg === '--format') {
      format = argv[++i];
      if (!format) {
        throw new Error('--format requires markdown or json');
      }
      continue;
    }
    if (arg.startsWith('--format=')) {
      format = arg.slice('--format='.length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (!['markdown', 'json'].includes(format)) {
    throw new Error(`Unsupported format: ${format}`);
  }
  return { help: false, format };
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function walkFiles(root, predicate = () => true) {
  if (!fs.existsSync(root)) {
    return [];
  }
  const result = [];
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
      } else if (entry.isFile() && predicate(fullPath)) {
        result.push(fullPath);
      }
    }
  }
  return result.sort();
}

function relative(repoRoot, filePath) {
  return toPosix(path.relative(repoRoot, filePath));
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function currentCommit(repoRoot) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function collectSource(repoRoot) {
  const sourceRoot = path.join(repoRoot, 'src');
  const files = walkFiles(sourceRoot, file => file.endsWith('.ts'));
  const modules = new Map();
  const exports = [];
  const imports = [];

  const exportPattern = /^\s*export\s+(?:default\s+)?(?:abstract\s+)?(class|interface|type|enum|function|const|async\s+function)\s+([A-Za-z_$][\w$]*)/gm;
  const importPattern = /^\s*import(?:[\s\S]*?)\sfrom\s+['"]([^'"]+)['"];?/gm;

  for (const file of files) {
    const rel = relative(repoRoot, file);
    const underSrc = toPosix(path.relative(sourceRoot, file));
    const parts = underSrc.split('/');
    const module = parts.length === 1 ? '(root)' : parts[0];
    if (!modules.has(module)) {
      modules.set(module, []);
    }
    modules.get(module).push(rel);

    const content = readText(file);
    for (const match of content.matchAll(exportPattern)) {
      exports.push({ file: rel, kind: match[1], name: match[2] });
    }
    for (const match of content.matchAll(importPattern)) {
      if (match[1].startsWith('.')) {
        imports.push({ file: rel, source: match[1] });
      }
    }
  }

  return {
    modules: Object.fromEntries(
      [...modules.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, moduleFiles]) => [name, moduleFiles.sort()])
    ),
    exports: exports.sort((a, b) =>
      a.file.localeCompare(b.file) || a.name.localeCompare(b.name)
    ),
    imports: imports.sort((a, b) =>
      a.file.localeCompare(b.file) || a.source.localeCompare(b.source)
    ),
  };
}

function collectTests(repoRoot) {
  const testRoot = path.join(repoRoot, 'src', 'test');
  const files = walkFiles(testRoot, file => /\.test\.ts$/.test(file));
  const suitePattern = /^\s*(?:describe|suite)\(\s*['"`]([^'"`]+)['"`]/gm;
  return files.map(file => {
    const content = readText(file);
    const suites = [...content.matchAll(suitePattern)].map(match => match[1]);
    return {
      file: relative(repoRoot, file),
      suites,
    };
  });
}

function collectJavaProjects(repoRoot) {
  const javaRoot = path.join(repoRoot, 'java-project');
  const buildNames = new Set(['pom.xml', 'build.gradle', 'build.gradle.kts']);
  return walkFiles(javaRoot, file => buildNames.has(path.basename(file)))
    .map(file => ({
      root: relative(repoRoot, path.dirname(file)),
      buildFile: relative(repoRoot, file),
    }));
}

function collectPackage(repoRoot) {
  const packageJson = JSON.parse(readText(path.join(repoRoot, 'package.json')));
  const contributes = packageJson.contributes ?? {};
  return {
    packageManager: packageJson.packageManager ?? null,
    scripts: Object.fromEntries(
      Object.entries(packageJson.scripts ?? {}).sort(([a], [b]) => a.localeCompare(b))
    ),
    commands: (contributes.commands ?? [])
      .map(item => item.command)
      .filter(Boolean)
      .sort(),
    configurationKeys: Object.keys(
      contributes.configuration?.properties ?? {}
    ).sort(),
    activationEvents: [...(packageJson.activationEvents ?? [])].sort(),
  };
}

function collectInventory(repoRoot) {
  const source = collectSource(repoRoot);
  return {
    repository: path.basename(repoRoot),
    commit: currentCommit(repoRoot),
    source,
    tests: collectTests(repoRoot),
    javaProjects: collectJavaProjects(repoRoot),
    package: collectPackage(repoRoot),
  };
}

function renderList(items, empty = '_None_') {
  return items.length > 0 ? items.map(item => `- \`${item}\``).join('\n') : empty;
}

function renderMarkdown(inventory) {
  const lines = [
    '# MyBatis Boost Codebase Inventory',
    '',
    `- Repository: \`${inventory.repository}\``,
    `- Commit: \`${inventory.commit ?? 'unavailable'}\``,
    '',
    '## Source Modules',
    '',
    '| Module | TypeScript files |',
    '|---|---:|',
  ];

  for (const [module, files] of Object.entries(inventory.source.modules)) {
    lines.push(`| \`${module}\` | ${files.length} |`);
  }

  lines.push('', '## Exported Symbols', '');
  for (const item of inventory.source.exports) {
    lines.push(`- \`${item.name}\` (${item.kind}) — \`${item.file}\``);
  }

  lines.push('', '## Relative Imports', '');
  for (const item of inventory.source.imports) {
    lines.push(`- \`${item.file}\` → \`${item.source}\``);
  }

  lines.push('', '## Extension Commands', '',
    renderList(inventory.package.commands),
    '', '## Configuration Keys', '',
    renderList(inventory.package.configurationKeys),
    '', '## Package Scripts', '');
  for (const [name, command] of Object.entries(inventory.package.scripts)) {
    lines.push(`- \`${name}\`: \`${command}\``);
  }

  lines.push('', '## Tests', '');
  for (const test of inventory.tests) {
    const suites = test.suites.length > 0 ? test.suites.join('; ') : 'no top-level suite detected';
    lines.push(`- \`${test.file}\` — ${suites}`);
  }

  lines.push('', '## Java Projects', '');
  for (const project of inventory.javaProjects) {
    lines.push(`- \`${project.root}\` — \`${project.buildFile}\``);
  }

  return `${lines.join('\n')}\n`;
}

function printHelp() {
  process.stdout.write(
    'Usage: node codebase-inventory.mjs [--format markdown|json]\n'
  );
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  const repoRoot = findRepoRoot(scriptDir);
  const inventory = collectInventory(repoRoot);
  if (args.format === 'json') {
    process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
  } else {
    process.stdout.write(renderMarkdown(inventory));
  }
} catch (error) {
  process.stderr.write(`[codebase-inventory] ${error.message}\n`);
  process.exit(2);
}
