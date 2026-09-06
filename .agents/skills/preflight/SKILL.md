---
name: preflight
description: >
  Verify that the local development environment has all required tools and
  dependencies installed. Checks Node.js, npm, RTK, ast-grep, Git, project
  dependencies, and TypeScript. Reports a pass/fail table with install
  instructions for anything missing.
---

# Preflight Environment Check

## Purpose

You are performing a **local environment verification**. Your objective is to
confirm that all required developer and agent tools are installed, accessible,
and at acceptable versions. Report results as a concise pass/fail table.

## Execution Steps

Run the following checks **sequentially**. For each check, record the result
as ✅ PASS (with version) or ❌ FAIL (with install instructions).

### 1. Node.js

```bash
node --version
```

- **Expected**: v22.0.0 or higher.
- **Install**: <https://nodejs.org/> (LTS recommended).

### 2. npm

```bash
npm --version
```

- **Expected**: v10.0.0 or higher (ships with Node.js 22+).
- **Install**: Comes with Node.js. Update with `npm install -g npm`.

### 3. Git

```bash
git --version
```

- **Expected**: Any recent version (2.30+).
- **Install**: <https://git-scm.com/downloads>

### 4. Project Dependencies

```bash
npm ls --depth=0
```

- **Expected**: No `MISSING` or `ERR!` entries.
- **Fix**: Run `npm install` from the project root.

### 5. RTK (Rust Token Killer)

```bash
rtk --version
```

- **Expected**: v0.40.0 or higher.
- **Install**: See <https://github.com/rtk-ai/rtk> for installation via Cargo,
  Homebrew, or prebuilt binary. After installing, run
  `rtk init --agent antigravity` in the project root.

### 6. ast-grep

```bash
npx ast-grep --version
```

- **Expected**: Any version (installed as devDependency `@ast-grep/cli`). Note: the `sg` alias is deprecated; always use `ast-grep`.
- **Fix**: Run `npm install` — `@ast-grep/cli` is listed in devDependencies.

### 7. TypeScript Compiler

```bash
npx tsc --version
```

- **Expected**: v6.0.0 or higher (matches project's `typescript` devDependency).
- **Fix**: Run `npm install` to restore devDependencies.

## Output Format

After running all checks, present results in a markdown table:

```markdown
| Tool | Status | Version | Notes |
| --- | --- | --- | --- |
| Node.js | ✅ | v22.x.x | — |
| npm | ✅ | v10.x.x | — |
| Git | ✅ | 2.x.x | — |
| Dependencies | ✅ | — | All installed |
| RTK | ✅ | v0.48.x | — |
| ast-grep | ✅ | 0.x.x | via npx |
| TypeScript | ✅ | 6.0.x | — |
```

If any check fails, add the install/fix instructions to the **Notes** column.

## When to Use

- After cloning the repository for the first time.
- When an agent encounters unexpected tool-not-found errors.
- When onboarding a new developer or setting up a new machine.
- Periodically to verify environment consistency.
