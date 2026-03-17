---
description: Find obvious missing logic elements in BMF YAML specification — entities, fields, actions, screens, and flows that should exist based on what's already defined.
---

## User Input

```text
$ARGUMENTS
```

## Overview

Analyze a BMF YAML specification and find **logic elements that are obviously implied but not described**. This is a completeness checker, not a style/quality audit. It answers one question: "Given what's already defined, what's clearly missing?"

The command outputs findings directly to chat (no file generated).

## Execution

### 1. Parse Arguments

Extract from `$ARGUMENTS`:
- `folder` — path to BMF project folder (e.g., `bmfs/works/bchp3`)

If folder is empty, list available projects in `bmfs/` and ask user to specify.

### 2. Load Project

Read ALL `*.yaml` files in `{folder}/`. Build entity registry:

```
entity_id -> {
  type, epic_domain, name,
  file, description, tags, props, data, effects, components, layout, to,
  references_out: [entity IDs this entity references via $entity.*, $screen.*, $action.*, etc.],
  references_in: [entity IDs that reference this entity]
}
```

### 3. Run Structural Validation

```bash
npx ts-node utils/validate-schema.ts {folder}
npx ts-node utils/check-references.ts {folder}
```

Capture output. Broken references are critical — report them first.

### 4. Find Missing Logic Elements

For each category below, collect findings. Each finding has:
- **severity**: CRITICAL / WARNING
- **entity_id**: the entity that reveals the gap
- **what's missing**: concrete description of the missing element
- **suggested fix**: specific entity/field/action to add

NO INFO-level findings. Only report things that are clearly missing, not "nice to have".

---

#### 4.1. IMPLIED BUT MISSING ENTITIES

Scan all `effects`, `data`, `props`, `components`, and `description` fields for `$entity.*`, `$action.*`, `$screen.*`, `$dialog.*`, `$event.*`, `$context.*` references. For each reference, check that the target entity exists.

**Beyond broken references** (which validators catch), look for:
- Actions with `create $entity.X.*` effects — if entity:X doesn't exist, it must be created
- Screens displaying data from entities that have no definition
- Events with `to` targets that don't resolve

Severity: CRITICAL

---

#### 4.2. IMPLIED BUT MISSING FIELDS

Cross-reference entity `data`/`props` with how entities are used:

**A. Screen → Entity gaps:**
- Screen components with `value: data.X.field` — verify `field` exists on entity X's `data` or `props`
- If a screen renders a field that the entity doesn't declare, flag it

**B. Action → Entity gaps:**
- Action effects that set entity fields (`entity.X.field = ...`) — verify `field` exists on entity X
- `create $entity.X` effects — compare fields set in the create with fields defined on entity X. Flag large gaps (create sets < 50% of entity fields, or sets fields not defined)

**C. Context → Entity gaps:**
- Context queries referencing entity fields that don't exist on the target entity

Severity: WARNING

---

#### 4.3. MISSING CRUD OPERATIONS

For each `entity:*:*`, determine if it's user-managed (has input screens or create actions by users, not system):

**For user-managed entities, check:**
- **Missing create** — no `action:*` with `create $entity.X` and no creation form (screen/dialog)
- **Missing edit** — entity has mutable fields (descriptions, statuses, content) but no update action
- **Missing delete** — entity represents user-generated content but no delete/archive action. Soft-delete (status = deleted/archived) counts.
- **Missing list screen** — entity is queryable but no screen lists it
- **Missing detail screen** — entity has multiple data fields but no screen displays them

**Skip for:**
- System-managed entities (sessions, logs, notifications — created by events, not users)
- Reference/static entities (categories, types, roles, configs)
- Context and layout entities

Severity: WARNING

---

#### 4.4. MISSING SCREENS & NAVIGATION GAPS

**A. Dead-end screens:**
- Screens with no outbound navigation (no button/component with `$action.*` or `$screen.*` target)
- Exception: screens using a layout with global navigation are NOT dead-ends

**B. Unreachable screens:**
- Screens that no other screen, action, or layout references — no way to navigate to them

**C. Missing utility screens** (only when the project has 5+ screens):
- No main/home screen (entry point after auth)
- No error/404 screen
- Entities with events but no notifications list screen

Severity: WARNING

---

#### 4.5. MISSING ERROR & EDGE CASE HANDLING

**A. Actions without error paths:**
- Actions with effects referencing `integration:*` or `external:*` (external calls) but no `if/else` error branch
- Actions performing `create` that can fail (validation, uniqueness) but no error path

**B. Missing confirmation dialogs:**
- Actions whose name/description implies destruction (delete, remove, cancel, archive, reject, ban, block) but no confirmation dialog exists in the flow

**C. Missing validation:**
- Screens with input forms (components with editable fields) that submit to actions with no validation logic in effects (no `if` checking input validity)

Severity: WARNING

---

#### 4.6. MISSING EVENTS & NOTIFICATIONS

Look for state changes that obviously need notifications:

- Actions that change entity status (approve, reject, complete, cancel) with a `to` target audience — but no `event:*` entity exists for this notification
- Actions affecting other users' data (admin moderation, assignment changes) with no event to notify affected users
- Only flag when there's a clear recipient — don't flag internal state changes

Severity: WARNING

---

#### 4.7. ORPHAN ENTITIES

Entities with zero incoming references (nothing displays, triggers, or uses them).

Exceptions:
- Entry-point screens (referenced by layout navigation or marked as home/main)
- Entities referenced through data fields of other entities (relational references)
- Context entities (consumed implicitly)

Severity: WARNING

---

### 5. Report Findings

Output directly in chat. No file is generated.

**Format:**

```
YAML Refinement — {project name}
{N} findings: {N} critical, {N} warning

Structural validation: {pass / N errors}
{If errors, list them briefly}

--- CRITICAL ---

{entity_id} — {what's missing}
  {1-2 lines of explanation}
  Fix: {concrete suggestion}

--- WARNING ---

{entity_id} — {what's missing}
  {1-2 lines of explanation}
  Fix: {concrete suggestion}

{...repeat...}
```

If many findings of the same type (e.g., 10 entities missing descriptions), collapse:
- Show 2-3 examples
- "... and N more: `id1`, `id2`, ..."

**If zero findings:** report "No obvious gaps found. Specification looks complete."

### 6. Fix Findings (Interactive)

After presenting findings, ask the user:
- "Fix critical findings now?" — if yes, apply fixes for CRITICAL items
- WARNING items are left for user to decide

When called from `bmf.create` flow (automated), fix CRITICAL findings automatically without asking, then present remaining WARNINGs in the summary.

## Behavior Rules

- **Completeness checker, not quality audit.** Don't flag vague descriptions, naming style, tag inconsistency. Only flag things that are structurally missing.
- **No false positives.** Every finding must point to a concrete missing element with evidence (entity ID, field name, reference chain). "This entity might need X" is NOT a finding. "Screen:auth:login renders `data.user.avatar` but entity:user:profile has no `avatar` field" IS a finding.
- **No INFO-level noise.** Only CRITICAL (broken/impossible) and WARNING (clearly missing logic). If it's debatable, don't flag it.
- **Use the project language.** If `main.yaml` is in Russian, write findings in Russian.
- **Collapse repetitive findings.** 2-3 examples + "and N more".
- **Never auto-fix without signal.** When run standalone, ask before fixing. When run from bmf.create, fix CRITICALs automatically.
