# BMF — Behaviour Modeling Framework

Общее описание проекта: [README.md](README.md)

Описание всех типов сущностей с примерами: `bmfs/{project}/main.yaml`

## Схема и валидация

Все сущности валидируются через `schema.json`:

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

## Неймспейсы

ID формат: `type:epic:name`

**Зарезервированные типы** (специальная схема в patternProperties):
- `action:*:*` — действия с effects
- `event:*:*` — события с to + effects
- `screen:*:*` — экраны с layout
- `components:*` — группы YAML-anchors
- `epic:*` — эпики (только 2 сегмента, без подэпиков)

**Все остальные типы** используют base-схему:
- Встроенные: `entity`, `dialog`, `layout`, `context`, `toast`, `external`
- Кастомные: `doc`, `role`, `feature`, `config` — любые свои

При создании нового типа — добавь описание в `bmfs/{project}/main.yaml`.

## Структура проекта

```
bmfs/
  {project}/           # Спецификация проекта
    *.yaml             # Сущности (screen, action, entity...)
    _comments.yaml     # Комментарии к ревью
    _epics.yaml        # Эпики (бизнес-цели)
    _test-cases.yaml   # Сценарии tc:*
    main.yaml          # Описание всех типов сущностей
  links/               # Симлинки на внешние проекты
```

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
npx ts-node utils/validate-schema.ts bmfs/{project}      # Валидация схемы
npx ts-node utils/check-references.ts bmfs/{project}     # Проверка ссылок
npx ts-node utils/delete-tc-tags.ts bmfs/{project}       # Удаление tc:* тегов
npx ts-node utils/validate-tcs-epics.ts bmfs/{project}   # Проверка epic:* ↔ tc:* соответствия
```
