# BMF — Behaviour Modeling Framework

Структурированный YAML-формат для формализации ТЗ приложения.

BMF описывает **что** делает система, а не **как** — через минимальный набор сущностей и связи между ними. Результат: декларативная спецификация, которую можно визуализировать и валидировать.

## Команды Claude Code

### BMF-команды

Рабочий процесс: `create` → `create-epics` → `create-tcs` → `create-prd` / `yaml2prdmd` → `refine` / `refine-prd` → `estimation` → `estimation-client`

#### `/bmf.create {name} [source]`

Создание нового BMF-проекта из шаблона, опционально с наполнением из источника.

```bash
/bmf.create myapp
/bmf.create myapp "Описание приложения"
/bmf.create myapp path/to/requirements.pdf
```

- Копирует `bmfs/template/` в `bmfs/works/{name}/`
- Если указан источник (текст, файл, URL) — анализирует требования и наполняет все файлы сущностей
- Запускает валидацию схемы и проверку ссылок после генерации
- Генерирует `README.md` проекта с инвентарём сущностей

#### `/bmf.create-epics {folder} [lang]`

Генерация `_epics.yaml` на основе анализа YAML-структуры проекта.

```bash
/bmf.create-epics bmfs/works/myproject
/bmf.create-epics bmfs/works/myproject ru
```

- Группирует сущности по доменам, генерирует описания эпиков (что + зачем)
- ID эпиков строго двухсегментные: `epic:domain`
- Запускает `validate-tcs-epics.ts` после генерации

#### `/bmf.create-tcs {folder} [lang]`

Генерация тест-кейсов (`_test-cases.yaml`) и разметка сущностей тегами `tc:*`.

```bash
/bmf.create-tcs bmfs/works/myproject
```

- Требует `_epics.yaml` (сначала запустите `/bmf.create-epics`)
- Очищает существующие `tc:*` теги, генерирует happy path / edge case / альтернативные сценарии
- Размечает сущности маркерами `:start`, промежуточными и `:end`
- Проверяет покрытие пока все обязательные сущности не покрыты

#### `/bmf.create-prd {source} [output] [lang]`

Генерация PRD (`prd.md`) из любого входного документа — структурирует в **Epic → Feature → User Story**.

```bash
/bmf.create-prd path/to/requirements.md
/bmf.create-prd bmfs/works/myproject
/bmf.create-prd "Описание продукта"
```

- Принимает любой вход: файл, URL, текст или папку BMF-проекта
- Не требует предварительных шагов — работает автономно без BMF YAML пайплайна
- Исчерпывающий анализ источника, структурирование в Epic → Feature → User Story
- Использует `bmfs/prd-template.md` как структурный шаблон
- 3-проходная верификация против источника для предотвращения потери информации

#### `/bmf.yaml2prdmd {folder} [lang]`

Генерация PRD (`prd.md`) с плоской структурой **Epic → User Story**.

```bash
/bmf.yaml2prdmd bmfs/works/myproject
```

- Требует `_epics.yaml` + `_test-cases.yaml`
- Эпики становятся секциями фич, TC — нумерованными user stories (US-N)
- Включает ключевые объекты, навигацию, уведомления и доменные секции
- Без BMF entity ID в выводе

#### `/bmf.refine {folder} [lang]`

Глубокий семантический анализ BMF-спецификации.

```bash
/bmf.refine bmfs/works/myproject
```

- Проверки: целостность модели данных, действия и эффекты, контекст и поток данных, покрытие эпиков/TC, неоднозначности, конфликты, кросс-ссылки кастомных сущностей, полнота CRUD
- Адаптирует глубину анализа по состоянию проекта (core / core+epics / full)
- Отчёт сгруппирован по эпикам с уровнями серьёзности (CRITICAL / WARNING / INFO)
- **Только отчёт** — никогда не модифицирует YAML-файлы

#### `/bmf.refine-prd {folder} [lang]`

Глубокий анализ качества сгенерированного PRD.

```bash
/bmf.refine-prd bmfs/works/myproject
```

- Кросс-проверка PRD против исходного YAML (эпики, TC, сущности)
- Проверки: утёкшие внутренности, покрытие эпиков/фич, покрытие TC/user stories, консистентность ролей, структурное качество, качество контента
- Сводная таблица покрытия с пробелами
- **Только отчёт** — никогда не модифицирует `prd.md`

#### `/bmf.estimation {folder} [lang]`

Генерация CSV-оценки с анализом реализации.

```bash
/bmf.estimation bmfs/works/myproject
```

- Требует `_epics.yaml` + `_test-cases.yaml`
- Фаза 1: скелет CSV (phase, epic, feature, test_case)
- Фаза 2: глубокий анализ по TC — трассировка сущностей, детальные описания реализации и оценки в часах
- UTF-8 с BOM для совместимости с Excel

#### `/bmf.estimation-client {folder} {hour_price} [currency]`

Генерация клиентской CSV-оценки со стоимостью.

```bash
/bmf.estimation-client bmfs/works/myproject 5000
/bmf.estimation-client bmfs/works/myproject 5000 €
```

- Требует `estimation.csv` (сначала запустите `/bmf.estimation`)
- Заменяет ID на читаемые названия, технические описания на функциональные
- Пересчитывает часы в стоимость (часы × ставка)

#### `/bmf.prd2estimation {folder} [lang]`

Генерация CSV-оценки из существующего PRD.

```bash
/bmf.prd2estimation bmfs/works/myproject
```

- Сохраняет редакторскую структуру PRD: Epic → Feature → User Story
- YAML-файлы используются для глубокого анализа реализации, а не для структуры
- Используйте когда PRD уже определяет группировку фич для оценки

#### `/bmf.frontend-mock {folder} [output]`

Генерация кликабельного фронтенд-мока (Vite + React + shadcn/ui) из BMF YAML.

```bash
/bmf.frontend-mock bmfs/works/myproject
/bmf.frontend-mock bmfs/works/myproject ./my-mock
```

- Рендерит все экраны, лейауты, диалоги как работающее React-приложение
- Навигация между экранами через эффекты действий (`$screen.*`)
- Диалоги открываются/закрываются через ссылки `$dialog.*`
- Мок-данные генерируются из определений сущностей
- Запуск: `cd mock && npm install && npm run dev`

#### `/bmf.comments {project}`

Ревью и разрешение комментариев в BMF-спецификации.

```bash
/bmf.comments marketplace
```

- Проверяет каждый нерешённый комментарий против спецификации
- **Разрешает по умолчанию**, если спецификация ясна
- Оставляет открытыми только комментарии, требующие уточнения

## Концепция

Любое приложение можно описать через три базовых примитива:

- **Entity** — данные (пользователь, заказ, сообщение)
- **Action** — действие с побочными эффектами (создать заказ, перейти на экран)
- **Event** — асинхронное событие в системе (push-уведомление, real-time обновление)

Остальные сущности — обвязка для UI и структуры:

- **Screen** — экран с layout, данными и компонентами
- **Dialog** — модальное окно поверх экрана
- **Layout** — каркас страницы (навигация, структура)
- **Component** — переиспользуемый UI-блок (YAML anchor)
- **Context** — глобальное состояние сессии

Каждая сущность — YAML-запись с ID формата `type:epic:name` (например `screen:auth:login`, `action:cart:checkout`).

Сущности ссылаются друг на друга через `$`-нотацию:

```
$screen.auth.login      — навигация на экран
$action.cart.checkout    — вызов действия
$entity.users.user      — ссылка на модель данных
$event.orders.ready      — отправка события
$dialog.common.confirm   — показ модалки
$context.current_user    — глобальное состояние
```

Это позволяет строить граф связей и визуализировать всё приложение целиком.

Подробнее о каждой сущности с примерами: [bmfs/template/README.md](bmfs/template/README.md)

## Быстрый старт

1. Скопируйте `bmfs/template/` с именем нового проекта
2. Начните с `main.yaml` — опишите проект и типы сущностей
3. Определите модели данных в `entity.yaml`
4. Создайте экраны в `screen.yaml`
5. Добавьте действия в `action.yaml`

## Структура проекта

```
bmf/
├── bmfs/             # BMF-спецификации
│   ├── template/     # Шаблон с примерами для нового проекта
│   ├── {project}/    # Спецификация конкретного приложения
│   │   ├── main.yaml        # Метаданные, описание типов сущностей
│   │   ├── screen.yaml      # Экраны
│   │   ├── action.yaml      # Действия
│   │   ├── entity.yaml      # Модели данных
│   │   ├── event.yaml       # События
│   │   ├── dialog.yaml      # Диалоги
│   │   ├── context.yaml     # Глобальный контекст
│   │   ├── layout.yaml      # Шаблоны layout
│   │   ├── component.yaml   # Переиспользуемые компоненты
│   │   ├── _epics.yaml      # Эпики (бизнес-цели)
│   │   ├── _test-cases.yaml # Тест-кейсы
│   │   └── _comments.yaml   # Комментарии к ревью
│   └── links/        # Симлинки на внешние проекты
├── viewer/           # BMF Viewer (визуализатор)
├── utils/            # Утилиты валидации
└── .claude/commands/ # Claude Code slash-команды
```

## Viewer (визуализатор)

### Режим разработки

```bash
cd viewer
npm install
npm run dev
```

Откройте http://localhost:5173 в браузере.

### Продакшн-сборка

```bash
cd viewer
npm run build
npm run preview
```

### Использование

1. Нажмите **«Open Spec Folder»** для выбора папки BMF-проекта
2. Viewer загрузит все `.yaml` файлы и отобразит граф навигации
3. Кликните на узел для просмотра деталей сущности
4. Нажмите **C** для добавления/редактирования комментариев к выбранным сущностям
5. Комментарии автоматически сохраняются в `_comments.yaml` в папке проекта

## Система комментариев

Комментарии хранятся в `_comments.yaml` внутри папки каждого проекта:

```yaml
# BMF Comments
# Generated by BMF Viewer

entity:users:user:
  text: "Нужно добавить валидацию email"
  createdAt: 1704067200000
  resolved: false

screen:home:main:
  text: "Отсутствует состояние загрузки"
  createdAt: 1704067200000
  resolved: true
  resolution: "Добавлен компонент загрузки"
  questions:
    - question: "Показывать спиннер или скелетон?"
      answer: "Использовать скелетон для лучшего UX"
```

### Поля комментариев

| Поле | Тип | Описание |
|------|-----|----------|
| `text` | string | Текст комментария |
| `createdAt` | number | Unix timestamp (миллисекунды) |
| `resolved` | boolean | Разрешён ли комментарий |
| `resolution` | string | Заметки о разрешении (опционально) |
| `questions` | array | Тред обсуждения (вопрос-ответ) |

## Утилиты

Консольные утилиты для управления BMF. Запускаются через `npx ts-node`.

### `validate-schema.ts`

Валидация BMF-файлов против JSON-схемы.

```bash
npx ts-node utils/validate-schema.ts bmfs/{project}
```

### `check-references.ts`

Проверка битых ссылок между сущностями.

```bash
npx ts-node utils/check-references.ts bmfs/{project}
```

### `check-tcs.ts`

Проверка покрытия тест-кейсами. Показывает какие сущности покрыты тегами `tc:*`, а какие нет.

```bash
npx ts-node utils/check-tcs.ts bmfs/{project}
```

**Вывод:**

- Сводка определённых тест-кейсов
- Покрытие по типам сущностей (screen, dialog, action, event)
- Список непокрытых обязательных сущностей (нужно исправить)
- Список осиротевших `tc:*` тегов (ссылающихся на несуществующие тест-кейсы)

### `delete-tc-tags.ts`

Удаление всех `tc:*` тегов из файлов сущностей. Полезно для перегенерации покрытия с нуля.

```bash
npx ts-node utils/delete-tc-tags.ts bmfs/{project}
```

### `tag-entities.ts`

Применение предопределённых тегов тест-кейсов к сущностям. Содержит захардкоженные маппинги ID тест-кейсов к тегам сущностей.

```bash
npx ts-node utils/tag-entities.ts bmfs/{project}
```

## Разработка

### Стек Viewer

- React 18
- TypeScript
- Zustand (управление состоянием)
- XY Flow (визуализация графов)
- Vite (сборка)

### Запуск тестов

```bash
cd viewer
npm test
npm run test:e2e
```
