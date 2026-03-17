---
description: Implement whole project step by step by plan — enrich each TC with full YAML details, implement, verify with tests, then proceed to next.
---

## User Input

```text
$ARGUMENTS
```

## Overview

Execute the implementation plan (`plan/` directory) step by step. For each TC in order:

1. **Enrich** — read the plan file and load ALL referenced entities from YAML with full details (props, data, effects, components, layout)
2. **Implement** — write the actual code (backend, frontend, tests) as described in "Что реализовать"
3. **Verify** — run tests to confirm the TC passes
4. **Gate** — only proceed to the next TC when ALL tests for the current TC pass

This skill is a **code generation and execution** skill — it produces real project code, not documentation.

## Execution

### 1. Parse Arguments

Extract from `$ARGUMENTS`:
- `folder` (required) — path to BMF project folder (e.g., `bmfs/works/gaf`)
- `output` (optional) — target directory for the generated project code (default: ask user)
- `start_from` (optional) — plan file number to resume from (e.g., `011` to skip already implemented TCs)

If folder is empty, list available projects in `bmfs/works/` and ask user to specify.

If output is empty, ask user:
```
Where should the project code be generated?
  - Provide a path (e.g., ~/projects/gaf)
```

### 2. Verify Prerequisites

Check that all exist in `{folder}/`:
- `plan/` directory with numbered `.md` files
- `plan/README.md` — implementation plan overview
- `_test-cases.yaml` — TC definitions
- `_epics.yaml` — epic definitions
- All `*.yaml` entity files referenced in plan files

Check for supporting docs (not required but used if present):
- `tech.md` — technical decisions and patterns
- `tdd.md` — testing strategy and mock patterns
- `services/*.md` — service architecture
- `CLAUDE.md` — project-specific instructions

If `plan/` is missing:
```
ERROR: plan/ directory not found in {folder}

Run: /bmf.tc-implement {folder} first to generate plan files.
```

### 3. Load Project Context (once)

Read into context BEFORE starting any TC:

**A. Plan overview:**
- `{folder}/plan/README.md` — full implementation order, dependencies, entity coverage

**B. All entity YAML files:**
- `{folder}/*.yaml` (excluding `_*.yaml`) — full entity definitions
- For each entity: ID, description, tags, props, data, effects, components, layout

**C. Meta files:**
- `{folder}/_epics.yaml` — epic descriptions
- `{folder}/_test-cases.yaml` — TC descriptions with steps

**D. Technical docs (if present):**
- `{folder}/tech.md` — technology choices, patterns, architecture decisions
- `{folder}/tdd.md` — testing strategy, mock implementations, test levels
- `{folder}/services/*.md` — service boundaries and responsibilities

**E. Project instructions (if present):**
- `{folder}/CLAUDE.md` — project-specific rules for code generation

### 4. Build Execution Order

Parse `plan/README.md` → Order table to get the sequential list of plan files:

```
000-infra.md         → infrastructure setup (special — no TC, just scaffold)
001-tc-auth-login-admin.md → first TC
002-tc-admin-create-user.md → second TC
...
```

If `start_from` is specified, skip all files before that number.

### 5. For Each Plan File — Execute Implementation Cycle

For each plan file in order, execute the following cycle:

#### 5.1. Announce Current TC

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 [{NNN}/{TOTAL}] {tc:domain:scenario}
 Stage: {stage} | Epic: {epic:domain}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### 5.2. Enrich — Load Full Context for This TC

Read the plan file `{folder}/plan/{NNN}-tc-{name}.md` and for EVERY entity mentioned in it:

**A. Read full entity definition from YAML:**
- For each entity ID in "Сущности" tables → read its FULL definition from the source YAML file
- Include: description, tags, ALL props with types, ALL data fields with descriptions, ALL effects (full BML expressions), ALL components with types/labels/values, layout references
- For screens: read the full component tree (including YAML anchors resolved)
- For actions: read all effects with full BML expressions
- For events: read `to` recipients and effects
- For entities: read all data fields with types and constraints

**B. Read dependency entities:**
- For each entity in "Зависимости" table → read its full definition too
- These are entities from earlier TCs that this TC depends on

**C. Cross-reference with tech.md / tdd.md:**
- Find ALL sections in tech.md / tdd.md that reference entities from this TC
- Extract relevant implementation patterns, code examples, mock strategies

**D. Build implementation brief:**

Combine all of the above into a single coherent implementation brief:

```
TC: {tc:domain:scenario}
Scenario: {numbered steps from _test-cases.yaml}

ENTITIES TO IMPLEMENT:
  {entity_id}:
    description: ...
    props: { full definition }
    data: { full definition }
    effects: [ full BML expressions ]
    components: [ full component tree ]
    referenced_by: [ other entities that use this one ]

DEPENDENCIES (already implemented):
  {entity_id}: { summary of what exists }

TECHNICAL CONTEXT:
  {relevant sections from tech.md}

TESTING STRATEGY:
  {relevant sections from tdd.md}
  {test checklist from plan file "Тесты" section}
```

#### 5.3. Implement — Write Code

Based on the enriched brief, implement everything listed in "Что реализовать" section of the plan file:

**Implementation order within a TC:**

1. **Data models** — DB schema, migrations, Zod schemas in contract package
2. **Backend logic** — NestJS modules, services, controllers, guards
3. **Frontend** — React components, pages, API hooks, state
4. **Events / Async** — SSE handlers, event listeners, background jobs
5. **Tests** — ALL test levels mentioned in the plan file

**Code generation rules:**

- Follow patterns established by earlier TCs — read existing code before writing new code
- Use existing abstractions (adapters, services, guards) — don't reinvent
- Match the coding style of existing files in `{output}/`
- Follow tech.md patterns exactly (e.g., DI adapters, ts-rest contracts, Drizzle schema)
- Follow tdd.md mock strategies exactly (e.g., `overrideProvider()`, no `vi.mock()`)
- Every new file must be in the correct directory per project structure
- Every new module must be properly imported in parent module
- Every new route must be added to the router
- Every new contract endpoint must be added to `packages/contract`
- Commit atomically per TC (all files for one TC = one logical unit)

**For 000-infra (special case):**
- This is the project scaffold — no business logic
- Create the full monorepo structure, configs, adapters, mocks, CI, DB setup
- This must work end-to-end: `pnpm install && pnpm build && pnpm test:mock` should pass

#### 5.4. Verify — Run Tests

After implementation, run the test suite:

```bash
# In {output}/ directory

# Step 1: Type check
pnpm typecheck

# Step 2: Lint
pnpm lint

# Step 3: Unit + Service tests (L1-L3 backend, L1+L4 frontend)
pnpm test:mock

# Step 4: E2E tests if this TC has L5 tests
pnpm --filter web test:e2e
```

**Verification criteria — ALL must pass:**
- [ ] TypeScript compilation succeeds (zero errors)
- [ ] Lint passes (zero errors, warnings OK)
- [ ] All existing tests still pass (no regressions)
- [ ] All NEW tests for this TC pass
- [ ] If TC has E2E tests — Playwright tests pass

#### 5.5. Gate — Fix or Proceed

**If ALL tests pass:**
```
✓ [{NNN}/{TOTAL}] {tc:domain:scenario} — PASSED
  Tests: {N} new, {M} total, 0 failed
  Files: {N} created, {M} modified
```
→ Proceed to next TC (step 5.1)

**If tests FAIL:**

1. Analyze failure output
2. Identify root cause (implementation bug, missing import, wrong mock, schema mismatch)
3. Fix the issue
4. Re-run ONLY the failing tests first for fast feedback
5. Then re-run the full suite
6. Repeat until all pass

**Max retry attempts: 3**

If after 3 fix attempts tests still fail:
```
✗ [{NNN}/{TOTAL}] {tc:domain:scenario} — BLOCKED

  Failing tests:
    - {test name}: {error summary}
    - ...

  Attempted fixes:
    1. {what was tried}
    2. {what was tried}
    3. {what was tried}

  Likely root cause: {analysis}
```
→ STOP and ask user for guidance. Do NOT skip to next TC.

### 6. Progress Tracking

Maintain a todo list with all TCs. Update status as you progress:

```
[completed] 000-infra — Infrastructure Setup
[completed] 001-tc-auth-login-admin — Admin login
[in_progress] 002-tc-admin-create-user — Create employee
[pending] 003-tc-auth-login-employee — Employee login
...
```

### 7. Completion Summary

After all TCs are implemented:

```
Implementation complete!

  TCs implemented: {N}/{TOTAL}
  Files created: {N}
  Files modified: {N}
  Total tests: {N} (all passing)

  By stage:
    mvp: {N} TCs — all passing
    v1:  {N} TCs — all passing

  To run:
    pnpm dev          — start dev servers
    pnpm test:mock    — run all tests
    pnpm build        — production build
```

## Behavior Rules

### General
- NEVER skip a TC — implementation is strictly sequential
- NEVER proceed to next TC if current TC's tests fail
- ALWAYS read existing code before modifying it
- ALWAYS enrich with full YAML details before implementing — don't implement from plan file summaries alone
- ALWAYS check what already exists in {output}/ before creating new files
- If a plan file references entities that don't exist in YAML — flag it, don't guess

### Code Quality
- Follow the established patterns from earlier TCs — consistency over cleverness
- Don't add features beyond what the plan file specifies
- Don't refactor earlier code unless the current TC specifically requires it
- Keep test coverage at the levels specified in the plan file (L1-L5)
- Use the exact mock strategies from tdd.md — no shortcuts

### Error Recovery
- On test failure, fix the failing code — don't modify the test to make it pass
- If a test seems wrong (testing the wrong thing), flag it to the user before changing
- If implementation reveals a gap in the plan file (missing entity, unclear flow) — flag it, propose a solution, ask user before proceeding
- If tech.md / tdd.md contradicts the plan file — follow tech.md / tdd.md (they are the technical authority)

### Communication
- Announce each TC before starting
- Show test results after each TC
- Report blockers immediately — don't silently skip
- After every 5 TCs, show a progress summary
