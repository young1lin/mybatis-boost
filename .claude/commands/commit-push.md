---
description: Stage changed files, create a commit, and push to remote
---

# Commit & Push

Automatically stage files, create a commit message, and push to remote repository.

## What This Command Does

1. **Analyze changes**: Shows what files have been modified/added/deleted
2. **Filter files**: Excludes files that shouldn't be committed:
   - `debug*.json` - Debug output files
   - `*.exe`, `*.dll` - Compiled binaries (unless explicitly added)
   - `*.log` - Log files
   - `.DS_Store` - macOS system files
   - `*.tmp`, `*.swp` - Temporary files
3. **Stage files**: Runs `git add` on remaining files
4. **Create commit**: Generates a conventional commit message
5. **Push**: Pushes to the current branch's remote

## Usage

```
/commit-push
```

## Commit Message Format

Follows conventional commits format:

```
<type>(<scope>): <description>

[optional body]

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `docs` - Documentation changes
- `chore` - Maintenance tasks
- `perf` - Performance improvements

## Examples

**Example 1: Feature addition**
```
Changes:
+ cmd/statusline/main.go (new feature)
+ internal/parser/transcript.go (updated)

→ Commit: "feat(statusline): add token progress display"
```

**Example 2: Bug fix**
```
Changes:
M internal/config/paths.go (fix path handling)

→ Commit: "fix(config): correct Windows path resolution"
```

**Example 3: Test updates**
```
Changes:
M cmd/statusline/main_test.go
M internal/parser/parser_test.go

→ Commit: "test: add comprehensive test coverage for parser"
```

## Files to Exclude from Commit

The following patterns are automatically excluded:

| Pattern | Description |
|---------|-------------|
| `debug*.json` | Debug output files |
| `*.exe`, `*.dll`, `*.so` | Compiled binaries |
| `*.log` | Log files |
| `.DS_Store` | macOS system files |
| `Thumbs.db` | Windows thumbnail cache |
| `*.tmp`, `*.swp`, `*.swo` | Editor temporary files |
| `node_modules/` | Node.js dependencies |
| `__pycache__/` | Python cache |
| `*.pyc` | Python bytecode |

## Steps to Execute

1. Run `git status --porcelain` to get list of changes
2. Run `git diff --stat` to see change summary
3. Filter out files matching exclusion patterns
4. Run `git add` on remaining files
5. Generate commit message based on changes
6. Run `git commit` with the message
7. Run `git push` to remote

## Error Handling

If any step fails:
- Show the error message
- Don't proceed to next step
- Allow user to manually fix and retry
