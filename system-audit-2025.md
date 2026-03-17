# Steam Game Recommendation Engine — Systems Reference

**Codebase**: Express/Node.js/TypeScript/PostgreSQL + Angular  
**First authored**: March 2025 | **Living document** — updated as the system evolves  
**Purpose**: Deep analytical guide, study reference, and implementation roadmap. Covers architecture, design patterns, engineering principles, anti-patterns, complexity analysis, known bugs, scaling considerations, and step-by-step implementation plans. Not a security audit.

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
│       ├── components/           # user-search, game-card
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

### Architecture & Design Patterns

**Anemic domain model**: A domain model where entities are plain data containers with no behavior or invariant enforcement. Business rules live in services instead of in the objects themselves. This codebase uses an anemic model — `OwnedGame`, `UserProfile`, and `ScoredRecommendation` are all data bags with no validation in constructors. The trade-off is simplicity at the cost of scattered business rules.

**Circuit breaker**: A resilience pattern with three states — **closed** (requests flow normally), **open** (requests fail immediately without calling the external service), and **half-open** (one probe request is allowed to test recovery). The circuit opens when failures exceed a threshold and closes again after a successful probe. Opossum implements this in the codebase with a 50% error threshold and 30-second reset timeout. The key design decision is error filtering: not all errors should trip the circuit (see §2.4).

**Composition root**: A single location in the application where all dependencies are wired together. The codebase currently lacks one — services instantiate their dependencies inline (e.g., `new PostgresGameMetadataRepository()` in `user-profile.service.ts`). A composition root would make the dependency graph explicit, testable, and swappable.

**Dependency injection (DI)**: Providing an object's dependencies from the outside rather than having the object create them internally. Constructor injection is the most common form: `class GenreVectorStrategy { constructor(private readonly repo: IGameMetadataRepository) {} }`. The strategies in this codebase use constructor injection; the services do not.

**Dependency inversion principle**: High-level modules should depend on abstractions, not concrete implementations. `RecommendationScoringStrategy` depends on `IGameMetadataRepository` (abstraction), not `PostgresGameMetadataRepository` (concrete). But `user-profile.service.ts` calls `new PostgresGameMetadataRepository()` directly, violating the principle at the composition level.

**Factory method / factory function**: A function that creates and returns an object, encapsulating construction logic. `getSteamService()` and `getRecommenderService()` are factory functions that also enforce the singleton constraint. The `validate(schema)` middleware factory is a higher-order function that produces configured Express middleware.

**Layered architecture**: Organizing code into horizontal layers (presentation → application → domain → infrastructure) where each layer depends only on the layers below it. The codebase follows this structure: routes → services → strategies → repositories. The key rule is that infrastructure (PostgreSQL, Steam API) never depends on domain logic.

**Repository pattern**: An abstraction that encapsulates data access behind an interface. Callers depend on `IGameMetadataRepository`, not on PostgreSQL. This enables mock implementations for testing and makes it possible to swap storage backends (e.g., PostgreSQL → pgvector) without changing business logic. The gap: `searchGames()` accepts raw SQL, which leaks implementation details through the abstraction.

**Singleton pattern**: Ensuring a class has only one instance. Implemented via module-level variables and lazy initialization: `let instance = null; function getInstance() { if (!instance) instance = new C(); return instance; }`. Used for `SteamService` (holds circuit breakers) and `RecommenderService` (holds ~50MB in-memory index). The trade-off: singletons are hard to test in isolation and create hidden global state.

**Strategy pattern**: Encapsulates an algorithm in a swappable object so different algorithms can be used interchangeably. `GenreVectorStrategy`, `FriendOverlapStrategy`, and `RecommendationScoringStrategy` each implement one scoring signal. The orchestrator (`buildUserProfile`) composes them without implementing the algorithms. New strategies can be added without modifying existing ones (Open/Closed Principle).

### Engineering Principles

**Composition over inheritance**: Favoring object composition (combining simple objects) over class inheritance (extending a base class). The scoring formula `0.50×jaccard + 0.30×genre + 0.20×social` is a composition of three independent signals, not a class hierarchy. Each signal is computed by a separate strategy and combined at the end.

**Defensive programming**: Writing code that anticipates and handles unexpected inputs gracefully. In this codebase: capping owned games to 100 before aggregation (prevents OOM for users with 5000+ games), limiting source strings to 3 per recommendation (prevents unbounded string allocation), and slicing friend lists to 10 (prevents excessive Steam API calls).

**Fail fast**: When a system detects a problem, it should report it immediately rather than continuing with potentially corrupt state. The circuit breaker fails fast when Steam is unhealthy. The config validation fails fast when `PORT` is missing. Zod validation fails fast on malformed requests. The alternative — proceeding with bad data — causes harder-to-diagnose failures downstream.

**Idempotency**: An operation that produces the same result regardless of how many times it is executed. `GenreVectorStrategy.buildVector()` is idempotent — given the same library and recent games, it always returns the same normalized vector. CI pipelines should be idempotent — running the same pipeline twice on the same commit should produce the same pass/fail result.

**Immutability**: Once created, an object's state cannot be changed. `config` is loaded once and never mutated (though not enforced with `Object.freeze`). Strategy methods return new `Map`s and `Set`s rather than mutating inputs. The recommender's in-memory data is populated at load and never modified during request handling.

**Separation of concerns**: Each module should address a single concern. Routes handle HTTP. Validation handles request shape. Services handle business logic. Repositories handle data access. The gap: `SearchService` builds SQL queries, which is a data access concern that belongs in the repository.

**Shift-left testing**: Moving quality checks earlier in the development lifecycle. Catching bugs at the linting stage costs less than catching them in CI, which costs less than catching them in staging, which costs less than production. The CI pipeline implements shift-left by running lint → test → build on every push.

**SOLID**: Five principles of object-oriented design — Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion. See §5.1 for a per-principle assessment of this codebase.

**Twelve-Factor App**: A methodology for building cloud-native applications. The most relevant factors here: (III) Config — store config in environment variables, not code. (VI) Processes — application processes should be stateless. (IX) Disposability — maximize robustness with fast startup and graceful shutdown. This codebase follows Factor III (dotenv) but violates Factor IX (no graceful shutdown).

**Validate at boundaries**: External data should be validated at the point where it enters the system. Zod validates inbound HTTP requests. But Steam API responses are not validated at runtime — they use TypeScript `as` assertions, which are compile-time only. A complete implementation would validate both inbound (requests) and outbound (external API responses) boundaries.

### Data Structures & Algorithms

**Dot product**: The sum of element-wise products of two vectors. Used for genre alignment scoring: `Σ(candidate_genre[i] × user_preference[i])`. A higher dot product means the candidate's genres align more closely with the user's preferences.

**IDF (Inverse Document Frequency)**: A measure of how rare a term is across all documents. `IDF(t) = log(N / df(t))` where N is total documents and df(t) is how many contain term t. Common terms (e.g., "action") get low IDF; rare terms (e.g., "roguelike-deckbuilder") get high IDF. Used in the offline pipeline to weight game features.

**Jaccard similarity**: A measure of set overlap: `|A ∩ B| / |A ∪ B|`. If game A has tags {action, rpg, open-world} and game B has {action, rpg, shooter}, the Jaccard similarity is 2/4 = 0.5. Pre-computed offline for all game pairs and stored in `similarity-index.json`. The scoring strategy uses the best Jaccard score per candidate across the user's library.

**L1-normalization**: Scaling a vector so its elements sum to 1: `v_normalized[i] = v[i] / Σ(v)`. The genre vector is L1-normalized so weights represent proportional preference (e.g., "action" = 0.35 means 35% of weighted playtime is in action games). This makes the genre alignment score scale-independent — a user with 10 games and a user with 1000 games produce comparable vectors.

**Log-scale weighting**: Using `Math.log1p(playtime)` instead of raw playtime to prevent one game from dominating the genre vector. A user with 5000 hours in one game and 10 hours in everything else would have a nearly singular vector without log scaling. `log1p(5000) ≈ 8.5` vs `log1p(10) ≈ 2.4` — still weighted toward the dominant game, but not exclusively.

**Weighted linear combination**: A final score computed as a weighted sum of independent signals: `score = w₁×signal₁ + w₂×signal₂ + ... + wₙ×signalₙ` where weights sum to 1. The recommendation engine uses `0.50×jaccard + 0.30×genre + 0.20×social`. The weights are constants but could be made configurable for A/B testing.

### Database & Search

**Connection pooling**: Maintaining a pool of reusable database connections rather than opening a new connection per query. `pg.Pool` manages a fixed set (default max 10). Each `pool.query()` borrows a connection, executes, and returns it. Under load, requests queue when all connections are busy. Connection creation is expensive (~20ms for PostgreSQL); pooling amortizes this across requests.

**Full-text search (tsvector / plainto_tsquery)**: PostgreSQL's built-in text search. `tsvector` stores a document as normalized, stemmed lexemes. `plainto_tsquery` converts a search string into a query that matches against the tsvector. The `@@` operator performs the match. `ts_rank_cd` scores relevance. Requires a pre-computed `search_vector` column for index support.

**Parameterized queries**: Using placeholders (`$1`, `$2`) instead of string interpolation to pass user input to SQL queries. `pool.query('SELECT * FROM games WHERE app_id = $1', [appId])` is safe; `pool.query('SELECT * FROM games WHERE app_id = ' + appId)` is vulnerable to SQL injection. All repository queries in this codebase use parameterization.

**pg_trgm (trigram matching)**: A PostgreSQL extension that breaks strings into three-character subsequences (trigrams) for fuzzy matching. "portal" → {"por", "ort", "rta", "tal"}. The `%` operator finds strings with similar trigram sets. Supports GiST and GIN indexes for performance. Used for genre/tag matching in `SearchService`.

### Node.js & Runtime

**Event loop**: Node.js processes all I/O on a single thread using an event-driven, non-blocking model. Async operations (network, disk) are dispatched to the OS/libuv thread pool and their callbacks are queued for execution on the main thread. Blocking the event loop (e.g., `fs.readFileSync` on a large file) freezes all request handling. The RecommenderService's synchronous `loadData()` is the primary event loop blocker in this codebase.

**Express middleware pipeline**: Middleware functions execute in registration order. Each receives `(req, res, next)` and either responds or calls `next()` to pass control. The pipeline in this codebase: `cors() → json() → rateLimit() → route → validate() → handler → 404 → errorHandler`. Order matters — rate limiting before routes means over-limit requests never hit business logic.

`**Promise.allSettled`**: Waits for all promises to complete (fulfilled or rejected) and returns an array of outcomes. Unlike `Promise.all` (which short-circuits on first rejection), `allSettled` ensures all I/O completes. Used in `buildUserProfile` so a failed friend list fetch does not abort the library and recent games fetches.

`**Promise.all` vs `Promise.allSettled**`: `Promise.all` rejects immediately when any input promise rejects — good when all results are required. `Promise.allSettled` waits for everything — good when partial results are acceptable. This codebase uses `allSettled` for Steam API calls because individual failures (private profiles, rate limits) should not cancel the entire profile build.

### Infrastructure & DevOps

**CI/CD (Continuous Integration / Continuous Delivery)**: CI automatically builds and tests code on every push. CD extends this to automatically deploy verified builds. A GitHub Actions workflow is Infrastructure as Code — the pipeline definition is versioned in the repository, not configured in a web UI. See §15.1 for implementation details.

**Docker**: A containerization platform that packages an application and its dependencies into an isolated, reproducible unit (image). Multi-stage builds use a "builder" stage (with dev tools) and a "production" stage (minimal runtime only) to minimize image size. See §15.2 for implementation details.

**docker-compose**: A tool for defining multi-container applications. A `docker-compose.yml` describes services (API, PostgreSQL, Redis), their images, environment variables, networks, volumes, health checks, and startup dependencies. `depends_on` with `condition: service_healthy` prevents the API from starting before the database is ready.

**Graceful shutdown**: Handling `SIGTERM`/`SIGINT` by stopping new request acceptance, draining in-flight requests, closing database connections, and then exiting. Without it, `docker stop` or a Kubernetes pod termination kills the process mid-request, dropping connections and potentially corrupting state.

**Health check**: An endpoint that reports whether the application and its dependencies are functioning. A naive health check returns `{status: 'ok'}` unconditionally. A production-grade health check verifies database connectivity, service readiness, and configuration. Docker and Kubernetes use health checks to determine whether to route traffic to a container.

**Rate limiting**: Capping the number of requests a client can make within a time window. `express-rate-limit` uses an in-memory counter per IP (default: 100 requests per 15 minutes). Prevents abuse and protects upstream dependencies (Steam API has its own rate limits). The counter resets when the process restarts — not persistent across deploys.

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


| Strategy                        | Input                 | Output                                | Responsibility                                                     |
| ------------------------------- | --------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| `GenreVectorStrategy`           | library, recentAppIds | `Map<string, number>` (L1-normalized) | Build user preference vector from playtime-weighted genres         |
| `FriendOverlapStrategy`         | friendLibraries       | `Set<number>`                         | Compute games owned by ≥2 friends                                  |
| `RecommendationScoringStrategy` | profile, limit        | `ScoredRecommendation[]`              | Score candidates using 3-signal composite (Jaccard, genre, social) |


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


| State                         | Location                 | Lifecycle                                           | Mutability                                     |
| ----------------------------- | ------------------------ | --------------------------------------------------- | ---------------------------------------------- |
| `pg.Pool`                     | `config/db.ts`           | Module load → process exit                          | Immutable after creation                       |
| `SteamService` instance       | `steam.service.ts`       | First `getSteamService()` call → process exit       | Mutable (circuit breaker state)                |
| `RecommenderService` instance | `recommender.service.ts` | First `getRecommenderService()` call → process exit | Mutable (in-memory index; `isLoaded` set once) |
| `config` object               | `config.ts`              | Module load                                         | Immutable (plain object, no `Object.freeze`)   |


**Principle**: **Shared mutable state** is confined to singletons. There is no global mutable variable that routes or handlers modify directly. Each request is **stateless** — no server-side session store.

---

### 3.2 Request-Scoped State

Each HTTP request flows through: `req` → validation → route handler → service → response. No request-scoped state is stored between middleware invocations. The `UserProfile` object is built per request and discarded after the response.

**Data flow**: Request params/body → Zod validation (no mutation) → service calls (async, return new data) → JSON response. No shared in-memory cache for request data.

---

### 3.3 RecommenderService State Machine

The recommender has an implicit **two-state machine**:


| State              | Condition                                     | Behavior                                         |
| ------------------ | --------------------------------------------- | ------------------------------------------------ |
| `LOADING`          | Constructor running, `loadData()` in progress | `isReady()` = false; recommend routes return 503 |
| `READY`            | `isLoaded` = true                             | Full functionality                               |
| (implicit `ERROR`) | `loadData()` threw; `isLoaded` = false        | Same as LOADING — 503                            |


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


| Principle                 | Adherence | Evidence                                                                                                                                                                           |
| ------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Single Responsibility** | Partial   | Strategies are single-purpose. `user-profile.service` is now a thin orchestrator. `SearchService` still builds SQL and maps rows — could split query builder vs. mapper.           |
| **Open/Closed**           | Partial   | New search strategies could be added without modifying existing ones. Adding a new repository implementation requires editing call sites (no DI container).                        |
| **Liskov Substitution**   | Good      | `PostgresGameMetadataRepository` implements `IGameMetadataRepository`; any implementation can replace it.                                                                          |
| **Interface Segregation** | Good      | `IGameMetadataRepository` has three focused methods. `FriendOverlapStrategy` has no interface (pure, no deps).                                                                     |
| **Dependency Inversion**  | Partial   | Strategies depend on `IGameMetadataRepository` (abstraction). But `SteamService` and `RecommenderService` are still obtained via `getSteamService()` — no interface, no injection. |


---

### 5.2 Separation of Concerns


| Concern              | Location                              | Notes                                        |
| -------------------- | ------------------------------------- | -------------------------------------------- |
| HTTP/transport       | Routes, Express                       | Params, query, body extraction; status codes |
| Validation           | `validate.middleware.ts`, Zod schemas | Request shape validation                     |
| Business logic       | Services, strategies                  | Profile building, scoring, search            |
| Data access          | Repositories                          | SQL, parameterization                        |
| External integration | `SteamService`                        | Steam API, circuit breaker                   |
| Configuration        | `config.ts`                           | Env loading, defaults                        |


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


| Type                   | Role                          | Invariants                                                                |
| ---------------------- | ----------------------------- | ------------------------------------------------------------------------- |
| `OwnedGame`            | Value object                  | None enforced (playtime could be negative)                                |
| `UserLibrary`          | Aggregate of OwnedGame        | None                                                                      |
| `UserProfile`          | Rich aggregate                | Contains `genreVector` (L1-normalized), `friendOverlapSet`, `ownedAppIds` |
| `ScoredRecommendation` | DTO for API response          | None                                                                      |
| `Game`                 | Value object from Steam Store | None                                                                      |


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


| Source          | Access Pattern                         | Caching                            |
| --------------- | -------------------------------------- | ---------------------------------- |
| Steam Web API   | Axios, circuit breaker                 | None                               |
| Steam Store API | Axios, circuit breaker                 | None                               |
| PostgreSQL      | pg.Pool, parameterized queries         | None (connection pool only)        |
| File system     | `fs.readFileSync` (RecommenderService) | Loaded once at startup into memory |


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

**Gap**: No explicit "ready" gate. The first request to `/api/recommend/`* triggers RecommenderService construction, which blocks. Health check (`/api/health`) does not verify recommender readiness.

---

### 9.2 Shutdown

No `process.on('SIGTERM'|'SIGINT')` handler. On kill, the process exits immediately. The pg.Pool is not closed; connections are dropped. For graceful shutdown: register handlers, call `pool.end()`, stop accepting new requests.

---

## 10. Summary: Strengths and Gaps

### Strengths


| Area               | Implementation                                                                          |
| ------------------ | --------------------------------------------------------------------------------------- |
| Repository pattern | `IGameMetadataRepository` abstracts DB; `PostgresGameMetadataRepository` implements it. |
| Strategy pattern   | Genre, friend overlap, and scoring are isolated, testable strategies.                   |
| Circuit breaker    | Steam API calls are wrapped; 429/5xx trip the circuit; 4xx do not.                      |
| Parallel I/O       | `Promise.allSettled` for Steam and friend fetches.                                      |
| Memory bounds      | Top 100 games, 3 source strings in recommendations.                                     |
| Search             | Full-text and trigram for efficient querying.                                           |


### Gaps and Known Bugs


| Area                      | Severity | Gap                                                                                                                                                                           | Suggested Direction                                                                                      |
| ------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `**pg.Pool` password**    | **Bug**  | `config.ts` defines `pgPassword` but `db.ts` never passes it to `new Pool()`. Breaks in any environment with password auth (Docker, CI, production).                          | Add `password: config.pgPassword` to Pool options. See §14.1 Step 1A.                                    |
| **Health check contract** | **Bug**  | Backend returns `{ status, timestamp }`. Frontend expects `{ status, apiKeyConfigured }`. Field `apiKeyConfigured` is never sent.                                             | Add `apiKeyConfigured: !!config.steamApiKey` to health response. See §14.1 Step 1B.                      |
| **ESLint missing**        | **Bug**  | `package.json` defines `"lint": "eslint src/**/*.ts"` but no ESLint config exists and ESLint is not in devDependencies. `npm run lint` fails.                                 | Install ESLint + TypeScript plugin; create `eslint.config.mjs`. See §14.1 Step 1C.                       |
| RecommenderService init   | High     | Sync `fs.readFileSync` in constructor blocks event loop for seconds. No explicit READY/FAILED state.                                                                          | Async load via `fs.promises.readFile`; expose `whenReady()` Promise; add FAILED state. See §14.1 Step 2. |
| Graceful shutdown         | High     | No `SIGTERM`/`SIGINT` handler. Process drops connections on kill. Docker `stop` causes ungraceful termination.                                                                | Register handlers; call `server.close()` then `pool.end()`. See §14.1 Step 5.                            |
| Config immutability       | Low      | `config` object is not frozen. Can be mutated at runtime accidentally.                                                                                                        | Wrap in `Object.freeze()`.                                                                               |
| Steam response validation | Medium   | Steam API responses use `as Type` assertions (compile-time only). No runtime validation. Malformed responses cause silent data corruption.                                    | Add Zod schemas for Steam response types; use `safeParse()`.                                             |
| Dependency injection      | Medium   | Services instantiate repositories and strategies directly (`new PostgresGameMetadataRepository()`).                                                                           | Introduce a composition root; inject interfaces via constructor.                                         |
| Domain invariants         | Low      | Types are anemic data bags. No validation in constructors (e.g., playtime could be negative).                                                                                 | Add domain entities with invariant checks; use factories for construction.                               |
| SearchService SQL         | Low      | Builds SQL internally; repository accepts raw SQL via `searchGames(sqlQuery, params)`.                                                                                        | Move query construction into repository or a dedicated query builder.                                    |
| Composition root          | Medium   | No single place that wires dependencies. Concrete implementations are hardcoded at 6+ call sites.                                                                             | Create `composition.ts` or use a lightweight DI container.                                               |
| Test coverage             | High     | `user.routes`, `recommend.routes`, `SteamService`, `user-profile.service`, and all 3 strategies are untested. The critical path (recommendation flow) has zero test coverage. | Write unit tests for the critical path before adding infrastructure. See §14.1 Step 3.                   |


---

## 10A. Anti-Patterns and Technical Debt

This section catalogs patterns in the codebase that are not outright bugs but represent architectural debt — patterns that work today but will cause pain as the system grows, or that an experienced reviewer would flag.

### 10A.1 Leaky Abstraction in Repository

`IGameMetadataRepository.searchGames(sqlQuery: string, params: any[])` accepts raw SQL. The interface is supposed to abstract data access, but the caller (`SearchService`) must know PostgreSQL syntax to use it. This is a leaky abstraction — the repository's contract exposes its implementation. If the storage backend changed (e.g., to Elasticsearch), every caller would need to change its SQL strings.

**How an architect would fix it**: Replace `searchGames(sql, params)` with `searchByFilters(filters: SearchFilters)` where `SearchFilters` is a domain object: `{ keyword?: string, genres?: string[], tags?: string[], categories?: string[], limit: number }`. The repository translates filters to SQL internally.

### 10A.2 Service Locator via Module Singletons

`getSteamService()` and `getRecommenderService()` are module-level factory functions that act as a service locator — callers ask a global function for their dependency instead of receiving it through their constructor. This pattern has three costs:

1. **Hidden dependencies**: Reading `recommend.routes.ts` does not reveal its dependencies without scanning every function body for `getRecommenderService()` calls.
2. **Testing friction**: Unit tests must mock the module export (`jest.mock('../services/recommender.service')`) rather than passing a mock via constructor. Module mocking is brittle and order-dependent.
3. **No type safety on the dependency graph**: Nothing prevents circular dependencies or ensures all services are initialized before use.

**How an architect would fix it**: A composition root (`composition.ts`) constructs all services and passes them to route factories. Routes become `createRecommendRoutes(recommenderService, steamService)` instead of importing globals.

### 10A.3 Synchronous Initialization in Constructor

`RecommenderService.constructor()` calls `this.loadData()`, which uses `fs.readFileSync`. This violates Node.js convention — constructors should not perform I/O. The consequences:

- The event loop blocks for seconds while parsing ~50MB of JSON.
- The constructor cannot return a Promise, so there is no way to `await` readiness.
- There is no distinction between "still loading" and "failed to load."

**How an architect would fix it**: Separate construction from initialization. Either use a static factory (`static async create()`) or expose a `whenReady()` Promise. Load data before `app.listen()` so the server only accepts requests when ready.

### 10A.4 Temporal Coupling in Request Flow

`buildUserProfile` must be called before `scoreWithUserContext`. This ordering is enforced by the route handler but not by the type system. If a future developer calls `scoreWithUserContext` with a stale or partially-built profile, the code will not fail at compile time.

**How an architect would fix it**: Make the pipeline explicit. Either chain the calls in a single `getRecommendationsForUser(steamId)` function that encapsulates the ordering, or use a builder pattern where `scoreWithUserContext` is a method on the `UserProfile` result.

### 10A.5 Inconsistent Service Instantiation

Three different instantiation patterns coexist:

- `SteamService`: lazy singleton via `getSteamService()`
- `RecommenderService`: lazy singleton via `getRecommenderService()`
- `SearchService`: new instance per call (`new SearchService()`)
- `PostgresGameMetadataRepository`: new instance per call (`new PostgresGameMetadataRepository()`)

No documentation or convention explains when to use which pattern. A new developer must read every service to discover how it is obtained.

---

## 10B. Complexity Analysis

### Recommendation Scoring — Time Complexity

Given: L = library size (capped at 100), S = similar games per library game (30), C = total unique candidates, G = genres per candidate.

```
Phase 1 — Candidate generation:
  For each owned game (L):
    Fetch 30 similar games (S):
      Map lookup + insert: O(1) amortized
  Total: O(L × S) = O(100 × 30) = O(3,000) operations

Phase 2 — Metadata fetch:
  Single batch query: O(C) where C ≤ L × S = 3,000

Phase 3 — Scoring:
  For each candidate (C):
    Genre alignment: O(G) where G ≈ 10–20
    Social lookup: O(1) set membership
    Total per candidate: O(G)
  Total: O(C × G) = O(3,000 × 15) ≈ O(45,000) operations

Phase 4 — Sort:
  O(C × log(C)) ≈ O(3,000 × 12) ≈ O(36,000) comparisons
```

**Overall**: O(L×S + C×G + C×log(C)) ≈ **O(50,000)** operations per recommendation request. CPU-bound phases are sub-millisecond on modern hardware. The bottleneck is Phase 2 (PostgreSQL batch query for C candidates) and the Steam API calls in `buildUserProfile`.

### Genre Vector Construction — Time Complexity

Given: L = library size, R = metadata rows returned, G = average genres per game.

```
Metadata fetch: O(L) query, O(R × G) to parse genre strings
Vector accumulation: O(L × G) — for each game, add to each genre
L1 normalization: O(unique_genres) — single pass
```

**Overall**: O(L × G) ≈ O(100 × 15) = **O(1,500)** operations. Negligible.

### Memory Profile


| Data structure              | Size (50k games)   | Location           | Lifecycle                           |
| --------------------------- | ------------------ | ------------------ | ----------------------------------- |
| `similarityIndex` Map       | ~30–50 MB          | RecommenderService | Process lifetime                    |
| `gameVectors` Map           | ~15–30 MB          | RecommenderService | Process lifetime                    |
| `idf` Map                   | ~2–5 MB            | RecommenderService | Process lifetime                    |
| `pg.Pool` connections       | ~10 × 50KB = 500KB | db.ts              | Process lifetime                    |
| Per-request `UserProfile`   | ~50–200 KB         | Stack/heap         | Request-scoped, GC'd after response |
| Per-request candidate `Map` | ~100–500 KB        | Stack/heap         | Request-scoped, GC'd after response |


**Total steady-state**: ~~50–100 MB for the recommender + ~500 KB for the pool = **~~50–100 MB**. Per-request allocations are small and short-lived. The V8 garbage collector handles them efficiently under normal load. At high concurrency (>100 concurrent recommendation requests), per-request allocations could cause GC pauses.

---

## 10C. Scaling Analysis

This section describes what would happen if the system needed to serve 10x, 100x, or 1000x current load, and what architectural changes each threshold would require.

### Current Architecture: Single Node

One Node.js process, one PostgreSQL instance, no caching, no load balancer. Handles ~50–100 concurrent users comfortably. The recommender's in-memory data is the primary memory constraint.

### 10x Load (~500–1,000 concurrent users)


| Bottleneck                 | Impact                                                                                                                                          | Mitigation                                                                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Steam API rate limits      | 429 responses increase; circuit breaker opens frequently                                                                                        | **Redis caching** — cache responses by steamId/appId with 15-min TTL. Most users re-request the same profiles. Cache hit rate of 60–80% reduces Steam calls by 3–5x. |
| PostgreSQL connection pool | 10 connections saturate under concurrent recommendation requests (each does a batch metadata query)                                             | Increase `max` to 25–50. Add `connectionTimeoutMillis` to fail fast instead of queuing indefinitely.                                                                 |
| Event loop blocking        | Already resolved if async loading is implemented (§14.1 Step 2). Otherwise, first recommendation request blocks all other requests for seconds. | Async `loadData()` at startup.                                                                                                                                       |


### 100x Load (~5,000–10,000 concurrent users)


| Bottleneck                        | Impact                                                                  | Mitigation                                                                                                                                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single Node.js process            | CPU-bound scoring phases compete with request handling on one thread    | **Cluster mode** (Node.js `cluster` module) or **PM2** — spawn N workers (one per CPU core). Each worker holds its own copy of the recommender data. 4 cores = 4 × 100 MB = 400 MB memory for recommender data alone. |
| In-memory recommender per process | Each worker loads ~100 MB. 8 workers = 800 MB just for similarity data. | **pgvector** — move similarity index to PostgreSQL with vector similarity queries. Workers share the database instead of each holding a copy. Memory drops to near-zero per worker.                                   |
| PostgreSQL query latency          | Batch metadata queries for 3,000 candidates take 50–200 ms under load   | **Read replicas** — separate read traffic from write traffic. Recommendation queries go to replicas.                                                                                                                  |


### 1000x Load (~50,000–100,000 concurrent users)

At this scale, the monolith is no longer sufficient. Required changes:

1. **Horizontal scaling with load balancer**: Nginx or cloud ALB distributing requests across N application instances.
2. **Dedicated recommendation service**: Extract the scoring engine into its own service with its own scaling group, since recommendation requests are 10x more expensive than search or user lookups.
3. **Pre-computed recommendations**: Instead of computing recommendations per-request, run a batch job that pre-computes top-N recommendations for active users and stores them. The API serves from cache.
4. **Event-driven updates**: When a user's library changes, publish an event to a message queue (Redis Streams, not Kafka — appropriate scale) that triggers re-computation of that user's recommendations.

This is the point where Kafka, microservices, and Kubernetes become justified — not before.

---

## Testing Coverage Snapshot

**Backend** (Jest): Route tests for `game.routes` and `search.routes` (validation, error handling, mocked SteamService/SearchService). Unit tests for `RecommenderService` (mocked `fs`; similarity index, getSimilarGames, getRecommendationsByTags, getRecommendationsForLibrary). Unit tests for `SearchService` (SQL construction, param handling). Middleware tests for `validate.middleware` (Zod schema rejection, pass-through). No integration tests against a live database or Steam API. No tests for `user.routes`, `recommend.routes`, `SteamService`, `user-profile.service`, or strategies.

**Frontend** (Jest + Playwright): Unit tests cover `game-card`. Playwright visual checks cover the query page across key breakpoints plus an Axe accessibility guardrail. No unit tests for `user-search`, `backend-service`, `steam-api.service`, or page components.

**Gaps**: User and recommend routes are untested. SteamService (circuit breaker, API mapping) has no unit tests. The full user-recommendation flow (buildUserProfile → scoreWithUserContext) is untested. Strategies are untested in isolation. No E2E coverage. Run `npm run test` in `backend/` and `frontend/` to execute suites.

---

## Performance Characteristics

**Latency**: User library and profile endpoints are dominated by Steam API response time (typically 200–800 ms). Game details depend on the Steam Store API (similar range). Search is database-bound; with indexes, expect 10–50 ms. Similar-games and by-tags are in-memory lookups (sub-10 ms). Full user recommendations combine Steam (multiple parallel calls), PostgreSQL (metadata), and in-memory similarity; total latency is often 1–3 seconds, with Steam as the main bottleneck.

**Memory**: The RecommenderService loads the similarity index, vectors, and IDF into Maps. For a dataset of ~50k games, expect roughly 50–100 MB heap usage. The pg.Pool default max is 10 connections. No caching; each request hits Steam or the database.

**Blocking**: The first recommend request triggers synchronous `loadData()` (fs.readFileSync of three JSON files). This blocks the event loop for several seconds. All other request handling is async.

**Bottlenecks**: Steam API rate limits and latency; no caching. User recommendations with large libraries iterate over many games and fetch similar-games for each; the scoring strategy does O(library_size × 30) similarity lookups plus a metadata batch query. PostgreSQL connection pool saturation under high concurrency. See §10B for detailed complexity analysis.

---

## 11. Resume Driven Development Plan

Resume driven development (RDD) is the practice of prioritizing technologies and features that signal "senior engineer" or "production-ready" to recruiters and hiring managers, often ahead of features that solve immediate user problems. The goal is to maximize the number of credible, discussable line items on a resume and in interviews. This section catalogs initiatives that could be added to the Steam Recommendation Engine, evaluates each for resume impact, and provides enough context to decide whether the investment is worthwhile.

The tables below use several attributes to assess each initiative. **Resume Value** describes the phrase or skill you can claim (e.g., "Containerized microservices"). **Effort** is the relative implementation cost (Low: hours to a day; Medium: days to a week; High: weeks; Very High: months). **Actual Need** explains whether the project genuinely benefits or whether the initiative is primarily for optics. **Worth Implementing?** is the overall recommendation for resume placement. **Time to Implement** gives a rough hour estimate for a competent developer. **Interview Discussability** rates how often the topic arises in technical interviews (High: common; Medium: role-dependent; Low: rare). **Project Fit** indicates how naturally the initiative fits this codebase (Strong: solves a real gap; Moderate: plausible use case; Weak: artificial). **Risk of Over-engineering** warns when the initiative may make the project harder to maintain or explain (Low: clean addition; High: unnecessary complexity). **Dependencies** notes prerequisites (e.g., Docker before Kubernetes).

The initiatives are grouped by theme and ordered within each group by recommended priority (highest value, lowest effort first). A consolidated recommended order appears at the end.

---

### Phase 1: Infrastructure & DevOps


| Initiative                   | Resume Value             | Effort | Time   | Actual Need                                                                                                    | Worth?     | Interview Discussability | Project Fit | Over-engineering Risk | Dependencies          |
| ---------------------------- | ------------------------ | ------ | ------ | -------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------ | ----------- | --------------------- | --------------------- |
| **CI/CD (GitHub Actions)**   | "CI/CD pipelines"        | Low    | 2–4h   | Lint, test, deploy; baseline expectation. No workflow exists today.                                            | **High**   | High                     | Strong      | Low                   | None                  |
| **Docker + docker-compose**  | "Containerized services" | Low    | 4–8h   | Dev parity; easier onboarding. No Dockerfile exists today.                                                     | **High**   | High                     | Strong      | Low                   | None                  |
| **Health check enhancement** | "Production readiness"   | Low    | 1–2h   | `/api/health` returns a static `{status:'ok'}` — does not verify DB, recommender, or Steam API key.            | **High**   | Medium                   | Strong      | Low                   | None                  |
| **Graceful shutdown**        | "Production operations"  | Low    | 2–4h   | No SIGTERM/SIGINT handler. Process drops connections on kill. Prerequisite for Docker and CI/CD credibility.   | **High**   | Medium                   | Strong      | Low                   | None                  |
| **Redis caching layer**      | "Distributed caching"    | Medium | 8–16h  | Steam API is the latency bottleneck (200–800ms); responses are highly cacheable. Requires adding ioredis back. | **High**   | High                     | Strong      | Low                   | Docker (optional)     |
| **Prometheus + Grafana**     | "Observability stack"    | Medium | 8–12h  | No metrics today; production visibility. Can start with express-prom-bundle alone (no Grafana required).       | **High**   | High                     | Strong      | Low                   | Docker (optional)     |
| **OpenTelemetry tracing**    | "Distributed tracing"    | Medium | 16–24h | Request flow visibility; valuable for debugging multi-service calls. Complements Prometheus.                   | **Medium** | Medium                   | Moderate    | Medium                | Prometheus (optional) |
| **Kubernetes manifests**     | "Orchestrated at scale"  | Medium | 16–32h | Overkill for single-node; interview fodder                                                                     | **High**   | High                     | Weak        | High                  | Docker, deploy target |
| **Terraform / Pulumi**       | "Infrastructure as Code" | Medium | 16–40h | If deploying to cloud; IaC standard                                                                            | **High**   | High                     | Moderate    | Low                   | Cloud account         |


---

### Phase 2: Architecture & API


| Initiative                         | Resume Value                 | Effort    | Time    | Actual Need                                     | Worth?     | Interview Discussability | Project Fit | Over-engineering Risk | Dependencies          |
| ---------------------------------- | ---------------------------- | --------- | ------- | ----------------------------------------------- | ---------- | ------------------------ | ----------- | --------------------- | --------------------- |
| **GraphQL API**                    | "GraphQL / Apollo"           | High      | 24–48h  | REST fine; GraphQL for flexible queries         | **High**   | High                     | Moderate    | Medium                | Schema design         |
| **Event-driven: Kafka / RabbitMQ** | "Message queues"             | High      | 32–64h  | No async workflows; artificial job queue        | **High**   | High                     | Weak        | High                  | Docker, broker setup  |
| **Dependency injection**           | "Composition root / DI"      | Medium    | 8–16h   | Services instantiate deps directly; testability | **High**   | High                     | Strong      | Low                   | None                  |
| **API versioning (/v1/)**          | "Versioned APIs"             | Low       | 2–4h    | Future-proofing; minor refactor                 | **Medium** | Medium                   | Strong      | Low                   | None                  |
| **gRPC for internal calls**        | "gRPC / protobuf"            | Medium    | 24–40h  | Overkill; HTTP sufficient                       | **Medium** | Medium                   | Weak        | High                  | Proto definitions     |
| **CQRS for recommendations**       | "CQRS / Event Sourcing"      | High      | 40–80h  | Read-heavy; trivial write model                 | **Medium** | Medium                   | Weak        | High                  | Event store           |
| **Split into microservices**       | "Microservices architecture" | Very High | 80–160h | Monolith appropriate for scale                  | **Low**    | High                     | Weak        | Very High             | Docker, orchestration |


---

### Phase 3: Data, ML & Observability


| Initiative                | Resume Value          | Effort | Time   | Actual Need                                 | Worth?     | Interview Discussability | Project Fit | Over-engineering Risk | Dependencies              |
| ------------------------- | --------------------- | ------ | ------ | ------------------------------------------- | ---------- | ------------------------ | ----------- | --------------------- | ------------------------- |
| **Vector DB (pgvector)**  | "Vector embeddings"   | Medium | 16–32h | Similarity index in-memory; persist + scale | **High**   | High                     | Strong      | Low                   | PostgreSQL extension      |
| **ML pipeline (MLflow)**  | "MLOps"               | High   | 40–80h | Formalize offline recommender scripts       | **High**   | High                     | Strong      | Medium                | Python env, data pipeline |
| **A/B testing framework** | "Experimentation"     | Medium | 24–48h | Weight tuning; product story                | **Medium** | Medium                   | Moderate    | Medium                | Feature flags             |
| **Feature store**         | "Feature engineering" | High   | 48–80h | Features computed on-the-fly                | **Low**    | Low                      | Weak        | High                  | ML infra                  |


---

### Phase 4: Frontend & Testing


| Initiative                              | Resume Value           | Effort | Time   | Actual Need                        | Worth?     | Interview Discussability | Project Fit | Over-engineering Risk | Dependencies       |
| --------------------------------------- | ---------------------- | ------ | ------ | ---------------------------------- | ---------- | ------------------------ | ----------- | --------------------- | ------------------ |
| **E2E with Playwright**                 | "End-to-end testing"   | Medium | 16–32h | No E2E today; integration coverage | **High**   | High                     | Strong      | Low                   | Angular app        |
| **Storybook**                           | "Component library"    | Low    | 8–16h  | Reusable UI docs; design system    | **Medium** | Medium                   | Moderate    | Low                   | Angular components |
| **WebSocket real-time**                 | "Real-time systems"    | Medium | 16–24h | No live data; artificial "refresh" | **Medium** | Medium                   | Weak        | Medium                | None               |
| **PWA / offline**                       | "Progressive Web App"  | Medium | 24–40h | Niche for game discovery           | **Low**    | Low                      | Weak        | Medium                | Service worker     |
| **ADR (Architecture Decision Records)** | "Documented decisions" | Low    | 4–8h   | Explains *why*; onboarding         | **Low**    | Low                      | Strong      | Low                   | None               |


---

### Pitfalls

Resume driven development carries several risks. **Over-engineering** is the most common: adding Kafka when a cron job would suffice, or splitting a monolith before there is a scaling problem, makes the codebase harder to understand and defend in interviews. Interviewers often ask "why did you choose X?"—if the answer is "to put it on my resume," the signal backfires. **Artificial use cases** also hurt: a message queue with no real async workload, or a feature store when features are computed in real time, invites skepticism. **Maintenance burden** increases with every new system: Redis, Prometheus, and OpenTelemetry each require monitoring, upgrades, and debugging. A resume full of half-integrated tools suggests shallow experience. **Scope creep** is another pitfall: starting with Docker is fine; adding Kubernetes, Terraform, and a custom operator for a single-service project dilutes focus. Finally, **neglecting fundamentals**—tests, error handling, graceful shutdown—in favor of buzzwords leaves a project that looks impressive on paper but is brittle in practice. The best resume items are those that solve real problems and are easy to explain under pressure.

---

### Highest Value Implementations for Resume Development

The highest-value, lowest-risk additions for resume development are **CI/CD**, **Docker**, **health check enhancement + graceful shutdown**, **Redis caching**, and **Prometheus metrics**. Each is widely recognized, requires modest effort, fits the project naturally, and is easy to discuss in interviews. CI/CD is table stakes—recruiters and hiring managers expect it, and a two-hour GitHub Actions workflow pays off immediately. Docker provides "containerized" as a resume line and improves onboarding; docker-compose for the API plus PostgreSQL is a standard setup. Health check enhancement and graceful shutdown are often overlooked but are prerequisites for production credibility—interviewers notice when a project handles SIGTERM, verifies dependency readiness, and exposes a meaningful health endpoint. These two combined take 3–6 hours and form the "production-ready" narrative that makes CI/CD and Docker believable rather than cosmetic. Redis caching addresses the real latency bottleneck (Steam API at 200–800ms per call) with highly cacheable responses; "distributed caching" is a strong resume phrase. Prometheus metrics fill the observability gap—there are no metrics today—and observability is a recurring interview topic. Dependency injection and pgvector are strong second-tier options: DI improves testability and architecture discussions, while pgvector aligns the recommender with the current AI/ML hiring wave. E2E with Playwright rounds out testing rigor for full-stack roles. Avoid microservices, CQRS, feature stores, and Kubernetes for this project—the effort-to-signal ratio is poor and the over-engineering risk is high.

**Key insight**: Fundamentals first, buzzwords second. A CI/CD pipeline that runs tests on a project with no graceful shutdown and a health check that always returns "ok" signals shallow implementation. Build the foundation (health, shutdown, DI) so that the infrastructure layers (CI/CD, Docker, Redis, Prometheus) have substance behind them.

---

### Recommended Order (Max Resume ROI / Min Effort)

1. **CI/CD (GitHub Actions)** — Lint, test, optional deploy. Table stakes; 2–4 hours. See §15.1 for step-by-step guide.
2. **Docker + docker-compose** — One Dockerfile, one compose file. "Containerized" in one PR; 4–8 hours. See §15.2 for step-by-step guide.
3. **Health check enhancement + graceful shutdown** — Verify DB/recommender readiness; SIGTERM handler; pool cleanup. Foundation for everything above. 3–6 hours combined.
4. **Redis caching** — Add ioredis with actual usage; cache Steam API responses by steamId/appId with TTL. "Distributed caching"; 8–10 hours.
5. **Dependency injection** — Composition root; inject repositories and strategies. "Clean architecture"; 8–10 hours.
6. **Prometheus metrics** — `express-prom-bundle` or similar. "Observability"; 8–12 hours.
7. **E2E with Playwright** — Cover critical user flows. "End-to-end testing"; 8–10 hours for core flows.
8. **pgvector** — Persist similarity index; optional scale path. "Vector embeddings"; 8–10 hours for basic integration.

**Constraint note**: All time estimates above have been capped at ≤10 hours per initiative. Larger ranges from Phase tables represent worst-case with learning curve; experienced implementation should target the lower bound.

*Use responsibly. The best resume line is still "shipped a feature users love."*

---

## 12. How the System Functions: Start to Finish

When Node starts, it loads `index.ts`, which in turn loads `config.ts`. Config reads environment variables from both the monorepo root and `src/.env`, merging them so local values override. The resulting config holds the port, Steam API key, and PostgreSQL credentials. If the port is missing, the process exits immediately. The Express app is then created and middleware is registered: CORS, JSON body parsing, and a rate limiter that caps each IP at 100 requests per 15 minutes on all `/api/`* paths. Routes are mounted for user, recommend, game, and search, along with a health check, a 404 handler, and a global error handler. Separately, `config/db.ts` loads as a side effect and creates a shared `pg.Pool` connected to PostgreSQL, exporting a `query` helper. Finally, the server calls `listen` on the configured port. At this point, no SteamService or RecommenderService exists yet; both are created lazily on first use.

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


| Item                             | Location                                         | Resume Value | Reasoning                                                                                                                                                                                                                                                                                                           |
| -------------------------------- | ------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ioredis**                      | `backend/package.json`                           | None         | Unused dependency. No code imports or uses it. Adds ~5 transitive packages to node_modules. Zero resume value because it is not implemented—removing it does not lose a resume line. If Redis is added later, it can be reintroduced with actual usage.                                                             |
| **data:inspect-csv**             | `backend/package.json`, `inspect-csv-columns.ts` | None         | One-off debug utility for inspecting CSV columns. Useful during initial data exploration; not part of the core pipeline. The main flow uses `data:process` and `data:build-recommender`. Low resume value; keeping it adds script clutter. Optional: move to a `scripts/dev/` folder or remove if no longer needed. |
| **inspect-csv-and-interface.ts** | `backend/src/scripts/`                           | None         | No npm script references it. Appears to be a one-off interface-inspection utility. Dead code from a resume perspective. Safe to remove or relocate to a scratch/dev folder.                                                                                                                                         |
| **data:download**                | `backend/package.json`, `download-dataset.ts`    | Low          | If the primary workflow is "download steam.csv from Kaggle manually," this script may be redundant. Kaggle often requires browser-based download. Evaluate: if unused, remove the script and npm target to simplify the data pipeline story.                                                                        |


**Do not strip**: Rate limiting, circuit breaker, strategy pattern, repository pattern, friend overlap, genre vector, Zod validation, or any route or service that powers the API. These are either core functionality or provide meaningful resume value (resilience, clean architecture, validation).

---

### 13.2 Implementation Plan: High Resume Value + High Project Fit

Prioritize implementations where **Worth = High** and **Project Fit = Strong**. Avoid initiatives with **Worth = Low** or **Project Fit = Weak**, as they add effort without proportional resume or product benefit.

**Tier 1 — Implement first** (High worth, Strong fit, low effort):


| Order | Initiative               | Time  | Rationale                                                                                            |
| ----- | ------------------------ | ----- | ---------------------------------------------------------------------------------------------------- |
| 1     | CI/CD (GitHub Actions)   | 2–4h  | Table stakes. Lint, test, optional deploy. No project-fit risk.                                      |
| 2     | Docker + docker-compose  | 4–8h  | Standard containerization. Improves onboarding. Strong fit.                                          |
| 3     | Health check enhancement | 1–2h  | Extend `/api/health` to verify recommender readiness. Addresses real gap.                            |
| 4     | Graceful shutdown        | 2–4h  | SIGTERM handler, pool cleanup. Production hygiene.                                                   |
| 5     | Dependency injection     | 8–16h | Composition root; inject repositories/strategies. Improves testability and architecture discussions. |


**Tier 2 — Implement next** (High worth, Strong fit, moderate effort):


| Order | Initiative          | Time   | Rationale                                                                                                                                                                 |
| ----- | ------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6     | Redis caching       | 8–16h  | Wire up caching for Steam API responses. Natural fit; Steam is the latency bottleneck. *Note: Requires adding ioredis back with actual usage—do not add if stripping it.* |
| 7     | Prometheus metrics  | 12–24h | No metrics today. Observability is a real gap.                                                                                                                            |
| 8     | E2E with Playwright | 16–32h | No E2E coverage. Testing rigor; strong signal for full-stack roles.                                                                                                       |
| 9     | pgvector            | 16–32h | Persist similarity index; aligns with AI/ML hiring. Natural fit for recommender.                                                                                          |


**Tier 3 — Consider if time permits** (High worth, Moderate fit):


| Initiative            | Time   | Rationale                                                            |
| --------------------- | ------ | -------------------------------------------------------------------- |
| API versioning (/v1/) | 2–4h   | Future-proofing. Strong fit, medium worth.                           |
| Terraform / Pulumi    | 16–40h | IaC for cloud deploy. Moderate fit; only if deploying.               |
| ML pipeline (MLflow)  | 40–80h | Formalize offline scripts. High effort; do if targeting MLOps roles. |


**Avoid** (Low worth or Weak fit; high over-engineering risk):


| Initiative               | Why avoid                                                        |
| ------------------------ | ---------------------------------------------------------------- |
| Split into microservices | Very high effort; monolith fits current scale. Weak project fit. |
| Kafka / RabbitMQ         | No real async workload. Artificial use case.                     |
| CQRS / Event Sourcing    | Read-heavy; trivial write model. Hard to justify.                |
| Feature store            | Features computed on-the-fly. Overkill.                          |
| Kubernetes               | Overkill for single-node. Weak fit.                              |
| gRPC                     | HTTP + JSON sufficient. Niche.                                   |
| GraphQL                  | REST is adequate. Moderate fit but high effort.                  |
| WebSocket, PWA, ADR      | Low worth or weak fit.                                           |


---

### 13.3 Summary

**Strip**: Remove `ioredis` (unused), consider removing or relocating `data:inspect-csv`, `inspect-csv-and-interface.ts`, and `data:download` if they are not part of the active workflow. These have low or zero resume value and add bloat without serving core usage.

**Implement**: Focus on Tier 1 and Tier 2. CI/CD, Docker, health check, graceful shutdown, and dependency injection deliver high resume value with strong project fit and modest effort. Redis, Prometheus, E2E, and pgvector round out a credible, defensible stack. Avoid low-value or weak-fit initiatives to keep the project lean and interview-ready.

---

## 14. Definitive Action Plan

This section is the single source of truth for what to do next. It supersedes the category-based ordering in §13.2 with an execution-order plan derived from codebase inspection and a principle: **make the code trustworthy first, prove it works with tests, then wrap it in infrastructure that verifies something real**.

Infrastructure without substance is hollow. A CI/CD pipeline running against a codebase with a broken database connection, an untested recommendation flow, and a health check that lies is a green badge on a fragile house. An interviewer who asks "walk me through a request" will hit the cracks within 60 seconds. The right order is: fix what is broken → prove the critical path works → then package it.

---

### 14.1 The Plan

#### Day 1: Make the Code Trustworthy

**Step 1. Fix all three bugs at once. (17 minutes)**

These are broken right now. None are design decisions; they are just wrong.


| #   | Bug                                             | File                                                                                             | Fix                                                                                                                                             | Time   |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| A   | `pg.Pool` does not receive password             | `backend/src/config/db.ts` line 5                                                                | Add `password: config.pgPassword` to Pool options                                                                                               | 2 min  |
| B   | Frontend/backend health check contract mismatch | `backend/src/index.ts` lines 42–47; `frontend/src/app/services/steam-api.service.ts` lines 55–59 | Add `apiKeyConfigured: !!config.steamApiKey` to health response                                                                                 | 5 min  |
| C   | No ESLint config — `npm run lint` fails         | `backend/package.json` line 10                                                                   | Install `eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin` as devDeps; create `backend/eslint.config.mjs` (see §15.1.4 Step 3) | 10 min |


Commit as: `fix: db password, health contract, eslint config`

**Step 2. Fix the recommender's synchronous load. (2–3 hours)**

The `RecommenderService` constructor calls `loadData()`, which runs `fs.readFileSync` three times on JSON files that can be 50–100MB. This blocks the Node.js event loop for several seconds. Every other request — health checks, search, user lookups — is frozen during this time. In an interview, if someone asks "what happens when the first recommendation request comes in?" and the answer is "the entire server freezes for 5 seconds," that is a bad answer.

This fix demonstrates Node.js concurrency understanding — one of the most common backend interview topics. The changes:

- Convert `loadData()` to async using `fs.promises.readFile`.
- Do not call it from the constructor. Expose a `static async create()` factory or a `whenReady(): Promise<void>` method.
- Call it at startup in `index.ts`, before `app.listen()`, so the data is loaded before the server accepts requests.
- Add an explicit `FAILED` state so a load error is distinguishable from "still loading."

Small code change (~40 lines), but touches three discussable concepts: async I/O, the factory pattern, and state machines.

**Step 3. Write the tests that do not exist for the critical path. (4–6 hours)**

The untested code is the most important code in the project:


| Tested                                           | Not tested                                                  |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `game.routes` (validation, error handling)       | `user.routes` (3 endpoints, all untested)                   |
| `search.routes` (validation, error handling)     | `recommend.routes` (5 endpoints, all untested)              |
| `RecommenderService` (similarity, tags, library) | `SteamService` (circuit breaker behavior, API mapping)      |
| `SearchService` (SQL construction)               | `user-profile.service` (the entire recommendation pipeline) |
| `validate.middleware` (Zod rejection)            | All 3 strategies (genre vector, friend overlap, scoring)    |


The recommendation flow — `buildUserProfile` → strategy execution → `scoreWithUserContext` — is the entire point of the application. If an interviewer asks "how do you know your recommendation engine works?" and the answer is "I did not test it," that is worse than not having CI/CD.

What to test, in order of value:

1. `**SteamService`** — Mock Axios. Test that circuit breaker trips on 429/5xx and does not trip on 403/404. Test that `getOwnedGames` maps the Steam response correctly. Test that `SteamApiError` is thrown with correct status codes.
2. **Strategies in isolation** — `GenreVectorStrategy.buildVector()` with a mock repository: verify L1-normalization. `FriendOverlapStrategy.buildOverlapSet()` with known input: verify the ≥2-friends threshold. `RecommendationScoringStrategy.scoreCandidates()` with a mock profile: verify the 50/30/20 weight formula. Pure logic, no I/O.
3. `**user.routes`** — Mock `getSteamService`. Test 17-digit Steam ID passes validation, non-numeric returns 400, `SteamApiError` with 403 returns 403. Same pattern as existing `game.routes` tests.
4. `**recommend.routes**` — Mock `getRecommenderService` and `buildUserProfile`. Test `/status` returns `ready: true/false`, `/similar/:appId` returns 503 when not ready, `/user/:steamId` returns 404 for empty libraries.

This is unit and route-level testing using patterns already in the codebase (Jest, supertest, mocked services). 4–6 hours total.

**Why this matters more than CI/CD**: CI/CD runs your tests. If your tests do not cover the critical path, CI/CD is verifying that the unimportant parts work. A pipeline that runs 5 test files and misses the recommendation engine gives false confidence.

---

#### Day 2: Infrastructure That Has Substance (6–12 hours)

**Step 4. CI/CD with GitHub Actions. (2–4 hours)**

The workflow runs lint, the new tests, and the build. The tests cover the critical path. The pipeline is verifying something meaningful. Full step-by-step guide in §15.1.

**Step 5. Graceful shutdown + health check enhancement. (3–4 hours)**

Combine into one session — both modify `index.ts` and reinforce each other.

*Graceful shutdown*: Store the return value of `app.listen()` in a `server` variable. Register `SIGTERM` and `SIGINT` handlers that call `server.close()`, then `pool.end()`, then `process.exit(0)`. 15 lines of code that makes the Docker story credible.

*Health check*: Extend `/api/health` to run `pool.query('SELECT 1')`, call `recommenderService.isReady()`, and check `!!config.steamApiKey`. Return `{ status: 'ok'|'degraded'|'unhealthy', checks: { db, recommender, steamApiKey }, timestamp }`.

Do these before Docker because Docker `stop` sends SIGTERM (needs graceful shutdown) and Docker `healthcheck` calls `/api/health` (needs the enhanced version). If you do Docker first, you wire up infrastructure against a health endpoint that lies and a process that does not shut down cleanly.

**Step 6. Docker + docker-compose. (4–8 hours)**

Dockerfile, compose file, `.dockerignore`. Now when Docker's healthcheck fires, it calls an endpoint that actually verifies the database and recommender. When `docker stop` sends SIGTERM, the process drains connections. Infrastructure backed by real behavior. Full step-by-step guide in §15.2.

---

#### Day 3: Polish That Compounds (4–6 hours)

**Step 7. Freeze config + strip dead code. (20 minutes)**

`Object.freeze(config)` in `config.ts`. Remove `ioredis` from `package.json`. Delete or relocate `inspect-csv-columns.ts` and `inspect-csv-and-interface.ts`. Housekeeping.

**Step 8. Zod validation for Steam API responses. (3–4 hours)**

`SteamService` uses `as SteamOwnedGamesResponse` type assertions — compile-time only. At runtime, if Steam changes their response shape, the code silently produces garbage. Adding Zod schemas for the critical response types turns compile-time assumptions into runtime guarantees. Completes the "validate at boundaries" narrative: Zod on requests (already done, §2.5) AND Zod on external responses.

**Step 9. Dependency injection / composition root. (8–10 hours)**

Address the gap from §10: `user-profile.service.ts` lines 57–59 create `new PostgresGameMetadataRepository()`, `new GenreVectorStrategy(repo)`, and `new FriendOverlapStrategy()` inline. Create `composition.ts` that wires everything. Routes receive services from the composition root. Makes the architecture match the diagram in §1.1. Do this after testing — the Day 1 tests give you a safety net for the refactor.

---

#### Day 4+: If Time Permits


| Step | Item                     | Time  | Depends on                | Resume line                              |
| ---- | ------------------------ | ----- | ------------------------- | ---------------------------------------- |
| 10   | Redis caching            | 8–10h | Docker, graceful shutdown | "Distributed caching with Redis"         |
| 11   | E2E with Playwright      | 8–10h | Docker, CI/CD             | "End-to-end testing with Playwright"     |
| 12   | Move SQL into repository | 3–4h  | DI                        | —                                        |
| 13   | Prometheus metrics       | 8–10h | Docker                    | "Observability with Prometheus"          |
| 14   | pgvector                 | 8–10h | Docker, DI                | "Vector similarity search with pgvector" |


---

### 14.2 Quick Reference


| Step | Item                             | Day | Time   | Blocked by |
| ---- | -------------------------------- | --- | ------ | ---------- |
| 1A   | Fix `pg.Pool` password           | 1   | 2 min  | —          |
| 1B   | Fix health check contract        | 1   | 5 min  | —          |
| 1C   | Create ESLint config             | 1   | 10 min | —          |
| 2    | Async recommender loading        | 1   | 2–3h   | —          |
| 3    | Unit tests for critical path     | 1   | 4–6h   | —          |
| 4    | CI/CD (GitHub Actions)           | 2   | 2–4h   | 1A–C, 3    |
| 5    | Graceful shutdown + health check | 2   | 3–4h   | 1B         |
| 6    | Docker + docker-compose          | 2   | 4–8h   | 1A, 4, 5   |
| 7    | Freeze config + strip dead code  | 3   | 20 min | —          |
| 8    | Zod for Steam responses          | 3   | 3–4h   | —          |
| 9    | Dependency injection             | 3   | 8–10h  | 3, 4       |
| 10   | Redis caching                    | 4+  | 8–10h  | 5, 6       |
| 11   | E2E with Playwright              | 4+  | 8–10h  | 4, 6       |
| 12   | Move SQL into repository         | 4+  | 3–4h   | 9          |
| 13   | Prometheus metrics               | 4+  | 8–10h  | 6          |
| 14   | pgvector                         | 4+  | 8–10h  | 6, 9       |


**Total**: Day 1 ~7–10 hours. Day 2 ~9–16 hours. Day 3 ~11–14 hours. Day 4+ ~35–44 hours.

---

### 14.3 The Interview Test

The way to evaluate this order: **after each day, could you walk an interviewer through the project and defend every decision?**

**After Day 1** (bugs + async load + tests): "The recommendation engine is async, tested, and the scoring formula is verified. Here is the test output. Here is the state machine for the recommender. Here is how the circuit breaker behaves when Steam returns 429." You have substance — you can talk for 30 minutes about engineering decisions with no infrastructure files at all.

**After Day 2** (CI/CD + shutdown + health + Docker): Now you have both. The CI pipeline runs real tests. Docker's healthcheck calls an endpoint that actually verifies the database and recommender. `docker stop` drains connections. Every piece of infrastructure is backed by code that works and is tested.

**After Day 3** (Zod + DI + cleanup): The codebase is clean. Boundaries are validated in both directions. The architecture matches the diagram. The composition root makes the dependency graph explicit. This is the version you open in a screen-share.

---

## 15. Implementation Guides

Step-by-step guides for the two largest infrastructure items in §14 (Steps 4 and 6). Each guide includes the reasoning, engineering principles, mechanical instructions, interview preparation, and common pitfalls.

---

### 15.1 CI/CD with GitHub Actions

**Time estimate**: 2–4 hours  
**Resume line**: "Designed and implemented CI/CD pipeline with GitHub Actions — automated linting, testing, and build verification on every push and pull request"  
**Prerequisites**: GitHub repository, existing `npm run lint` and `npm run test` scripts in both `backend/` and `frontend/`

---

#### 15.1.1 Why CI/CD

**The engineering argument**: Continuous Integration is the practice of merging all developer working copies to a shared mainline several times a day, with each merge verified by an automated build. Without CI, the only guarantee that code works is "it worked on my machine." CI catches regressions the moment they are introduced, not days later when someone tries to deploy.

**The resume argument**: CI/CD is table stakes. It is the single most expected infrastructure item on any software project. A portfolio project without CI suggests the developer has not worked on a team or does not understand the deployment lifecycle. A GitHub Actions workflow file is visible to anyone who visits the repository — recruiters, hiring managers, and interviewers will see the green checkmark (or its absence) before they read a line of code.

**Why before Docker**: CI/CD does not depend on Docker. The GitHub Actions runners come with Node.js, npm, and PostgreSQL pre-installed. Adding Docker later is an enhancement to CI, not a prerequisite. Starting with CI also means every subsequent change (Docker, Redis, health check) is automatically verified.

---

#### 14.1.2 Engineering Principles and Design Patterns

**Fail-Fast Principle**: The pipeline is structured so the cheapest checks run first. Linting (seconds) catches syntax and style issues before tests (which take longer) run. If linting fails, the pipeline aborts immediately — no point running tests on code that does not pass the linter. This mirrors the circuit breaker pattern already in the codebase: stop doing expensive work when a cheap check has already failed.

**Separation of Concerns**: The workflow is split into distinct jobs — one for the backend, one for the frontend. Each job is independent and can run in parallel. This mirrors the layered architecture in the codebase (§1.1): the backend and frontend are separate concerns with separate dependencies and separate test suites. A failure in the frontend test suite does not block visibility into backend test results, and vice versa.

**Idempotency**: Every CI run starts from a clean environment. There is no leftover state from a previous run. The runner checks out the code, installs dependencies, runs checks, and discards everything. This guarantees that a passing pipeline means the code works from scratch — not that it works because some cached artifact from a previous run happens to be present.

**Shift-Left Testing**: "Shift left" means moving quality checks earlier in the development lifecycle. By running lint and tests on every push and pull request, defects are caught at the earliest possible moment — before code reaches the main branch, before it reaches staging, and long before it reaches production. The cost of fixing a bug increases roughly 10x at each stage (dev → CI → staging → production); CI catches bugs at the cheapest stage.

**Infrastructure as Code**: The workflow definition (`.github/workflows/ci.yml`) is a YAML file checked into the repository. It is versioned, reviewable, and reproducible. Anyone who clones the repository gets the exact same CI configuration. This is the same principle as the `docker-compose.yml` (§14.2) and the `config.ts` pattern: infrastructure is defined in code, not in a web UI.

---

#### 14.1.3 Concepts You Need to Understand

**GitHub Actions vocabulary**:

- **Workflow**: A YAML file in `.github/workflows/` that defines an automated process. Triggered by events (push, pull_request, schedule, manual).
- **Job**: A set of steps that run on a single runner (virtual machine). Jobs in the same workflow run in parallel by default. Use `needs:` to create sequential dependencies.
- **Step**: A single task within a job. Can be a shell command (`run:`) or a reusable action (`uses:`).
- **Runner**: The virtual machine that executes a job. `ubuntu-latest` is the standard choice — it comes with Node.js, Python, Docker, PostgreSQL, and most common tools pre-installed.
- **Action**: A reusable unit of CI logic published to the GitHub Marketplace. `actions/checkout@v4` checks out your code. `actions/setup-node@v4` installs a specific Node.js version.
- **Matrix**: Run the same job across multiple configurations (e.g., Node 20 and Node 22). Useful for library projects; for applications with a single target runtime, a matrix is unnecessary overhead.
- **Artifact**: A file produced by one job and consumed by another (or downloaded later). Used for build outputs, test reports, and coverage files.

**How GitHub Actions pricing works**: Public repositories get unlimited free CI minutes. Private repositories get 2,000 free minutes per month on the free plan, 3,000 on Pro. Each job's runtime is metered. A workflow with two parallel jobs that each take 2 minutes uses 4 minutes of quota. Caching `node_modules` reduces runtime and thus cost.

**PostgreSQL in CI**: GitHub Actions runners have PostgreSQL pre-installed but not running. You can either start the system PostgreSQL service or use a Docker container via `services:`. The service container approach is more portable and explicit — it declares the exact PostgreSQL version and credentials in the workflow file, rather than depending on whatever version the runner happens to have.

---

#### 14.1.4 Step-by-Step Implementation

**Step 1: Create the workflow directory**

```bash
mkdir -p .github/workflows
```

GitHub Actions only reads workflow files from `.github/workflows/` at the repository root. The directory must exist and the file must have a `.yml` or `.yaml` extension.

**Step 2: Create the CI workflow file**

Create `.github/workflows/ci.yml` with the following content. Each section is annotated with the reasoning.

```yaml
name: CI

# Trigger: run on every push to main and on every pull request targeting main.
# This ensures main is always green and PRs are validated before merge.
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # ─── Backend ────────────────────────────────────────────────
  backend:
    name: Backend — Lint, Test, Build
    runs-on: ubuntu-latest

    # PostgreSQL service container — provides a clean database for
    # integration tests without depending on the runner's system Postgres.
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: steam_collab
        ports:
          - 5432:5432
        # Health check: wait for Postgres to accept connections before
        # starting steps. Without this, tests may fail because the DB
        # is not ready when npm test runs.
        options: >-
          --health-cmd="pg_isready -U postgres"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5

    defaults:
      run:
        working-directory: backend

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: npm ci
        # npm ci (clean install) is preferred over npm install in CI:
        # it installs exact versions from package-lock.json, fails if
        # the lock file is out of sync, and is faster because it skips
        # the dependency resolution step.

      - name: Lint
        run: npm run lint
        # Fail-fast: lint runs before tests. If code style is broken,
        # there is no point running the full test suite.

      - name: Test
        run: npm test
        env:
          STEAM_API_KEY: test_key_for_ci
          PGHOST: localhost
          PGDATABASE: steam_collab
          PGUSER: postgres
          PGPASSWORD: postgres
          PGPORT: 5432
          PORT: 3000
        # Environment variables are scoped to this step. The Steam API
        # key is a dummy — unit tests mock the Steam service. PG vars
        # point to the service container.

      - name: Build
        run: npm run build
        # TypeScript compilation. Catches type errors that tests might
        # miss (e.g., unused imports with strict mode, type mismatches
        # in files without test coverage).

  # ─── Frontend ───────────────────────────────────────────────
  frontend:
    name: Frontend — Test, Build
    runs-on: ubuntu-latest

    defaults:
      run:
        working-directory: frontend

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Test
        run: npm test

      - name: Build
        run: npm run build
        # Angular production build. Catches template errors, AOT
        # compilation issues, and missing imports that the dev server
        # might not surface.
```

**Why this structure**:

- Two parallel jobs (backend, frontend) — independent concerns run independently.
- Backend job includes a PostgreSQL service container — tests can run against a real database if integration tests are added later. The existing unit tests mock the DB, so this is forward-looking.
- `npm ci` over `npm install` — deterministic installs from the lock file.
- `actions/setup-node@v4` with `cache: npm` — caches the npm download cache between runs, reducing install time from ~30s to ~5s on cache hit.
- Lint → Test → Build order — cheapest check first.

**Step 3: Verify the lint script works locally**

Before pushing, confirm lint and test pass locally:

```bash
cd backend && npm run lint && npm test && npm run build
cd ../frontend && npm test && npm run build
```

If `npm run lint` fails because there is no `.eslintrc` or `eslint.config` file, you need to create one. The `package.json` has `"lint": "eslint src/**/*.ts"` but no ESLint configuration was found in the repository. Create a minimal one:

```bash
# From backend/
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

Then create `backend/eslint.config.mjs`:

```javascript
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
```

**Step 4: Ensure `package-lock.json` is committed**

`npm ci` requires `package-lock.json` to exist. If it is in `.gitignore`, remove it. The lock file should always be committed for applications (as opposed to libraries).

```bash
git ls-files backend/package-lock.json frontend/package-lock.json
```

If either is missing, run `npm install` in that directory to generate it, then `git add` it.

**Step 5: Push and verify**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for backend and frontend"
git push
```

Navigate to the repository's **Actions** tab on GitHub. You should see the workflow running. Both jobs (backend and frontend) should appear as parallel pipelines. Green checkmarks indicate success.

**Step 6: Add a branch protection rule (optional, 30 minutes)**

On GitHub, go to Settings → Branches → Add rule. Set the branch name pattern to `main`. Enable "Require status checks to pass before merging" and select both the `backend` and `frontend` jobs. This prevents merging PRs that fail CI — the automated gatekeeper that makes CI meaningful.

---

#### 14.1.5 How to Discuss This in an Interview

**Question**: "Tell me about your CI/CD setup."

**Strong answer**: "I set up a GitHub Actions pipeline with two parallel jobs — one for the backend (Node/Express/TypeScript), one for the Angular frontend. The backend job spins up a PostgreSQL service container so tests run against a real database. The pipeline runs lint first as a fail-fast gate, then unit tests, then a full TypeScript build to catch type errors in files without test coverage. I use `npm ci` for deterministic installs and cache the npm store between runs. Branch protection requires both jobs to pass before merging to main."

**Follow-up they might ask**: "Why two jobs instead of one?" → "Separation of concerns. The backend and frontend have independent dependency trees and test suites. Running them in parallel cuts wall-clock time in half and makes it immediately clear which side broke."

**Follow-up they might ask**: "Why a PostgreSQL service container if your tests mock the database?" → "Forward-looking. The mock-based unit tests are already in place, but the service container means I can add integration tests that hit a real database without changing the CI config. The cost is about 10 seconds of startup time."

---

#### 14.1.6 Common Pitfalls


| Pitfall                                    | Symptom                          | Fix                                                                      |
| ------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------ |
| `npm ci` fails with "no package-lock.json" | CI fails at install step         | Commit `package-lock.json`; remove from `.gitignore`                     |
| Lint fails because no ESLint config exists | `npm run lint` exits non-zero    | Create `eslint.config.mjs` (see Step 3)                                  |
| Tests fail because env vars are missing    | `config.ts` reads undefined keys | Add `env:` block to the test step with dummy values                      |
| PostgreSQL service not ready               | Connection refused errors        | Ensure `options:` includes `--health-cmd` and `--health-retries`         |
| Cache miss every run                       | Slow installs                    | Verify `cache-dependency-path` points to the correct `package-lock.json` |
| Frontend build fails with AOT errors       | Template compilation errors      | Run `npm run build` locally first; fix template issues before pushing    |


---

### 14.2 Docker and docker-compose

**Time estimate**: 4–8 hours  
**Resume line**: "Containerized full-stack application with Docker multi-stage builds and docker-compose orchestration for API, PostgreSQL, and development parity"  
**Prerequisites**: Docker Desktop installed locally, basic understanding of what a container is

---

#### 14.2.1 Why Docker Second

**The engineering argument**: Docker solves the "works on my machine" problem. Today, the project requires manual installation of Node.js v22, PostgreSQL, creating the `steam_collab` database, configuring `.env`, and running the data pipeline — all documented in the Quick Start section but easy to get wrong. A `docker-compose up` command replaces all of that with a single, reproducible step. It also enforces environment parity: the container that runs in development is the same image that runs in production (or CI).

**The resume argument**: "Containerized services" and "docker-compose orchestration" are two of the most universally recognized infrastructure skills. They appear in nearly every backend and full-stack job listing. Docker is also the foundation for Kubernetes, cloud deployment, and most CI/CD pipelines — without it, those items cannot credibly appear on a resume.

**Why after CI/CD**: Docker is a larger lift (4–8h vs 2–4h) and CI/CD provides immediate value without Docker. Once CI is in place, Docker adds a second layer: the CI pipeline can build and test Docker images, and `docker-compose` can be used for local development. The two reinforce each other.

---

#### 14.2.2 Engineering Principles and Design Patterns

**Immutable Infrastructure**: A Docker image is a point-in-time snapshot of the application and its dependencies. Once built, it does not change. Deploying means replacing the old container with a new one, not SSH-ing into a server and running `git pull`. This eliminates configuration drift — the state where a server gradually diverges from its intended configuration due to ad-hoc manual changes.

**Multi-Stage Builds (Builder Pattern)**: The Dockerfile uses two stages: a "build" stage that compiles TypeScript and installs all dependencies (including devDependencies), and a "production" stage that copies only the compiled JavaScript and production dependencies. This is the Builder pattern applied to container construction. The build stage has access to the full toolchain; the production stage is minimal. The result is a smaller image (hundreds of MB smaller) that contains no TypeScript source, no test files, and no dev tools — reducing the attack surface and improving startup time.

**Separation of Concerns (via compose services)**: `docker-compose.yml` defines each component as a separate service: the API, the database, and optionally Redis (for later). Each service has its own container, its own network identity, and its own lifecycle. This mirrors the layered architecture (§1.1) at the infrastructure level. The API does not know or care how PostgreSQL is installed or configured — it connects to a hostname (`postgres`) on port `5432`.

**Twelve-Factor App — III. Config**: The Twelve-Factor methodology (a widely-referenced set of best practices for cloud-native applications) states that configuration should be stored in environment variables, not in code. The `docker-compose.yml` file passes environment variables to containers, and the application reads them via `config.ts`. This is already partially implemented (dotenv), but Docker makes it explicit: the `environment:` block in compose is the single source of truth for each container's configuration.

**Twelve-Factor App — VI. Processes**: Containers should be stateless and share-nothing. Each request is independent. The RecommenderService's in-memory data appears to violate this, but it is loaded from files baked into the image — the data is immutable after startup and identical across all instances. The container can be killed and restarted without data loss (PostgreSQL holds persistent data in a named volume).

**Principle of Least Privilege**: The production image runs as a non-root user (`node`). By default, Docker containers run as root, which means a vulnerability in the application could compromise the host filesystem. Running as a non-root user limits the blast radius.

---

#### 14.2.3 Concepts You Need to Understand

**Docker vocabulary**:

- **Image**: A read-only template containing the application, its dependencies, and configuration. Built from a Dockerfile. Think of it as a class.
- **Container**: A running instance of an image. Think of it as an object. Multiple containers can run from the same image.
- **Dockerfile**: A text file with instructions (`FROM`, `RUN`, `COPY`, `CMD`) that define how to build an image. Each instruction creates a layer.
- **Layer**: Docker images are composed of stacked filesystem layers. Each Dockerfile instruction creates a layer. Layers are cached — if a layer has not changed, Docker reuses the cached version. This is why `COPY package*.json` and `RUN npm ci` come before `COPY . .` — the dependency layer is cached until `package.json` or `package-lock.json` changes.
- **Volume**: Persistent storage that survives container restarts. Used for PostgreSQL data (`pgdata:/var/lib/postgresql/data`). Without a volume, the database is wiped every time the container stops.
- **Network**: Docker creates an isolated network for compose services. Containers refer to each other by service name (e.g., `postgres`), not `localhost`.
- **docker-compose**: A tool for defining and running multi-container Docker applications. A `docker-compose.yml` file describes all services, their images, environment variables, ports, volumes, and dependencies.

**Multi-stage build mechanics**: A Dockerfile can have multiple `FROM` instructions. Each `FROM` starts a new stage. You can copy files from a previous stage using `COPY --from=builder /app/dist ./dist`. Only the final stage ends up in the image. This lets you use heavy tools (TypeScript compiler, dev dependencies) in the build stage without shipping them in the production image.

**Why `npm ci` in Docker**: Same reason as in CI (§14.1.4 Step 2). Deterministic installs. In Docker, this has an additional benefit: the `npm ci` layer is cached as long as `package*.json` has not changed. Changing a source file does not invalidate the dependency layer.

**.dockerignore**: Similar to `.gitignore`, this file tells Docker which files to exclude from the build context (the set of files sent to the Docker daemon). Excluding `node_modules`, `dist`, `.git`, and data files reduces build context size and prevents local artifacts from leaking into the image.

---

#### 14.2.4 Step-by-Step Implementation

**Step 1: Create `.dockerignore` at the repository root**

```
node_modules
dist
.git
.github
*.md
backend/data/raw
backend/data/processed
.env
.env.*
```

**Why**: Without `.dockerignore`, Docker sends everything (including `node_modules`, git history, and large data files) to the daemon as build context. This slows down builds and can accidentally include secrets.

**Step 2: Create the backend Dockerfile**

Create `backend/Dockerfile`:

```dockerfile
# ── Stage 1: Build ─────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests first (layer caching optimization).
# This layer is only rebuilt when package.json or package-lock.json changes.
COPY package.json package-lock.json ./

RUN npm ci

# Copy source code and compile TypeScript.
COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ── Stage 2: Production ───────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Run as non-root for security (Principle of Least Privilege).
USER node

COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./

# Install production dependencies only.
RUN npm ci --omit=dev

COPY --from=builder --chown=node:node /app/dist ./dist

# Recommender data files — copied separately so the layer is only
# rebuilt when the data changes, not on every code change.
COPY --chown=node:node data/processed ./data/processed

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

**Key decisions explained**:

- `node:22-alpine` — Alpine-based images are ~5x smaller than Debian-based (150MB vs 800MB). Less surface area, faster pulls.
- `COPY package*.json` before `COPY src/` — layer caching. Dependencies change rarely; source code changes frequently.
- `npm ci --omit=dev` in production stage — no TypeScript, no Jest, no ts-node-dev in the final image.
- `USER node` — the `node` user is created by the base image. Running as non-root.
- `COPY data/processed` — the pre-computed recommender data is baked into the image. This means the image is self-contained; it does not need a volume mount for recommender data.

**Step 3: Create `docker-compose.yml` at the repository root**

```yaml
services:
  # ─── PostgreSQL ───────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: steam_collab
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── Backend API ──────────────────────────────────────────
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      PORT: 3000
      STEAM_API_KEY: ${STEAM_API_KEY}
      PGHOST: postgres
      PGDATABASE: steam_collab
      PGUSER: postgres
      PGPASSWORD: postgres
      PGPORT: 5432
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

volumes:
  pgdata:
```

**Key decisions explained**:

- `depends_on` with `condition: service_healthy` — the API container does not start until PostgreSQL is accepting connections. This prevents the "connection refused" race condition that happens when the API starts before the database is ready. The `healthcheck` on the postgres service drives this.
- `PGHOST: postgres` — inside the Docker network, the PostgreSQL container is reachable at hostname `postgres` (the service name). Not `localhost`.
- `${STEAM_API_KEY}` — reads from the host's environment or a `.env` file at the repository root. Secrets are not hardcoded in `docker-compose.yml`.
- `pgdata` named volume — PostgreSQL data persists across container restarts. Removing the volume (`docker volume rm cs125_pgdata`) resets the database.
- `restart: unless-stopped` — the API container restarts automatically if it crashes, unless you explicitly stop it. Production behavior.
- No frontend service yet — the Angular dev server is not ideal for Docker (it uses file watchers that do not play well with container filesystems). Add it later with a separate Dockerfile using `ng build` and an nginx container for serving the static build.

**Step 4: Fix the `config/db.ts` password issue**

The codebase exploration revealed that `config.ts` defines `pgPassword` but `db.ts` does not pass it to the Pool. This will cause connection failures in Docker (where PostgreSQL requires password authentication). Fix it:

In `backend/src/config/db.ts`, add `password: config.pgPassword` to the Pool configuration:

```typescript
export const pool = new Pool({
  host: config.pgHost,
  database: config.pgDatabase,
  user: config.pgUser,
  port: config.pgPort,
  password: config.pgPassword,
});
```

**Why this matters**: On local development, PostgreSQL often uses `trust` authentication (no password needed). Inside Docker, the PostgreSQL container is configured with `POSTGRES_PASSWORD=postgres`, which enforces password authentication. Without this fix, the API cannot connect to the database.

**Step 5: Create a `.env` file at the repository root (for docker-compose)**

```bash
# .env (repository root — do NOT commit this file)
STEAM_API_KEY=your_actual_steam_api_key
```

Add `.env` to `.gitignore` if it is not already there. The `docker-compose.yml` reads `${STEAM_API_KEY}` from this file.

**Step 6: Build and run**

```bash
# From repository root
docker compose up --build
```

This will:

1. Build the `api` image from `backend/Dockerfile` (multi-stage: compile TypeScript, then create production image).
2. Pull `postgres:16-alpine` if not already cached.
3. Start PostgreSQL, wait for its healthcheck to pass.
4. Start the API container, connected to PostgreSQL.

Verify:

```bash
curl http://localhost:3000/api/health
# Should return: {"status":"ok","timestamp":"..."}

curl http://localhost:3000/api/search?keyword=portal
# Should return search results (if database is populated)
```

**Step 7: Add a `docker-compose.dev.yml` override for development (optional, 30 min)**

For development, you want hot-reload (source file changes reflected without rebuilding the image). Create `docker-compose.dev.yml`:

```yaml
services:
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: builder
    command: npx ts-node-dev --respawn --transpile-only src/index.ts
    volumes:
      - ./backend/src:/app/src:ro
    environment:
      NODE_ENV: development
```

Run with:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

This mounts your local `src/` directory into the builder-stage container and runs `ts-node-dev` for hot reload. Changes to source files are reflected immediately without rebuilding the image.

**Step 8: Integrate Docker into CI (enhancement to §14.1)**

Add a step to the CI workflow that verifies the Docker image builds successfully:

```yaml
      - name: Build Docker image
        run: docker build -t steam-rec-api:ci .
        working-directory: backend
```

This does not run the container in CI — just verifies the Dockerfile is valid and the build succeeds. A failing Docker build should block the PR just like a failing test.

---

#### 14.2.5 How to Discuss This in an Interview

**Question**: "Tell me about your Docker setup."

**Strong answer**: "I containerized the backend with a multi-stage Dockerfile — the build stage compiles TypeScript and installs all dependencies, then the production stage copies only the compiled JS and production deps. The final image runs as a non-root user on Alpine, so it is about 150MB. I use docker-compose to orchestrate the API and PostgreSQL with a healthcheck-based startup dependency, so the API waits for Postgres to be ready before starting. The recommender data files are baked into the image so it is self-contained. For development, I have a compose override that mounts the source directory and runs ts-node-dev for hot reload."

**Follow-up they might ask**: "Why multi-stage?" → "Two reasons. First, image size — the build stage has TypeScript, Jest, and dev tools that add hundreds of megabytes. The production stage only has the compiled JavaScript and runtime dependencies. Second, security — fewer tools in the image means a smaller attack surface."

**Follow-up they might ask**: "Why not just use `node:22` instead of `node:22-alpine`?" → "Alpine is about 5x smaller. The trade-off is that Alpine uses `musl` instead of `glibc`, which can cause issues with native Node modules that link against `glibc`. For this project, all dependencies are pure JavaScript, so Alpine works fine."

**Follow-up they might ask**: "How do you handle database migrations?" → "Currently, the schema is created by the data pipeline (`npm run data:process`). For production, I would add a migration tool like `node-pg-migrate` and run migrations as a Docker entrypoint script or a separate init container."

---

#### 14.2.6 Common Pitfalls


| Pitfall                                                | Symptom                                         | Fix                                                                                                            |
| ------------------------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| API cannot connect to PostgreSQL                       | `ECONNREFUSED 127.0.0.1:5432`                   | Use `PGHOST=postgres` (service name), not `localhost`. Inside Docker, `localhost` is the container itself.     |
| PostgreSQL requires password but API does not send one | `password authentication failed`                | Add `password: config.pgPassword` to `pg.Pool` in `db.ts` (Step 4)                                             |
| Docker build includes `node_modules` from host         | Huge build context; stale dependencies in image | Create `.dockerignore` with `node_modules` (Step 1)                                                            |
| Data files missing in container                        | Recommender returns 503                         | Ensure `COPY data/processed ./data/processed` is in the Dockerfile and the files exist locally before building |
| Container starts before Postgres is ready              | Connection errors on first request              | Use `depends_on` with `condition: service_healthy` and add a `healthcheck` to the postgres service             |
| Image is too large (>500MB)                            | Slow pulls, slow deploys                        | Verify multi-stage build is correct; ensure `npm ci --omit=dev` is used in the production stage                |
| Hot reload does not work in dev                        | Code changes have no effect                     | Use `docker-compose.dev.yml` override with volume mount (Step 7)                                               |


---

#### 14.2.7 Additional Learning: The Docker Build Cache

Understanding Docker's layer cache is essential for writing efficient Dockerfiles. Each instruction (`FROM`, `RUN`, `COPY`, etc.) creates a layer. Docker caches each layer and reuses it if the inputs have not changed.

**Cache invalidation rules**:

- `COPY` invalidates if any copied file has changed (by content hash, not modification time).
- `RUN` invalidates if the command string has changed or if any previous layer was invalidated.
- Once a layer is invalidated, all subsequent layers are also invalidated (the cache is linear).

**Practical implication**: Order your Dockerfile instructions from least-frequently-changed to most-frequently-changed.

```
COPY package.json package-lock.json ./   ← changes rarely
RUN npm ci                                ← cached until package.json changes
COPY src/ ./src/                          ← changes every commit
RUN npm run build                         ← runs every time src/ changes
```

If you put `COPY . .` before `RUN npm ci`, then every source code change invalidates the `npm ci` layer, and Docker re-downloads all dependencies every time. This turns a 5-second build into a 60-second build.

---

### 14.3 What to Implement After These Two

With CI/CD and Docker in place, the next highest-return steps from §13.2 are:


| Priority | Initiative                       | Time  | Why next                                                                                                                                                                                                   |
| -------- | -------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3        | Health check + graceful shutdown | 3–6h  | Completes the "production-ready" narrative. The health check can now be used by Docker's `healthcheck` directive for the API container. Graceful shutdown ensures `docker stop` does not drop connections. |
| 4        | Redis caching                    | 8–10h | Docker makes Redis trivial to add (one service in `docker-compose.yml`). The CI pipeline validates the caching layer automatically.                                                                        |
| 5        | Dependency injection             | 8–10h | Improves testability. CI verifies the refactored code does not break anything.                                                                                                                             |


Each subsequent initiative builds on the CI/CD + Docker foundation. This is why these two are the correct starting point.
