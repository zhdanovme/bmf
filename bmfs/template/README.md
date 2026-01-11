# BMF Template

Шаблонный проект BMF-спецификации. Каждый файл содержит примеры сущностей с комментариями — используйте их как отправную точку для нового проекта.

## Быстрый старт

1. Скопируйте папку `template/` с новым именем проекта
2. Начните с [main.yaml](main.yaml) — опишите проект и настройте типы сущностей
3. Определите модели данных в [entity.yaml](entity.yaml)
4. Создайте экраны в [screen.yaml](screen.yaml) и привяжите к ним данные
5. Добавьте действия в [action.yaml](action.yaml) для обработки пользовательских взаимодействий

## Файлы сущностей

| Файл | Тип | ID формат | Описание |
|------|-----|-----------|----------|
| [main.yaml](main.yaml) | — | — | Корневой файл проекта: метаданные, описание всех типов сущностей, кастомные типы |
| [screen.yaml](screen.yaml) | `screen` | `screen:epic:name` | Экраны — полноэкранные UI-состояния с layout, data-binding и компонентами |
| [action.yaml](action.yaml) | `action` | `action:epic:name` | Действия — обработчики с побочными эффектами (навигация, CRUD, toast) |
| [entity.yaml](entity.yaml) | `entity` | `entity:epic:name` | Модели данных — схемы хранимых объектов с полями и типами |
| [event.yaml](event.yaml) | `event` | `event:epic:name` | События — асинхронные уведомления другим пользователям (real-time) |
| [dialog.yaml](dialog.yaml) | `dialog` | `dialog:epic:name` | Диалоги — модальные окна поверх экрана (подтверждения, ошибки, формы) |
| [context.yaml](context.yaml) | `context` | `context:global:main` | Глобальный контекст — singleton-состояние сессии (текущий пользователь, computed-запросы) |
| [layout.yaml](layout.yaml) | `layout` | `layout:epic:name` | Шаблоны layout — структура страницы с навигацией |
| [external.yaml](external.yaml) | `external` | `external:epic:name` | Внешние системы — сторонние сервисы, микросервисы, API за границей проектируемой системы |
| [component.yaml](component.yaml) | `components` | `components:epic` | Переиспользуемые UI-компоненты — YAML anchors для вставки в screens/dialogs |

## Как собирать спецификацию

### 1. Модели данных — [entity.yaml](entity.yaml)

Начните с определения структуры данных. Каждая entity описывает схему хранимого объекта.

```yaml
entity:orders:order:
  description: User order
  data:
    id: uuid
    user_id: $entity.users.user    # ссылка на другую сущность
    total: 0                        # значение по умолчанию
    state: draft                    # enum-like строка
    created_at: datetime
```

### 2. Глобальный контекст — [context.yaml](context.yaml)

Определите singleton-состояние сессии: текущий пользователь и computed-запросы.

```yaml
context:global:main:
  data:
    current_user_id: uuid
    current_user: query $entity.users.user where id == current_user_id
```

### 3. Layout — [layout.yaml](layout.yaml)

Создайте каркасы страниц. Экраны ссылаются на layout через `$layout.epic.name`.

```yaml
layout:global:main:
  description: Main layout with navigation
  components:
    - type: nav-item
      label: Home
      value: $action.nav.go-home
```

### 4. Компоненты — [component.yaml](component.yaml)

Вынесите повторяющиеся блоки UI в YAML anchors. Определяйте в `components:epic`, используйте в screens через `*anchor-name`.

```yaml
components:profile:
  - &profile:header
    components:
      - type: text
        label: data.user.display_name
      - type: image
        value: data.user.avatar_url
```

### 5. Экраны — [screen.yaml](screen.yaml)

Экраны связывают данные с UI. Используют layout, data-binding и компоненты (inline или anchors).

```yaml
screen:profile:main:
  layout: $layout.global.main
  data:
    user: $context.current_user
  components:
    - *profile:header              # anchor из component.yaml
    - type: button
      label: Edit
      value: $action.profile.edit
```

### 6. Диалоги — [dialog.yaml](dialog.yaml)

Модальные окна. Могут принимать props и закрываться через `$dialog.close`.

```yaml
dialog:common:confirm:
  props:
    title: string
    on_confirm: $action
  components:
    - type: text
      value: props.title
    - type: button
      label: Cancel
      value: $dialog.close
    - type: button
      label: Confirm
      value: props.on_confirm
```

### 7. Действия — [action.yaml](action.yaml)

Actions обрабатывают взаимодействия: навигация, мутации данных, показ уведомлений.

```yaml
action:orders:submit:
  props:
    order_id: uuid
  data:
    order: query $entity.orders.order where id == props.order_id
  effects:
    - data.order.status = submitted
    - "$toast.success(message: Order submitted)"
    - $screen.orders.list
```

### 8. События — [event.yaml](event.yaml)

Events — асинхронные уведомления другим пользователям. Поле `to` определяет получателей.

```yaml
# Конкретному пользователю
event:orders:ready:
  props:
    user_id: uuid
  to: props.user_id
  effects:
    - "$toast.info(message: Your order is ready)"

# Группе по условию
event:rooms:updated:
  props:
    room_id: uuid
  to: query users where active_room.room_id == props.room_id
  effects:
    - "$toast.info(message: Room updated)"

# Broadcast (без to)
event:system:maintenance:
  effects:
    - "$dialog.maintenance(message: Server restart in 5 min)"
```

## Ссылки между сущностями

```
$screen.epic.name      — навигация на экран
$dialog.epic.name      — показ модалки
$action.epic.name      — вызов действия
$entity.epic.name      — ссылка на модель данных
$event.epic.name       — отправка события
$context.field         — глобальное состояние
$layout.epic.name      — шаблон layout
$external.epic.name    — внешняя система
$dialog.close          — закрыть текущий диалог
```

## Валидация

```bash
npx ts-node utils/validate-schema.ts bmfs/{project}    # валидация схемы
npx ts-node utils/check-references.ts bmfs/{project}   # проверка ссылок
```
