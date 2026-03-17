---
description: Generate a PRD (prd.md) from any input document — structures requirements into Epic → Feature → User Story format.
---

## User Input

```text
$ARGUMENTS
```

## Overview

Generate a **product-level** requirements document (`prd.md`) from any input source. The command takes raw requirements (text, file, URL) and structures them into a clean PRD using the **Epic → Feature → User Story** format.

This command does NOT require BMF YAML files. It works directly with the input document.

**Key structure:**

- **Epic** = top-level functional area identified from the input
- **Feature** = logical grouping of related capabilities within an epic
- **User Story** = individual user scenario with steps and expected result

## Execution

### 1. Parse Arguments

Extract from `$ARGUMENTS`:
- `source` (required) — requirements source. Can be:
  - Path to a file (`.md`, `.txt`, `.docx`, `.pdf`)
  - URL to a requirements document
  - Inline text description of the product
  - Path to a BMF project folder — in this case, read all `.yaml` files as source material
- `output` — output file path (default: same directory as source, or `prd.md` in current directory for inline text)
- `lang` — language for PRD (default: auto-detect from source content)

If `source` is empty, ask the user what to structure into a PRD.

### 2. Read the Source

**A. If file path** → read the file
**B. If URL** → fetch and extract content
**C. If inline text** → use directly
**D. If BMF project folder** → read `main.yaml` + all `*.yaml` files (including `_epics.yaml`, `_test-cases.yaml` if they exist) as raw source material

For all source types, the goal is the same: extract the raw requirements content to structure.

### 3. Read PRD Template

Read `bmfs/prd-template.md` — this defines the target PRD structure:
- Section headings and their purpose
- Epic → Feature → User Story hierarchy
- Capability types (Просмотр, Список, Создание, etc.)
- User story format ("Как/хочу/чтобы")

The template is the structural blueprint. The source provides the content.

### 4. Exhaustive Source Analysis

Before structuring anything, analyze the source systematically. For EVERY category below, explicitly list what was found or write "not mentioned". This prevents information loss.

**A. Product identity:**
- Product name, description, positioning
- Target audience / market
- Problem statement

**B. Modules & features inventory:**
- List ALL functional modules/sections/chapters from the source
- Each module becomes at least one epic
- Do NOT skip modules that seem minor — if the source describes it, capture it
- IMPORTANT: Sections titled "Additional mechanics", "Additional opportunities", "Ideas for engagement" (or their Russian equivalents) in technical specifications are REAL requirements, not optional brainstorming

**C. User roles:**
- List ALL roles/personas mentioned
- Their permissions and capabilities
- Role relationships (hierarchy, mutual exclusivity)

**D. Non-functional requirements:**
- Performance targets, availability/SLA, scalability
- Security (auth methods, encryption, compliance)
- Accessibility, localization, SEO
- Deployment constraints
- Backup & recovery

**E. External integrations:**
- Auth providers (OAuth, SSO, government portals)
- Messaging channels (Telegram, SMS, email, push)
- Third-party APIs (maps, payments, analytics)
- Import/export formats

**F. Business logic & algorithms:**
- Scoring/rating formulas, ranking algorithms
- Moderation/validation rules, state machines
- Recommendation/optimization algorithms

**G. Reference data & catalogs:**
- Enum catalogs with ALL values
- Filter parameters with ranges
- Classification systems, taxonomies
- CRITICAL: When the source lists named items (e.g., 10 categories, 7 types), store the COMPLETE list. Count items in source — numbers must match in PRD.

**H. Analytics & reporting:**
- Dashboard metrics, report types, export formats
- KPIs and indices

**I. Business rules & constraints:**
- Exclusivity rules, threshold values
- Content limits, temporal constraints
- Prohibitions — things users are NOT allowed to do

**J. Verbatim content:**
- ALL proper nouns, organization names, product names
- ALL URLs, emails, phones, messenger handles
- ALL named categories, directions, types with exact names
- These MUST appear in the PRD — not generalized into prose

### 5. Structure into Epic → Feature → User Story

**Step A: Identify Epics.**

Group the source material into top-level functional areas (epics). Each epic should be:
- A cohesive domain (auth, catalog, orders, analytics, etc.)
- Large enough to contain 2+ features
- Named with a clear, business-facing title

**Step B: For each epic, identify Features.**

Within each epic, group related capabilities into features (2–5 per epic):
- Features that share the same entities or user flows belong together
- Features that form a sequential flow belong together
- Error/edge cases belong with their happy-path feature
- Feature names should be action-oriented ("Управление аккаунтами", not "Аккаунты")

**Step C: For each feature, derive User Stories.**

Each discrete user scenario becomes a user story:
- Extract the user role performing the action
- Identify what the user wants to do and why
- Define numbered steps (user action → system reaction)
- Define expected result

**Step D: Assign roles to epics and features.**

Based on the roles identified in step 4C, assign which roles interact with each epic and feature.

**Step E: Determine capabilities per feature.**

For each feature, select applicable capability types:
- Просмотр, Список, Создание, Редактирование, Удаление
- Поиск, Сортировка, Фильтрация
- Экспорт, Импорт, Массовые операции

### 6. Generate PRD Markdown

Write the PRD following the template structure from `bmfs/prd-template.md`:

```markdown
# {Project Name} — Product Requirements Document

## Описание проекта

{2-5 sentences: what the product is, who it's for, what problem it solves.
All factual details from source preserved.}

## Основные сценарии использования

{For each key role, a cohesive narrative paragraph:
who → what they do → what they get.}

## Нефункциональные требования

{Only include subsections relevant to the project. Delete irrelevant ones.}

### Безопасность
### Локализация
### Доступность
### SEO
### Деплоймент

---

## Бизнес цели

{Measurable outcomes: "Сократить время X на Y%", "Автоматизировать процесс Z".}

---

## Роли пользователей

- **{Role} —** {description and capabilities}

---

## Функциональные требования

### Epic — {Epic Title}

{Epic description — what this area covers and why it matters.}

**Роли**: {roles}

#### Feature — {Feature Title}

{1-3 sentences about what the feature does from user perspective.}

**Роль**: {primary role}

**Функциональности:**

- **Просмотр** — ...
- **Создание** — ...
{only applicable ones}

##### User Stories

###### US — {Short title}

**Как** {role} **хочу** {action}, **чтобы** {value}

**Шаги:**

1. Пользователь {action}
2. Система {reaction}
3. ...

**Ожидаемый результат:** {outcome}

---

{After all epics, add additional sections for content that doesn't fit
the Epic→Feature→US structure:}

## {Category Title}

{Requirements/constraints, external integrations, business rules,
reference data, analytics — in appropriate format (tables, prose, lists).}
```

### 7. Writing Rules

**Language:**
- Auto-detect language from the source content
- Use the same language consistently throughout the PRD
- If source is mixed — use the dominant language

**Content fidelity:**
- Preserve ALL factual content from source — don't invent or add information
- Exact numbers, dates, enum values, formulas must be preserved verbatim
- Named lists must be complete — count items in source vs PRD
- Contact info (URLs, emails, phones) must appear in the PRD
- Treat ALL content in source as mandatory unless explicitly marked optional

**Structure:**
- Cross-reference epics where they reference each other (e.g., "> Не включает: см. Epic «...»")
- Use consistent formatting throughout
- Delete template sections that don't apply — don't leave empty placeholders

**What NOT to include (if source is a BMF project):**
- BMF entity IDs (`entity:*`, `screen:*`, `action:*`, `tc:*`, etc.)
- YAML syntax, BML expressions, `$schema` references
- Field types (`uuid`, `string`, `datetime`)
- Use human-readable names everywhere

### 8. Write Output File

Write the generated markdown to `{output}` path.

Default output location:
- If source is a file → same directory as source file: `{source_dir}/prd.md`
- If source is a BMF folder → `{folder}/prd.md`
- If source is inline text or URL → `./prd.md` in current directory

### 9. Iterative Verification (3 passes)

After writing the PRD, perform **3 verification passes** comparing the generated document against the source material. Only finalize after all passes complete.

**Each pass:**

1. **Re-read the full generated PRD** (not from memory — use Read tool)
2. **Re-read source material sections** systematically
3. **For each source section**, check: is the corresponding content present in the PRD? Identify gaps.
4. **For each gap claimed in a previous pass**, re-read the specific PRD lines to verify it's actually missing (not just phrased differently). Record corrections (false positives).
5. **Produce a pass report**: list of verified gaps + corrections from previous pass

**Pass rules:**

- Use exact line references from the PRD (e.g., "line 55") for every claim
- Verify each gap against the actual PRD text, not from memory — re-read the section
- Check for equivalent content phrased differently (synonyms, merged sections, implicit coverage)
- A gap is confirmed only when verified across 2+ passes without correction

**Exit criteria:**

- All 3 passes complete
- Final report includes: confirmed gaps with PRD line references, corrections log across passes

**Report format after verification:**

```
Verification complete (3 passes).

Corrections log:
  Pass 1→2: {N} false positives found and corrected
  Pass 2→3: {N} false positives found and corrected

Confirmed gaps: {N} critical + {N} substantial = {N} total

Critical:
  1. {Gap title} — source: {section ref}, PRD: not found
  ...

Substantial:
  1. {Gap title} — source: {section ref}, PRD: partial at line {N}
  ...
```

If critical gaps are found, ask the user whether to:

- **Fix now** — update the PRD to address confirmed gaps
- **Accept as-is** — proceed with the PRD in current state
- **Review gaps** — show detailed comparison for each gap before deciding

### 10. Report Summary

After generation, report:

```
PRD generated: {output}

Source: {source description}

Contents:
  - Epics: {N}
  - Features: {N} (across all epics)
  - User Stories: {N}

  Feature breakdown:
    Epic: {epic title}
      - {feature title} ({N} stories)
      - {feature title} ({N} stories)
    Epic: {epic title}
      - {feature title} ({N} stories)
    ...

  Additional sections: {list if any}

Verification: {pass/fail with gap count}
```

## Behavior Rules

- Never overwrite existing `prd.md` without confirmation
- Preserve all factual content from source — don't invent or add information
- Cross-reference epics by title where they reference each other
- Match the language of the source for the entire document
- Feature grouping must be consistent — every user scenario belongs to exactly one feature
- If source is a BMF project: **NEVER include BMF entity IDs** in the PRD output
- Named lists and catalogs must be reproduced in full — never summarize "10 directions" when source lists all 10 by name
- Contact information (URLs, emails, phones) must appear in the PRD
- Never skip the verification passes (step 9) — they are the primary defense against information loss
- The PRD template (`bmfs/prd-template.md`) defines the structure — follow it precisely
