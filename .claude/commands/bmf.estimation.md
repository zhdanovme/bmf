---
description: Generate estimation CSV from epics and test cases with implementation analysis.
---

## User Input

```text
$ARGUMENTS
```

## Overview

Generate an estimation spreadsheet (CSV) from BMF project epics and test cases. The estimation includes implementation descriptions derived from deep analysis of project YAMLs, PRDs, and source documents, with hour-based effort estimates per test case and per epic.

## Execution

### 1. Parse Arguments

Extract from `$ARGUMENTS`:
- `folder` — path to BMF project folder (e.g., `bmfs/works/bchp3`)
- `lang` — language for descriptions (default: auto-detect from `main.yaml`)
- `output` — output CSV path (default: `{folder}/estimation.csv`)

If folder is empty, list available projects in `bmfs/` and ask user to specify.

### 2. Verify Prerequisites

Check that both files exist:
- `{folder}/_epics.yaml`
- `{folder}/_test-cases.yaml`

**If either is missing:**
```
ERROR: Required files not found in {folder}

Missing:
  - _epics.yaml → run: /bmf.create-epics {folder}
  - _test-cases.yaml → run: /bmf.create-tcs {folder}
```
Stop execution.

### 3. Read All Project Data

Read and parse:

**A. `{folder}/_epics.yaml`** — all epics with descriptions
**B. `{folder}/_test-cases.yaml`** — all test cases with descriptions
**C. All YAML files in `{folder}/`** — entity definitions, screens, actions, dialogs, events, etc.
**D. `{folder}/main.yaml`** — project metadata, roles, entity type descriptions
**E. `{folder}/prd.md`** — PRD if it exists (additional context)
**F. Source documents** — any `.docx`, `.pdf`, or `.md` files in `{folder}/` or parent that may contain original requirements

### 4. Build Epic → Feature → Test Case Map

**Step A:** For each epic, collect its test cases by domain prefix matching:
- `tc:auth:*` → `epic:auth`
- `tc:reg-family:*` → `epic:reg-family`

**Step B: Cluster TCs into features within each epic.**

For each epic, analyze its test cases and group them into **2–5 features** based on semantic similarity:

1. Read all TC descriptions within the epic
2. Identify cohesive clusters of related TCs — look for shared screens, shared entities, shared user flow patterns, or shared functional area
3. Name each feature with a concise title (e.g., "Управление аккаунтами", "Автопостинг", "Ручная публикация")
4. Assign each TC to exactly one feature
5. Order features logically (basic/setup first, advanced/automation last)

**Clustering guidelines:**
- TCs that share the same screen or entity CRUD naturally belong together
- TCs that form a sequential flow (create → edit → toggle) belong together
- TCs that describe error/edge cases belong with the happy-path TC of the same flow
- If an epic has ≤3 TCs, a single feature covering all of them is acceptable

**Step C: Extract phase from epic tags:** look for `stage:*` tag on each epic. If an epic has `tags: [stage:mvp]`, its phase is `mvp`. If no `stage:*` tag — phase is empty. All TCs inherit the phase of their parent epic.

Sort epics alphabetically by domain. Within each epic, features ordered logically. Within each feature, sort test cases alphabetically.

### 5. Phase 1 — Build Skeleton CSV

Generate initial CSV with structure only (no implementation descriptions, no estimations):

```csv
phase,epic,feature,test_case,implementation_description,estimation_hours
mvp,epic:auth,,,,
,,Вход в систему,,,
,,,tc:auth:login-success,,
,,,tc:auth:login-invalid,,
,,Регистрация,,,
,,,tc:auth:register-adult,,
v2,epic:cart,,,,
,,Корзина,,,
,,,tc:cart:add-product,,
,,,tc:cart:checkout-flow,,
```

**CSV rules:**
- Epic row: `phase` filled (from `stage:*` tag, empty if no tag), `epic` filled, all other columns empty
- Feature row: `phase` empty, `epic` empty, `feature` filled with human-readable title, other columns empty
- TC row: `phase` empty, `epic` empty, `feature` empty, `test_case` filled, other columns empty
- Use comma as delimiter
- Quote fields that contain commas or newlines
- UTF-8 encoding with BOM for Excel compatibility

Write this skeleton to `{output}` and show it to the user.

### 6. Phase 2 — Deep Analysis & Estimation

For **each test case row**, perform deep analysis:

**A. Read the TC description** — understand the user flow steps

**B. Trace entities involved:**
- Follow the TC steps and identify all screens, actions, dialogs, events, and entities referenced
- Use tc:* tags in entity YAML files to find tagged entities
- Follow BML references ($screen.*, $action.*, $dialog.*) to trace the full flow

**C. Analyze implementation complexity by checking:**

1. **UI complexity** — number of screens, form fields, validation rules, conditional rendering
2. **Business logic** — effects chains, state mutations, computed values, algorithms
3. **Integrations** — external API calls (ЕСИА, payment, maps, AI), third-party services
4. **Data model** — entity relationships, queries, data transformations
5. **Edge cases** — error handling paths, empty states, permission checks, concurrent access
6. **Non-functional** — performance requirements, caching needs, file uploads, real-time updates

**D. Check source documents** (PRD, .docx, .md) for:
- Additional requirements not captured in YAML
- Specific numeric constraints (timeouts, limits, sizes)
- Legal/compliance requirements
- Integration specifications

**E. Write implementation description (DETAILED):**

The description must be a **thorough technical breakdown**, not a brief summary. Write as much as needed to fully capture what needs to be built. Think of it as a mini-spec for a developer who will implement this TC.

Include:
- **All screens involved** — list each screen by ID, describe its layout, key components, form fields, buttons, conditional visibility
- **All actions traced** — list each action by ID, describe its effects chain step by step (what happens on click, what entities are created/updated, what redirects happen)
- **All dialogs** — when they appear, what they show, what buttons do
- **All events** — what triggers them, who receives them, what effects fire
- **Data model** — which entities are read/written, key fields, relationships, validation rules
- **Business rules** — reference specific rule:* entities that apply, describe constraints
- **Algorithms** — reference specific algorithm:* entities, describe calculation logic
- **Integrations** — reference specific integration:* entities, describe what external APIs are called and how
- **Edge cases** — permission checks, empty states, error paths, concurrent access, rate limiting
- **NFR concerns** — file size limits, performance targets, security requirements from req:* entities

Format: free-form text, can be multi-line. Use semicolons or line breaks to separate points. Reference entity IDs where possible (e.g., "screen:reg:individual-form has 15+ fields with age-dependent branching").

**Length guidance:** A simple TC might need 3-5 lines. A complex TC can easily need 10-20 lines. Do NOT truncate — write everything relevant.

**F. Estimate hours:**
- Based on the implementation description, estimate effort in hours
- Use this rough scale as guidance:
  - **1-2h** — simple CRUD screen, basic form, straightforward action
  - **2-4h** — screen with validation + error handling, multi-step form, filtered list
  - **4-8h** — complex flow with integrations, file upload + processing, multi-entity state changes
  - **8-16h** — external API integration (OAuth, maps, payment), complex algorithms, real-time features
  - **16-32h** — major subsystem (AI moderation pipeline, rating engine, offline map support)
- Estimates are for a single mid-level developer including basic testing
- Round to nearest 0.5h

### 7. Feature-Level & Epic-Level Estimation

**Feature rows** can optionally have their own `implementation_description` and `estimation_hours` when there is shared setup within the feature (e.g., "shared form components, validation utilities"). Feature estimation = shared overhead within the feature only (not a sum of TCs).

If there is no feature-level overhead, leave feature description and estimation empty.

**Epic rows** can optionally have their own `implementation_description` and `estimation_hours` when:
- There is shared infrastructure across features/TCs (e.g., "shared authentication middleware, user session management")
- There is integration setup cost not attributable to a single feature or TC
- There are cross-cutting concerns (DB migrations, API scaffolding, deployment config)

**Epic estimation = shared overhead only** (not a sum of features/TCs). The total for the epic is understood as: epic overhead + sum of feature overheads + sum of TC estimates.

If there is no shared overhead, leave epic description and estimation empty.

### 8. Write Final CSV

Update `{output}` with all implementation descriptions and estimations filled in.

**Final format example:**

```csv
phase,epic,feature,test_case,implementation_description,estimation_hours
mvp,epic:auth,,,"Shared infrastructure: session store (Redis/JWT); authentication middleware checking session on every protected route; password hashing (bcrypt); СНИЛС validation utility (checksum algorithm); rate-limiting middleware for login attempts; ЕСИА OAuth 2.0 client setup (integration:auth:esia) — redirect URI registration, token exchange endpoint, profile data mapping; 2FA support (req:sec:two-factor-auth) — TOTP or SMS-based second factor; DB migrations for user, user-profile, guardian tables",12
,,Вход в систему,,,
,,,tc:auth:login-success,"screen:reg:login — форма с двумя полями (СНИЛС + пароль); компонент ввода СНИЛС с маской ХХХ-ХХХ-ХХХ ХХ и валидацией контрольной суммы на клиенте; action:reg:login — effects chain: 1) валидация СНИЛС формата, 2) запрос к БД entity:reg:user по snils, 3) сравнение хэша пароля, 4) проверка has_signed_contract (rule:legal:contract-required), 5) если контракт не подписан → $screen.legal.contract, если подписан → $screen.lk.dashboard; создание session entity с токеном; установка context:session.current_user; если включён 2FA (req:sec:two-factor-auth) — дополнительный шаг подтверждения; edge case: заблокированный аккаунт после N неудачных попыток",4
,,,tc:auth:login-invalid,"Продолжение flow tc:reg:login-success при ошибке: action:reg:login возвращает ошибку → effect $toast.error с сообщением; инкремент счётчика неудачных попыток в entity:reg:user.failed_login_count; после 5 попыток (rule или config) — временная блокировка аккаунта; пользователь остаётся на screen:reg:login; поля не очищаются для повторной попытки; dialog:common:error отображается поверх",1.5
```

### 9. Report Summary

After completion, report:

```
Estimation generated: {output}

Summary:
  Epics: {N}
  Features: {N}
  Test cases: {N}

  Total estimated hours: {sum of all estimation_hours}

  Phase breakdown:
    mvp — Nh ({N} epics, {N} features, {N} TCs)
    v2 — Nh ({N} epics, {N} features, {N} TCs)
    (no phase) — Nh ({N} epics, {N} features, {N} TCs)

  Top 5 most expensive test cases:
    1. tc:xxx:yyy — Nh (reason)
    2. ...

  Epic breakdown:
    epic:auth [mvp] — Nh (overhead) + Nh (features+TCs) = Nh total
      - Вход в систему: Nh ({N} TCs)
      - Регистрация: Nh ({N} TCs)
    epic:cart [v2] — Nh (overhead) + Nh (features+TCs) = Nh total
      - Корзина: Nh ({N} TCs)
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
- If `_epics.yaml` or `_test-cases.yaml` is missing — stop and tell user which command to run first
- Phase 1 skeleton MUST be shown to user before proceeding to Phase 2
- Implementation descriptions must be grounded in actual YAML entities — no hallucinated features
- Estimations must reflect actual complexity found in the spec, not generic guesses
- Quote CSV fields properly — implementation descriptions often contain commas
- Use the same language as the project for implementation descriptions
- Every TC must have an estimation — no empty estimation_hours for TC rows
- Epic estimation_hours can be empty if there's no shared overhead
