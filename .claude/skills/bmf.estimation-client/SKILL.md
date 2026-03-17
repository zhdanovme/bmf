---
description: Generate client-facing estimation CSV with costs from epics and test cases.
---

## User Input

```text
$ARGUMENTS
```

## Overview

Generate a client-facing estimation spreadsheet (CSV) from BMF project epics and test cases. Unlike the internal `bmf.estimation`, this produces a clean, business-readable document: IDs are replaced with human-readable titles, technical implementation details are replaced with functional descriptions, and hours are converted to monetary cost.

## Execution

### 1. Parse Arguments

Extract from `$ARGUMENTS`:
- `folder` — path to BMF project folder (e.g., `bmfs/works/bchp3`)
- `hour_price` — cost per hour (number, e.g., `5000`). **Required.**
- `currency` — currency label (default: `₽`)
- `lang` — language for descriptions (default: auto-detect from `main.yaml`)
- `output` — output CSV path (default: `{folder}/estimation-client.csv`)

If folder or hour_price is missing, ask user to provide them.

### 2. Verify Prerequisites

Check that both files exist:
- `{folder}/_epics.yaml`
- `{folder}/_test-cases.yaml`

Also check that `{folder}/estimation.csv` exists — it is the **source** for hour estimates.

**If any is missing:**
```
ERROR: Required files not found in {folder}

Missing:
  - _epics.yaml → run: /bmf.create-epics {folder}
  - _test-cases.yaml → run: /bmf.create-tcs {folder}
  - estimation.csv → run: /bmf.estimation {folder}
```
Stop execution.

### 3. Read All Project Data

Read and parse:

**A. `{folder}/estimation.csv`** — source estimation with hours per test case and epic
**B. `{folder}/_epics.yaml`** — epic descriptions (for human-readable titles)
**C. `{folder}/_test-cases.yaml`** — test case descriptions (for human-readable titles and functional descriptions)
**D. `{folder}/main.yaml`** — project metadata
**E. All YAML files in `{folder}/`** — entity definitions for additional context

### 4. Build Title Map

For every epic, feature, and test case, extract a human-readable title:

**Epics:** Use `description` field from `_epics.yaml`. If the description is long, use its first sentence or a concise summary.
- `epic:auth` → "Авторизация и регистрация"
- `epic:cart` → "Корзина и оформление заказа"

**Features:** Use the `feature` column value from `estimation.csv` as-is — it is already a human-readable title.

**Test cases:** Use `description` field from `_test-cases.yaml`. Extract a short functional title (first sentence or summary of the TC purpose).
- `tc:auth:login-success` → "Успешный вход в систему"
- `tc:cart:add-product` → "Добавление товара в корзину"

### 5. Build Functional Descriptions

For each test case, write a **user-facing functional description** — what the feature does from the user's perspective. This replaces the technical `implementation_description`.

**Rules:**
- Write from the user's/business perspective, NOT technical
- No entity IDs, no screen IDs, no technical jargon
- Describe WHAT the user can do, not HOW it's implemented
- Keep concise but informative (1-3 sentences)
- Use the same language as the project

**Examples:**
- BAD: "screen:reg:login — форма с двумя полями (СНИЛС + пароль); action:reg:login — effects chain..."
- GOOD: "Пользователь вводит СНИЛС и пароль для входа в личный кабинет. Система проверяет данные и перенаправляет на главную страницу."

For features, write a brief summary of what the feature covers from a business perspective (1-2 sentences).

For epics, write a brief summary of what the epic covers from a business perspective.

### 5.5. Map Phase to Human-Readable Name

Read `phase` column from source `estimation.csv`. Convert raw `stage:*` tag values to human-readable phase names:
- `mvp` → `MVP`
- `v2` → `V2`
- Other values → capitalize first letter

Phase is only shown on epic rows. TC rows leave the phase column empty.

### 6. Calculate Costs

For each row from `estimation.csv`:
- Read `estimation_hours` value
- Calculate: `стоимость = estimation_hours × hour_price`
- Format as integer (round to nearest whole number)

### 7. Generate Client CSV

**Header:** `фаза,эпик,фича,функционал,описание,стоимость`

**Structure:**
- Epic row: `фаза` filled (from `stage:*` tag on epic, mapped to human-readable name; empty if no tag), `эпик` filled with human-readable title, `фича` empty, `функционал` empty, `описание` with epic-level functional summary, `стоимость` with epic overhead cost (if any)
- Feature row: `фаза` empty, `эпик` empty, `фича` filled with human-readable feature title, `функционал` empty, `описание` with feature-level functional summary, `стоимость` with feature overhead cost (if any)
- TC row: `фаза` empty, `эпик` empty, `фича` empty, `функционал` filled with human-readable title, `описание` with functional description, `стоимость` with calculated cost

**Example:**

```csv
фаза,эпик,фича,функционал,описание,стоимость
MVP,Авторизация и регистрация,,,"Общая инфраструктура: управление сессиями, хэширование паролей, интеграция с ЕСИА",60000
,,Вход в систему,,,"",
,,,Успешный вход в систему,"Пользователь вводит СНИЛС и пароль для входа в личный кабинет. Система проверяет данные и перенаправляет на главную страницу.",20000
,,,Неуспешная попытка входа,"При вводе неверных данных система показывает ошибку. После нескольких неудачных попыток аккаунт временно блокируется.",7500
,,Регистрация,,,
,,,Регистрация совершеннолетнего,"Пользователь создаёт аккаунт, указывая паспортные данные. Система определяет возраст и запрашивает соответствующие документы.",30000
V2,Корзина и оформление заказа,,,"Функциональность корзины: добавление, удаление товаров и оформление заказа",0
,,Управление корзиной,,,
,,,Добавление товара в корзину,"Пользователь добавляет товар в корзину с выбранной страницы каталога. Корзина обновляется с учётом количества и цены.",15000
```

### 8. CSV Format

- Delimiter: comma (`,`)
- Encoding: UTF-8 with BOM (`\xEF\xBB\xBF`) for Excel compatibility
- Quote character: double-quote (`"`)
- Escape: double double-quote (`""`) inside quoted fields
- Newlines in fields: use `\n` within double-quoted fields
- Header row: `фаза,эпик,фича,функционал,описание,стоимость`

Write to `{output}`.

### 9. Report Summary

After completion, report:

```
Client estimation generated: {output}
Hour rate: {hour_price}{currency}/h

Summary:
  Эпиков: {N}
  Фич: {N}
  Функциональных блоков: {N}

  Итого стоимость: {total_cost}{currency}

  Разбивка по фазам:
    MVP — {cost}{currency} ({N} эпиков, {N} фич)
    V2 — {cost}{currency} ({N} эпиков, {N} фич)
    (без фазы) — {cost}{currency} ({N} эпиков, {N} фич)

  Разбивка по эпикам:
    [MVP] Авторизация и регистрация — {cost}{currency}
      - Вход в систему: {cost}{currency} ({N} функц. блоков)
      - Регистрация: {cost}{currency} ({N} функц. блоков)
    [V2] Корзина и оформление — {cost}{currency}
      - Управление корзиной: {cost}{currency} ({N} функц. блоков)
    ...
```

## Behavior Rules

- Never overwrite existing `estimation-client.csv` without confirmation
- If source `estimation.csv` is missing — stop and tell user to run `/bmf.estimation` first
- All IDs must be replaced with human-readable titles — NO raw IDs in the output
- Descriptions must be user/business-facing — NO technical jargon, NO entity IDs
- Стоимость = estimation_hours × hour_price — always
- Use the same language as the project for descriptions
- Every TC must have a стоимость — no empty cost fields for TC rows
- Epic стоимость can be empty (0) if there's no shared overhead in source estimation
- Quote CSV fields properly — descriptions often contain commas
