# Matchmaking Platform

A competitive matchmaking platform for team-based games — handling users, teams,
skill-based matchmaking, real-time lobbies/chat, and tournament brackets.

The system is a **modular NestJS monolith** with hard module boundaries that can be
extracted into independent services as scale requires. Module boundaries are
enforced from the start, so splitting a module into its own service is a deployment
change rather than a rewrite.

---

## Tech Stack

### Frontend
- **Next.js (App Router)** + **TypeScript** + **Tailwind CSS**
- **Zustand** for UI state, **React Query** for server state (caching/sync) — kept
  strictly separate; server data never lives in the global UI store.
- **socket.io-client** for real-time.
- **Optimistic UI scoped to chat only.** Match/game state stays server-authoritative
  (rendered from React Query + socket invalidation).

### Backend
- **NestJS** monorepo, TypeScript throughout.
- **Auth:** `@nestjs/jwt`, custom guards, Discord OAuth2 (authorization-code flow
  with `state` CSRF protection; tokens stored server-side).
- **Persistence:** PostgreSQL via **Prisma** (ACID — users, teams, brackets,
  matches, transactions) + **Redis** (sessions, refresh-token rotation, matchmaking
  pool).
- **Realtime:** Socket.io with the Redis adapter for horizontal scaling. JWT is
  validated on socket connection.

---

## Architecture

```
                   ┌─────────────────────────┐
   Next.js  ──────▶│  API / Web process      │
   (browser)  REST │  modules:               │
            + WS   │   auth · teams ·         │──┐
                   │   tournaments · realtime │  │  shared
                   └─────────────────────────┘  │  Prisma +
                                                 │  Redis
                   ┌─────────────────────────┐  │
                   │  Matchmaker worker       │──┘
                   │  (pool sweep / tick)     │
                   └─────────────────────────┘

        PostgreSQL (Prisma)            Redis
        users, teams, brackets,        sessions, refresh rotation,
        matches, transactions          matchmaking pool + locks
```

### Monorepo layout (Nx or Turborepo + pnpm workspaces)
```
apps/
  web/              # Next.js frontend
  api/              # NestJS API/web process (auth, teams, tournaments, realtime gateway)
  matchmaker/       # NestJS worker process (matchmaking tick)
packages/
  contracts/        # shared, versioned event payloads (e.g. match.found schema)
  types/            # shared TypeScript types (FE <-> BE)
  db/               # Prisma schema + generated client
```
Shared event contracts live in `packages/contracts` so producer and consumer can
never drift.

### Service responsibilities
| Module / service | Stack | Responsibility |
|---|---|---|
| Core API | NestJS + `@nestjs/jwt` | HTTP/CRUD, auth, business-rule validation |
| Matchmaking | NestJS + Redis (RabbitMQ when split out) | pool solver, balance, server selection |
| Realtime | NestJS + Socket.io + Redis pub/sub | WebSocket connections, chat, lobbies |
| Frontend | Next.js | client application |

Distributed tracing, structured logging, and metrics are required once modules are
split across process boundaries.

---

## Matchmaking Design

Matchmaking is a **pooling problem, not a queue-consumer problem.** A population of
waiting parties is held and periodically solved for optimal balanced groupings across
the whole pool — this cannot be expressed by processing one message at a time.

- **Redis** holds the live pool (sorted sets keyed by MMR, partitioned by region +
  queue type).
- **A periodic solver tick** sweeps the pool and forms matches on MMR proximity,
  ping, role composition, and party size.
- **Events** (join/leave inbound, `match.found`/`match.timeout` outbound) flow over a
  broker (RabbitMQ) once matchmaking runs as its own service.

### Correctness rules
- **No double-booking.** Two workers must never claim the same player into two
  matches. The matcher is a **leader/singleton per queue**, or players are claimed via
  atomic Redis ops/locks. Scale by **sharding on region + queue type**, not by adding
  generic consumers.
- **Idempotent match creation.** Broker delivery is at-least-once; match creation
  dedupes on a stable key so redelivery cannot create duplicate matches.

### Rating / balancing
Uses **Glicko-2 or TrueSkill** (rating + uncertainty), not average MMR. Balancing
considers rating distribution/variance, not just the mean.

---

## Infrastructure

### Local
- **Docker Compose** — app(s), PostgreSQL, Redis (and RabbitMQ when introduced) as
  isolated containers.

### Cloud (AWS)
- **ECS Fargate** for backend containers.
- **RDS** (PostgreSQL), **ElastiCache** (Redis), **Amazon MQ** (RabbitMQ).
- **S3** for static user content.
- WebSockets behind the load balancer use sticky sessions (or websocket-only
  transport).
