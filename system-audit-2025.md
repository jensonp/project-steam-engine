# System Audit: Design Patterns, Principles, and Architecture

**Codebase**: Steam Game Recommendation Engine (Express/Node.js/TypeScript/PostgreSQL + Angular)  
**Audit Date**: March 2025  
**Focus**: Design patterns, fundamental engineering principles, systems architecture, state management — not security.

---

## 1. Architectural Overview

### 1.1 Layered Architecture

The backend follows a **layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation Layer (Routes)                                │
│  user.routes, game.routes, search.routes, recommend.routes   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Application Layer (Services / Use Cases)                    │
│  SteamService, SearchService, RecommenderService,            │
│  buildUserProfile, scoreWithUserContext                      │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Domain / Strategy Layer                                     │
│  GenreVectorStrategy, FriendOverlapStrategy,                 │
│  RecommendationScoringStrategy                              │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Infrastructure Layer (Repositories, External APIs)          │
│  PostgresGameMetadataRepository, Steam Web API, pg.Pool      │
└─────────────────────────────────────────────────────────────┘
```

**Principle**: Higher layers depend on lower layers; infrastructure does not depend on domain. Routes depend on services; services depend on strategies and repositories; strategies depend on repository interfaces.

---

## 2. Design Patterns in Use

### 2.1 Singleton Pattern

**Location**: `SteamService`, `RecommenderService`

**Mechanics**:
```typescript
let steamServiceInstance: SteamService | null = null;

export function getSteamService(): SteamService {
  if (!steamServiceInstance) {
    steamServiceInstance = new SteamService();
  }
  return steamServiceInstance;
}
```

**Purpose**: Ensure a single instance of stateful services. `SteamService` holds Axios clients and circuit breakers; `RecommenderService` holds an in-memory similarity index (~50MB). Duplicating these would waste memory and create inconsistent circuit-breaker state.

**Trade-off**: Lazy initialization defers construction to first use. The first request to a user endpoint triggers `SteamService` creation; the first request to a recommend endpoint triggers `RecommenderService` creation (which blocks the event loop during `loadData()`).

---

### 2.2 Repository Pattern

**Location**: `repositories/game.repository.ts`, `repositories/interfaces.ts`

**Interface**:
```typescript
export interface IGameMetadataRepository {
  getMetadataForApps(appIds: number[]): Promise<GameMetadata[]>;
  getFullMetadataForCandidates(appIds: number[]): Promise<GameMetadata[]>;
  searchGames(sqlQuery: string, params: any[]): Promise<GameSearchResultRow[]>;
}
```

**Implementation**: `PostgresGameMetadataRepository` encapsulates all PostgreSQL access for game metadata. It receives the shared `query` function (from `db.ts`) implicitly via module scope.

**Principle**: **Dependency Inversion** — high-level modules (strategies, services) depend on the `IGameMetadataRepository` abstraction, not on PostgreSQL. Tests can inject a `MockGameMetadataRepository` without touching the database.

**Gap**: `SearchService` and strategies instantiate `new PostgresGameMetadataRepository()` directly. There is no composition root or DI container; the concrete implementation is hardcoded at call sites. To swap implementations, every `new PostgresGameMetadataRepository()` would need to change.

---

### 2.3 Strategy Pattern

**Location**: `services/strategies/genre-vector.strategy.ts`, `friend-overlap.strategy.ts`, `scoring.strategy.ts`

**Purpose**: Extract algorithms into interchangeable, testable units. Each strategy encapsulates a single responsibility:

| Strategy | Input | Output | Responsibility |
|----------|-------|--------|----------------|
| `GenreVectorStrategy` | library, recentAppIds | `Map<string, number>` (L1-normalized) | Build user preference vector from playtime-weighted genres |
| `FriendOverlapStrategy` | friendLibraries | `Set<number>` | Compute games owned by ≥2 friends |
| `RecommendationScoringStrategy` | profile, limit | `ScoredRecommendation[]` | Score candidates using 3-signal composite (Jaccard, genre, social) |

**Dependency injection**: Strategies receive dependencies via constructor. `GenreVectorStrategy` and `RecommendationScoringStrategy` receive `IGameMetadataRepository`; `FriendOverlapStrategy` has no external deps (pure function over in-memory data).

**Principle**: **Single Responsibility** — each strategy does one thing. `buildUserProfile` orchestrates them; it does not implement the algorithms.

---

### 2.4 Circuit Breaker Pattern

**Location**: `utils/circuit-breaker.ts`, `SteamService`

**Mechanics**: Opossum wraps `executeApiRequest` and `executeStoreRequest`. When the failure rate exceeds `errorThresholdPercentage` (50%), the circuit **opens** — subsequent calls fail immediately without calling Steam. After `resetTimeout` (30s), the circuit moves to **half-open** and allows one probe request.

**Error filtering**: `isSteamSystemError` distinguishes:
- **Business errors** (401, 403, 404): Do not trip the circuit. Private profiles and not-found are expected.
- **System errors** (429, 5xx): Trip the circuit. Rate limits and server failures indicate upstream instability.

**Principle**: **Fail fast** — when an external dependency is unhealthy, stop sending requests. Avoids cascading timeouts and connection exhaustion.

---

### 2.5 Factory / Middleware Factory

**Location**: `middleware/validate.middleware.ts`

**Mechanics**:
```typescript
export const validate = (schema: ZodSchema) => {
  return async (req, res, next) => { ... };
};
```

**Purpose**: Higher-order function that produces Express middleware. Each route supplies its own schema; the factory returns a middleware instance configured for that schema. This is the **Factory Method** pattern applied to middleware.

---

## 3. State Management

### 3.1 Process-Level State

| State | Location | Lifecycle | Mutability |
|-------|----------|-----------|------------|
| `pg.Pool` | `config/db.ts` | Module load → process exit | Immutable after creation |
| `SteamService` instance | `steam.service.ts` | First `getSteamService()` call → process exit | Mutable (circuit breaker state) |
| `RecommenderService` instance | `recommender.service.ts` | First `getRecommenderService()` call → process exit | Mutable (in-memory index; `isLoaded` set once) |
| `config` object | `config.ts` | Module load | Immutable (plain object, no `Object.freeze`) |

**Principle**: **Shared mutable state** is confined to singletons. There is no global mutable variable that routes or handlers modify directly. Each request is **stateless** — no server-side session store.

---

### 3.2 Request-Scoped State

Each HTTP request flows through: `req` → validation → route handler → service → response. No request-scoped state is stored between middleware invocations. The `UserProfile` object is built per request and discarded after the response.

**Data flow**: Request params/body → Zod validation (no mutation) → service calls (async, return new data) → JSON response. No shared in-memory cache for request data.

---

### 3.3 RecommenderService State Machine

The recommender has an implicit **two-state machine**:

| State | Condition | Behavior |
|-------|-----------|----------|
| `LOADING` | Constructor running, `loadData()` in progress | `isReady()` = false; recommend routes return 503 |
| `READY` | `isLoaded` = true | Full functionality |
| (implicit `ERROR`) | `loadData()` threw; `isLoaded` = false | Same as LOADING — 503 |

**Gap**: No explicit `ERROR` state. If loading fails, the service is indistinguishable from "still loading." A third state (`FAILED`) with a distinct error message would improve observability.

---

## 4. Data Flow and Boundaries

### 4.1 Trust Boundaries (Data Integrity)

```
[External] Steam API (untrusted JSON)
     │
     ▼  [Boundary] SteamService maps snake_case → camelCase, validates structure ad-hoc
     │
[Internal] OwnedGame[], PlayerSummary, etc.

[External] PostgreSQL (trusted — we write the schema)
     │
     ▼  [Boundary] Repository returns raw rows; services map to domain types
     │
[Internal] GameMetadata, GameSearchResult
```

**Principle**: **Validate at boundaries**. External data (Steam API) is transformed at the service layer. Internal data (PostgreSQL) is trusted but still mapped from DB rows to domain types. There is no runtime schema validation (Zod) of Steam responses — TypeScript types are compile-time only.

---

### 4.2 Request Pipeline

```
HTTP Request
  → cors()
  → express.json()        [parses body into req.body]
  → rateLimit()           [in-memory counter per IP]
  → route handler
      → validate(schema)   [Zod parseAsync; rejects invalid]
      → async handler
          → getSteamService() / getRecommenderService() / new SearchService()
          → service method
          → res.json()
  → 404 or error handler
```

**Middleware order**: CORS and body parsing run first (required for all requests). Rate limit runs before routes (rejects over-limit before hitting business logic). Validation runs per-route. The 404 and error handlers are catch-alls.

---

## 5. Fundamental Engineering Principles

### 5.1 SOLID Assessment

| Principle | Adherence | Evidence |
|-----------|------------|----------|
| **Single Responsibility** | Partial | Strategies are single-purpose. `user-profile.service` is now a thin orchestrator. `SearchService` still builds SQL and maps rows — could split query builder vs. mapper. |
| **Open/Closed** | Partial | New search strategies could be added without modifying existing ones. Adding a new repository implementation requires editing call sites (no DI container). |
| **Liskov Substitution** | Good | `PostgresGameMetadataRepository` implements `IGameMetadataRepository`; any implementation can replace it. |
| **Interface Segregation** | Good | `IGameMetadataRepository` has three focused methods. `FriendOverlapStrategy` has no interface (pure, no deps). |
| **Dependency Inversion** | Partial | Strategies depend on `IGameMetadataRepository` (abstraction). But `SteamService` and `RecommenderService` are still obtained via `getSteamService()` — no interface, no injection. |

---

### 5.2 Separation of Concerns

| Concern | Location | Notes |
|---------|----------|-------|
| HTTP/transport | Routes, Express | Params, query, body extraction; status codes |
| Validation | `validate.middleware.ts`, Zod schemas | Request shape validation |
| Business logic | Services, strategies | Profile building, scoring, search |
| Data access | Repositories | SQL, parameterization |
| External integration | `SteamService` | Steam API, circuit breaker |
| Configuration | `config.ts` | Env loading, defaults |

**Gap**: SQL query construction lives in `SearchService` (dynamic WHERE clause) and is passed to `repo.searchGames(sqlQuery, params)`. The repository accepts raw SQL — it does not own the query shape. A stricter separation would have the repository expose `searchByFilters(filters)` and build SQL internally.

---

### 5.3 Immutability and Side Effects

- **Config**: Loaded once, never mutated.
- **Request/response**: Express `req`/`res` are mutable by design; handlers do not mutate shared state.
- **Strategies**: `GenreVectorStrategy.buildVector` returns a new `Map`; does not mutate inputs. `FriendOverlapStrategy.buildOverlapSet` returns a new `Set`.
- **RecommenderService**: `similarityIndex`, `gameVectors` are populated at load and never mutated during request handling.
- **SteamService**: Circuit breaker state (open/half-open/closed) is mutated by Opossum internally — acceptable for resilience.

---

## 6. Concurrency Model

### 6.1 Node.js Event Loop

The server is **single-threaded**. All request handling runs on the same event loop. Blocking the loop (e.g., `fs.readFileSync` in RecommenderService constructor) stalls all requests.

**Async patterns**:
- `Promise.allSettled` in `buildUserProfile` Phase 1 — parallel Steam API calls; one failure does not abort others.
- `Promise.allSettled` in `getMultipleOwnedGames` — parallel friend library fetches.
- `await` in routes — Express 4 does not auto-catch rejections; each handler uses try/catch.

---

### 6.2 Connection Pooling

`pg.Pool` manages a fixed set of connections (default max 10). Each `pool.query()` borrows a connection, executes, and returns it. Under concurrent load, requests queue when all connections are busy. No connection is held across multiple queries in a single request — each repository call is independent.

---

### 6.3 Circuit Breaker Concurrency

Opossum's circuit breaker is **thread-safe** (in the Node.js sense — single-threaded with async concurrency). Multiple concurrent requests can trip the circuit; once open, all fail fast. No race condition on state transitions.

---

## 7. Domain Model

### 7.1 Entity Types

| Type | Role | Invariants |
|------|------|------------|
| `OwnedGame` | Value object | None enforced (playtime could be negative) |
| `UserLibrary` | Aggregate of OwnedGame | None |
| `UserProfile` | Rich aggregate | Contains `genreVector` (L1-normalized), `friendOverlapSet`, `ownedAppIds` |
| `ScoredRecommendation` | DTO for API response | None |
| `Game` | Value object from Steam Store | None |

**Principle**: **Anemic domain model** — types are data bags. Business rules (e.g., "playtime must be non-negative") are not enforced in constructors. Validation is at the boundary (Zod for requests) and ad-hoc in services.

---

### 7.2 Recommendation Scoring Formula

The scoring engine implements a **weighted linear combination**:

```
score(c) = 0.50 × jaccardScore(c) + 0.30 × genreAlignment(c) + 0.20 × socialScore(c)
```

- **Jaccard**: Pre-computed similarity from the offline index (content overlap).
- **Genre alignment**: Dot product of candidate's genre set with user's L1-normalized preference vector.
- **Social**: Binary — 1 if ≥2 friends own the game, else 0.

**Principle**: **Composition over inheritance** — the final score is a sum of independent signals. Weights are constants; could be made configurable for A/B testing.

---

## 8. Infrastructure and Systems

### 8.1 Data Sources

| Source | Access Pattern | Caching |
|--------|----------------|---------|
| Steam Web API | Axios, circuit breaker | None |
| Steam Store API | Axios, circuit breaker | None |
| PostgreSQL | pg.Pool, parameterized queries | None (connection pool only) |
| File system | `fs.readFileSync` (RecommenderService) | Loaded once at startup into memory |

---

### 8.2 Search Implementation

`SearchService` uses:
- **pg_trgm** (`%%` operator): Trigram similarity for genre/tag/category matching. Supports indexed lookups when `gist`/`gin` indexes exist on the columns.
- **Full-text search**: `search_vector @@ plainto_tsquery('english', $1)` for keyword. Requires a `tsvector` column (e.g., `to_tsvector('english', game_name || ' ' || short_description)`).
- **Ranking**: `ts_rank_cd(search_vector, query)` for relevance when keyword is present.

**Principle**: **Use the right tool** — ILIKE would force sequential scans; full-text and trigram leverage PostgreSQL's indexing.

---

### 8.3 Memory Bounds (RecommenderService)

`getRecommendationsForLibrary` includes explicit bounds:
- **Top 100 games**: `ownedGames` is sorted by playtime and sliced to 100 before aggregation. Prevents OOM for users with thousands of games.
- **Source strings capped at 3**: `sources` array is limited to 3 items to avoid large string allocations in `reason`.

**Principle**: **Defensive programming** — cap inputs to prevent unbounded growth.

---

## 9. Lifecycle and Initialization

### 9.1 Startup Sequence

1. Load `config` (dotenv, parse env).
2. Import routes (which import services).
3. Create Express app, register middleware.
4. Mount routes.
5. `app.listen(PORT)`.

**Gap**: No explicit "ready" gate. The first request to `/api/recommend/*` triggers RecommenderService construction, which blocks. Health check (`/api/health`) does not verify recommender readiness.

---

### 9.2 Shutdown

No `process.on('SIGTERM'|'SIGINT')` handler. On kill, the process exits immediately. The pg.Pool is not closed; connections are dropped. For graceful shutdown: register handlers, call `pool.end()`, stop accepting new requests.

---

## 10. Summary: Strengths and Gaps

### Strengths

| Area | Implementation |
|------|----------------|
| Repository pattern | `IGameMetadataRepository` abstracts DB; `PostgresGameMetadataRepository` implements it. |
| Strategy pattern | Genre, friend overlap, and scoring are isolated, testable strategies. |
| Circuit breaker | Steam API calls are wrapped; 429/5xx trip the circuit; 4xx do not. |
| Parallel I/O | `Promise.allSettled` for Steam and friend fetches. |
| Memory bounds | Top 100 games, 3 source strings in recommendations. |
| Search | Full-text and trigram for efficient querying. |

### Gaps

| Area | Gap | Suggested Direction |
|------|-----|---------------------|
| Dependency injection | Services instantiate repositories and strategies directly. | Introduce a composition root; inject interfaces via constructor. |
| RecommenderService init | Sync load blocks event loop; no explicit READY/FAILED state. | Async load; expose `whenReady()` Promise; add FAILED state. |
| Domain invariants | Types are anemic; no validation in constructors. | Add domain entities with invariant checks; use factories for construction. |
| SearchService | Builds SQL internally; repository accepts raw SQL. | Move query construction into repository or a dedicated query builder. |
| Graceful shutdown | No signal handlers. | Register SIGTERM/SIGINT; close pool; stop server. |
| Composition root | No single place that wires dependencies. | Create `composition.ts` or use a lightweight DI container. |

---

## 11. Resume Driven Development Plan

*Prioritize technologies and features that signal "senior engineer" to recruiters and hiring managers — regardless of whether they solve actual problems.*

### Phase 1: Infrastructure Buzzwords

| Initiative | Resume Value | Effort | Actual Need |
|------------|--------------|--------|-------------|
| **Docker + docker-compose** | "Containerized microservices" | Low | Dev parity; easier onboarding |
| **Kubernetes manifests** | "Orchestrated at scale" | Medium | Overkill for single-node; good for interviews |
| **Redis caching layer** | "Distributed caching" | Medium | `ioredis` already in package.json (unused); Steam API responses could be cached |
| **Prometheus + Grafana** | "Observability stack" | Medium | No metrics today; useful for production |
| **OpenTelemetry tracing** | "Distributed tracing" | Medium | Request flow visibility; hot topic in 2025 |

### Phase 2: Architecture Upgrades

| Initiative | Resume Value | Effort | Actual Need |
|------------|--------------|--------|-------------|
| **GraphQL API** | "GraphQL / Apollo" | High | REST is fine; GraphQL shines for flexible client queries |
| **Event-driven: Kafka / RabbitMQ** | "Message queues" | High | No async workflows; would need "recommendation job queue" use case |
| **Split into microservices** | "Microservices architecture" | Very High | Monolith is appropriate for current scale |
| **gRPC for internal calls** | "gRPC / protobuf" | Medium | Overkill; HTTP + JSON is sufficient |
| **CQRS for recommendations** | "CQRS / Event Sourcing" | High | Read-heavy; write model is trivial |

### Phase 3: Data & ML Credibility

| Initiative | Resume Value | Effort | Actual Need |
|------------|--------------|--------|-------------|
| **Vector DB (Pinecone / pgvector)** | "Vector embeddings" | Medium | Similarity index is in-memory; pgvector could persist + scale |
| **ML pipeline (MLflow / Kubeflow)** | "MLOps" | High | Offline recommender scripts; formalizing would help reproducibility |
| **A/B testing framework** | "Experimentation" | Medium | Would enable weight tuning; good product story |
| **Feature store** | "Feature engineering" | High | Overkill; features are computed on-the-fly |

### Phase 4: Frontend & DX

| Initiative | Resume Value | Effort | Actual Need |
|------------|--------------|--------|-------------|
| **Storybook** | "Component library" | Low | Reusable UI docs; good for design system |
| **E2E with Playwright** | "End-to-end testing" | Medium | No E2E today; catches integration bugs |
| **PWA / offline support** | "Progressive Web App" | Medium | Niche for game discovery; impressive nonetheless |
| **WebSocket real-time updates** | "Real-time systems" | Medium | No live data; could fake with "recommendations refresh" |

### Phase 5: The "I've Shipped It" Line Items

| Initiative | Resume Value | Effort | Actual Need |
|------------|--------------|--------|-------------|
| **CI/CD (GitHub Actions)** | "CI/CD pipelines" | Low | Linting, tests, deploy; baseline expectation |
| **Terraform / Pulumi** | "Infrastructure as Code" | Medium | If deploying to cloud; IaC is standard |
| **ADR (Architecture Decision Records)** | "Documented decisions" | Low | Explains *why*; useful for onboarding |
| **API versioning (/v1/)** | "Versioned APIs" | Low | Future-proofing; minor refactor |

### Suggested Order (Max Resume ROI / Min Effort)

1. **Docker + docker-compose** — One Dockerfile, one compose file. "Containerized" in one PR.
2. **Redis caching** — Wire up existing `ioredis`; cache Steam API responses by steamId. "Distributed caching" ✓
3. **CI/CD (GitHub Actions)** — Lint, test, optional deploy. Table stakes.
4. **Prometheus metrics** — `express-prometheus-middleware` or similar. "Observability" ✓
5. **ADR for key decisions** — Markdown files in `/docs/adr/`. "Documented architecture" ✓

*Use responsibly. The best resume line is still "shipped a feature users love."*
