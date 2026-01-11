---
description: Generate estimation CSV from a PRD document — uses PRD's editorial Epic→Feature→US structure with deep YAML-backed analysis.
---

## User Input

```text
$ARGUMENTS
```

## Overview

Generate an estimation spreadsheet (CSV) from an existing PRD (`prd.md`). Unlike `bmf.estimation` which reads raw `_epics.yaml` + `_test-cases.yaml` and clusters TCs into features on the fly, this command **preserves the PRD's editorial structure** — feature grouping, naming, ordering, and user story formulation are taken as-is from the PRD.

YAML entity files are used for **deep implementation analysis** (tracing screens, actions, effects, integrations), not for structure.

**When to use which:**
- `/bmf.estimation` — no PRD exists yet, generate estimation directly from YAML specs
- `/bmf.prd2estimation` — PRD already exists and defines the feature structure you want to estimate against

## Execution

### 1. Parse Arguments

Extract from `$ARGUMENTS`:
- `folder` — path to BMF project folder (e.g., `bmfs/works/moments`)
- `lang` — language for descriptions (default: auto-detect from PRD language)
- `output` — output CSV path (default: `{folder}/estimation.csv`)

If folder is empty, list available projects in `bmfs/` and ask user to specify.

### 2. Verify Prerequisites

**Required:**
- `{folder}/prd.md` — the PRD document (source of structure)

**Optional but recommended:**
- `{folder}/_epics.yaml` — for phase (`stage:*`) tags and epic IDs
- `{folder}/_test-cases.yaml` — for mapping User Stories back to TC IDs
- YAML entity files (`*.yaml`) — for deep implementation analysis

**If `prd.md` is missing:**
```
ERROR: prd.md not found in {folder}

Generate it first:
  /bmf.create-prd {folder}    (Epic → Feature → US structure)
  /bmf.yaml2prdmd {folder}    (Epic → US flat structure)
```
Stop execution.

### 3. Read All Project Data

Read and parse:

**A. `{folder}/prd.md`** — PRIMARY source: Epic → Feature → US structure
**B. `{folder}/_epics.yaml`** — if exists: epic IDs, descriptions, `stage:*` tags for phases
**C. `{folder}/_test-cases.yaml`** — if exists: TC IDs and descriptions for back-mapping
**D. `{folder}/main.yaml`** — if exists: project metadata, roles
**E. All YAML files in `{folder}/`** — entity definitions for deep analysis (screens, actions, dialogs, events, entities, integrations, etc.)
**F. Source documents** — any `.docx`, `.pdf`, or `.md` files (besides `prd.md`) that may contain original requirements

### 4. Parse PRD Structure

Extract the hierarchical structure from `prd.md`:

**Step A: Identify Epics.** Find all `### Epic — {Title}` sections (or equivalent heading pattern). Extract:
- Epic title
- Epic description (prose below heading)
- Roles

**Step B: Identify Features within each Epic.** Find all `#### Feature — {Title}` subsections. Extract:
- Feature title
- Feature description
- Role
- Capabilities list (if present)

**Step C: Identify User Stories within each Feature.** Find all `###### US — {Title}` entries. Extract:
- US title
- "Как / хочу / чтобы" statement
- Steps (numbered list)
- Expected result

**Step D: Build the full hierarchy:**
```
Epic 1
  ├── Feature 1.1
  │   ├── US 1.1.1
  │   ├── US 1.1.2
  │   └── US 1.1.3
  └── Feature 1.2
      ├── US 1.2.1
      └── US 1.2.2
Epic 2
  └── ...
```

**Handling PRD format variations:**

The PRD may follow either `bmf.create-prd` format (Epic → Feature → US) or `bmf.yaml2prdmd` format (Feature → US, no intermediate Feature level). Detect the format by checking heading structure:
- If `#### Feature —` exists → `create-prd` format, use 3-level hierarchy
- If only `### N.N. {Title}` with `**User Stories:**` → `yaml2prdmd` format, treat each section as both epic AND feature (single feature per epic)

### 5. Map User Stories to TC IDs

**If `_test-cases.yaml` exists:**

For each User Story extracted from the PRD, attempt to match it to a TC:

1. Compare US title with TC descriptions — find the best semantic match
2. Match by ordered position within the same epic domain
3. If confident match found → use TC ID (e.g., `tc:auth:login-success`)
4. If no confident match → use `us:{epic-domain}:{slugified-us-title}` as synthetic ID

**If `_test-cases.yaml` does not exist:**

Generate synthetic IDs for all User Stories:
- Format: `us:{epic-domain}:{slugified-us-title}`
- Example: `us:auth:registration-new-user`

The `epic-domain` is derived by matching the Epic title back to `_epics.yaml` IDs, or by slugifying the Epic title if no `_epics.yaml`.

### 6. Extract Phase Information

**If `_epics.yaml` exists:**
- For each Epic in the PRD, match it to an epic in `_epics.yaml` by title/description similarity
- Read `stage:*` tag from the matched epic
- All Features and US within that epic inherit its phase

**If `_epics.yaml` does not exist:**
- Scan the PRD for phase indicators (e.g., "План-график работ" section, "Этап 1/2/3" references, "MVP" mentions)
- If found, map epics to phases based on content
- If not found, leave phase empty

### 7. Phase 1 — Build Skeleton CSV

Generate initial CSV with structure only (no implementation descriptions, no estimations):

```csv
phase,epic,feature,test_case,implementation_description,estimation_hours
mvp,epic:auth,,,,
,,Регистрация и авторизация,,,
,,,tc:auth:register-new-user,,
,,,tc:auth:sso-login,,
,,Управление персональными данными,,,
,,,tc:auth:edit-personal-data,,
,,,tc:auth:delete-account,,
```

**CSV rules:**
- Epic row: `phase` filled (from `stage:*` tag or PRD phase analysis, empty if unknown), `epic` filled (matched ID or `epic:{slugified-title}`), all other columns empty
- Feature row: `phase` empty, `epic` empty, `feature` filled with the Feature title **exactly as it appears in the PRD**, other columns empty
- US/TC row: `phase` empty, `epic` empty, `feature` empty, `test_case` filled with matched TC ID or synthetic US ID, other columns empty
- Use comma as delimiter
- Quote fields that contain commas or newlines
- UTF-8 encoding with BOM for Excel compatibility

Write this skeleton to `{output}` and show it to the user.

### 8. Phase 2 — Deep Analysis & Estimation

For **each User Story row**, perform deep analysis:

**A. Read the US from PRD** — understand the user flow from steps and expected result

**B. Read the matched TC** (if `_test-cases.yaml` exists) — get additional detail from TC description and verification steps

**C. Trace entities involved using YAML files:**
- Follow the US steps and identify all screens, actions, dialogs, events, and entities that would be involved
- If `_test-cases.yaml` exists, use `tc:*` tags on entities to find tagged entities
- Follow BML references ($screen.*, $action.*, $dialog.*) to trace the full flow
- If no YAML entities available, analyze based on PRD description alone

**D. Analyze implementation complexity by checking:**

1. **UI complexity** — number of screens, form fields, validation rules, conditional rendering
2. **Business logic** — effects chains, state mutations, computed values, algorithms
3. **Integrations** — external API calls (SSO, payment, maps, AI, email services), third-party services
4. **Data model** — entity relationships, queries, data transformations
5. **Edge cases** — error handling paths, empty states, permission checks, concurrent access
6. **Non-functional** — performance requirements, caching needs, file uploads, real-time updates

**E. Check source documents** (original `.docx`, `.pdf`, `.md`) for:
- Additional requirements not captured in PRD
- Specific numeric constraints (timeouts, limits, sizes)
- Legal/compliance requirements
- Integration specifications

**F. Write implementation description (DETAILED):**

The description must be a **thorough technical breakdown**. Think of it as a mini-spec for a developer.

Include:
- **All screens involved** — list each screen by ID (from YAML) or by description (from PRD), describe layout, key components, form fields
- **All actions traced** — describe effects chain step by step
- **All dialogs** — when they appear, what they show, what buttons do
- **All events** — what triggers them, who receives them
- **Data model** — which entities are read/written, key fields, relationships, validation rules
- **Business rules** — constraints, validation logic
- **Algorithms** — calculation logic, scoring, matching
- **Integrations** — external APIs, data exchange
- **Edge cases** — permission checks, empty states, error paths
- **NFR concerns** — file size limits, performance targets, security requirements

If YAML entities are available, reference entity IDs in the description (e.g., "screen:auth:login has 3 fields with SNILS mask validation").
If no YAML entities, describe in terms from the PRD (e.g., "Login form with SNILS and password fields").

**Length guidance:** A simple US might need 3-5 lines. A complex US can easily need 10-20 lines. Do NOT truncate — write everything relevant.

**G. Estimate hours:**
- Based on the implementation description, estimate effort in hours
- Use this rough scale as guidance:
  - **1-2h** — simple CRUD screen, basic form, straightforward action
  - **2-4h** — screen with validation + error handling, multi-step form, filtered list
  - **4-8h** — complex flow with integrations, file upload + processing, multi-entity state changes
  - **8-16h** — external API integration (OAuth, maps, payment), complex algorithms, real-time features
  - **16-32h** — major subsystem (AI moderation pipeline, rating engine, offline map support)
- Estimates are for a single mid-level developer including basic testing
- Round to nearest 0.5h

### 9. Feature-Level & Epic-Level Estimation

**Feature rows** can optionally have their own `implementation_description` and `estimation_hours` when there is shared setup within the feature (e.g., "shared form components, validation utilities"). Feature estimation = shared overhead within the feature only (not a sum of USes).

If there is no feature-level overhead, leave feature description and estimation empty.

**Epic rows** can optionally have their own `implementation_description` and `estimation_hours` when:
- There is shared infrastructure across features/USes (e.g., "shared authentication middleware, user session management")
- There is integration setup cost not attributable to a single feature or US
- There are cross-cutting concerns (DB migrations, API scaffolding, deployment config)

**Epic estimation = shared overhead only** (not a sum of features/USes). The total for the epic is understood as: epic overhead + sum of feature overheads + sum of US estimates.

If there is no shared overhead, leave epic description and estimation empty.

### 10. Write Final CSV

Update `{output}` with all implementation descriptions and estimations filled in.

**Final format example:**

```csv
phase,epic,feature,test_case,implementation_description,estimation_hours
mvp,epic:auth,,,"Shared infrastructure: session store (Redis/JWT); authentication middleware; password hashing (bcrypt); SSO OAuth 2.0 client setup — redirect URI registration, token exchange, profile data mapping; email verification service; GDPR/152-FZ compliant data handling pipeline; DB migrations for user, user-profile tables",14
,,Регистрация и авторизация,,,
,,,tc:auth:register-new-user,"Форма регистрации (ФИО, email, пароль); клиентская валидация полей; серверная валидация уникальности email; хэширование пароля; фиксация согласий (дата, время, IP, версия соглашения); отправка confirmation email с токеном; обработка подтверждения по ссылке; активация аккаунта; edge case: повторная отправка подтверждения, expired token",6
,,,tc:auth:sso-login,"Кнопка входа через SSO; OAuth 2.0 redirect flow; обработка callback с кодом авторизации; обмен кода на access token; запрос профиля (ФИО, email, регион); автоматическое создание аккаунта при первом входе; синхронизация данных при повторном; edge case: конфликт email с существующим аккаунтом",8
,,Управление персональными данными,,,
,,,tc:auth:edit-personal-data,"Форма редактирования в ЛК; загрузка текущих данных; валидация изменений; аудит-лог каждого изменения (дата/время, IP, тип, предыдущее значение); edge case: concurrent edit, email change requires re-verification",4
,,,tc:auth:delete-account,"Кнопка удаления в настройках; confirmation dialog с предупреждением; soft-delete аккаунта; обработка данных по 152-ФЗ (анонимизация vs удаление); grace period; edge case: пользователь с активными договорами/конкурсами",3
```

### 11. Report Summary

After completion, report:

```
Estimation generated: {output}
Source: {folder}/prd.md

Data sources used:
  - prd.md: structure (Epic → Feature → US)
  - _epics.yaml: {found|not found} (phase tags)
  - _test-cases.yaml: {found|not found} (TC ID mapping)
  - YAML entities: {N} files read (deep analysis)

Summary:
  Epics: {N}
  Features: {N}
  User Stories: {N}

  Total estimated hours: {sum of all estimation_hours}

  Phase breakdown:
    mvp — Nh ({N} epics, {N} features, {N} USes)
    v2 — Nh ({N} epics, {N} features, {N} USes)
    (no phase) — Nh ({N} epics, {N} features, {N} USes)

  Top 5 most expensive user stories:
    1. {tc/us ID} — Nh (reason)
    2. ...

  Epic breakdown:
    epic:auth [mvp] — Nh (overhead) + Nh (features+USes) = Nh total
      - Регистрация и авторизация: Nh ({N} USes)
      - Управление персональными данными: Nh ({N} USes)
    epic:catalog [mvp] — Nh (overhead) + Nh (features+USes) = Nh total
      - Главная страница: Nh ({N} USes)
      - Каталог и категории: Nh ({N} USes)
    ...
```

## CSV Format Specification

- Delimiter: comma (`,`)
- Encoding: UTF-8 with BOM (`\xEF\xBB\xBF`) for Excel compatibility
- Quote character: double-quote (`"`)
- Escape: double double-quote (`""`) inside quoted fields
- Newlines in fields: use `\n` within double-quoted fields
- Header row: `phase,epic,feature,test_case,implementation_description,estimation_hours`

## Behavior Rules

- Never overwrite existing `estimation.csv` without confirmation
- If `prd.md` is missing — stop and tell user which command to run first
- `_epics.yaml` and `_test-cases.yaml` are optional — the command degrades gracefully without them
- Phase 1 skeleton MUST be shown to user before proceeding to Phase 2
- Implementation descriptions must be grounded in actual PRD content and YAML entities (if available) — no hallucinated features
- Estimations must reflect actual complexity found in the spec, not generic guesses
- Feature names in CSV must match PRD feature titles exactly — do NOT rename or re-cluster
- The PRD's editorial structure is authoritative — never reorganize epics, features, or US grouping
- Quote CSV fields properly — implementation descriptions often contain commas
- Use the same language as the PRD for implementation descriptions
- Every US row must have an estimation — no empty estimation_hours for US rows
- Epic and feature estimation_hours can be empty if there's no shared overhead
