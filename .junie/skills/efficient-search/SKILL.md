---
name: efficient-search
description: Guidance on performing efficient searches and project exploration by skipping unnecessary directories and files.
TRIGGER when: The task involves searching for files, symbols, text, or exploring the project structure (especially recursively).
---

# Efficient Search and Exploration

Use this skill when you need to search for files, symbols, or text within the project codebase or when exploring the project structure. Its goal is to minimize noise and improve performance by excluding irrelevant directories.

## Key Principles
- **Minimize Noise**: Always exclude dependency, build, and metadata directories from searches and listings.
- **Respect Boundaries**: Honor `.gitignore` rules and focus on source code.
- **Efficiency**: Use search tool exclusions to speed up results and reduce resource usage.

## Guidelines

### Prohibited Practices
- **NEVER** use `ls -R` or `dir /s` on root or source directories without strict exclusions. These commands will traverse `node_modules`, `bin`, `obj`, etc., resulting in massive, useless output.
- **AVOID** `Get-ChildItem -Recurse` in PowerShell unless `-Exclude` or `-Filter` is used to skip noise directories.

### Recommended Approach
1.  **Targeted Search**: Use `search_project` or `search_contents_by_grep` with specific terms instead of manual recursive listings.
2.  **Breadth-First Exploration**: Use `ls` (without `-R`) to explore one level at a time.
3.  **Symbolic Search**: Use `get_file_structure` to understand a file's content without reading the whole file.
4.  **Exclusions**: When recursion is absolutely necessary, ALWAYS skip the following:

#### 1. Dependency Directories
- `node_modules/`
- `packages/` (NuGet, etc.)
- `vendor/`

#### 2. Build and Output Directories
- `bin/`
- `obj/`
- `dist/`
- `build/`
- `target/`
- `out/`

#### 3. IDE and Tooling Metadata
- `.git/`
- `.idea/`
- `.vs/`
- `.vscode/`
- `.junie/` (unless specifically looking for agent configurations)

#### 4. Git Ignored Files
- Any file or directory listed in the project's `.gitignore` should generally be skipped.

## Examples

### Efficient listing in PowerShell (excluding common noise)
```powershell
# List files recursively but skip bin, obj, and node_modules
Get-ChildItem -Recurse -Exclude bin,obj,node_modules
```

### Search with exclusions in PowerShell
```powershell
# Searching for "User" but excluding bin and obj directories
Get-ChildItem -Recurse -Exclude bin,obj | Select-String "User"
```

### Focusing on source directories
```powershell
# Search only in the src directory
# Note: Always include -Exclude if there's any chance of nested dependency folders
Get-ChildItem -Path .\src -Recurse -Exclude node_modules | Select-String "Authentication"
```
