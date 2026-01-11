---
description: Deep semantic analysis of a BMF specification — find ambiguities, gaps, conflicts, and quality issues beyond schema validation.
---

## User Input

```text
$ARGUMENTS
```

## Overview

Perform a deep semantic analysis of a BMF specification and generate a structured refinement report (`_refinement.md`). This goes beyond schema/reference validation — it examines semantic completeness, logical consistency, data flow integrity, and specification quality.

The command adapts its checks based on what exists in the project: core YAML only, with epics, or full (with test cases and custom entities).

## Execution

### 1. Parse Arguments

Extract from `$ARGUMENTS`:
- `folder` — path to BMF project folder (e.g., `bmfs/works/bchp3`)
- `lang` — language for the report (default: auto-detect from `main.yaml`)

If folder is empty, list available projects in `bmfs/` and ask user to specify.

### 2. Inventory Project State

Read the folder and classify files:

- `core_files` — `*.yaml` excluding `_*.yaml` and `main.yaml` (entity, screen, action, dialog, event, context, layout, component)
- `custom_files` — core YAML files with non-standard entity types (`req`, `rule`, `algorithm`, `integration`, `role`, etc.)
- `has_epics` — `_epics.yaml` exists
- `has_tcs` — `_test-cases.yaml` exists
- `has_comments` — `_comments.yaml` exists

Determine analysis depth:
- **core** — only core YAML files exist
- **core+epics** — epics generated, no test cases yet
- **full** — epics + test cases + possibly custom entities

Report to user:

```
Project: {folder}
Core YAML: {N} files ({list})
Custom YAML: {N} files ({list})
Epics: yes/no
Test cases: yes/no
Analysis depth: core | core+epics | full
```

### 3. Run Structural Validation

Run existing utilities to establish baseline. Capture outputs but do NOT stop on failure — include structural errors in the report.

```bash
npx ts-node utils/validate-schema.ts {folder}
npx ts-node utils/check-references.ts {folder}
```

If `has_epics && has_tcs`:
```bash
npx ts-node utils/validate-tcs-epics.ts {folder}
npx ts-node utils/check-tcs.ts {folder}
```

### 4. Load All Project Data

Read and parse ALL files in `{folder}/`:

**A.** `main.yaml` — project metadata, roles, custom entity type descriptions, entry point
**B.** All core YAML files — entity, screen, action, dialog, event, context, layout, component
**C.** All custom YAML files — rule, req, algorithm, integration, role, etc.
**D.** `_epics.yaml` — if exists
**E.** `_test-cases.yaml` — if exists

Build a complete entity registry:
```
entity_id -> {
  type, epic_domain, name,
  file, description, tags, props, data, effects, components, layout, to,
  references_out: [entity IDs this entity references via $entity.*, $screen.*, $action.*, etc.],
  references_in: [entity IDs that reference this entity]
}
```

Build a domain map:
```
epic_domain -> {
  entities, screens, actions, dialogs, events, components, layouts,
  custom: {type: [ids]},
  test_cases: [tc IDs] (if has_tcs),
  epic_id: epic:domain or null (if has_epics)
}
```

### 5. Semantic Analysis — Run All Check Categories

For each category below, collect findings. Each finding has:
- **severity**: CRITICAL / WARNING / INFO
- **entity_id**: the primary entity involved
- **category**: which check category found it
- **title**: one-line summary
- **detail**: explanation of the issue with concrete evidence
- **suggestion**: specific fix recommendation (entity IDs, field names, yq commands where applicable)

---

#### 5.1. DATA MODEL INTEGRITY

Check entities (`entity:*:*`) for:

**A. Field reference consistency** (CRITICAL)
- Entity data fields referencing other entities (`$entity.*`) — verify the target entity exists and has the referenced field structure.
- Example: `entity:reg:user` has `team_id: $entity.reg.team` — verify `entity:reg:team` exists.

**B. Implied field gaps** (WARNING)
- Screens displaying data that does not exist in entity `data` fields. Trace component `value` bindings back to entities — if a screen renders `data.user.avatar_url` but `entity:reg:user` has no `avatar_url` field, flag it.
- Actions creating/updating entity fields not in entity definition. Parse effects for assignments and `create` statements — if an action sets `entity:reg:user.verified = true` but `verified` is not in entity data, flag it.

**C. Orphan entities** (INFO)
- Entities defined but never referenced by any screen, action, dialog, event, or context query. Use the `references_in` map — entities with zero incoming references are orphans.
- Exception: entities referenced through `data` fields of other entities are legitimate (relational references).

**D. Missing inverse relationships** (WARNING)
- If entity A references entity B (e.g., `team_id: $entity.reg.team`), but B has no field linking back to A and the relationship semantically expects it (one-to-many) — flag as potential gap.

---

#### 5.2. ACTIONS & EFFECTS

Check actions (`action:*:*`) for:

**A. Missing error paths** (WARNING)
- Actions with effects that can fail (`create $entity.*`, external integration calls, validation) but no `if/else` error branch after the operation.
- Special attention to actions referencing `integration:*` entities — external calls should always have error handling.

**B. Dead-end screens** (WARNING)
- Screens with no outbound actions — no button/component with `value: $action.*` or `value: $screen.*`.
- Exception: screens using a `layout` that provides global navigation (check if layout has nav items). These are NOT dead-ends.

**C. Side-effect completeness** (WARNING)
- Actions that `create $entity.*` but do not set fields that appear required based on entity definition. Cross-reference the entity's data fields — flag large gaps between what the entity defines and what the create sets.

**D. Circular navigation** (INFO — best effort)
- Detect obvious cycles in the screen → action → screen navigation graph that have no exit. Build a directed graph from effect `$screen.*` references and flag loops where every node's only outbound edges lead back into the cycle.

---

#### 5.3. CONTEXT & DATA FLOW

Check context (`context:*:*`) and data bindings:

**A. Unused context fields** (INFO)
- Context fields that are never referenced by any screen, action, or component (`$context.*` references). Context fields not in that set are unused.

**B. Context queries with broken references** (CRITICAL)
- Context fields using `query` expressions that reference entities or fields that do not exist. Verify each `$entity.*` target in query expressions exists and the `where` clause references valid fields.

**C. Screen data bindings to undefined sources** (WARNING)
- Screens with `data` fields that reference `$context.*` fields not present in context definitions, or `$entity.*` paths that do not resolve.

---

#### 5.4. EPIC & TC COVERAGE

**Skip entirely if `has_epics` is false.**

**A. Orphan entity domains** (WARNING)
- Entities whose epic domain (the middle segment of their ID) has no corresponding `epic:*` defined. Example: `screen:billing:payment` exists but no `epic:billing`.

**B. Unbalanced epics** (INFO)
- Epics with very few entities (< 3 total screens + actions + dialogs + events) — may be too granular or incomplete.
- Epics with very many entities (> 20) — may need decomposition into subfeatures.

**If `has_tcs` is also true:**

**C. TC coverage gaps** (WARNING)
- Screens, actions, dialogs, events without any `tc:*` tag — they are not covered by any test case scenario.
- Epics without any test cases (`epic:domain` exists but no `tc:domain:*`).

**D. TC tag integrity** (WARNING)
- Test cases referenced in tags but no entity has `:start` tag for that TC (scenario has no entry point).
- Test cases with `:start` but no `:end` (scenario has no defined conclusion).
- Test case tags on entities from a different epic domain than the TC domain — verify this is intentional cross-epic flow.

---

#### 5.5. AMBIGUITIES & UNDERSPECIFICATION

**A. Missing or vague descriptions** (WARNING)
- Entities with no `description` field at all or with empty description.
- Descriptions shorter than 20 characters — too terse to be useful.
- Descriptions using only generic phrases without specifics: "shows data", "processes request", "manages items" — flag when the description does not clarify WHAT data/request/items.

**B. Undefined behavior triggers** (WARNING)
- Screens with conditional rendering (`if:` in components) where the condition references a field/state, but the spec does not document what action or event sets that field.
- Actions with `if/then/else` effects where the condition checks a state that is never explicitly set by another action.

**C. Derived-looking fields** (INFO)
- Entity fields that appear to be derived from other fields (e.g., `is_minor` on a user entity — should it be computed from `birth_date` or is it manually set?). Flag when a boolean or computed-looking field has no corresponding action/algorithm that sets it.

**D. Undocumented defaults** (INFO)
- Entity data fields with no default value and no indication of whether they are required or optional. If props are untyped or data fields lack context about mandatory vs optional, flag it.

---

#### 5.6. CONFLICTS & INCONSISTENCIES

**A. Contradictory effects** (CRITICAL)
- Two different actions that can be reached in the same flow (same TC path) and set the same entity field to conflicting values without conditional branching.

**B. Duplicate functionality** (WARNING)
- Two actions with very similar descriptions and overlapping effects chains that may be unintentional duplicates.
- Two screens with very similar component layouts targeting the same entity data.

**C. Domain mismatches across flows** (INFO)
- Same logical flow using entities from mismatched domains. Example: `screen:auth:login` leads to `action:reg:login` — the `auth` vs `reg` domain split may be intentional or a naming inconsistency.

**D. Tag inconsistencies** (INFO)
- Entities with `stage:*` tags where values are inconsistent within the same epic or flow (some `stage:mvp`, others `stage:v2` in entities that should ship together).

---

#### 5.7. CUSTOM ENTITY CROSS-REFERENCES

**Skip if no custom files exist.**

**A. Rules without enforcement** (WARNING)
- `rule:*` entities that describe constraints but no `action:*` or `screen:*` references the rule in description, data, or effects. The rule exists but nothing enforces it.

**B. Algorithms without consumers** (WARNING)
- `algorithm:*` entities that describe computation logic but no action implements or references the algorithm.

**C. Integrations without actions** (WARNING)
- `integration:*` entities describing external systems but no action calls or references the integration in its effects.

**D. Requirements without implementation trace** (INFO)
- `req:*` entities specifying non-functional requirements where the functional spec does not visibly address them (e.g., `req:perf:page-load` says "< 2s" but no loading state, caching, or performance consideration appears in screens/actions).

---

#### 5.8. CRUD COMPLETENESS

Check that user-facing entities have appropriate create/edit/delete actions. Not all entities need CRUD — apply heuristics to determine what's expected.

**A. Classify each `entity:*:*` into a CRUD expectation tier:**

| Tier | Needs | Examples | How to detect |
|------|-------|---------|---------------|
| **user-managed** | create + edit + delete | posts, comments, orders, projects, tasks | Entity has multiple data fields that a user fills in; screens exist for viewing/listing this entity |
| **user-created** | create + edit (no delete or soft-delete) | user profiles, registrations, applications | Entity represents the user themselves or a one-time submission; deletion would be account-level |
| **system-managed** | none (or admin-only) | sessions, logs, analytics events, notifications | Entity is created by system actions/events, not by user input; no input screen exists |
| **reference/static** | none | categories, types, roles, statuses, config | Entity has no user-facing write flow; data is predefined or seeded; appears only as lookup/filter |
| **computed** | none | scores, rankings, aggregations, statistics | Entity is derived from other data via algorithms or context queries |

**Detection heuristics (check in order):**
1. If entity has NO incoming references from any `screen:*` component with input fields → likely system-managed or reference
2. If entity is referenced only in `context:*` queries or as filter options → reference/static
3. If entity is only created in `event:*` effects (not `action:*`) → system-managed
4. If entity has a corresponding create/input `screen:*` or `dialog:*` → user-managed or user-created
5. If entity name suggests reference data (`category`, `type`, `status`, `config`, `role`, `setting`) → reference/static
6. If entity name suggests system data (`session`, `log`, `event`, `notification`, `token`) → system-managed

**B. For user-managed entities, check CRUD coverage** (WARNING):
- **Missing create**: No `action:*` with `create $entity.X.*` effect and no `dialog:*` / `screen:*` with a creation form for this entity
- **Missing edit**: Entity has mutable fields (descriptions, statuses, content) but no `action:*` with `update`/`set` effects on those fields
- **Missing delete**: Entity represents user-generated content (posts, comments, items) but no delete/archive action exists. Exception: if a soft-delete pattern is used (status field with "deleted"/"archived" value), that counts.

**C. For user-created entities, check create + edit** (WARNING):
- Same as above but skip delete check — deletion is not expected.

**D. Misclassified CRUD actions** (INFO):
- Delete actions exist for reference/static entities (suspicious — why would you delete a category?)
- Create actions exist for computed entities (suspicious — computed data shouldn't be manually created)
- No actions at all for user-managed entities (all CRUD missing — entity is likely orphaned or mistyped)

**IMPORTANT:** Do not flag missing CRUD for entities that are clearly internal plumbing (`context:*`, `layout:*`, `components:*`). Only check `entity:*:*` type entities.

---

### 6. Compile Report

#### 6.1. Calculate Summary Statistics

Count findings by severity and category. Build summary table.

#### 6.2. Suppress Duplicate Patterns

If the same check produces many identical findings (e.g., 15 entities all missing descriptions), collapse them:
- Show 2-3 representative examples with full detail
- Add: "... and N more entities with the same issue: `entity:a`, `entity:b`, ..."

This keeps the report readable without hiding total counts.

#### 6.3. Write `{folder}/_refinement.md`

**Report structure:**

```markdown
# BMF Refinement Report — {project name}

> Generated by `bmf.refine` on {date}
> Analysis depth: {core | core+epics | full}

## Summary

| Category | Critical | Warning | Info | Total |
|----------|----------|---------|------|-------|
| Data Model Integrity | N | N | N | N |
| Actions & Effects | N | N | N | N |
| Context & Data Flow | N | N | N | N |
| Epic & TC Coverage | N | N | N | N |
| Ambiguities | N | N | N | N |
| Conflicts | N | N | N | N |
| Custom Entity Refs | N | N | N | N |
| CRUD Completeness | N | N | N | N |
| **Total** | **N** | **N** | **N** | **N** |

{If any category was skipped, note: "Skipped: Epic & TC Coverage (_epics.yaml not found)"}

## Structural Validation

{Output from validate-schema.ts, check-references.ts — verbatim if errors found, "All checks passed" if clean.}
{Output from validate-tcs-epics.ts, check-tcs.ts — if applicable.}

## Findings by Epic

### epic:{domain} — {epic title or "no epic defined"}

{N findings: N critical, N warning, N info}

---

**CRITICAL** `{entity_id}` — {one-line title}

{Detail paragraph explaining the issue with concrete evidence — entity IDs, field names, file references.}

**Suggestion:** {Specific fix — what to add/change and where. Include yq command if applicable.}

---

**WARNING** `{entity_id}` — {one-line title}

{Detail.}

**Suggestion:** {Fix.}

---

{...repeat for all findings in this epic, ordered by severity (CRITICAL first)...}

### Cross-cutting

{Findings that apply project-wide: naming conventions, context issues, structural patterns.}

## Recommended Priority

1. Fix all **CRITICAL** findings first — broken references, logic contradictions, impossible data flows.
2. Address **WARNING** findings by epic — work through one epic at a time.
3. Review **INFO** findings during polish — improvement opportunities, not blockers.

## Re-validation

After addressing findings, re-run:
\`\`\`bash
npx ts-node utils/validate-schema.ts {folder}
npx ts-node utils/check-references.ts {folder}
/bmf.refine {folder}
\`\`\`
```

### 7. Report to User

After generating the report, show a concise summary in the chat:

```
Refinement report generated: {folder}/_refinement.md

Summary:
  Critical: N findings (must fix)
  Warning:  N findings (should fix)
  Info:     N findings (nice to fix)

Top critical/warning issues:
  1. {category}: {title} — {entity_id}
  2. {category}: {title} — {entity_id}
  3. {category}: {title} — {entity_id}
  ...up to 5

Skipped checks: {list or "none"}
Structural validation: {pass/fail}
```

### 8. Cleanup

After reporting to user, delete the generated report file:

```bash
rm {folder}/_refinement.md
```

The report content has already been presented in the chat. The file is temporary and should not persist in the project.

## Behavior Rules

- **Report only — never auto-fix.** This command generates `_refinement.md`. It does not modify any YAML files. Suggestions include concrete fixes (with yq commands where applicable) the user can apply manually.
- Never overwrite existing `_refinement.md` without confirmation.
- **No false positives.** Only flag issues with concrete evidence pointing to specific entity IDs. "This entity references `$entity.reg.team` but `entity:reg:team` does not exist" IS a finding. "This entity could theoretically have an issue" is NOT a finding.
- **Severity must be justified.** CRITICAL = broken references, logical contradictions, impossible data flows. WARNING = missing error handling, uncovered entities, vague specs. INFO = naming suggestions, optimization opportunities, minor inconsistencies.
- **Group findings by epic.** The user works on one epic at a time. Findings grouped by epic keep work focused. Cross-cutting findings go in a separate section at the end.
- **Adapt to project state.** If `_epics.yaml` does not exist, skip all epic-related checks (5.4). If `_test-cases.yaml` does not exist, skip TC coverage checks. If no custom files exist, skip 5.7. Report which checks were skipped and why.
- **Use the project language.** If `main.yaml` is in Russian, write findings in Russian. If in English, use English.
- **Collapse repetitive findings.** If 10+ entities all have the same issue (e.g., missing descriptions), show 2-3 examples with full detail and list the rest as "... and N more: `id1`, `id2`, ...". Never suppress the count — always show how many total.
- **Structural validation is not duplicated.** Run `validate-schema.ts` and `check-references.ts` as-is. Do not re-implement their logic. Layer semantic analysis on top of their output.
- **Context queries are BML, not SQL.** When validating context queries, parse them as BML expressions (`query $entity.x where field == value`). Verify entity and field existence only — do not attempt to evaluate the query logic.
