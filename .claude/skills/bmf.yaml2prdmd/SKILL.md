---
description: Generate a PRD (prd.md) from BMF YAML project using epics as features and test cases as user stories.
---

## User Input

```text
$ARGUMENTS
```

## Overview

Generate a **product-level** requirements document (`prd.md`) from a BMF YAML project. The PRD is a business-facing document for stakeholders who don't know the BMF format. It uses epics as feature sections and test cases as user stories. YAML internals (entity IDs, screen IDs, action chains, BML expressions) are used as **source material** but must NOT appear in the output.

## Execution

### 1. Parse Arguments

Extract from `$ARGUMENTS`:
- `folder` — path to BMF project folder (e.g., `bmfs/bchp`)
- `lang` — language for PRD (default: match project language, auto-detect from `main.yaml` description)
- `output` — output file path (default: `{folder}/prd.md`)

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

**A. `{folder}/main.yaml`** — project overview, roles, entry point
**B. `{folder}/_epics.yaml`** — all epics with descriptions
**C. `{folder}/_test-cases.yaml`** — all test cases with step descriptions
**D. All YAML files** — read EVERY `.yaml` file in the folder
   (excluding files starting with `_` and `main.yaml`).

   Standard files (always expected):
   - `entity.yaml`, `screen.yaml`, `action.yaml`, `dialog.yaml`
   - `event.yaml`, `context.yaml`, `layout.yaml`, `component.yaml`

   Projects may also contain additional files with custom entity types
   (e.g., `req.yaml`, `integration.yaml`, `algorithm.yaml`, `spec.yaml`
   or any other `*.yaml`). Read ALL of them — do not skip unknown files.

### 4. Build Epic → TC Map & Understand Domain

For each epic, collect its test cases by domain prefix matching.
Read ALL YAML files to **understand** what the system does — entities, screens,
actions, events, dialogs are your source material for writing descriptions.
But they are NOT included in the output directly.

### 5. Generate PRD Markdown

Write the PRD following this structure:

---

```markdown
# {Project Name} — Product Requirements Document

> Auto-generated from BMF specification by `bmf.yaml2prdmd`

## 1. Overview

{Content from main.yaml description — project summary, timeline, roles, categories.
Rewrite as clean prose, not YAML fields. Keep all factual details.}

## 2. Roles

{Extract roles from main.yaml and list with brief description.}

| Роль | Описание |
|------|----------|
| ... | ... |

## 3. Features

{For each ROOT epic, create a feature section. Number them sequentially.}

### 3.N. {Epic Title}

{Epic description from _epics.yaml — rewritten as clean prose.}

{If epic has subepics, add subsections:}

#### 3.N.M. {Subepic Title}

{Subepic description.}

**User Stories:**

{For each test case that belongs to this epic, convert to user story format:}

---

**US-{sequential_number}: {TC title in human-readable form}**

{TC description — keep the numbered steps as-is, they serve as acceptance criteria.
Reformat "Проверить:" / "Verify:" as a clear "Acceptance Criteria:" block.}

**Acceptance Criteria:**
- {criteria from "Verify" / "Проверить" line}

---

## 4. Key Objects & Data

{Describe the main data objects of the system in product terms.
Group by feature area. Use human-readable names, NOT entity IDs.
Focus on WHAT data exists and WHY it matters, not field types or DB schema.}

### 4.N. {Feature area}

| Object | Key Attributes | Purpose |
|--------|---------------|---------|
| {Human name} | attr1, attr2, ... | {what it represents} |

## 5. Navigation

{Describe the app's navigation structure in product terms.
What sections/tabs does the user see? How do they move between areas?}

- **{Area name}** — {description}
  - Sections: section1, section2, ...

## 6. Notifications & Events

{Describe system notifications and real-time events in user terms.
WHO gets notified, WHEN, and ABOUT WHAT.}

| Trigger | Who is notified | What happens |
|---------|----------------|--------------|
| {when X happens} | {role/user} | {notification description} |

{If the project contains additional domain-specific concepts beyond standard features,
add sections for them. Group by semantic category. Common patterns:}

## 7+. {Category Title}

{Render additional domain concepts in product-friendly format.
Use the most appropriate format for each category:}

**For requirements/constraints:**
| Requirement | Target | Applies To |
|-------------|--------|------------|

**For external integrations:**
| System | Purpose | Data Exchange |
|--------|---------|---------------|

**For business rules/algorithms:**
### {Rule Name}
{Description, logic, inputs, edge cases — rendered as readable prose}

**For reference data/catalogs:**
### {Catalog Name}
{Render ALL values — tables or bullet lists. Never summarize.}

**For analytics/dashboards:**
| Dashboard | Metrics | Dimensions | Export |
|-----------|---------|------------|--------|

{Section numbering continues from the last standard section.
Only create sections for categories that actually exist in the project.}
```

---

### 6. Writing Rules

**General:**
- Write clean, readable markdown — this is a document for stakeholders who don't know BMF
- **NO entity IDs** — never use `entity:epic:name`, `screen:epic:name`, `action:epic:name`, `tc:epic:name` or any other BMF identifiers in the output
- **NO field types** — describe data in product terms (e.g., "name, email, phone" not "string, string, string")
- **NO technical internals** — no $references, BML expressions, YAML syntax, schema details
- Use human-readable names everywhere (e.g., "User" not "entity:auth:user", "Login screen" not "screen:auth:login")
- Number all sections, features, and user stories consistently
- Use the same language as the project (detected from `main.yaml`)

**Epic → Feature conversion:**
- Epic `description` becomes feature description prose
- Strip "Ограничения:" into a note, don't lose the info
- "Включает:" becomes part of the feature description naturally
- Describe what the feature DOES, not how it's implemented

**Test Case → User Story conversion:**
- Sequential US-N numbering (no TC IDs in output)
- TC description's first line becomes the story title
- Numbered steps become acceptance criteria / scenario steps
- "Verify:" / "Проверить:" becomes "Acceptance Criteria:" bullet list
- Steps should read as user actions, not system internals

**Data objects:**
- Describe objects in product terms — what they represent, not how they're stored
- Use human-readable names (e.g., "Пользователь", "Правило качества")
- List key attributes by meaning, not by field type
- Group by feature area for context

**Custom domain concepts:**
- Read ALL yaml files to understand the full domain
- For catalog/spec entities: enumerate ALL values, do NOT summarize
- For requirement entities: highlight specific numeric targets prominently
- For algorithm entities: present formulas/rules in readable prose, not code
- Preserve exact numbers, dates, enum values, and limits — these are specifications
- Present everything in product-friendly language

**What NOT to include:**
- Any BMF entity IDs (`entity:*`, `screen:*`, `action:*`, `event:*`, `tc:*`, `dialog:*`, `layout:*`, `context:*`)
- YAML anchors, `*references`, `$schema` references
- `tags` arrays, `props` structures, `effects` chains
- Component YAML structure — describe what the UI shows instead
- BML expressions — describe the behavior in words
- Field types (uuid, string, datetime, $entity:*) — use product terms

### 7. Write Output File

Write the generated markdown to `{output}` path (default: `{folder}/prd.md`).

### 8. Report Summary

After generation, report:

```
PRD generated: {output}

Contents:
  - Overview: project summary and roles
  - Features: {N} features from {N} epics
  - User Stories: {N} stories from {N} test cases
  - Key Objects: {N} data objects
  - Navigation: {N} app sections
  - Notifications: {N} event types
  {For each additional domain category found:}
  - {Category}: {N} items
```

## Example Output (fragment)

For BCHP project:

```markdown
# ЦПК-ЗЛГ — Product Requirements Document

> Auto-generated from BMF specification by `bmf.yaml2prdmd`

## 1. Overview

ЦПК-ЗЛГ — цифровая платформа Всероссийского конкурса «Знать. Любить. Гордиться!»,
разработанная для АНО «Больше, чем путешествие».

Платформа обеспечивает полный цикл проведения конкурса: от регистрации участников
и выполнения заданий до экспертной оценки, рейтингов и формирования сертификатов.
Включает интерактивную карту с маршрутами и объектами показа.

**Этапы конкурса:**

1. Регистрация (31 марта — 15 апреля 2026)
2. Региональный этап (15 апреля — 13 мая 2026)
3. Окружной этап (19 мая — 2 июня 2026)
4. Федеральный этап (8 июня — 22 июня 2026)
5. Подведение итогов (начало июля 2026)

**Категории участников:**

- Индивидуальные участники (14–35 лет)
- Семейные команды (3+ человек, до 2 поколений)
- Региональные команды
- Специальные номинации

## 2. Roles

| Роль | Описание |
|------|----------|
| Участник | Выполняет задания, загружает работы, участвует в рейтинге |
| Эксперт | Проверяет работы участников, выставляет баллы |
| Куратор региона | Координирует участников в регионе |
| Организатор | Управляет конкурсом, заданиями, этапами |
| Партнёр | Внешний партнёр конкурса |

## 3. Features

### 3.1. Регистрация и авторизация

Участник создаёт аккаунт и получает доступ к платформе конкурса.
Поддерживается вход по СНИЛС/паролю и через Госуслуги (ЕСИА).
Регистрация учитывает возраст — несовершеннолетние указывают данные
законного представителя, совершеннолетние — паспортные данные.
Семейные команды формируются через invite-код.
Обязательно принятие согласия на обработку персональных данных (152-ФЗ).

> Не включает: управление профилем (см. 3.8) и подписание договоров (см. 3.4).

#### 3.1.1. Регистрация нового участника

Пользователь создаёт аккаунт с учётом категории участия и возраста.

#### 3.1.2. Вход в существующий аккаунт

Пользователь авторизуется по СНИЛС/паролю или через Госуслуги.

**User Stories:**

---

**US-1: Регистрация совершеннолетнего участника**

Регистрация совершеннолетнего участника (индивидуальное участие).

1. Участник открывает лендинг
2. Нажимает «Зарегистрироваться»
3. Заполняет основную форму (ФИО, СНИЛС, телефон, регион)
4. Выбирает тип участия — индивидуальное
5. Система создаёт пользователя, определяет возраст >= 18
6. Участник заполняет паспортные данные
7. Система сохраняет данные
8. Показывается диалог «Успешная регистрация»
9. Участник переходит на экран логина

**Acceptance Criteria:**

- Пользователь создан, данные сохранены, можно войти

---
```

## Behavior Rules

- Never overwrite existing `prd.md` without confirmation
- If `_epics.yaml` or `_test-cases.yaml` is missing — stop and tell user which command to run first
- Preserve all factual content from YAML — don't invent or add information
- Use consistent numbering throughout the document
- Cross-reference features by section number where epics reference each other (e.g., "Ограничения" → "см. 3.N")
- Match the language of the project (ru/en) for the entire document
- **NEVER include BMF entity IDs** — the PRD is a product document, not a technical spec. Use human-readable names everywhere
