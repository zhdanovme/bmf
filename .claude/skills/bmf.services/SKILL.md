---
description: Generate service architecture (services/*.md) by analyzing BMF project sources — YAMLs, PRD, or original requirements.
---

## User Input

```text
$ARGUMENTS
```

## Overview

Identify backend services from project sources and generate a `services/{name}.md` file per service. Each file describes the service as a **runtime component** — not just a static interface, but a living part of the system with sync API, async commands (produces/consumes), and scheduled tasks.

The command must infer the **runtime architecture** from the spec: what's synchronous, what's event-driven, what flows through queues, what runs on a schedule. The output should read as a preliminary architecture document.

## Execution

### 1. Parse Arguments

Extract from `$ARGUMENTS`:
- `folder` (required) — path to BMF project folder (e.g., `bmfs/works/myproject`)
- `lang` — language for descriptions (default: auto-detect from `main.yaml` or source content)

If folder is empty, list available projects in `bmfs/` and ask user to specify.

### 2. Read Available Sources

Scan `{folder}/` and collect **all available** sources. The more sources — the better the analysis.

**A. YAML files (always present):**
- `{folder}/main.yaml` — project metadata, roles, entity type descriptions
- `{folder}/*.yaml` — all entity definitions (screens, actions, entities, events, externals, etc.)
- `{folder}/_epics.yaml` — epics if they exist
- `{folder}/_test-cases.yaml` — test cases if they exist

**B. PRD (optional):**
- `{folder}/prd.md`

**C. Original requirements (optional):**
- `{folder}/original.md`, `{folder}/original.txt`, or any `.docx`/`.pdf` in `{folder}/`

Report what was found:
```
Sources found in {folder}:
  - YAML files: {N} files
  - PRD: {yes/no}
  - Original requirements: {yes/no} ({filename})
```

### 3. Analyze Runtime Architecture

This is the critical step. Read all sources and reconstruct how the system works **at runtime** — not just what data exists, but how it flows.

**Step A: Inventory extraction.**

From the sources, extract:

1. **Entities** — all `entity:*` definitions. Group by domain prefix.
2. **Actions** — all `action:*` definitions. Their effects reveal operations and data flow.
3. **Events** — all `event:*` definitions. They reveal async communication.
4. **Externals** — all `external:*` definitions or integrations listed in `main.yaml`.
5. **Screens** — all `screen:*` definitions. They show read patterns and user-initiated operations.
6. **Settings/config** — any `entity:*:settings` or config-like entities with intervals, schedules, rules.

**Step B: Classify interaction patterns.**

For every action and event, determine its runtime nature:

1. **Scheduled / periodic** — look for signals:
   - Settings with `interval`, `schedule`, `cron`, `frequency` fields
   - Actions that process batches of entities (iterate over positions, check rules)
   - Descriptions mentioning "periodic", "by schedule", "auto", "background"
   - Any action that doesn't have a screen trigger (no screen button points to it)

2. **Queue / async pipeline** — look for signals:
   - Action A creates an entity → Action B processes that entity later (producer/consumer)
   - Action chains where one step produces work items for another step
   - Events that trigger actions in other domains
   - Long-running operations (parsing, AI calls, external API calls)
   - Descriptions mentioning "pipeline", "background", "async", "queue"

3. **Event-driven** — look for signals:
   - `event:*` definitions with `to:` and `effects:`
   - Actions triggered by events (event effects chain to actions)
   - Cross-domain notifications

4. **Synchronous / request-response** — what's left:
   - CRUD operations triggered directly by screen buttons
   - Form submissions
   - Data queries for screen rendering
   - Settings updates

**Step C: Trace data flow pipelines.**

Follow entity lifecycle from creation to final state. For each major entity type, trace:

```
entity created by [action/event] →
  processed by [action/consumer] →
    triggers [event/queue message] →
      consumed by [action/consumer] →
        final state / side effect
```

These pipelines reveal the real architecture. Each stage in a pipeline may be a different service or a queue boundary.

**Step D: Identify service boundaries.**

Apply these heuristics:

1. **Entity ownership** — entities with shared domain prefix that are mutually referenced belong to one service.
2. **Pipeline stages** — each distinct processing stage in a pipeline is a candidate for a separate service/worker.
3. **Async boundaries** — where the spec implies a queue or event between two operations, that's a service boundary.
4. **Cohesion over splitting** — don't create a service for every entity. Group related entities if they share lifecycle.
5. **External integration** — external system calls often warrant isolation (separate worker/consumer).

**Step E: For each identified service, determine:**

- **Name** — short, lowercase, hyphenated
- **Responsibility** — one sentence
- **Interface** — sync methods (CRUD, queries, user-initiated operations)
- **Produces** — what queues/events this service publishes to, and what triggers production
- **Consumes** — what queues/events this service listens to, and what it does with each message
- **Schedules** — what periodic tasks this service runs (with interval source from settings)
- **Data** — which entities this service owns
- **Dependencies** — sync dependencies on other services + external systems

### 4. Present Service Map

Before generating files, show the proposed architecture:

```
Proposed services ({N}):

  {service-name} [{type: api | worker | scheduler | hybrid}]
    Responsibility: {one line}
    Sync: {N} methods
    Produces: {queue/event names}
    Consumes: {queue/event names}
    Schedules: {task names}
    Data: {entity:* IDs}

  ...

Data flow:
  {entity} pipeline:
    [trigger] → service-a (produces → queue-x) → service-b (consumes queue-x, produces → queue-y) → service-c

  ...

Dependency graph:
  service-a → service-b (sync), service-c (via queue-x)
  ...
```

Ask the user to confirm, adjust, or merge/split services before proceeding.

### 5. Read Service Template

Read `bmfs/service-template.md` — use it as the structural blueprint for each service file.

### 6. Generate Service Files

Create `{folder}/services/` directory if it doesn't exist.

For each confirmed service, generate `{folder}/services/{name}.md` following the template structure:

**Header:**
```markdown
# {name}

> {Responsibility — one sentence.}
```

**Tech section:**
- Fill in what can be inferred from the spec
- Use `TBD` for anything not inferrable — don't guess

**Interface section** — sync operations only:
- One `###` entry per method
- Method signature: `method_name(param1, param2) → result`
- Derived from `action:*` that are triggered by screen buttons (user-initiated)
- Include query/read methods inferred from `screen:*` data bindings
- Order: writes first, then reads

**Produces section** — async output:

- What queues or events this service publishes
- What triggers production (user action? schedule? consumed message?)
- Brief payload description
- Example: `**parse-tasks** — scheduled by parsing intervals; payload: position_id, platforms, search queries`

**Consumes section** — async input:

- What queues or events this service listens to
- What the consumer does with each message (the processing logic)
- What it produces as a result (next queue, state change, side effect)
- Example: `**parse-tasks** — fetches listings from marketplace via Bright Data, stores results, produces → verification-tasks`

**Schedules section** — periodic tasks:

- Task name, interval source (reference to settings field), what it does
- Example: `**run-parsing** — interval from entity:system:settings.parsing_intervals per platform; creates parse-tasks for each active position`

**Dependencies section:**

- Link to other service `.md` files for sync dependencies
- External systems as: `**external:** {name} — {why}`
- Distinguish sync vs async deps where relevant

**Data section:**
- Link to YAML files containing the entities
- Use relative paths: `[entity:epic:name](../entity-file.yaml)`

### 7. Generate README.md

Generate `{folder}/services/README.md` — an architectural overview of the whole system. This is the entry point for anyone looking at the services directory.

Structure:

```markdown
# Архитектура сервисов

> {One-line project description from main.yaml}

## Сервисы

{Table: service name (linked), type (api/worker/scheduler), one-line description}

## Data Flow

{For each major pipeline identified in Step 3C, draw an ASCII diagram showing:
 trigger → queue → service → queue → service → ... → final effect
 Use indentation and tree branches (├─ └─) for conditional paths}

## Очереди

{Table: queue name, producer(s), consumer(s)}

## External Dependencies

{Table: system name, used by which service(s), purpose}

## Entity Ownership

{Table: service name, list of owned entities}
```

The README should tell the full story of how the system works at runtime. A new developer reading only this file should understand the architecture.

### 8. Cross-Validation

After generating all files, verify:

1. **Every `entity:*` is owned by exactly one service** — no orphans, no shared ownership
2. **Every `action:*` maps to a service method, producer, consumer, or scheduled task** — no unaccounted actions
3. **Every `event:*` appears as a produces/consumes entry** — no orphan events
4. **Queue/event names are consistent** — every produced queue has a consumer, every consumed queue has a producer
5. **Dependency links are valid** — every `[service](service.md)` reference points to a generated file
6. **No circular sync dependencies** — circular async deps (via queues) are fine, circular sync deps are a warning

Report any issues found.

### 9. Review Cycle

After cross-validation, perform a **review pass** to ensure nothing was missed. Re-read all source YAMLs and compare against the generated services.

**Pass 1: Entity coverage.**

Re-read `entity.yaml`. For each `entity:*` definition:

- Confirm it appears in exactly one service's Data section
- Confirm the YAML file link is correct

**Pass 2: Action coverage.**

Re-read `action.yaml`. For each `action:*` definition:

- Confirm it maps to a sync method, produces entry, consumes entry, or scheduled task
- If an action is not accounted for — add it to the appropriate service or flag as a gap

**Pass 3: Event coverage.**

Re-read `event.yaml`. For each `event:*` definition:

- Confirm it appears as a produces entry in one service and triggers a consumes entry in another
- Verify the queue/event name is consistent between producer and consumer

**Pass 4: Screen-to-API coverage.**

Re-read `screen.yaml`. For each screen:

- Every button with `$action.*` must map to a sync API method or a produces entry
- Every `data:` query must be served by some service's Interface (get/list methods)
- If a screen's data source has no corresponding read method — add it

**Pass 5: README completeness.**

Re-read `services/README.md`:

- Every service from the services directory is listed in the table
- Every queue mentioned in service files appears in the Очереди table
- Every external dependency mentioned in service files appears in External Dependencies
- Data flow diagrams cover all major pipelines

**After all passes:**

- Fix any gaps found (update service files and README)
- Report corrections made:

```
Review complete ({N} passes).

Corrections:
  - {what was missing and where it was added}
  ...

Final: {N} services, {N} entities, {N} actions, {N} events — all covered.
```

### 10. Report Summary

```
Services generated in {folder}/services/:

  Files created:
    - services/{name}.md [type] ({N} sync, {N} produces, {N} consumes, {N} schedules, {N} entities)
    - ...

  Total: {N} services, {N} sync methods, {N} async channels, {N} entities mapped

  Architecture overview:
    Sync API: {service names}
    Workers/consumers: {service names}
    Schedulers: {service names}

  Data flow pipelines:
    {entity}: [trigger] → svc-a → queue → svc-b → queue → svc-c
    ...

  Dependency graph:
    {sync and async dependencies}

  Warnings:
    - {any validation issues from step 7}
```

## Behavior Rules

- Never overwrite existing `services/*.md` files without confirmation
- If `services/` directory already has files, show diff of what will change and ask before proceeding
- Service names must be lowercase, hyphenated, concise
- Interface methods are abstract — no HTTP verbs, no REST paths, no request/response bodies
- Method parameters use meaningful names without types
- **Produces/Consumes/Schedules must be inferred from spec signals, not invented** — every async pattern must be justified by evidence in the YAML (intervals in settings, event chains, pipeline patterns)
- Data section must link to actual YAML files — don't reference files that don't exist
- Dependencies between services must be justified by actual data/action references in the spec
- Tech stack fields should be `TBD` rather than guessed — only fill what's clearly implied by the spec
- Use the same language as the project for descriptions
- The service template (`bmfs/service-template.md`) defines the structure — follow it precisely
- Present the service map (step 4) and get user confirmation before generating files
- Omit empty sections — if a service has no Schedules, don't include an empty `## Schedules` heading
