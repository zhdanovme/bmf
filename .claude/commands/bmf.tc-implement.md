---
description: Generate plan/*.md implementation specs from tc-plan.yaml — one file per TC with entities, dependencies, and links to YAMLs.
---

## User Input

```text
$ARGUMENTS
```

## Overview

Takes the ordered TC plan (`tc-plan.yaml`) and generates a `plan/` directory with one markdown file per test case. Each file describes **what needs to be implemented** to make that TC pass: which entities to create/modify, what data models are involved, what screens to build, what actions to wire up — all with clickable links to source YAML files.

Files are numbered by global implementation order across all stages, so the folder reads as a sequential implementation guide.

## Execution

### 1. Parse Arguments

Extract from `$ARGUMENTS`:
- `folder` (required) — path to BMF project folder (e.g., `bmfs/works/myproject`)

If folder is empty, list available projects in `bmfs/` and ask user to specify.

### 2. Verify Prerequisites

Check that all exist:
- `{folder}/tc-plan.yaml` — implementation plan
- `{folder}/_test-cases.yaml` — TC definitions
- `{folder}/_epics.yaml` — epic definitions

If `tc-plan.yaml` is missing:
```
ERROR: tc-plan.yaml not found in {folder}

Run: /bmf.tc-plan {folder} first.
```

### 3. Read All Sources

Load into context:

**A. Plan and meta:**
- `{folder}/tc-plan.yaml` — ordered TC list by stage
- `{folder}/_test-cases.yaml` — TC descriptions
- `{folder}/_epics.yaml` — epic context

**B. All entity YAML files:**
- `{folder}/*.yaml` (excluding `_*.yaml`)
- For each entity: ID, description, tags, props, data, effects, components, layout, references

**C. Optional:**
- `{folder}/prd.md` — PRD if exists (for additional context)
- `{folder}/services/*.md` — service architecture if exists

### 4. Build Global Order

Flatten `tc-plan.yaml` stages into a single ordered list with global numbering:

```
tc-plan.yaml:
  mvp:
    - tc:auth:register        → 001
    - tc:auth:login-success   → 002
    - tc:catalog:browse       → 003
  v1:
    - tc:social:add-friend    → 004
    - tc:auth:password-reset  → 005
```

This numbering is used for file prefixes.

### 5. For Each TC — Generate Implementation Spec

For each TC in global order, generate `{folder}/plan/{NNN}-tc-{domain}-{name}.md`.

**File naming:**
- `NNN` — zero-padded global order number (001, 002, ...)
- `tc-{domain}-{name}` — TC ID with colons replaced by hyphens
- Example: `001-tc-auth-register.md`, `015-tc-cart-checkout-empty.md`

**For each TC, analyze:**

A. **TC definition** — read description from `_test-cases.yaml`
B. **Tagged entities** — find all entities with `tc:domain:scenario` tags (`:start`, `:end`, bare)
C. **Entity details** — for each tagged entity, extract its full definition (props, data, effects, components)
D. **References** — trace all `$entity.*`, `$action.*`, `$screen.*`, `$dialog.*`, `$context.*`, `$external.*` references from tagged entities
E. **New vs existing** — which entities from this TC were already covered by earlier TCs in the plan (check their tc:* tags)
F. **Dependencies** — which earlier TCs (by plan order) touch entities that this TC references

### 6. File Structure

Each `{NNN}-tc-{domain}-{name}.md` follows this structure:

```markdown
# {NNN}. {tc:domain:scenario-name}

> {First line of TC description from _test-cases.yaml}

**Stage:** {stage from tc-plan.yaml}
**Epic:** [{epic:domain}]({relative path to _epics.yaml})

## Сценарий

{Full TC description from _test-cases.yaml — numbered steps}

## Сущности

Entities directly tagged with this TC, grouped by type.

### Screens

| Entity | File | Status | Description |
|--------|------|--------|-------------|
| [screen:epic:name](../file.yaml) | file.yaml | NEW | Short description |

### Actions

| Entity | File | Status | Description |
|--------|------|--------|-------------|
| [action:epic:name](../file.yaml) | file.yaml | NEW | Short description |

### Dialogs

| Entity | File | Status | Description |
|--------|------|--------|-------------|

### Entities (data models)

| Entity | File | Status | Description |
|--------|------|--------|-------------|

### Events

| Entity | File | Status | Description |
|--------|------|--------|-------------|

{Omit empty groups — if no events, skip ### Events}

## Зависимости

Entities referenced by this TC's entities but belonging to OTHER TCs.

| Entity | Defined in TC | Plan # | File |
|--------|---------------|--------|------|
| [entity:auth:user](../entity.yaml) | [tc:auth:register](001-tc-auth-register.md) | 001 | entity.yaml |
| [$context.current_user](../context.yaml) | [tc:auth:login-success](002-tc-auth-login-success.md) | 002 | context.yaml |

{If no dependencies — write "Нет внешних зависимостей."}

## Что реализовать

Concrete implementation checklist derived from entity analysis:

### Data models
- [ ] `entity:epic:name` — {fields to create/extend}: [source](../entity.yaml)
  - field1: type — {purpose}
  - field2: type — {purpose}

### Backend logic
- [ ] `action:epic:name` — {what this action does}: [source](../action.yaml)
  - Effects: {list key effects from YAML}
  - References: {key $references}

### UI
- [ ] `screen:epic:name` — {what to render}: [source](../screen.yaml)
  - Layout: {layout reference}
  - Key components: {list main components}
- [ ] `dialog:epic:name` — {modal purpose}: [source](../dialog.yaml)

### Events / Async
- [ ] `event:epic:name` — {trigger and recipients}: [source](../event.yaml)

{Omit empty subsections. Only include what this TC actually needs.}

## Заметки

{Any non-obvious implementation notes:
- Edge cases mentioned in TC description
- Complex effect chains to pay attention to
- External system integrations ($external:*)
- Shared entities that might conflict with other TCs
If nothing notable — omit this section entirely.}
```

### 7. Generate plan/README.md

Create `{folder}/plan/README.md` — overview of the whole implementation plan:

```markdown
# Implementation Plan

> Generated from tc-plan.yaml

## Overview

| Stage | TCs | Description |
|-------|-----|-------------|
| mvp   | {N} | {first and last TC in stage} |
| v1    | {N} | {first and last TC in stage} |

**Total:** {N} test cases, {N} entities involved

## Order

| # | TC | Stage | Epic | Dependencies |
|---|-----|-------|------|-------------|
| 001 | [tc:auth:register](001-tc-auth-register.md) | mvp | epic:auth | — |
| 002 | [tc:auth:login-success](002-tc-auth-login-success.md) | mvp | epic:auth | 001 |
| 003 | [tc:catalog:browse](003-tc-catalog-browse.md) | mvp | epic:catalog | 001, 002 |
| ... | ... | ... | ... | ... |

## By Epic

### epic:auth
- [001 tc:auth:register](001-tc-auth-register.md) — mvp
- [002 tc:auth:login-success](002-tc-auth-login-success.md) — mvp
- [017 tc:auth:password-reset](017-tc-auth-password-reset.md) — v1

### epic:catalog
- [003 tc:catalog:browse](003-tc-catalog-browse.md) — mvp
...
```

### 8. Validation Pass

After generating all files, verify:

1. **Every TC from tc-plan.yaml has a corresponding .md file** — no orphans
2. **All entity links point to existing YAML files** — no broken `(../file.yaml)` references
3. **All dependency TC links point to existing .md files** — no broken `(NNN-tc-*.md)` references
4. **Numbering is sequential** — no gaps
5. **Status column is correct** — "NEW" for entities first appearing in this TC, "EXISTS" for entities already covered by earlier TCs

Report issues if found.

### 9. Report Summary

```
Implementation plan generated in {folder}/plan/

  Files created: {N} + README.md

  By stage:
    mvp: {N} files (001-{N})
    v1:  {N} files ({N+1}-{M})
    ...

  Entity coverage:
    Screens: {N} across {N} TCs
    Actions: {N} across {N} TCs
    Entities: {N} across {N} TCs
    Dialogs: {N} across {N} TCs
    Events: {N} across {N} TCs

  Dependency chains:
    Longest: {tc:id} depends on {N} prior TCs
    Independent: {N} TCs have no dependencies
```

## Behavior Rules

- Never overwrite existing `plan/` directory without confirmation
- If `plan/` already exists, ask user: overwrite all / update changed only / abort
- All paths in markdown links must be **relative** from `plan/` to project root (`../entity.yaml`, `../_epics.yaml`)
- Links to other plan files use just filename (`001-tc-auth-register.md`), not full path
- Entity Status is "NEW" if this is the first TC in plan order that tags this entity, "EXISTS" otherwise
- Omit empty sections — don't write `### Events` if TC has no events
- Use the same language as the project for headings and descriptions
- Preserve exact entity descriptions from YAML — don't paraphrase
- Every entity ID mentioned must be a clickable link to its source YAML file
- Every TC reference must be a clickable link to its plan .md file
- The "Что реализовать" section should be actionable — a developer reads it and knows what to build
- Keep each file focused — don't repeat information from other TC files, reference them via links instead
