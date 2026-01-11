---
description: Deep quality analysis of a generated PRD — find gaps, leaked internals, inconsistencies, and coverage issues against source BMF spec.
---

## User Input

```text
$ARGUMENTS
```

## Overview

Perform a deep quality analysis of a generated `prd.md` and produce a structured refinement report (`_prd-refinement.md`). Cross-references the PRD against its BMF source material (YAML specs, epics, test cases) to find completeness gaps, leaked technical internals, structural issues, and content quality problems.

This command does NOT modify the PRD. It generates a report with concrete findings and fix suggestions.

## Execution

### 1. Parse Arguments

Extract from `$ARGUMENTS`:
- `folder` — path to BMF project folder (e.g., `bmfs/bchp`)
- `lang` — language for the report (default: auto-detect from `main.yaml`)

If folder is empty, list available projects in `bmfs/` and ask user to specify.

### 2. Verify Prerequisites

Check that all required files exist:
- `{folder}/prd.md` — the PRD to analyze
- `{folder}/_epics.yaml`
- `{folder}/_test-cases.yaml`
- `{folder}/main.yaml`

**If `prd.md` is missing:**
```
ERROR: No PRD found at {folder}/prd.md

Generate one first: /bmf.yaml2prdmd {folder}
```
Stop execution.

**If `_epics.yaml` or `_test-cases.yaml` is missing:**
```
WARNING: Source files missing — some cross-reference checks will be skipped.

Missing:
  - _epics.yaml → coverage checks disabled
  - _test-cases.yaml → user story checks disabled
```
Continue with available files, skip checks that require missing sources.

### 3. Read All Source Data

Read and parse:

**A. `{folder}/prd.md`** — the PRD document under analysis
**B. `{folder}/main.yaml`** — project metadata, roles, entry point
**C. `{folder}/_epics.yaml`** — all epics with descriptions
**D. `{folder}/_test-cases.yaml`** — all test cases with steps
**E. All YAML files** — every `*.yaml` in the folder (excluding `_*.yaml` and `main.yaml`) — entities, screens, actions, dialogs, events, contexts, layouts, components, and any custom types

Build source inventories:
- `epics[]` — all epic IDs with titles/descriptions
- `test_cases[]` — all TC IDs with titles/steps/verify blocks
- `entities[]` — all entity IDs grouped by type and domain
- `roles[]` — roles from main.yaml
- `events[]` — all event entities (for notifications section)
- `custom_types{}` — non-standard entity types found (req, rule, algorithm, integration, etc.)

### 4. Parse PRD Structure

Parse the PRD markdown to extract:
- `prd_sections[]` — top-level sections with numbering
- `prd_features[]` — Feature sections (### 3.N.) with titles and content
- `prd_subfeatures[]` — Subfeature sections (#### 3.N.M.) with titles
- `prd_user_stories[]` — US-N blocks with titles, steps, acceptance criteria
- `prd_roles[]` — roles listed in the Roles table
- `prd_objects[]` — objects in Key Objects section
- `prd_notifications[]` — entries in Notifications section
- `prd_cross_refs[]` — internal cross-references ("см. 3.N", "see 3.N")

### 5. Quality Analysis — Run All Check Categories

For each category, collect findings. Each finding has:
- **severity**: CRITICAL / WARNING / INFO
- **location**: section or US reference in the PRD (e.g., "Section 3.2", "US-5")
- **category**: which check category found it
- **title**: one-line summary
- **detail**: explanation with concrete evidence
- **suggestion**: specific fix recommendation

---

#### 5.1. LEAKED INTERNALS

Scan the entire PRD text for technical artifacts that should NOT appear in a product document.

**A. BMF entity IDs** (CRITICAL)
- Any occurrence of patterns: `entity:*:*`, `screen:*:*`, `action:*:*`, `event:*:*`, `dialog:*:*`, `context:*:*`, `layout:*`, `tc:*:*`, `epic:*`, `component:*`
- These must be replaced with human-readable names.

**B. BML expressions** (CRITICAL)
- Any `$entity.*`, `$screen.*`, `$action.*`, `$context.*`, `$event.*` references.
- Any `query $entity.*` expressions.

**C. YAML syntax artifacts** (CRITICAL)
- YAML anchors (`*reference`, `&anchor`), `$schema` references, raw field type annotations (`string`, `uuid`, `datetime`, `boolean` used as type declarations).

**D. Technical field names** (WARNING)
- Raw snake_case field names that look like database columns rather than product descriptions (e.g., `created_at`, `user_id`, `is_active`). Exceptions: well-known terms that are also used in product language.

---

#### 5.2. EPIC/FEATURE COVERAGE

Cross-reference PRD features against source epics.

**A. Missing epics** (CRITICAL)
- Epics defined in `_epics.yaml` that have no corresponding feature section in the PRD. Every epic must appear as a feature.

**B. Extra features** (WARNING)
- Feature sections in the PRD that do not correspond to any epic in `_epics.yaml`. May indicate invented content or a naming mismatch.

**C. Incomplete epic descriptions** (WARNING)
- Compare epic description content (Includes, Limitations) against the feature section text. If the epic describes capabilities or limitations that are not reflected in the PRD feature section, flag as gap.

**D. Missing "Limitations" / cross-references** (INFO)
- Epics with "Ограничения:" / "Limitations:" that should generate cross-references (e.g., "см. 3.N") in the PRD but don't.

---

#### 5.3. TEST CASE / USER STORY COVERAGE

Cross-reference PRD user stories against source test cases.

**A. Missing test cases** (CRITICAL)
- Test cases in `_test-cases.yaml` that have no corresponding US-N in the PRD. Every test case should map to a user story.

**B. Extra user stories** (WARNING)
- US-N entries in the PRD that do not correspond to any test case. May indicate invented content.

**C. Step fidelity** (WARNING)
- User stories where the numbered steps significantly diverge from the source TC steps — missing steps, reordered steps, or added steps that aren't in the source.
- Focus on material differences, not minor rewording.

**D. Missing acceptance criteria** (WARNING)
- User stories without an "Acceptance Criteria:" / "Ожидаемый результат:" block, or where the source TC has "Verify:" / "Проверить:" content that was not converted.

---

#### 5.4. ROLE CONSISTENCY

**A. Missing roles** (WARNING)
- Roles defined in `main.yaml` that do not appear in the PRD Roles table.

**B. Extra roles** (INFO)
- Roles in the PRD that are not defined in `main.yaml`.

**C. Role references in features** (INFO)
- Feature sections that mention roles not listed in the Roles table.
- User stories that reference a role not in the Roles table.

---

#### 5.5. DATA COVERAGE

**A. Missing key entities** (WARNING)
- Core entities (`entity:*:*`) that represent important domain objects but are not mentioned in the Key Objects section. Focus on entities that appear in multiple screens/actions — if an entity is central to the system, it should be documented.

**B. Object description quality** (INFO)
- Objects in the Key Objects table with very short or generic "Purpose" descriptions.
- Objects listed without key attributes.

---

#### 5.6. NOTIFICATIONS & EVENTS

**A. Missing events** (WARNING)
- Event entities (`event:*:*`) that represent user-visible notifications but have no corresponding entry in the Notifications section.

**B. Notification completeness** (INFO)
- Notification entries missing "Who is notified" or "What happens" columns.

---

#### 5.7. STRUCTURAL QUALITY

**A. Broken numbering** (WARNING)
- Feature numbering gaps (3.1, 3.2, 3.4 — missing 3.3).
- User story numbering gaps or duplicates (US-1, US-2, US-5 — gap).
- Section numbering inconsistencies.

**B. Broken cross-references** (CRITICAL)
- Internal references ("см. 3.N", "see 3.N") that point to non-existent sections.

**C. Empty sections** (WARNING)
- Sections with headers but no content, or placeholder text still present.

**D. Missing standard sections** (INFO)
- Expected PRD sections that are absent: Overview, Roles, Features, Key Objects, Navigation, Notifications.

---

#### 5.8. CONTENT QUALITY

**A. Placeholder text** (WARNING)
- Remnants of template text: `[Описание]`, `[Название]`, `[Требования]`, `TODO`, `TBD`, `FIXME`, `...`, `[placeholder]`.

**B. Inconsistent language** (INFO)
- PRD written in mixed languages (some sections Russian, some English) when it should be uniform.

**C. Vague descriptions** (INFO)
- Feature descriptions shorter than 30 characters.
- Feature descriptions that are just the epic title repeated without elaboration.

**D. Custom domain sections** (WARNING)
- Project contains custom entity types (req, rule, algorithm, integration, etc.) but the PRD has no corresponding additional sections (7+). These domain concepts should be surfaced in the PRD.

---

### 6. Compile Report

#### 6.1. Calculate Summary Statistics

Count findings by severity and category. Build summary table.

#### 6.2. Suppress Duplicate Patterns

If the same check produces many identical findings (e.g., 10 user stories all missing acceptance criteria), collapse:
- Show 2-3 representative examples with full detail
- Add: "... and N more with the same issue: US-3, US-7, ..."

#### 6.3. Write `{folder}/_prd-refinement.md`

**Report structure:**

```markdown
# PRD Refinement Report — {project name}

> Generated by `bmf.refine-prd` on {date}

## Summary

| Category | Critical | Warning | Info | Total |
|----------|----------|---------|------|-------|
| Leaked Internals | N | N | N | N |
| Epic/Feature Coverage | N | N | N | N |
| TC/User Story Coverage | N | N | N | N |
| Role Consistency | N | N | N | N |
| Data Coverage | N | N | N | N |
| Notifications & Events | N | N | N | N |
| Structural Quality | N | N | N | N |
| Content Quality | N | N | N | N |
| **Total** | **N** | **N** | **N** | **N** |

{If any category was skipped, note: "Skipped: TC/User Story Coverage (_test-cases.yaml not found)"}

## Findings by Section

### Section 3.N — {Feature title}

{N findings: N critical, N warning, N info}

---

**CRITICAL** Section 3.N / US-M — {one-line title}

{Detail paragraph with concrete evidence — what was found, where in the PRD, what it should be.}

**Suggestion:** {Specific fix — what to change and where.}

---

{...repeat for all findings in this section, ordered by severity...}

### Cross-cutting

{Findings that apply to the entire PRD: leaked internals, structural issues, language consistency.}

## Coverage Summary

| Source | Total | Covered in PRD | Missing |
|--------|-------|----------------|---------|
| Epics | N | N | N |
| Test Cases | N | N | N |
| Roles | N | N | N |
| Key Entities | N | N | N |
| Events | N | N | N |

{List missing items by name if any.}

## Recommended Priority

1. Fix all **CRITICAL** findings first — leaked internals break the PRD's purpose as a product document.
2. Address **CRITICAL** coverage gaps — missing epics/TCs mean the PRD is incomplete.
3. Fix **WARNING** findings by section — work through one feature at a time.
4. Review **INFO** findings during polish.

## Re-validation

After addressing findings, re-run:
\`\`\`bash
/bmf.refine-prd {folder}
\`\`\`
```

### 7. Report to User

After generating the report, show a concise summary in the chat:

```
PRD refinement report generated: {folder}/_prd-refinement.md

Summary:
  Critical: N findings (must fix)
  Warning:  N findings (should fix)
  Info:     N findings (nice to fix)

Coverage:
  Epics:      N/N covered
  Test Cases: N/N covered
  Roles:      N/N covered

Top critical/warning issues:
  1. {category}: {title} — {location}
  2. {category}: {title} — {location}
  3. {category}: {title} — {location}
  ...up to 5

Skipped checks: {list or "none"}
```

### 8. Cleanup

After reporting to user, delete the generated report file:

```bash
rm {folder}/_prd-refinement.md
```

The report content has already been presented in the chat. The file is temporary and should not persist in the project.

## Behavior Rules

- **Report only — never auto-fix.** This command generates `_prd-refinement.md`. It does not modify `prd.md` or any YAML files. Suggestions describe concrete fixes the user can apply manually or by re-running `/bmf.yaml2prdmd`.
- Never overwrite existing `_prd-refinement.md` without confirmation.
- **No false positives.** Only flag issues with concrete evidence. "Section 3.2 references 'см. 3.9' but section 3.9 does not exist" IS a finding. "This section might be incomplete" is NOT a finding.
- **Severity must be justified.** CRITICAL = leaked BMF internals, missing epics/TCs, broken cross-references. WARNING = quality gaps, missing sections, incomplete coverage. INFO = style suggestions, minor improvements.
- **Leaked internals are always CRITICAL.** The PRD's primary purpose is to be a product document. Any BMF entity IDs, BML expressions, or YAML artifacts break this contract.
- **Group findings by PRD section.** The user fixes the PRD section by section. Cross-cutting findings (language, structure) go in a separate section.
- **Use the project language.** Match the language of `main.yaml` for the report.
- **Collapse repetitive findings.** If 10+ user stories have the same issue, show 2-3 examples and list the rest as "... and N more: US-3, US-7, ...". Always show total count.
- **Coverage is a first-class metric.** The Coverage Summary table is mandatory — it shows at a glance whether the PRD fully represents the source spec.
- **Don't duplicate content checks that belong to `bmf.refine`.** This command checks the PRD as a document. It does NOT re-analyze the BMF YAML spec for semantic issues — that's what `/bmf.refine` is for.
