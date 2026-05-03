---
name: efficient-search
description: Guidance on performing efficient searches by skipping unnecessary directories and files.
---

# Efficient Search

Use this skill when you need to search for files, symbols, or text within the project codebase and want to minimize noise and improve performance by excluding irrelevant directories.

## Key Principles
- **Minimize Noise**: Always exclude dependency, build, and metadata directories from searches.
- **Respect Boundaries**: Honor `.gitignore` rules and focus on source code.
- **Efficiency**: Use search tool exclusions to speed up results and reduce resource usage.

## Guidelines

When searching, ALWAYS skip the following directories:

### 1. Dependency Directories
- `node_modules/`
- `packages/` (NuGet, etc.)
- `vendor/`

### 2. Build and Output Directories
- `bin/`
- `obj/`
- `dist/`
- `build/`
- `target/`
- `out/`

### 3. IDE and Tooling Metadata
- `.git/`
- `.idea/`
- `.vs/`
- `.vscode/`
- `.junie/` (unless specifically looking for agent configurations)

### 4. Git Ignored Files
- Any file or directory listed in the project's `.gitignore` should generally be skipped.

## Examples

### Search with exclusions in PowerShell
```powershell
# Searching for "User" but excluding bin and obj directories
Get-ChildItem -Recurse -Exclude bin,obj | Select-String "User"
```

### Focusing on source directories
```powershell
# Search only in the src directory
Get-ChildItem -Path .\src -Recurse | Select-String "Authentication"
```
