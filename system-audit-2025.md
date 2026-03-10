# System Audit: Design Patterns, Principles, and Architecture

**Codebase**: Steam Game Recommendation Engine (Express/Node.js/TypeScript/PostgreSQL + Angular)  
**Audit Date**: March 2025  
**Focus**: Design patterns, fundamental engineering principles, systems architecture, state management — not security.

---

## Technology Stack Summary

**Backend**: Node.js (v22+ recommended), Express 4.x, TypeScript 5.x. Key dependencies include Axios for HTTP, `pg` for PostgreSQL, Zod for validation, Opossum for circuit breaking, and `express-rate-limit` for rate limiting. `ioredis` is in package.json but unused.

**Frontend**: Angular 21.x with Angular Material and CDK. RxJS for reactive flows. Jest (not Karma) for unit tests.

**Data**: PostgreSQL with `pg_trgm` (trigram) and full-text search (`tsvector`). Steam Web API and Steam Store API for live data. Pre-computed JSON files (similarity index, vectors, IDF) for the recommender, produced by offline scripts.

**Tooling**: Jest for backend and frontend tests, ESLint for linting, ts-node-dev for hot reload. Data pipeline scripts: `data:process`, `data:build-recommender`, `data:pipeline`.

---

## Prerequisites & Quick Start

**Prerequisites**: Node.js v22+, PostgreSQL running locally, a Steam Web API key from [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey).

**Environment variables**: Copy `backend/src/.env.example` to `backend/src/.env` (or root `.env`). Required keys: `STEAM_API_KEY`, `PORT` (default 3000), `PGHOST`, `PGDATABASE` (default `steam_collab`), `PGUSER`, `PGPASSWORD`, `PGPORT` (default 5432; adjust if PostgreSQL uses a non-standard port).

**Database**: Create the `steam_collab` database and ensure the `games` table exists. The schema is created by the data pipeline.

**Data pipeline** (required for recommendations): (1) Place `steam.csv` (e.g., from Kaggle) in `data/raw/`. (2) Run `npm run data:process` (from `backend/`) to populate the games table and processed CSVs. (3) Run `npm run data:build-recommender` to generate `data/processed/recommender/similarity-index.json`, `vectors.json`, and `idf.json`. Without these files, recommend endpoints return 503.

**Run backend**: `cd backend && npm install && npm run dev`. Server listens on `http://localhost:3000`.

**Run frontend**: `cd frontend && npm install && npm start`. Angular dev server typically runs on `http://localhost:4200`.

**Full stack**: `cd backend && npm run dev:full` starts both backend and frontend.

---

## File Structure Map

```
cs125/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Entry point, middleware, routes
│   │   ├── config.ts             # Env loading
│   │   ├── config/
│   │   │   └── db.ts             # pg.Pool, query helper
│   │   ├── routes/               # Express routers
│   │   │   ├── user.routes.ts
│   │   │   ├── game.routes.ts
│   │   │   ├── search.routes.ts
│   │   │   ├── recommend.routes.ts
│   │   │   └── __tests__/
│   │   ├── services/
│   │   │   ├── steam.service.ts
│   │   │   ├── search.service.ts
│   │   │   ├── recommender.service.ts
│   │   │   ├── user-profile.service.ts
│   │   │   ├── strategies/       # GenreVector, FriendOverlap, Scoring
│   │   │   └── __tests__/
│   │   ├── repositories/
│   │   │   ├── interfaces.ts
│   │   │   └── game.repository.ts
│   │   ├── middleware/
│   │   │   ├── validate.middleware.ts
│   │   │   └── __tests__/
│   │   ├── utils/
│   │   │   └── circuit-breaker.ts
│   │   ├── types/
│   │   │   └── steam.types.ts
│   │   └── scripts/              # data:process, build-recommender, etc.
│   ├── data/
│   │   ├── raw/                  # steam.csv
│   │   └── processed/
│   │       └── recommender/      # similarity-index.json, vectors.json, idf.json
│   └── package.json
├── frontend/
│   └── src/app/
│       ├── app.ts, app.config.ts, app.routes.ts
│       ├── components/           # user-search, game-card, glass-settings
│       ├── pages/                # query-screen, config-screen, result-screen
│       ├── services/             # backend-service, steam-api.service
│       └── types/
└── system-audit-2025.md
```

---

## Known Limitations

**Steam API**: Requires a valid API key. Rate limits apply; the circuit breaker mitigates cascading failures but does not increase quota. Private profiles return 403; the system cannot fetch library or friend data for users with private settings.

**Recommender**: Depends entirely on offline data. If `data/processed/recommender/` is empty or missing, all recommend endpoints return 503. The first recommend request triggers synchronous file load, blocking the event loop for several seconds.

**Search**: Queries the local `games` table only. Games not in the Kaggle-derived dataset are not searchable. Full-text and trigram search require appropriate indexes for performance.

**No authentication**: The API does not authenticate users. Any client with the base URL can call endpoints. Steam IDs are passed as path params; there is no verification that the caller owns the profile.

**Single-node**: No horizontal scaling. The recommender's in-memory index is process-local. Connection pooling is per-process.

---

## Glossary

**Circuit breaker**: A resilience pattern that stops calling an external service when failures exceed a threshold, failing fast instead of timing out. After a cooldown, it probes once before resuming.

**Jaccard similarity**: A measure of set overlap: |A ∩ B| / |A ∪ B|. Used here for content similarity between games (e.g., shared genres/tags).

**L1-normalization**: Scaling a vector so its elements sum to 1. The genre vector is L1-normalized so weights represent proportional preference.

**pg_trgm**: PostgreSQL extension for trigram-based fuzzy matching. The `%%` operator enables indexed similarity search on text columns.

**Repository pattern**: An abstraction that encapsulates data access. Callers depend on an interface (e.g., `IGameMetadataRepository`), not the database.

**Strategy pattern**: Encapsulates an algorithm in a swappable object. Different strategies (e.g., genre vector, friend overlap) can be composed without changing the orchestrator.

**tsvector / plainto_tsquery**: PostgreSQL full-text search. `tsvector` stores a normalized document; `plainto_tsquery` parses a search string for matching.

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

## Testing Coverage Snapshot

**Backend** (Jest): Route tests for `game.routes` and `search.routes` (validation, error handling, mocked SteamService/SearchService). Unit tests for `RecommenderService` (mocked `fs`; similarity index, getSimilarGames, getRecommendationsByTags, getRecommendationsForLibrary). Unit tests for `SearchService` (SQL construction, param handling). Middleware tests for `validate.middleware` (Zod schema rejection, pass-through). No integration tests against a live database or Steam API. No tests for `user.routes`, `recommend.routes`, `SteamService`, `user-profile.service`, or strategies.

**Frontend** (Jest + Testing Library): Component tests for `game-card` and `glass-settings`. Service tests for `glass-settings.service`. Angular core and router are mocked. No E2E tests. No tests for `user-search`, `backend-service`, `steam-api.service`, or page components.

**Gaps**: User and recommend routes are untested. SteamService (circuit breaker, API mapping) has no unit tests. The full user-recommendation flow (buildUserProfile → scoreWithUserContext) is untested. Strategies are untested in isolation. No E2E coverage. Run `npm run test` in `backend/` and `frontend/` to execute suites.

---

## Performance Characteristics

**Latency**: User library and profile endpoints are dominated by Steam API response time (typically 200–800 ms). Game details depend on the Steam Store API (similar range). Search is database-bound; with indexes, expect 10–50 ms. Similar-games and by-tags are in-memory lookups (sub-10 ms). Full user recommendations combine Steam (multiple parallel calls), PostgreSQL (metadata), and in-memory similarity; total latency is often 1–3 seconds, with Steam as the main bottleneck.

**Memory**: The RecommenderService loads the similarity index, vectors, and IDF into Maps. For a dataset of ~50k games, expect roughly 50–100 MB heap usage. The pg.Pool default max is 10 connections. No caching; each request hits Steam or the database.

**Blocking**: The first recommend request triggers synchronous `loadData()` (fs.readFileSync of three JSON files). This blocks the event loop for several seconds. All other request handling is async.

**Bottlenecks**: Steam API rate limits and latency; no caching. User recommendations with large libraries iterate over many games and fetch similar-games for each; the scoring strategy does O(library_size × 30) similarity lookups plus a metadata batch query. PostgreSQL connection pool saturation under high concurrency.

---

## 11. Resume Driven Development Plan

Resume driven development (RDD) is the practice of prioritizing technologies and features that signal "senior engineer" or "production-ready" to recruiters and hiring managers, often ahead of features that solve immediate user problems. The goal is to maximize the number of credible, discussable line items on a resume and in interviews. This section catalogs initiatives that could be added to the Steam Recommendation Engine, evaluates each for resume impact, and provides enough context to decide whether the investment is worthwhile.

The tables below use several attributes to assess each initiative. **Resume Value** describes the phrase or skill you can claim (e.g., "Containerized microservices"). **Effort** is the relative implementation cost (Low: hours to a day; Medium: days to a week; High: weeks; Very High: months). **Actual Need** explains whether the project genuinely benefits or whether the initiative is primarily for optics. **Worth Implementing?** is the overall recommendation for resume placement. **Time to Implement** gives a rough hour estimate for a competent developer. **Interview Discussability** rates how often the topic arises in technical interviews (High: common; Medium: role-dependent; Low: rare). **Project Fit** indicates how naturally the initiative fits this codebase (Strong: solves a real gap; Moderate: plausible use case; Weak: artificial). **Risk of Over-engineering** warns when the initiative may make the project harder to maintain or explain (Low: clean addition; High: unnecessary complexity). **Dependencies** notes prerequisites (e.g., Docker before Kubernetes).

The initiatives are grouped by theme and ordered within each group by recommended priority (highest value, lowest effort first). A consolidated recommended order appears at the end.

---

### Phase 1: Infrastructure & DevOps

| Initiative | Resume Value | Effort | Time | Actual Need | Worth? | Interview Discussability | Project Fit | Over-engineering Risk | Dependencies |
|------------|--------------|--------|------|-------------|--------|--------------------------|-------------|------------------------|--------------|
| **CI/CD (GitHub Actions)** | "CI/CD pipelines" | Low | 2–4h | Lint, test, deploy; baseline expectation | **High** | High | Strong | Low | None |
| **Docker + docker-compose** | "Containerized services" | Low | 4–8h | Dev parity; easier onboarding | **High** | High | Strong | Low | None |
| **Redis caching layer** | "Distributed caching" | Medium | 8–16h | `ioredis` in package.json (unused); Steam API cache | **High** | High | Strong | Low | Docker (optional) |
| **Prometheus + Grafana** | "Observability stack" | Medium | 12–24h | No metrics today; production visibility | **High** | High | Strong | Low | Docker (optional) |
| **Health check enhancement** | "Production readiness" | Low | 1–2h | Extend /api/health to verify recommender readiness | **Medium** | Medium | Strong | Low | None |
| **Graceful shutdown** | "Production operations" | Low | 2–4h | SIGTERM handler; pool.end(); stop accepting | **Medium** | Medium | Strong | Low | None |
| **OpenTelemetry tracing** | "Distributed tracing" | Medium | 16–24h | Request flow visibility; hot in 2025 | **Medium** | Medium | Moderate | Medium | Prometheus (optional) |
| **Kubernetes manifests** | "Orchestrated at scale" | Medium | 16–32h | Overkill for single-node; interview fodder | **High** | High | Weak | High | Docker, deploy target |
| **Terraform / Pulumi** | "Infrastructure as Code" | Medium | 16–40h | If deploying to cloud; IaC standard | **High** | High | Moderate | Low | Cloud account |

---

### Phase 2: Architecture & API

| Initiative | Resume Value | Effort | Time | Actual Need | Worth? | Interview Discussability | Project Fit | Over-engineering Risk | Dependencies |
|------------|--------------|--------|------|-------------|--------|--------------------------|-------------|------------------------|--------------|
| **GraphQL API** | "GraphQL / Apollo" | High | 24–48h | REST fine; GraphQL for flexible queries | **High** | High | Moderate | Medium | Schema design |
| **Event-driven: Kafka / RabbitMQ** | "Message queues" | High | 32–64h | No async workflows; artificial job queue | **High** | High | Weak | High | Docker, broker setup |
| **Dependency injection** | "Composition root / DI" | Medium | 8–16h | Services instantiate deps directly; testability | **High** | High | Strong | Low | None |
| **API versioning (/v1/)** | "Versioned APIs" | Low | 2–4h | Future-proofing; minor refactor | **Medium** | Medium | Strong | Low | None |
| **gRPC for internal calls** | "gRPC / protobuf" | Medium | 24–40h | Overkill; HTTP sufficient | **Medium** | Medium | Weak | High | Proto definitions |
| **CQRS for recommendations** | "CQRS / Event Sourcing" | High | 40–80h | Read-heavy; trivial write model | **Medium** | Medium | Weak | High | Event store |
| **Split into microservices** | "Microservices architecture" | Very High | 80–160h | Monolith appropriate for scale | **Low** | High | Weak | Very High | Docker, orchestration |

---

### Phase 3: Data, ML & Observability

| Initiative | Resume Value | Effort | Time | Actual Need | Worth? | Interview Discussability | Project Fit | Over-engineering Risk | Dependencies |
|------------|--------------|--------|------|-------------|--------|--------------------------|-------------|------------------------|--------------|
| **Vector DB (pgvector)** | "Vector embeddings" | Medium | 16–32h | Similarity index in-memory; persist + scale | **High** | High | Strong | Low | PostgreSQL extension |
| **ML pipeline (MLflow)** | "MLOps" | High | 40–80h | Formalize offline recommender scripts | **High** | High | Strong | Medium | Python env, data pipeline |
| **A/B testing framework** | "Experimentation" | Medium | 24–48h | Weight tuning; product story | **Medium** | Medium | Moderate | Medium | Feature flags |
| **Feature store** | "Feature engineering" | High | 48–80h | Features computed on-the-fly | **Low** | Low | Weak | High | ML infra |

---

### Phase 4: Frontend & Testing

| Initiative | Resume Value | Effort | Time | Actual Need | Worth? | Interview Discussability | Project Fit | Over-engineering Risk | Dependencies |
|------------|--------------|--------|------|-------------|--------|--------------------------|-------------|------------------------|--------------|
| **E2E with Playwright** | "End-to-end testing" | Medium | 16–32h | No E2E today; integration coverage | **High** | High | Strong | Low | Angular app |
| **Storybook** | "Component library" | Low | 8–16h | Reusable UI docs; design system | **Medium** | Medium | Moderate | Low | Angular components |
| **WebSocket real-time** | "Real-time systems" | Medium | 16–24h | No live data; artificial "refresh" | **Medium** | Medium | Weak | Medium | None |
| **PWA / offline** | "Progressive Web App" | Medium | 24–40h | Niche for game discovery | **Low** | Low | Weak | Medium | Service worker |
| **ADR (Architecture Decision Records)** | "Documented decisions" | Low | 4–8h | Explains *why*; onboarding | **Low** | Low | Strong | Low | None |

---

### Pitfalls

Resume driven development carries several risks. **Over-engineering** is the most common: adding Kafka when a cron job would suffice, or splitting a monolith before there is a scaling problem, makes the codebase harder to understand and defend in interviews. Interviewers often ask "why did you choose X?"—if the answer is "to put it on my resume," the signal backfires. **Artificial use cases** also hurt: a message queue with no real async workload, or a feature store when features are computed in real time, invites skepticism. **Maintenance burden** increases with every new system: Redis, Prometheus, and OpenTelemetry each require monitoring, upgrades, and debugging. A resume full of half-integrated tools suggests shallow experience. **Scope creep** is another pitfall: starting with Docker is fine; adding Kubernetes, Terraform, and a custom operator for a single-service project dilutes focus. Finally, **neglecting fundamentals**—tests, error handling, graceful shutdown—in favor of buzzwords leaves a project that looks impressive on paper but is brittle in practice. The best resume items are those that solve real problems and are easy to explain under pressure.

---

### Highest Value Implementations for Resume Development

The highest-value, lowest-risk additions for resume development are **CI/CD**, **Docker**, **Redis caching**, **Prometheus metrics**, and **E2E testing with Playwright**. Each is widely recognized, requires modest effort, fits the project naturally, and is easy to discuss in interviews. CI/CD is table stakes—recruiters and hiring managers expect it, and a two-hour GitHub Actions workflow pays off immediately. Docker provides "containerized" as a resume line and improves onboarding; docker-compose for the API plus PostgreSQL is a standard setup. Redis caching is already partially prepared (ioredis in package.json) and Steam API responses are ideal cache candidates; the implementation is straightforward and the "distributed caching" phrase is strong. Prometheus metrics address a real gap—there are no metrics today—and observability is a recurring interview topic. Playwright E2E testing fills another gap, demonstrates testing rigor, and is increasingly expected for full-stack roles. Together, these five initiatives can be completed in roughly a week of focused work and yield multiple credible, defensible resume lines. Dependency injection and pgvector are strong second-tier options: DI improves testability and architecture discussions, while pgvector aligns the recommender with the current AI/ML hiring wave and fits the existing similarity-index use case. Avoid microservices, CQRS, feature stores, and Kubernetes for this project—the effort-to-signal ratio is poor and the over-engineering risk is high.

---

### Recommended Order (Max Resume ROI / Min Effort)

1. **CI/CD (GitHub Actions)** — Lint, test, optional deploy. Table stakes; 2–4 hours.
2. **Docker + docker-compose** — One Dockerfile, one compose file. "Containerized" in one PR; 4–8 hours.
3. **Redis caching** — Wire up ioredis; cache Steam API responses by steamId. "Distributed caching" ✓; 8–16 hours.
4. **Prometheus metrics** — `express-prometheus-middleware` or similar. "Observability" ✓; 12–24 hours.
5. **E2E with Playwright** — Cover critical user flows. "End-to-end testing" ✓; 16–32 hours.
6. **Dependency injection** — Composition root; inject repositories and strategies. "Clean architecture" ✓; 8–16 hours.
7. **pgvector** — Persist similarity index; optional scale path. "Vector embeddings" ✓; 16–32 hours.
8. **Health check + graceful shutdown** — Production readiness; 3–6 hours combined.

*Use responsibly. The best resume line is still "shipped a feature users love."*

---

## 12. How the System Functions: Start to Finish

When Node starts, it loads `index.ts`, which in turn loads `config.ts`. Config reads environment variables from both the monorepo root and `src/.env`, merging them so local values override. The resulting config holds the port, Steam API key, and PostgreSQL credentials. If the port is missing, the process exits immediately. The Express app is then created and middleware is registered: CORS, JSON body parsing, and a rate limiter that caps each IP at 100 requests per 15 minutes on all `/api/*` paths. Routes are mounted for user, recommend, game, and search, along with a health check, a 404 handler, and a global error handler. Separately, `config/db.ts` loads as a side effect and creates a shared `pg.Pool` connected to PostgreSQL, exporting a `query` helper. Finally, the server calls `listen` on the configured port. At this point, no SteamService or RecommenderService exists yet; both are created lazily on first use.

Every HTTP request passes through the same pipeline. CORS runs first, then body parsing. The rate limiter either allows the request or rejects it with a 429. If allowed, the request is matched to a route. Route-specific Zod validation runs; invalid params or body produce a 400. The handler then obtains the appropriate service (via `getSteamService`, `getRecommenderService`, or a fresh `SearchService` instance), invokes the service method, and returns JSON. If no route matches, the 404 handler runs. If the handler throws, the error handler returns a 500.

The user endpoints all hit the Steam Web API. A request to fetch a user's library triggers `getSteamService()`, which on first call instantiates SteamService with Axios clients and circuit breakers. The service calls the GetOwnedGames endpoint through the circuit breaker, maps the response to `OwnedGame[]`, and returns it. Similarly, recently played games and the Steam profile (name, avatar) come from other Steam API endpoints. The Steam profile is distinct from the recommendation profile: the latter, which includes genre vectors and friend overlap, is served at `/api/recommend/user/:steamId/profile`.

Game details come from the Steam Store API, a different base URL. The SteamService uses a separate circuit breaker for store requests. A request for game details by app ID fires the store breaker, fetches app metadata from the store API, maps it to the `Game` type, and returns it.

Search uses PostgreSQL. The SearchService builds a dynamic SQL query using pg_trgm for genre and tag matching, full-text search for keywords, and category filters for player count. It passes the query and params to `PostgresGameMetadataRepository.searchGames`, which executes via the shared pool. The rows are mapped to `GameSearchResult` and returned.

The recommender endpoints depend on in-memory data loaded from disk. The first request to any recommend route triggers `getRecommenderService()`, which constructs a RecommenderService. The constructor synchronously reads three JSON files from `data/processed/recommender/`: the similarity index, vectors, and IDF. These populate Maps in memory. If the index has data, `isLoaded` is set to true. The status endpoint simply reports whether the recommender is ready. The similar-games endpoint looks up an app ID in the similarity index, slices the result to the requested limit, and returns it. No Steam or database calls are involved. The by-tags endpoint iterates over the in-memory game vectors, scores games by tag overlap, sorts, and returns the top matches. Again, all data is in memory.

The full user-recommendation flow is the most involved. It runs in two phases. First, `buildUserProfile` aggregates Steam data. It issues three parallel calls to the Steam API: owned games, recently played games, and the friend list. It then fetches owned games for up to ten friends, also in parallel. With that data, it uses the genre-vector strategy to build an L1-normalized preference vector from playtime-weighted genres, which requires a PostgreSQL lookup for genre metadata via the repository. The friend-overlap strategy computes the set of games owned by at least two friends, using only in-memory data. A final Steam API call fetches the player summary for display. The result is a UserProfile containing the library, genre vector, friend overlap set, and owned app IDs.

The second phase scores candidates. The scoring strategy iterates over each game in the user's library, fetches the top 30 similar games from the in-memory similarity index for each, and merges them into a candidate set, keeping the best Jaccard score per candidate. It then fetches full metadata for those candidates from PostgreSQL. For each candidate, it computes a genre alignment score (dot product with the user's genre vector), a binary social score (one if the game is in the friend overlap set, zero otherwise), and a final score as a weighted sum: 50% Jaccard, 30% genre, 20% social. The results are sorted, sliced to the limit, and returned as `ScoredRecommendation[]`. The user profile endpoint runs only the first phase and returns a serialized summary (top genres, friend stats, etc.) without the internal Sets and Maps.

Data sources vary by endpoint. User library, recent games, and Steam profile use only the Steam API. Game details use only the Steam Store API. Search uses only PostgreSQL. Recommend status, similar games, and by-tags use only in-memory data. The full user recommendation flow uses all three: Steam API for profile building, PostgreSQL for genre metadata, and the in-memory similarity index for candidate generation and Jaccard scores.

The recommender's in-memory data is not produced by the server. It comes from an offline pipeline. The raw Steam dataset (e.g., steam.csv from Kaggle) is placed in `data/raw/`. Running `npm run data:process` populates the games table and processed CSVs. Running `npm run data:build-recommender` generates the similarity index, vectors, and IDF files in `data/processed/recommender/`. When the server starts, the first recommend request triggers `loadData()`, which reads those files. If they are missing or empty, `isLoaded` remains false and recommend endpoints return 503.

---

## 13. Strip vs. Implement: Reducing Bloat, Maximizing Value

This section identifies features and dependencies to remove (low resume value, poor project fit, or pure bloat) and provides a prioritized implementation plan that favors high resume value and strong project fit.

---

### 13.1 Features to Strip

**Criteria for stripping**: Resume value is low or zero; the item does not serve core usage; removal reduces maintenance or cognitive load without harming the product. We do not strip anything that is actively used by the recommendation engine, API, or data pipeline.

| Item | Location | Resume Value | Reasoning |
|------|----------|--------------|-----------|
| **ioredis** | `backend/package.json` | None | Unused dependency. No code imports or uses it. Adds ~5 transitive packages to node_modules. Zero resume value because it is not implemented—removing it does not lose a resume line. If Redis is added later, it can be reintroduced with actual usage. |
| **data:inspect-csv** | `backend/package.json`, `inspect-csv-columns.ts` | None | One-off debug utility for inspecting CSV columns. Useful during initial data exploration; not part of the core pipeline. The main flow uses `data:process` and `data:build-recommender`. Low resume value; keeping it adds script clutter. Optional: move to a `scripts/dev/` folder or remove if no longer needed. |
| **inspect-csv-and-interface.ts** | `backend/src/scripts/` | None | No npm script references it. Appears to be a one-off interface-inspection utility. Dead code from a resume perspective. Safe to remove or relocate to a scratch/dev folder. |
| **data:download** | `backend/package.json`, `download-dataset.ts` | Low | If the primary workflow is "download steam.csv from Kaggle manually," this script may be redundant. Kaggle often requires browser-based download. Evaluate: if unused, remove the script and npm target to simplify the data pipeline story. |

**Do not strip**: Rate limiting, circuit breaker, strategy pattern, repository pattern, friend overlap, genre vector, Zod validation, or any route or service that powers the API. These are either core functionality or provide meaningful resume value (resilience, clean architecture, validation).

---

### 13.2 Implementation Plan: High Resume Value + High Project Fit

Prioritize implementations where **Worth = High** and **Project Fit = Strong**. Avoid initiatives with **Worth = Low** or **Project Fit = Weak**, as they add effort without proportional resume or product benefit.

**Tier 1 — Implement first** (High worth, Strong fit, low effort):

| Order | Initiative | Time | Rationale |
|-------|------------|------|-----------|
| 1 | CI/CD (GitHub Actions) | 2–4h | Table stakes. Lint, test, optional deploy. No project-fit risk. |
| 2 | Docker + docker-compose | 4–8h | Standard containerization. Improves onboarding. Strong fit. |
| 3 | Health check enhancement | 1–2h | Extend `/api/health` to verify recommender readiness. Addresses real gap. |
| 4 | Graceful shutdown | 2–4h | SIGTERM handler, pool cleanup. Production hygiene. |
| 5 | Dependency injection | 8–16h | Composition root; inject repositories/strategies. Improves testability and architecture discussions. |

**Tier 2 — Implement next** (High worth, Strong fit, moderate effort):

| Order | Initiative | Time | Rationale |
|-------|------------|------|-----------|
| 6 | Redis caching | 8–16h | Wire up caching for Steam API responses. Natural fit; Steam is the latency bottleneck. *Note: Requires adding ioredis back with actual usage—do not add if stripping it.* |
| 7 | Prometheus metrics | 12–24h | No metrics today. Observability is a real gap. |
| 8 | E2E with Playwright | 16–32h | No E2E coverage. Testing rigor; strong signal for full-stack roles. |
| 9 | pgvector | 16–32h | Persist similarity index; aligns with AI/ML hiring. Natural fit for recommender. |

**Tier 3 — Consider if time permits** (High worth, Moderate fit):

| Initiative | Time | Rationale |
|------------|------|-----------|
| API versioning (/v1/) | 2–4h | Future-proofing. Strong fit, medium worth. |
| Terraform / Pulumi | 16–40h | IaC for cloud deploy. Moderate fit; only if deploying. |
| ML pipeline (MLflow) | 40–80h | Formalize offline scripts. High effort; do if targeting MLOps roles. |

**Avoid** (Low worth or Weak fit; high over-engineering risk):

| Initiative | Why avoid |
|------------|-----------|
| Split into microservices | Very high effort; monolith fits current scale. Weak project fit. |
| Kafka / RabbitMQ | No real async workload. Artificial use case. |
| CQRS / Event Sourcing | Read-heavy; trivial write model. Hard to justify. |
| Feature store | Features computed on-the-fly. Overkill. |
| Kubernetes | Overkill for single-node. Weak fit. |
| gRPC | HTTP + JSON sufficient. Niche. |
| GraphQL | REST is adequate. Moderate fit but high effort. |
| WebSocket, PWA, ADR | Low worth or weak fit. |

---

### 13.3 Summary

**Strip**: Remove `ioredis` (unused), consider removing or relocating `data:inspect-csv`, `inspect-csv-and-interface.ts`, and `data:download` if they are not part of the active workflow. These have low or zero resume value and add bloat without serving core usage.

**Implement**: Focus on Tier 1 and Tier 2. CI/CD, Docker, health check, graceful shutdown, and dependency injection deliver high resume value with strong project fit and modest effort. Redis, Prometheus, E2E, and pgvector round out a credible, defensible stack. Avoid low-value or weak-fit initiatives to keep the project lean and interview-ready.
