# BMF — Behaviour Modeling Framework

Структурированный YAML-формат для декларативного описания поведения системы.

BMF описывает **что** делает система, а не **как** — экраны, действия, данные, события и связи между ними.

## Принцип схемы

Все сущности валидируются через `schema.json`. Схема определяет:

```
definitions:
  base        — базовая сущность (description, tags, props, data, components)
  action      — действие (base + effects вместо components)
  event       — событие (action + to для получателей)
  screen      — экран (base + layout)
  component   — UI-компонент (type, label, value, if/then)
  effect      — побочный эффект (BML-выражение или if/then/else)
  bml         — выражение: $entity.x, query $entity.x where ...
```

Валидация: `npx ts-node utils/validate-schema.ts bmfs/{project}`

## Принцип неймспейсов

Каждая сущность имеет ID формата `type:epic:name`:

```
type   — тип сущности (screen, action, entity...)
epic   — домен/эпик (auth, cart, training...)
name   — имя сущности (login, checkout, user...)
```

**Зарезервированные типы** (специальная схема в patternProperties):
- `action:*:*` — действия с effects
- `event:*:*` — события с to + effects
- `screen:*:*` — экраны с layout
- `components:*` — группы YAML-anchors

**Все остальные типы** используют base-схему:
- Встроенные: `entity`, `dialog`, `layout`, `context`, `toast`
- Кастомные: `doc`, `role`, `feature`, `config` — любые свои

**При создании нового типа** (первый неймспейс) — добавь описание в `bmfs/{project}/main.yaml`.

## Описание сущностей

Подробное описание каждого типа сущности: `bmfs/{project}/main.yaml`

Содержит:
- Назначение и формат ID
- Ключевые поля
- Примеры использования
- Связи между сущностями

## Структура проекта

`bmfs/` — папка со всеми BMF-проектами.

```
bmfs/
  {project}/           # Спецификация проекта
    *.yaml             # Сущности (screen, action, entity...)
    _comments.yaml     # Комментарии к ревью
    _epics.yaml        # Эпики (бизнес-цели)
    _test-cases.yaml   # Сценарии tc:*
    main.yaml          # Описание всех типов сущностей
  links/               # Симлинки на внешние проекты
    external-app -> /path/to/external/bmf-spec
```

Проекты могут лежать напрямую в `bmfs/` или подключаться через симлинки в `bmfs/links/`.

## Работа с YAML

Используй `yq` для массовых операций:

```bash
# Удаление тегов
yq -i 'del(.*.tags[] | select(startswith("tc:")))' file.yaml

# Добавление тега ко всем сущностям
yq -i '.*.tags += ["stage:mvp"]' file.yaml

# Фильтрация по тегу
yq '.* | select(.tags[] == "stage:mvp")' file.yaml

# Поиск сущностей с определённым полем
yq '.* | select(has("effects"))' file.yaml
```

## Утилиты

```bash
npx ts-node utils/validate-schema.ts bmfs/{project}   # Валидация схемы
npx ts-node utils/check-references.ts bmfs/{project}  # Проверка ссылок
npx ts-node utils/delete-tc-tags.ts bmfs/{project}    # Удаление tc:* тегов
```
