# {service-name}

> {One-line description: what this service is responsible for.}

## Tech

- Runtime: {e.g. Node.js, Python, Go}
- Framework: {e.g. Express, FastAPI, Gin}
- DB: {e.g. PostgreSQL, MongoDB, —}
- Cache: {e.g. Redis, —}
- Queue: {e.g. RabbitMQ, Kafka, —}

## Interface

### method_name(param1, param2) → result
{Synchronous operation. What this method does, in one sentence.}

## Produces

- **queue-or-event-name** — {what triggers production, payload description}

## Consumes

- **queue-or-event-name** — {what the consumer does with each message}

## Schedules

- **task-name** — {interval/trigger, what it does}

## Dependencies

- [{other-service}](other-service.md) — {why this service depends on it}
- **external:** {name} — {why}

## Data

- **model_name** — [{entity:epic:name}](../entity-file.yaml)
