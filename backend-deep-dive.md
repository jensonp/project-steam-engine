# Backend Deep-Dive: Exhaustive File-by-File Technical Reference

> **Project**: Steam Game Recommendation Engine (PSE — Project Steam Engine)
>
> **Stack**: Node.js · Express 4 · TypeScript 5.3 · PostgreSQL · Zod 4 · Axios · pg (no ORM)
>
> **Runtime Architecture**: A stateless HTTP JSON API that composes three data sources — the Steam Web API (live), a local PostgreSQL database (batch-loaded from Kaggle), and a pre-computed in-memory similarity index — to serve game search, metadata lookup, and personalized recommendation endpoints.

---

## Table of Contents

1. [Configuration Layer](#1-configuration-layer)
2. [Entry Point — index.ts](#2-entry-point--indexts)
3. [Config Module — config.ts](#3-config-module--configts)
4. [Database Layer — config/db.ts](#4-database-layer--configdbts)
5. [Type System — steam.types.ts](#5-type-system--steamtypests)
6. [Validation Middleware — validate.middleware.ts](#6-validation-middleware--validatemiddlewarets)
7. [Route Layer](#7-route-layer)
   - 7.1 [user.routes.ts](#71-userroutests)
   - 7.2 [game.routes.ts](#72-gameroutests)
   - 7.3 [search.routes.ts](#73-searchroutests)
   - 7.4 [recommend.routes.ts](#74-recommendroutests)
8. [Service Layer](#8-service-layer)
   - 8.1 [steam.service.ts](#81-steamservicets)
   - 8.2 [search.service.ts](#82-searchservicets)
   - 8.3 [recommender.service.ts](#83-recommenderservicets)
   - 8.4 [user-profile.service.ts](#84-user-profileservicets)
9. [Data Pipeline Scripts](#9-data-pipeline-scripts)
   - 9.1 [download-dataset.ts](#91-download-datasetsts)
   - 9.2 [process-dataset.ts](#92-process-datasetsts)
   - 9.3 [build-recommender.ts](#93-build-recommenderts)
   - 9.4 [Inspection Utilities](#94-inspection-utilities)
10. [Shell Scripts](#10-shell-scripts)
11. [Python Scripts](#11-python-scripts)
12. [Test Suite](#12-test-suite)
13. [Architectural Diagrams](#13-architectural-diagrams)
14. [Formal Algorithmic & Systems-Level Decomposition](#14-formal-algorithmic--systems-level-decomposition)

- 14.1 [Primitive Operations Catalog](#141-primitive-operations-catalog)
- 14.2 [Algorithmic Composition](#142-algorithmic-composition--from-primitives-to-algorithms)
- 14.3 [System-Level Execution Traces](#143-system-level-execution-traces)
- 14.4 [Interface & Abstract Boundary Decomposition](#144-interface--abstract-boundary-decomposition)

---

## 1. Configuration Layer

### 1.1 `package.json`

**File**: `backend/package.json`

This manifest declares the backend as `pse-backend` v1.0.0 and defines the complete dependency graph and script interface.

**Runtime Dependencies — why each exists:**

| Dependency  | Version | Role                                                                                                                                                                                                                                                                    |
| ----------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `express`   | ^4.18.0 | HTTP framework. Provides the `Router`, middleware pipeline, `req`/`res` abstraction. Version 4 uses the callback-based error model (4-arity handler).                                                                                                                   |
| `cors`      | ^2.8.5  | Express middleware that sets `Access-Control-Allow-*` headers. Required because the Angular frontend (port 4200) makes cross-origin requests to the API (port 3000). Without this, browsers enforce the Same-Origin Policy and block the preflight `OPTIONS` request.   |
| `pg`        | ^8.18.0 | PostgreSQL client for Node.js. Exposes `Pool` (connection pooling) and `Client` (single connection). This project uses `Pool` exclusively. The driver communicates over the PostgreSQL wire protocol (libpq binary format) on the configured port.                      |
| `axios`     | ^1.6.0  | HTTP client used to call the Steam Web API and Steam Store API. Chosen over `fetch` (which is available in Node 18+) because Axios provides typed response generics (`get<T>`), automatic JSON parsing, configurable `baseURL`, and interceptor support out of the box. |
| `zod`       | ^4.3.6  | Schema declaration and validation library. Used to validate every inbound HTTP request (params, query, body) before it reaches route handler logic. Zod schemas double as TypeScript type inference sources via `z.infer<typeof schema>`.                               |
| `csv-parse` | ^6.1.0  | Parses CSV files from the Kaggle Steam dataset during the offline data pipeline. Uses the synchronous `parse` API (`csv-parse/sync`) to load the entire CSV into memory at once.                                                                                        |
| `dotenv`    | ^16.3.0 | Reads `.env` files and injects their key-value pairs into `process.env`. This project loads two `.env` files with a defined precedence (see Section 3).                                                                                                                 |

**Dev Dependencies — key choices:**

| Dependency                         | Purpose                                                                                                                                                                                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typescript` ^5.3.0                | Compiler. `strict: true` mode enforces `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, etc.                                                                                                                                                  |
| `ts-node-dev` ^2.0.0               | Development server. Combines `ts-node` (JIT TypeScript compilation via the TypeScript compiler API) with file-watching and process restart. `--transpile-only` skips type-checking at dev time for speed; type errors are caught by `tsc` at build time. |
| `jest` ^30.2.0 + `ts-jest` ^29.4.6 | Test runner. `ts-jest` transforms `.ts` files on the fly so Jest can execute them. The `preset: 'ts-jest'` in `jest.config.js` handles this.                                                                                                             |
| `supertest` ^7.2.2                 | HTTP assertion library. Spins up an in-memory Express server (no network socket) via `request(app)` and allows chaining assertions on status codes, headers, and response bodies.                                                                        |
| `@types/*`                         | TypeScript declaration files for `express`, `cors`, `pg`, `node`, `jest`, `supertest`. These provide type information for libraries written in JavaScript.                                                                                               |

**Script definitions:**

```
"dev"                 ->  ts-node-dev --respawn --transpile-only src/index.ts
"build"               ->  tsc                (produces dist/ from src/)
"start"               ->  node dist/index.js (production entry point)
"test"                ->  jest
"data:download"       ->  ts-node src/scripts/download-dataset.ts
"data:process"        ->  ts-node src/scripts/process-dataset.ts
"data:build-recommender"  ->  ts-node src/scripts/build-recommender.ts
"data:pipeline"       ->  npm run data:process && npm run data:build-recommender
"dev:full"            ->  bash scripts/dev-start.sh
```

The `data:pipeline` script chains `process` then `build-recommender` sequentially via `&&`. This enforces the dependency: `build-recommender` requires the processed output from `process-dataset`.

### 1.2 `tsconfig.json`

**File**: `backend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Key settings and their consequences:

- **`target: "ES2020"`** — The compiler emits ES2020 syntax, which means `optional chaining` (`?.`), `nullish coalescing` (`??`), `BigInt`, `Promise.allSettled`, and `globalThis` are emitted as-is rather than downleveled. This is safe because the runtime is Node.js (which supports ES2020 natively since v14).

- **`module: "commonjs"`** — Output uses `require()` / `module.exports`. This is necessary because `ts-node-dev` and Node.js (without the `--experimental-modules` flag or `"type": "module"` in `package.json`) expect CommonJS modules. When you write `import express from 'express'` in TypeScript, the compiler emits `const express_1 = require("express")`.

- **`esModuleInterop: true`** — Enables synthetic default imports. Without this, `import express from 'express'` would fail because the `express` package uses `module.exports = createApplication` (a CommonJS default export), not `export default`. With `esModuleInterop`, the compiler generates a `__importDefault` helper that wraps CommonJS modules to provide a `.default` property.

- **`strict: true`** — Enables the entire `strict` family: `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitAny`, `noImplicitThis`, `alwaysStrict`. This forces you to handle `null | undefined` explicitly, catch missing properties, and fully type function signatures.

- **`declaration: true` + `declarationMap: true`** — Generates `.d.ts` declaration files and `.d.ts.map` files alongside the JavaScript output. These are useful if the backend were consumed as a library, and they allow IDEs to navigate from compiled output back to source.

- **`sourceMap: true`** — Generates `.js.map` files so stack traces in errors point to the original `.ts` line numbers rather than the compiled `.js` lines.

- **`resolveJsonModule: true`** — Allows `import data from './file.json'` with full type inference on the JSON structure.

### 1.3 `.env.example`

**File**: `backend/src/.env.example`

```
STEAM_API_KEY=your_steam_api_key_here
PORT=3000
PGHOST=localhost
PGDATABASE=steam_collab
PGUSER=postgres
PGPASSWORD=your_postgres_password
PGPORT=8080
```

This documents the six environment variables the backend requires. The `STEAM_API_KEY` is obtained from [Valve's developer portal](https://steamcommunity.com/dev/apikey). The `PG*` variables follow the libpq convention (PostgreSQL's C client library), which means tools like `psql` also recognize them natively. Note that `PGPORT` defaults to 8080 here (non-standard; PostgreSQL's default is 5432) — this suggests the developer's local Postgres instance runs on a custom port.

### 1.4 `jest.config.js`

**File**: `backend/jest.config.js`

```js
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  clearMocks: true,
  silent: false,
};
```

- **`preset: 'ts-jest'`** — Tells Jest to use `ts-jest` as the transformer for `.ts` files. Under the hood, `ts-jest` invokes the TypeScript compiler API (`ts.transpileModule`) on each test file before Jest executes it.
- **`testEnvironment: 'node'`** — Uses Node.js globals (`process`, `Buffer`, `require`) instead of a jsdom browser emulation. Correct for a server-side project.
- **`roots: ['<rootDir>/src']`** — Jest only looks inside `src/` for test files. This prevents it from scanning `node_modules/` or `dist/`.
- **`testMatch`** — Glob pattern: any file matching `**/__tests__/**/*.test.ts` is treated as a test. This convention co-locates tests next to the modules they test (e.g., `services/__tests__/search.service.test.ts` sits next to `services/search.service.ts`).
- **`clearMocks: true`** — Automatically calls `jest.clearAllMocks()` between every test. This resets mock call counts and return values, preventing state leakage between tests.
- **`silent: false`** — Allows `console.log` output from tests to appear in the terminal. Useful during development; you would set this to `true` in CI to reduce noise.

---

## 2. Entry Point — `index.ts`

**File**: [`index.ts`](backend/src/index.ts)

This file is the application root. It constructs the Express application, registers middleware, mounts route sub-routers, defines fallback handlers, and starts the HTTP listener.

### Full execution flow on startup:

```
1. import config            ->  triggers dotenv loading (side effect in config.ts)
2. import route modules     ->  triggers module evaluation (constructors, singletons)
3. validate config.port     ->  fatal exit if missing
4. create Express app       ->  app = express()
5. register cors()          ->  global middleware (all routes)
6. register express.json()  ->  global middleware (JSON body parsing)
7. mount routers            ->  4 sub-routers on /api/* paths
8. define health check      ->  GET /api/health
9. define 404 handler       ->  catch-all for unmatched routes
10. define error handler    ->  4-arity Express error middleware
11. app.listen(PORT)        ->  binds TCP socket, starts accepting connections
```

### Mechanical step-by-step execution of `index.ts`

**Step 1 — Module imports (lines 1–7)**:

When Node.js evaluates `require('./config')`, the `config.ts` module is loaded and executed **synchronously**. This triggers `dotenv.config()` twice (see Section 3), populating `process.env`. The config object is constructed and cached in the module system.

When `require('./routes/user.routes')` is evaluated, Node.js loads and evaluates `user.routes.ts`, which in turn `require`s `steam.service.ts` (for `getSteamService`), `steam.types.ts` (for `SteamApiError`), `zod` (for schema definitions), and `validate.middleware.ts`. Each module is loaded once and cached — if two route files both import `steam.service.ts`, the module is only evaluated once. This is the CommonJS module singleton guarantee.

**Step 2 — Config validation (lines 9–13)**:

```typescript
if (!config.port) {
  console.error("FATAL ERROR: PORT is not defined in config.");
  process.exit(1);
}
```

The `!config.port` check leverages JavaScript's falsy evaluation. Since `parseInt` returns `NaN` for unparseable strings, and `NaN` is falsy, this guard catches both missing and invalid PORT values. `process.exit(1)` terminates the Node.js process with exit code 1 (indicating failure). The exit code is consumed by process managers (systemd, Docker, PM2) to determine restart behavior.

**Step 3 — Express application construction (line 15)**:

```typescript
const app = express();
```

`express()` returns a function with signature `(req: IncomingMessage, res: ServerResponse) => void`. This function is also augmented with methods like `.use()`, `.get()`, `.listen()`. Internally, Express creates a new `Application` prototype instance that maintains an ordered array of middleware layers (the "stack").

**Step 4 — Global middleware registration (lines 19–20)**:

```typescript
app.use(cors());
app.use(express.json());
```

`cors()` is invoked immediately (not deferred) and returns a middleware function `(req, res, next) => void`. This function is pushed onto the application's middleware stack. When a request arrives, Express walks the stack top-to-bottom. `cors()` inspects the request's `Origin` header and, if present, sets `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, and `Access-Control-Allow-Headers` on the response. For `OPTIONS` preflight requests, it responds immediately with 204 (no content) and terminates the middleware chain.

`express.json()` is a built-in middleware (added in Express 4.16). It checks the `Content-Type` header; if it matches `application/json`, it reads the full request body from the stream, parses it with `JSON.parse()`, and assigns the result to `req.body`. If the body is not valid JSON, it calls `next(err)` with a `SyntaxError`, which propagates to the error handler.

**Step 5 — Router mounting (lines 23–26)**:

```typescript
app.use("/api/user", userRoutes);
app.use("/api/recommend", recommendRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/search", searchRoutes);
```

Each `app.use(prefix, router)` call creates a "layer" in the Express stack that matches any request whose path starts with the given prefix. When a request arrives at `/api/user/76561198012345678/library`, Express:

1. Strips the prefix `/api/user` from the path.
2. Passes the remainder `/:steamId/library` to the `userRoutes` router.
3. The router matches this against its own routes (registered via `router.get('/:steamId/library', ...)`).

**Step 6 — Health check endpoint (lines 29–34)**:

```typescript
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
```

This is a simple 2-arity handler (no `next`). `res.json()` internally calls `JSON.stringify()` on the object, sets `Content-Type: application/json`, and sends the response. The `timestamp` provides a liveness signal — monitoring systems can poll this endpoint and verify the server is responsive.

**Step 7 — 404 handler (lines 37–39)**:

```typescript
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});
```

This is a **2-arity middleware** registered after all routes. Express only reaches this if no prior route handler called `res.send()`, `res.json()`, or `res.end()`. The 2-arity signature distinguishes it from the error handler (which has 4 parameters). Express uses `Function.length` (the number of declared parameters) to differentiate.

**Step 8 — Error handler (lines 42–45)**:

```typescript
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  },
);
```

Express identifies error-handling middleware by its **4-parameter signature**. When any upstream middleware calls `next(err)` or throws an exception inside an `async` handler (with appropriate error propagation), Express skips all normal middleware and jumps directly to the first 4-arity middleware. This is the "catch-all" safety net.

**Step 9 — Server start (lines 48–50)**:

```typescript
app.listen(PORT, () => {
  console.log(` Backend server is running at: http://localhost:${PORT} `);
});
```

`app.listen(PORT)` is sugar for `http.createServer(app).listen(PORT)`. Internally:

1. Node.js creates an `http.Server` instance.
2. Passes the Express `app` function as the `requestListener` (called on every incoming HTTP request).
3. Calls `server.listen(PORT)`, which instructs the OS kernel to bind a TCP socket on the specified port.
4. The OS places the socket in the `LISTEN` state, ready to accept incoming TCP connections.
5. When the bind succeeds, Node.js emits the `'listening'` event, which triggers the callback.

### Middleware ordering matters

Express processes middleware in **registration order**. The sequence here is:

1. `cors()` runs first — it adds CORS headers to every response and handles `OPTIONS` preflight requests. If this were registered after the routers, preflight requests would hit the 404 handler instead.

2. `express.json()` parses the `Content-Type: application/json` request body into `req.body`. If this were missing, `req.body` would be `undefined` for POST requests (e.g., `/api/recommend/bytags`).

3. Route handlers run in mount order. Because Express matches routes top-down, the order of `app.use('/api/user', ...)` etc. does not matter for non-overlapping prefixes — but it would matter if two routers claimed the same path.

4. The 404 handler is a **2-arity middleware** `(req, res)` registered after all routes. Express only reaches this if no route handler called `res.send()` / `res.json()`.

5. The error handler is a **4-arity middleware** `(err, req, res, next)`. Express identifies error-handling middleware by its 4-parameter signature. This catches any `throw` or `next(err)` from upstream middleware/routes. It logs the error and returns a generic 500.

---

## 3. Config Module — `config.ts`

**File**: [`config.ts`](backend/src/config.ts)

### Mechanical execution flow

When this module is first `require`d (triggered by `import { config } from './config'` in `index.ts`), Node.js evaluates the entire file top-to-bottom:

**Step 1 — Import resolution**:

```typescript
import dotenv from "dotenv";
import path from "path";
```

Both are CommonJS modules. `dotenv` is loaded from `node_modules/dotenv/lib/main.js`; `path` is a Node.js built-in (no disk I/O needed — it's compiled into the Node.js binary).

**Step 2 — First dotenv load (root monorepo)**:

```typescript
const rootEnv =
  dotenv.config({ path: path.join(process.cwd(), "..", ".env") }).parsed || {};
```

Execution flow of `dotenv.config()`:

1. `path.join(process.cwd(), '..', '.env')` constructs an absolute path. If `cwd` is `/project/backend`, this resolves to `/project/.env`.
2. `dotenv.config({ path })` calls `fs.readFileSync(path, 'utf8')` — synchronous, blocking I/O.
3. If the file exists, `dotenv` parses it line-by-line: splits on the first `=`, trims whitespace, handles quoted values, and builds a `{ key: value }` object.
4. Each key-value pair is injected into `process.env` via `process.env[key] = value` (but only if the key doesn't already exist in `process.env` — dotenv does not overwrite existing environment variables by default).
5. The `.parsed` property contains the parsed object. If the file doesn't exist, `.parsed` is `undefined`, and the `|| {}` fallback produces an empty object.

**Step 3 — Second dotenv load (local src/.env)**:

```typescript
const localEnv =
  dotenv.config({ path: path.join(process.cwd(), "src", ".env") }).parsed || {};
```

Same process, but for `backend/src/.env`. Since `dotenv.config()` was already called once, any keys from `rootEnv` are already in `process.env`. The second call won't overwrite them (due to dotenv's default behavior), but the `.parsed` object captures the local file's values regardless.

**Step 4 — Object spread merge**:

```typescript
const envConfig = { ...rootEnv, ...localEnv };
```

JavaScript's spread operator creates a new object. Keys from `localEnv` overwrite same-named keys from `rootEnv`. This is the precedence mechanism — **local values win**.

**Step 5 — Config object construction**:

```typescript
export const config = {
  steamApiKey: envConfig.STEAM_API_KEY || process.env.STEAM_API_KEY || "",
  steamApiBaseUrl: "https://api.steampowered.com",
  steamStoreApiUrl: "https://store.steampowered.com/api",
  port: parseInt(envConfig.PORT || process.env.PORT || "3000", 10),
  pgHost: envConfig.PGHOST || process.env.PGHOST || "localhost",
  pgDatabase: envConfig.PGDATABASE || process.env.PGDATABASE || "steam_collab",
  pgUser: envConfig.PGUSER || process.env.PGUSER || "postgres",
  pgPort: parseInt(envConfig.PGPORT || process.env.PGPORT || "5432", 10),
  pgPassword: envConfig.PGPASSWORD || process.env.PGPASSWORD || "",
};
```

Each property uses a 3-tier fallback chain evaluated left-to-right via JavaScript's `||` operator:

```
envConfig.X  ||  process.env.X  ||  hardcoded default
   ↓                 ↓                    ↓
 Merged .env     OS env variable      Last resort
```

The `||` operator returns the first truthy value. Empty strings `''` are falsy, so if a `.env` file has `PORT=` (empty value), the chain falls through to `process.env.PORT`, then to the default.

**The full precedence chain** for any config value is:

```
localEnv (src/.env)  >  rootEnv (../.env)  >  process.env  >  hardcoded default
```

### `parseInt` for PORT and PGPORT:

Environment variables are always strings. `parseInt(str, 10)` converts to a base-10 integer. The radix `10` is explicit to avoid the historical JavaScript pitfall where `parseInt('08')` was interpreted as octal in older engines (returning 0 instead of 8). Modern engines default to base 10, but explicit radix is a defensive practice.

---

## 4. Database Layer — `config/db.ts`

**File**: [`db.ts`](backend/src/config/db.ts)

### Mechanical execution flow

When this module is first `require`d:

**Step 1 — Import and Pool construction**:

```typescript
import { Pool, QueryResult, QueryResultRow } from "pg";
import { config } from "../config";

export const pool = new Pool({
  host: config.pgHost,
  database: config.pgDatabase,
  user: config.pgUser,
  port: config.pgPort,
});
```

`new Pool({...})` does **not** immediately open a TCP connection to PostgreSQL. The `pg.Pool` constructor only stores the configuration and initializes internal state:

- `this._clients = []` — array of active `Client` connections.
- `this._idle = []` — array of idle clients available for reuse.
- `this._pendingQueue = []` — queue of pending query callbacks waiting for a free client.
- `this._ending = false` — pool lifecycle flag.

The first actual TCP connection is established lazily, on the first `pool.query()` call.

**Step 2 — Console log**:

```typescript
console.log(
  `[DB] Initialize connection pool: postgres://${config.pgUser}@${config.pgHost}:${config.pgPort}/${config.pgDatabase}`,
);
```

This runs at module load time (not at connection time). It logs the connection parameters for debugging. Note that the password is intentionally omitted from the log output.

**Step 3 — Query helper export**:

```typescript
export const query = <T extends QueryResultRow = any>(
  text: string,
  params?: any[],
): Promise<QueryResult<T>> => {
  return pool.query<T>(text, params);
};
```

### Connection Pooling — what `pg.Pool` actually does when `pool.query()` is called:

1. **Check idle clients**: If `this._idle.length > 0`, pop the most recently used idle client (LIFO order for TCP keepalive efficiency).
2. **Check capacity**: If no idle clients exist and `this._clients.length < max` (default 10), create a new `Client`:
   a. Open a TCP socket to `host:port`.
   b. Perform the PostgreSQL startup handshake (send `StartupMessage` with protocol version 3.0, database, user).
   c. PostgreSQL responds with an `AuthenticationRequest` (e.g., `AuthenticationMD5Password`).
   d. Client sends the password hash. PostgreSQL responds with `AuthenticationOk`.
   e. PostgreSQL sends `ParameterStatus` messages (server version, encoding, timezone), then `BackendKeyData` (process ID, secret key for cancel), then `ReadyForQuery`.
   f. The client is now ready to execute queries.
3. **Queue if at capacity**: If all `max` clients are busy, the query callback is pushed onto `_pendingQueue`. When any client finishes its current query, it dequeues the next pending callback and executes it.

**What `pool.query<T>(text, params)` does internally**:

1. Acquires a client from the pool (steps above).
2. Sends a `Parse` message (SQL text  ->  prepared statement), `Bind` message (parameter values), and `Execute` message to PostgreSQL. This is the **extended query protocol**.
3. Parameters (`params` array) are transmitted separately from the SQL text as binary values. PostgreSQL's parser never sees them as SQL — they are bound at the protocol level, preventing SQL injection.
4. PostgreSQL executes the query and sends `DataRow` messages (one per result row) followed by `CommandComplete` and `ReadyForQuery`.
5. The `pg` client assembles the `DataRow` messages into a `QueryResult<T>` object with `.rows: T[]`, `.rowCount: number`, `.fields: FieldDef[]`.
6. The client is returned to the idle pool.

### The generic `query<T>` helper:

The type parameter `T extends QueryResultRow` constrains `T` to be an object (since `QueryResultRow` is `{ [column: string]: any }`). When a caller writes:

```typescript
const result = await query<{ app_id: number; genres: string }>(
  "SELECT app_id, genres FROM games WHERE app_id = $1",
  [730],
);
// result.rows[0].app_id   ->  TypeScript knows this is `number`
// result.rows[0].genres   ->  TypeScript knows this is `string`
```

This is a compile-time-only construct — at runtime, the `<T>` is erased. The actual return type depends on what PostgreSQL sends back. The type annotation is a developer contract: "I promise the query returns rows of this shape."

---

## 5. Type System — `steam.types.ts`

**File**: [`steam.types.ts`](backend/src/types/steam.types.ts)

This file defines the entire type vocabulary of the backend. It serves two distinct roles:

### 5.1 Domain Models (application-level types)

These types represent the **application's internal data model** — the cleaned, normalized shape of data after it has been transformed from raw API responses or database rows.

**`OwnedGame`**: Represents a single game in a user's library.

```typescript
interface OwnedGame {
  appId: number; // Steam's unique integer identifier for the application
  name: string | null; // Nullable because the API may omit it for delisted games
  playtimeMinutes: number;
  playtime2Weeks: number | null; // Null if the user hasn't played in 2 weeks
  imgIconUrl?: string; // Optional — only present when include_appinfo=1
}
```

**`UserLibrary`**: Aggregate of a user's game collection.

```typescript
interface UserLibrary {
  steamId: string; // 64-bit Steam ID represented as string (JS number loses precision beyond 2^53)
  gameCount: number;
  games: OwnedGame[];
}
```

The `steamId` is a `string` rather than `number` because Steam IDs are 64-bit unsigned integers (e.g., `76561198012345678`). JavaScript's `number` type is an IEEE 754 double-precision float, which can only represent integers exactly up to 2^53 - 1 (9,007,199,254,740,991). Steam IDs exceed this range, so representing them as numbers would cause precision loss. String representation is exact.

**`PlayerSummary`**: Profile metadata for display.

```typescript
interface PlayerSummary {
  steamId: string;
  personaName: string;
  profileUrl: string;
  avatar: string | null;
  visibility: number; // 1 = private, 3 = public
}
```

The `visibility` field maps to Steam's `communityvisibilitystate`:

- `1`: Private — the user's profile is hidden; library, friends, and game data are inaccessible.
- `3`: Public — all data is accessible.

This distinction is critical because API calls to private profiles return empty responses rather than errors — the backend must handle this gracefully (see `steam.service.ts`).

**`Friend`**: Represents a relationship in the user's friend graph.

```typescript
interface Friend {
  steamId: string;
  relationship: string; // 'friend' | 'all'
  friendSince: number; // Unix timestamp (seconds since 1970-01-01T00:00:00Z)
}
```

The `friendSince` field is a Unix epoch timestamp. JavaScript's `Date` constructor accepts milliseconds, so conversion requires `new Date(friendSince * 1000)`. The `relationship` field is always `'friend'` in practice because the API is called with `relationship=friend`.

**`UserGenreProfile`**: A single entry in the user's genre preference vector.

```typescript
interface UserGenreProfile {
  genre: string;
  weight: number; // L1-normalized share of total weighted playtime
}
```

The `weight` field is a probability-like value in [0, 1] where all weights across the vector sum to exactly 1.0. This is the result of L1 normalization (see Section 8.4 for the full derivation).

**`UserProfile`**: The aggregated user context object.

```typescript
interface UserProfile {
  steamId: string;
  personaName: string;
  avatar: string | null;
  librarySize: number;
  recentGamesCount: number;
  topGenres: UserGenreProfile[];
  friendsAnalyzed: number;
  friendOverlapGames: number;
  ownedAppIds: Set<number>; // O(1) lookup for "does user own this game?"
  friendOverlapSet: Set<number>; // O(1) lookup for "do >=2 friends own this game?"
  genreVector: Map<string, number>; // Full genre -> weight mapping
  library: OwnedGame[];
}
```

Note the use of `Set<number>` and `Map<string, number>` for internal computation fields. These provide O(1) membership testing and key lookup, which is critical when scoring thousands of recommendation candidates. However, `Set` and `Map` are not JSON-serializable — `JSON.stringify(new Set([1,2,3]))` produces `'{}'` because `Set` has no enumerable own properties. The route handler in `recommend.routes.ts` must strip these fields before sending the response.

**`Game`**: Full game details from the Steam Store API.

```typescript
interface Game {
  appId: number;
  name: string;
  genres: string[];
  tags: string[];
  description: string | null;
  headerImage: string | null;
  releaseDate: string | null;
  developers: string[];
  publishers: string[];
  price: number | null; // null means pricing info unavailable
  isFree: boolean;
}
```

### 5.2 Raw API Response Types

These types mirror the exact JSON structure returned by Steam's APIs. They exist to provide type safety when destructuring API responses.

**`SteamOwnedGamesResponse`**: Response from `/IPlayerService/GetOwnedGames/v1/`.

 ->  See [`SteamOwnedGamesResponse`](backend/src/types/steam.types.ts#L66-L77)

The `games` array is `optional` (marked with `?`) because the Steam API returns an empty `response: {}` object (no `games` key at all) when the user's profile is private. This is not an HTTP error — it's a 200 OK with a semantically empty payload. The service layer must check for this case explicitly.

**`SteamPlayerSummaryResponse`**: Response from `/ISteamUser/GetPlayerSummaries/v2/`.

 ->  See [`SteamPlayerSummaryResponse`](backend/src/types/steam.types.ts#L79-L89)

This endpoint accepts comma-separated Steam IDs and returns an array of player objects. In this project, only one ID is queried at a time (`steamids: steamId`), so `players[0]` is always the target user. The `players` array is non-optional (it's always present), but may be empty if the Steam ID is invalid.

**`SteamAppDetailsResponse`**: Response from `/api/appdetails`.

```typescript
interface SteamAppDetailsResponse {
  [appId: string]: {
    success: boolean;
    data?: {
      name: string;
      short_description?: string;
      header_image?: string;
      genres?: Array<{ description: string }>;
      categories?: Array<{ description: string }>;
      release_date?: { date: string };
      developers?: string[];
      publishers?: string[];
      is_free?: boolean;
      price_overview?: {
        final: number; // Price in cents (not dollars!)
      };
    };
  };
}
```

The response is keyed by `appId` as a string (e.g., `{ "730": { success: true, data: { ... } } }`). The `price_overview.final` is in **cents** (e.g., 5999 = $59.99).

**`SteamFriendListResponse`**: Response from `/ISteamUser/GetFriendList/v1/`.

 ->  See [`SteamFriendListResponse`](backend/src/types/steam.types.ts#L123-L131)

Note the snake_case (`friend_since`). The service layer maps this to camelCase (`friendSince`) when constructing `Friend` objects.

### 5.3 Custom Error Class

```typescript
export class SteamApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "SteamApiError";
  }
}
```

**Mechanical execution when `new SteamApiError('msg', 403)` is called**:

1. JavaScript allocates a new object with prototype `SteamApiError.prototype`.
2. `super(message)` calls `Error(message)`, which sets `this.message = message` and captures the call stack into `this.stack` (V8's `Error.captureStackTrace`).
3. TypeScript's `public statusCode?: number` parameter property is syntactic sugar — it declares `this.statusCode` as a public property and assigns the constructor argument to it. At runtime, this compiles to `this.statusCode = statusCode`.
4. `this.name = 'SteamApiError'` overrides the inherited `Error.prototype.name` ('Error'). Without this, stack traces would show `Error: msg` instead of `SteamApiError: msg`.

The `statusCode` field allows route handlers to set the HTTP response status code to match the error type:

- `403`  ->  private profile
- `404`  ->  player not found
- `undefined`  ->  defaults to 500

---

## 6. Validation Middleware — `validate.middleware.ts`

**File**: [`validate.middleware.ts`](backend/src/middleware/validate.middleware.ts)

```typescript
export const validate = (schema: ZodSchema) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const issues = (error as any).issues || (error as any).errors || [];
        const errorMessages = issues.map((issue: any) => {
          return `${issue.path.join(".")} - ${issue.message}`;
        });
        res
          .status(400)
          .json({ error: "Validation failed", details: errorMessages });
        return;
      }
      console.error("Validation Error:", error);
      res
        .status(500)
        .json({ error: "Internal server error during validation" });
      return;
    }
  };
};
```

### Mechanical execution flow — step by step:

**Step 1 — Factory invocation** (at route definition time, not request time):

When a route file calls `validate(steamIdSchema)`, the outer function executes immediately and returns a new anonymous async function. This returned function is the actual Express middleware. It captures `schema` in its closure (lexical scope).

```typescript
// This happens at module load time:
router.get("/:steamId/library", validate(steamIdSchema), handler);
//                               ↑ This returns middleware fn
```

**Step 2 — Middleware execution** (at request time):

When a request arrives at `GET /api/user/76561198012345678/library`, Express calls the middleware function with `(req, res, next)`.

**Step 3 — Validation target construction**:

```typescript
await schema.parseAsync({
  body: req.body, // {} for GET requests (no body)
  query: req.query, // { includeFreeGames: 'true' } for ?includeFreeGames=true
  params: req.params, // { steamId: '76561198012345678' }
});
```

The three Express request properties are bundled into a single object that matches the Zod schema structure. This means Zod schemas must be structured as `z.object({ params: z.object({...}), query: z.object({...}), body: z.object({...}) })`.

**Step 4 — Zod parsing internals**:

`schema.parseAsync(target)` executes the following internally:

1. **Root object check**: Verify `target` is an object.
2. **Nested object validation**: For each key (`body`, `query`, `params`), descend into the nested schema.
3. **Field validation**: For each field (e.g., `params.steamId`), run the validation chain:
   - `z.string()` — check `typeof value === 'string'`.
   - `.length(17)` — check `value.length === 17`.
   - `.regex(/^\d+$/)` — check `value.match(/^\d+$/) !== null`.
4. **Error accumulation**: Zod does **not** short-circuit on the first error. It validates all fields and accumulates all errors into a `ZodError` object with an `issues` array.
5. **On success**: Returns the parsed (and possibly coerced) data.
6. **On failure**: Throws a `ZodError`.

**Step 5 — Success path**:

```typescript
return next();
```

`next()` is Express's mechanism for passing control to the next middleware in the chain (the route handler). Without this call, the request would hang — Express would never know to proceed. The `return` prevents any code after `next()` from executing in this middleware.

**Step 6 — Failure path (Zod error)**:

```typescript
if (error instanceof z.ZodError) {
  const issues = (error as any).issues || (error as any).errors || [];
  const errorMessages = issues.map((issue: any) => {
    return `${issue.path.join(".")} - ${issue.message}`;
  });
  res.status(400).json({ error: "Validation failed", details: errorMessages });
  return;
}
```

Each Zod issue has:

- `path`: An array of path segments, e.g., `['params', 'steamId']`.
- `message`: Human-readable error, e.g., `'Steam ID must be exactly 17 characters long'`.
- `code`: The Zod error code, e.g., `'too_small'`, `'invalid_string'`.

The `path.join('.')` produces `'params.steamId'`, giving the caller a dot-notation path to the offending field. This is concatenated with the message: `'params.steamId - Steam ID must be exactly 17 characters long'`.

The `(error as any).issues || (error as any).errors` handles both Zod 3 (which uses `errors`) and Zod 4 (which uses `issues`).

**Concrete example**: If the request is `GET /api/user/abc/library`:

```json
{
  "error": "Validation failed",
  "details": [
    "params.steamId - Steam ID must be exactly 17 characters long",
    "params.steamId - Steam ID must contain only numbers"
  ]
}
```

### Why validation belongs in middleware (not in route handlers):

Separation of concerns. Route handlers assume their inputs are valid and focus on business logic. Validation middleware acts as a **gate** — invalid requests are rejected before they ever reach the handler. This also centralizes the error response format: every validation failure across all routes produces the same `{ error: 'Validation failed', details: [...] }` shape.

---

## 7. Route Layer

The route layer follows Express's `Router` pattern. Each file creates a `Router()` instance, attaches handlers, and exports it. The `index.ts` mounts each router at a specific path prefix.

### 7.1 `user.routes.ts`

**File**: [`user.routes.ts`](backend/src/routes/user.routes.ts)

**Mount point**: `/api/user`

**Endpoints**:

| Method | Path                | Purpose                            |
| ------ | ------------------- | ---------------------------------- |
| GET    | `/:steamId/library` | Fetch user's complete game library |
| GET    | `/:steamId/recent`  | Fetch recently played games        |
| GET    | `/:steamId/profile` | Fetch player profile summary       |

#### Zod Schema Definition

 ->  See [`steamIdSchema`](backend/src/routes/user.routes.ts#L10-L17)

This schema is shared across all three endpoints. It validates that `:steamId` is exactly 17 digits — the length of a 64-bit Steam ID in decimal notation (e.g., `76561198012345678`). The validation chain is conjunctive: both `.length(17)` AND `.regex(/^\d+$/)` must pass.

#### Endpoint: `GET /:steamId/library` — Mechanical Execution

 ->  Source: [`library handler`](backend/src/routes/user.routes.ts#L23-L47)

**Step 1** — Express matches the path `/:steamId/library` and runs the middleware chain: `validate(steamIdSchema)`  ->  `async handler`.

**Step 2** — Boolean-from-string query parameter conversion:

```typescript
const includeFreeGames = req.query.includeFreeGames !== "false";
```

Query parameters are always strings. This expression evaluates to:

- `true` if `includeFreeGames` is `undefined` (parameter not provided) — because `undefined !== 'false'` is `true`.
- `true` if the value is `'true'`, `'yes'`, or any string except `'false'`.
- `false` only if the value is exactly the string `'false'`.

This is an intentional "opt-out" design: free games are included by default.

**Step 3** — Service invocation:

```typescript
const steamService = getSteamService();
const library = await steamService.getOwnedGames(
  req.params.steamId,
  true,
  includeFreeGames,
);
```

`getSteamService()` returns the singleton `SteamService` instance (creating it on first call). The `getOwnedGames` method makes an HTTP request to the Steam Web API (see Section 8.1).

**Step 4** — Response:

```typescript
res.json(library);
```

`res.json()` calls `JSON.stringify(library)`, sets `Content-Type: application/json; charset=utf-8`, writes the string to the response stream, and ends the response. The `UserLibrary` object with `steamId`, `gameCount`, and `games[]` is serialized.

**Step 5** — Error handling:

```typescript
if (error instanceof SteamApiError) {
  res
    .status(error.statusCode || 500)
    .json({ error: error.message, code: error.statusCode });
} else {
  res.status(500).json({ error: "Internal server error" });
}
```

The `instanceof` check differentiates between known application errors (private profile, rate limit) and unexpected errors (network timeout, code bugs). Known errors preserve the `statusCode` from the exception; unknown errors always return 500.

#### Endpoint: `GET /:steamId/recent` — Mechanical Execution

 ->  Source: [`recent handler`](backend/src/routes/user.routes.ts#L53-L73)

**Step 1** — Count parameter parsing and clamping:

```typescript
const count = Math.min(parseInt(req.query.count as string) || 10, 100);
```

This expression evaluates right-to-left:

1. `req.query.count`  ->  `string | undefined` (Express query params are strings).
2. `parseInt(undefined)`  ->  `NaN`.
3. `NaN || 10`  ->  `10` (NaN is falsy, so the `||` short-circuits to the default).
4. `Math.min(10, 100)`  ->  `10`.

If the user passes `?count=50`: `parseInt('50')`  ->  `50`, `50 || 10`  ->  `50`, `Math.min(50, 100)`  ->  `50`.
If the user passes `?count=999`: `Math.min(999, 100)`  ->  `100`. The cap prevents abuse.

**Step 2** — Service call:

```typescript
const games = await steamService.getRecentlyPlayedGames(
  req.params.steamId,
  count,
);
```

This calls `/IPlayerService/GetRecentlyPlayedGames/v1/` on the Steam API. Unlike `getOwnedGames`, this method returns the raw `OwnedGame[]` array (not a `UserLibrary` wrapper), since the recently-played endpoint doesn't include a game count.

#### Endpoint: `GET /:steamId/profile` — Mechanical Execution

 ->  Source: [`profile handler`](backend/src/routes/user.routes.ts#L79-L99)

**Step 1** — Service call:

```typescript
const profile = await steamService.getPlayerSummary(req.params.steamId);
```

This calls `/ISteamUser/GetPlayerSummaries/v2/`, which returns public profile metadata (persona name, avatar URL, visibility state).

**Step 2** — Error handling specifics:

```typescript
const status = error.statusCode === 404 ? 404 : 500;
```

Unlike the library endpoint (which forwards the `statusCode` directly), the profile endpoint only distinguishes between "not found" (404) and everything else (500). This is because a 403 (private profile) for the `getPlayerSummary` endpoint has different semantics — the player _exists_ but their profile is private, which is arguably a 200 with reduced data, not a client error.

### 7.2 `game.routes.ts`

**File**: [`game.routes.ts`](backend/src/routes/game.routes.ts)

**Mount point**: `/api/game`

**Endpoints**:

| Method | Path      | Purpose                                       |
| ------ | --------- | --------------------------------------------- |
| GET    | `/:appId` | Fetch detailed game info from Steam Store API |

#### Zod Schema

 ->  See [`getGameParamsSchema`](backend/src/routes/game.routes.ts#L10-L14)

Note: The schema validates `appId` as a string matching `/^\d+$/`. This is correct because Express route parameters are always strings. The conversion to number happens in the handler.

#### Mechanical Execution

**Step 1** — Parse string to integer:

```typescript
const appId = parseInt(req.params.appId, 10);
```

After Zod validation, we know `req.params.appId` is a numeric string. `parseInt` converts it to a JavaScript number. The radix `10` is explicit for safety.

**Step 2** — Service call:

```typescript
const game = await steamService.getAppDetails(appId);
```

This calls the Steam Store API (`/appdetails?appids=730&cc=us&l=en`). Unlike the Web API methods, `getAppDetails` returns `null` on failure (rather than throwing). This is because Store API failures are non-exceptional — games can be delisted, region-locked, or the endpoint may be temporarily rate-limited.

**Step 3** — Null check:

```typescript
if (!game) {
  res.status(404).json({ error: `Game with app ID ${appId} not found` });
  return;
}
```

The `return` after `res.status(404).json(...)` is critical. Without it, execution would fall through to `res.json(game)`, causing a "headers already sent" error (Express can only send one response per request).

### 7.3 `search.routes.ts`

**File**: [`search.routes.ts`](backend/src/routes/search.routes.ts)

**Mount point**: `/api/search`

**Endpoints**:

| Method | Path | Purpose                                           |
| ------ | ---- | ------------------------------------------------- |
| GET    | `/`  | Search games by genres, keyword, and player count |

This is the database-backed search endpoint. It does not call the Steam API — it queries the local PostgreSQL `games` table.

#### Zod Schema — All Optional Parameters

 ->  See [`searchSchema`](backend/src/routes/search.routes.ts#L10-L16)

All three query parameters are optional. A request with no parameters (`GET /api/search`) is valid and returns the top 10 games by positive votes.

#### Mechanical Execution

**Step 1** — Type-safe query extraction:

```typescript
const queryData = req.query as z.infer<typeof searchSchema>["query"];
```

The `z.infer<typeof searchSchema>` extracts the TypeScript type from the Zod schema. The `['query']` index type narrows it to the `query` property. This cast tells TypeScript that `queryData` has the exact shape defined in the schema.

**Step 2** — Genre string processing:

```typescript
const genresRaw = queryData.genres || "";
const genreList = genresRaw
  .split(",")
  .map((g) => g.trim())
  .filter((g) => g.length > 0);
```

Concrete example: `?genres=RPG,Action,%20Puzzle`

1. `genresRaw` = `'RPG,Action, Puzzle'` (URL-decoded by Express).
2. `.split(',')` = `['RPG', 'Action', ' Puzzle']`.
3. `.map(g => g.trim())` = `['RPG', 'Action', 'Puzzle']`.
4. `.filter(g => g.length > 0)` = `['RPG', 'Action', 'Puzzle']` (filters out empty strings from trailing commas like `"RPG,"`).

**Step 3** — Service delegation:

```typescript
const games = await searchService.searchByGenres(
  genreList,
  keyword,
  playerCount,
);
```

The `searchService` is instantiated at module load time (`const searchService = new SearchService()`). It's stateless, so multiple instances would behave identically.

### 7.4 `recommend.routes.ts`

**File**: [`recommend.routes.ts`](backend/src/routes/recommend.routes.ts)

**Mount point**: `/api/recommend`

This is the most complex route file, with five endpoints orchestrating the recommendation engine.

**Endpoints**:

| Method | Path                     | Purpose                                                        |
| ------ | ------------------------ | -------------------------------------------------------------- |
| GET    | `/status`                | Check if the recommender is loaded and ready                   |
| GET    | `/similar/:appId`        | Get games similar to a specific game                           |
| GET    | `/user/:steamId`         | Get personalized recommendations for a user                    |
| GET    | `/user/:steamId/profile` | Get the user's aggregated profile (genre vector, friend stats) |
| POST   | `/bytags`                | Get recommendations matching specific tags                     |

#### Zod Schemas

Three distinct schemas are defined:

```typescript
// For /similar/:appId — numeric appId with optional limit
const similarGamesSchema = z.object({
  params: z.object({ appId: z.string().regex(/^\d+$/) }),
  query: z.object({ limit: z.string().regex(/^\d+$/).optional() }),
});

// For /user/:steamId — 17-digit steamId with optional limit
const userRecommendationsSchema = z.object({
  params: z.object({
    steamId: z.string().length(17).regex(/^\d+$/),
  }),
  query: z.object({ limit: z.string().regex(/^\d+$/).optional() }),
});

// For /bytags — POST body with tags array and optional limit
const byTagsSchema = z.object({
  body: z.object({
    tags: z.array(z.string()).min(1, "You must provide at least one tag"),
    limit: z.number().int().positive().optional(),
  }),
});
```

Note: The `byTagsSchema` validates `limit` as a `z.number()` (not `z.string()`), because it comes from a JSON body (which preserves JavaScript types), not a query parameter (which is always a string).

#### Endpoint: `GET /status` — Mechanical Execution

 ->  Source: [`status handler`](backend/src/routes/recommend.routes.ts#L44-L62)

```typescript
router.get('/status', (req: Request, res: Response): void => {
  try {
    const recommender = getRecommenderService();
    res.json({
      ready: recommender.isReady(),
      status: recommender.isReady() ? 'Online' : 'Loading or error',
    });
  } catch (error: any) {
    res.status(503).json({
      ready: false,
      error: error.message,
      instructions: [...]
    });
  }
});
```

**Step 1** — `getRecommenderService()` returns the singleton. If this is the first call, the constructor runs and attempts to load `similarity-index.json`, `vectors.json`, and `idf.json` from disk (synchronous I/O). If the files don't exist, `isLoaded` is set to `false`.

**Step 2** — If the constructor throws (e.g., malformed JSON file), the catch block returns 503 (Service Unavailable) with setup instructions.

**Step 3** — `recommender.isReady()` returns `this.isLoaded`, which is `true` only if `similarityIndex.size > 0`.

#### Endpoint: `GET /similar/:appId` — Mechanical Execution

 ->  Source: [`similar handler`](backend/src/routes/recommend.routes.ts#L67-L98)

**Step 1** — Readiness check:

```typescript
if (!recommender.isReady()) {
  res.status(503).json({ error: "Recommendation engine not ready" });
  return;
}
```

This guard prevents serving stale or empty responses when the data files haven't been loaded.

**Step 2** — Parameter parsing:

```typescript
const appId = parseInt(req.params.appId, 10);
const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
```

**Step 3** — O(1) similarity lookup:

```typescript
const recommendations = recommender.getSimilarGames(appId, limit);
```

`Map.get(appId)` is an O(1) hash table lookup. The result is a pre-sorted array of `SimilarGame` objects. `.slice(0, limit)` extracts the top-K.

**Step 4** — Empty result handling:

```typescript
if (recommendations.length === 0) {
  res
    .status(404)
    .json({ error: `No recommendations found for app ID ${appId}` });
  return;
}
```

#### Endpoint: `GET /user/:steamId` — The Personalized Recommendation Pipeline

 ->  Source: [`user recommendation handler`](backend/src/routes/recommend.routes.ts#L103-L136)

This is the crown jewel of the API. The complete mechanical execution flow:

**Step 1** — Readiness guard (same as `/similar`).

**Step 2** — Profile construction:

```typescript
const profile = await buildUserProfile(steamId);
```

This triggers the full 4-phase pipeline (see Section 8.4):

- Phase 1: Three parallel Steam API calls (library, recent, friends).
- Phase 2: Up to 10 friend libraries fetched in parallel.
- Phase 3: Genre vector + friend overlap computed from the data.
- Phase 4: Player summary fetched for display.

**Step 3** — Empty library check:

```typescript
if (profile.library.length === 0) {
  res.status(404).json({
    error: "Could not load Steam library. Profile may be private.",
  });
  return;
}
```

If the library is empty (private profile or API error), no recommendations can be generated.

**Step 4** — 3-signal composite scoring:

```typescript
const recommendations = await scoreWithUserContext(steamId, profile, limit);
```

This triggers the scoring engine (see Section 8.4):

- Collect candidates from similarity index.
- Batch-fetch candidate metadata from PostgreSQL.
- Compute `finalScore = alpha·jaccard + beta·genreAlignment + gamma·social` for each candidate.
- Sort and return top-K.

**Step 5** — Response: `res.json(recommendations)` serializes the `ScoredRecommendation[]` array.

#### Endpoint: `GET /user/:steamId/profile`

Returns the user's profile without recommendations. Crucially, it **strips non-serializable fields** before responding:

```typescript
res.json({
  steamId: profile.steamId,
  personaName: profile.personaName,
  avatar: profile.avatar,
  librarySize: profile.librarySize,
  recentGamesCount: profile.recentGamesCount,
  topGenres: profile.topGenres,
  friendsAnalyzed: profile.friendsAnalyzed,
  friendOverlapGames: profile.friendOverlapGames,
});
```

Fields omitted: `ownedAppIds` (Set), `friendOverlapSet` (Set), `genreVector` (Map), `library` (OwnedGame[]). `JSON.stringify` would produce `{}` for `Set` and `Map` — this explicit field selection prevents silent data loss.

#### Endpoint: `POST /bytags`

```typescript
const { tags, limit = 10 } = req.body;
const recommendations = recommender.getRecommendationsByTags(tags, limit);
```

Destructuring with default: if `req.body.limit` is `undefined`, `limit` defaults to `10`. The Zod schema has already validated that `tags` is a non-empty string array.

Note: The route handler passes `tags` directly as the `excludeAppIds` parameter position, but looking at the actual `getRecommendationsByTags` signature: `(tags: string[], excludeAppIds: number[] = [], limit: number = 20)`, the `limit` here is passed as the second argument (not third). This means `limit` is actually being interpreted as `excludeAppIds`. However, since `limit` is a number and `excludeAppIds` expects `number[]`, JavaScript's type coercion handles this gracefully — `new Set(10)` creates an empty Set, so no games are excluded. The actual limit defaults to 20 from the function signature. This is a subtle bug/inconsistency in the route handler.

---

## 8. Service Layer

### 8.1 `steam.service.ts`

**File**: [`steam.service.ts`](backend/src/services/steam.service.ts)

This service encapsulates all communication with Valve's Steam Web API and Steam Store API. It is the **only module** that makes outbound HTTP requests.

### Architecture: Two Axios clients

```typescript
this.apiClient = axios.create({
  baseURL: config.steamApiBaseUrl, // https://api.steampowered.com
  timeout: 30000,
});

this.storeClient = axios.create({
  baseURL: config.steamStoreApiUrl, // https://store.steampowered.com/api
  timeout: 30000,
});
```

Two separate `AxiosInstance` objects are created because the Steam Web API and the Steam Store API have different base URLs, different authentication models (Web API uses `key` parameter; Store API uses no auth but requires `cc` and `l` for country/language), and different response formats.

The 30-second timeout prevents the backend from hanging indefinitely if the Steam API is slow or unresponsive. When the timeout fires, Axios rejects the promise with a `ECONNABORTED` error, which the service translates into a `SteamApiError`.

### Constructor — Mechanical Execution

```typescript
constructor(apiKey?: string) {
  this.apiKey = apiKey || config.steamApiKey;
  if (!this.apiKey) {
    throw new Error('Steam API key is required. Set STEAM_API_KEY in .env file.');
  }
  this.apiClient = axios.create({ baseURL: config.steamApiBaseUrl, timeout: 30000 });
  this.storeClient = axios.create({ baseURL: config.steamStoreApiUrl, timeout: 30000 });
}
```

**Step 1** — API key resolution: The optional `apiKey` parameter allows tests to inject a test key. If not provided, the constructor falls back to `config.steamApiKey`. The `||` operator means an empty string `''` is treated as missing.

**Step 2** — API key validation: If no key is available, the constructor throws immediately. This is a fail-fast pattern — better to crash at `getSteamService()` call time than to discover the key is missing during an API request.

**Step 3** — Axios instance creation: `axios.create()` returns a new `AxiosInstance` with the given defaults. Each instance maintains its own defaults (baseURL, timeout) but shares the same underlying HTTP adapter (`http` or `https` module).

### Singleton pattern

```typescript
let steamServiceInstance: SteamService | null = null;

export function getSteamService(): SteamService {
  if (!steamServiceInstance) {
    steamServiceInstance = new SteamService();
  }
  return steamServiceInstance;
}
```

This is the **lazy singleton** pattern. The instance is created on first access and cached in module scope. Since Node.js modules are singletons themselves (the `require` cache ensures a module is evaluated only once), this means exactly one `SteamService` instance exists for the lifetime of the process.

The `getSteamService()` factory function (rather than direct export of an instance) defers construction to first use, which means the error occurs at request time (with a clear stack trace) rather than at module import time.

### Method: `getOwnedGames` — Mechanical Execution

 ->  Source: [`getOwnedGames`](backend/src/services/steam.service.ts#L46-L101)

```typescript
async getOwnedGames(steamId: string, includeAppInfo: boolean = true, includeFreeGames: boolean = true): Promise<UserLibrary>
```

**Step 1** — HTTP request construction:

```typescript
const response = await this.apiClient.get<SteamOwnedGamesResponse>(
  "/IPlayerService/GetOwnedGames/v1/",
  {
    params: {
      key: this.apiKey,
      steamid: steamId,
      include_appinfo: includeAppInfo ? 1 : 0,
      include_played_free_games: includeFreeGames ? 1 : 0,
      format: "json",
    },
  },
);
```

Axios constructs the URL: `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=XXXX&steamid=76561198012345678&include_appinfo=1&include_played_free_games=1&format=json`.

The `<SteamOwnedGamesResponse>` generic tells TypeScript (at compile time only) that `response.data` has type `SteamOwnedGamesResponse`. Axios adds `Content-Type: application/json` automatically and parses the response body with `JSON.parse()`.

**Step 2** — Private profile detection:

```typescript
const data = response.data.response;
if (!data || !data.games) {
  throw new SteamApiError(
    "No data returned. User profile may be private.",
    403,
  );
}
```

When Steam returns `{ response: {} }` (private profile), `data` is `{}` and `data.games` is `undefined`. The `!data.games` check catches this. A 403 statusCode is assigned to signal "forbidden" (the user exists but their data is inaccessible).

**Step 3** — Data mapping (snake_case  ->  camelCase):

```typescript
const games: OwnedGame[] = data.games.map((game) => ({
  appId: game.appid,
  name: game.name || null,
  playtimeMinutes: game.playtime_forever || 0,
  playtime2Weeks: game.playtime_2weeks || null,
  imgIconUrl: game.img_icon_url,
}));
```

The `.map()` produces a new array where each element is transformed from the API's snake_case naming to the application's camelCase convention. The `|| null` and `|| 0` fallbacks handle missing/falsy values:

- `game.name`  ->  `null` if undefined (delisted games).
- `game.playtime_forever`  ->  `0` if undefined or 0 (both are handled the same).
- `game.playtime_2weeks`  ->  `null` if undefined (user hasn't played recently).

**Step 4** — Error categorization:

```typescript
if (error instanceof SteamApiError) throw error;
if (axios.isAxiosError(error)) {
  throw new SteamApiError(
    `HTTP error: ${error.response?.status || "unknown"}`,
    error.response?.status,
  );
}
throw new SteamApiError(`Request failed: ${error}`);
```

Three error cases:

1. `SteamApiError` already thrown (from the private profile check) — re-throw as-is.
2. Axios error (HTTP 4xx/5xx, timeout, network error) — wrap in `SteamApiError` with the HTTP status.
3. Unknown error — wrap in generic `SteamApiError`.

### Method: `getRecentlyPlayedGames` — Mechanical Execution

 ->  Source: [`getRecentlyPlayedGames`](backend/src/services/steam.service.ts#L103-L140)

```typescript
async getRecentlyPlayedGames(steamId: string, count: number = 10): Promise<OwnedGame[]>
```

**Step 1** — HTTP request to `/IPlayerService/GetRecentlyPlayedGames/v1/`.

**Step 2** — Graceful empty handling:

```typescript
const games = response.data.response?.games || [];
```

The `?.` operator short-circuits if `response.data.response` is undefined (private profile). The `|| []` ensures the result is always an array.

**Step 3** — Data mapping (same as `getOwnedGames` but without `imgIconUrl`).

### Method: `getPlayerSummary` — Mechanical Execution

 ->  Source: [`getPlayerSummary`](backend/src/services/steam.service.ts#L142-L183)

```typescript
async getPlayerSummary(steamId: string): Promise<PlayerSummary>
```

**Step 1** — HTTP request to `/ISteamUser/GetPlayerSummaries/v2/`.

**Step 2** — Empty players check:

```typescript
const players = response.data.response?.players || [];
if (players.length === 0) {
  throw new SteamApiError(`Player not found: ${steamId}`, 404);
}
```

If the Steam ID is invalid (not just private), the `players` array is empty. This is the only case where we throw a 404.

**Step 3** — Data mapping:

```typescript
return {
  steamId: player.steamid,
  personaName: player.personaname || "Unknown",
  profileUrl: player.profileurl || "",
  avatar: player.avatarfull || null,
  visibility: player.communityvisibilitystate || 1,
};
```

The `|| 'Unknown'` default for `personaName` handles edge cases where the API returns no name. The `|| 1` default for `visibility` treats missing visibility as "private" (the safest assumption).

### Method: `getAppDetails` — Mechanical Execution

 ->  Source: [`getAppDetails`](backend/src/services/steam.service.ts#L185-L241)

```typescript
async getAppDetails(appId: number): Promise<Game | null>
```

**Step 1** — HTTP request to Store API:

```typescript
const response = await this.storeClient.get<SteamAppDetailsResponse>(
  "/appdetails",
  {
    params: { appids: appId, cc: "us", l: "en" },
  },
);
```

The `cc=us` requests USD pricing; `l=en` requests English text.

**Step 2** — Success check:

```typescript
const appData = response.data[String(appId)];
if (!appData?.success || !appData.data) {
  return null;
}
```

The Store API returns `{ "730": { success: false } }` for delisted/invalid games. The `String(appId)` conversion is necessary because the response keys are strings, not numbers.

**Step 3** — Genre/tag extraction:

```typescript
const genres = details.genres?.map((g) => g.description) || [];
const tags = details.categories?.map((c) => c.description) || [];
```

Steam's Store API returns genres as `[{ id: "1", description: "Action" }]`. The `.map()` extracts just the description strings.

**Step 4** — Price conversion:

```typescript
if (!isFree && details.price_overview) {
  price = details.price_overview.final / 100;
}
```

Steam's API returns prices in cents (5999 = $59.99). Division by 100 converts to dollars. The `!isFree` guard prevents free games from getting a price of `$0.00` (they should have `null` price).

**Step 5** — Error handling:

```typescript
} catch (error) {
  console.error(`Failed to fetch app details for ${appId}:`, error);
  return null;
}
```

Unlike other methods, `getAppDetails` returns `null` on failure rather than throwing. This is because Store API failures are expected (rate limits, delisted games) and should not crash the calling code.

### Method: `getFriendList` — Mechanical Execution

 ->  Source: [`getFriendList`](backend/src/services/steam.service.ts#L243-L277)

```typescript
async getFriendList(steamId: string): Promise<Friend[]>
```

**Step 1** — HTTP request to `/ISteamUser/GetFriendList/v1/` with `relationship: 'friend'`.

**Step 2** — Data mapping:

```typescript
return friends.map((f) => ({
  steamId: f.steamid,
  relationship: f.relationship,
  friendSince: f.friend_since,
}));
```

**Step 3** — Graceful degradation on error:

```typescript
if (axios.isAxiosError(error)) {
  const status = error.response?.status;
  if (status === 401 || status === 403) return [];
}
console.warn(`getFriendList(${steamId}) failed:`, (error as any).message);
return [];
```

Unlike `getOwnedGames` (which throws on private profiles), `getFriendList` returns `[]` on 401/403 errors. This is intentional: the friend list is an **optional** signal for recommendations. If unavailable, the recommendation engine still works — it just lacks social data. Throwing would abort the entire profile-building pipeline.

### Method: `getMultipleOwnedGames` — Mechanical Execution

 ->  Source: [`getMultipleOwnedGames`](backend/src/services/steam.service.ts#L279-L299)

```typescript
async getMultipleOwnedGames(steamIds: string[]): Promise<Map<string, OwnedGame[]>>
```

**Step 1** — Parallel execution:

```typescript
const results = await Promise.allSettled(
  steamIds.map((id) =>
    this.getOwnedGames(id).then((lib) => ({ id, games: lib.games })),
  ),
);
```

`steamIds.map(...)` creates an array of Promises, one per Steam ID. `Promise.allSettled` waits for all of them to complete (either fulfilled or rejected).

**Why `Promise.allSettled` vs `Promise.all`**:

- `Promise.all` rejects immediately if **any** promise rejects. If 9/10 friends have public profiles and 1 is private, all 9 successful results would be discarded.
- `Promise.allSettled` always resolves (never rejects). It returns an array of `{ status: 'fulfilled', value }` or `{ status: 'rejected', reason }` objects.

**Step 2** — Result collection:

```typescript
const map = new Map<string, OwnedGame[]>();
for (const result of results) {
  if (result.status === "fulfilled") {
    map.set(result.value.id, result.value.games);
  }
}
return map;
```

Only successful results are inserted. Rejected entries (private profiles, timeouts) are silently dropped. The returned Map contains only the friends whose libraries were accessible.

---

### 8.2 `search.service.ts`

**File**: [`search.service.ts`](backend/src/services/search.service.ts)

This service constructs dynamic SQL queries to search the `games` table.

### Interface: `GameSearchResult`

 ->  See [`GameSearchResult`](backend/src/services/search.service.ts#L3-L10)

This is the response shape sent to the frontend. It's a subset of the full `games` table — only the fields needed for search result cards.

### Method: `searchByGenres` — Mechanical Execution

 ->  Source: [`searchByGenres`](backend/src/services/search.service.ts#L16-L62)

```typescript
async searchByGenres(genres: string[], keyword?: string, playerCount?: string): Promise<GameSearchResult[]>
```

This method builds a SQL `WHERE` clause dynamically based on which filters the user provides.

**Step 1 — Initialize query builder state**:

```typescript
const whereClauses: string[] = [];
const params: any[] = [];
let paramIndex = 1;
```

- `whereClauses`: Accumulates SQL fragments like `(genres ILIKE $1 OR tags ILIKE $1)`.
- `params`: Accumulates parameter values like `'%RPG%'`.
- `paramIndex`: Tracks the next `$N` placeholder number.

**Step 2 — Genre filter construction**:

```typescript
if (genres.length > 0) {
  const genreConditions = genres.map((g) => {
    params.push(`%${g}%`);
    const clause = `(genres ILIKE $${paramIndex} OR tags ILIKE $${paramIndex})`;
    paramIndex++;
    return clause;
  });
  whereClauses.push(`(${genreConditions.join(" AND ")})`);
}
```

For `genres = ['RPG', 'Action']`:

1. Iteration 1: `params = ['%RPG%']`, `paramIndex = 2`, clause = `(genres ILIKE $1 OR tags ILIKE $1)`.
2. Iteration 2: `params = ['%RPG%', '%Action%']`, `paramIndex = 3`, clause = `(genres ILIKE $2 OR tags ILIKE $2)`.
3. `whereClauses = ['((genres ILIKE $1 OR tags ILIKE $1) AND (genres ILIKE $2 OR tags ILIKE $2))']`.

The `ILIKE` operator performs case-insensitive pattern matching in PostgreSQL. `%RPG%` matches any string containing "RPG" anywhere.

The `OR tags ILIKE` means genres are searched across both the `genres` and `tags` columns. The `AND` between genres means conjunctive matching: a game must match **all** requested genres.

**Step 3 — Keyword filter**:

```typescript
if (keyword) {
  params.push(`%${keyword}%`);
  whereClauses.push(
    `(game_name ILIKE $${paramIndex} OR short_description ILIKE $${paramIndex})`,
  );
  paramIndex++;
}
```

Keywords search across both the game name and the short description.

**Step 4 — Player count filter**:

```typescript
if (playerCount && playerCount !== "Any") {
  let mappedTerm = playerCount;
  if (playerCount === "Online") mappedTerm = "Online PvP";
  params.push(`%${mappedTerm}%`);
  whereClauses.push(`categories ILIKE $${paramIndex}`);
  paramIndex++;
}
```

The `playerCount === 'Online'`  ->  `'Online PvP'` mapping handles a UI/data mismatch: the frontend sends "Online" but the database stores "Online PvP" in the categories column.

**Step 5 — SQL assembly**:

```typescript
const whereString =
  whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
const sqlQuery = `
  SELECT app_id, game_name, genres, price, header_image
  FROM games
  ${whereString}
  ORDER BY positive_votes DESC
  LIMIT 10
`;
```

If no filters are provided, `whereString` is empty, and the query returns the 10 most positively-reviewed games globally.

**Step 6 — Query execution**:

```typescript
const result = await query(sqlQuery, params);
return this.mapRows(result.rows);
```

### Row mapping — `mapRows`:

```typescript
private mapRows(rows: any[]): GameSearchResult[] {
  return rows.map(row => ({
    appId: row.app_id,
    name: row.game_name,
    genres: row.genres ? row.genres.split(',') : [],
    headerImage: row.header_image,
    price: row.price ? parseFloat(row.price) : null,
    isFree: parseFloat(row.price) === 0
  }));
}
```

The `genres` column is stored as a comma-separated string in PostgreSQL (e.g., `"Indie,RPG,Adventure"`). The `split(',')` converts it to an array.

The `price` column comes from PostgreSQL as a `DECIMAL(10,2)`, which the `pg` driver returns as a string (to avoid floating-point precision loss). `parseFloat(row.price)` converts it back.

Note: `isFree: parseFloat(row.price) === 0` has an edge case — if `row.price` is `null`, `parseFloat(null)` returns `NaN`, and `NaN === 0` is `false`. This correctly treats null-price games as non-free.

---

### 8.3 `recommender.service.ts`

**File**: [`recommender.service.ts`](backend/src/services/recommender.service.ts)

This is the in-memory recommendation engine. It loads pre-computed similarity data from JSON files at startup and serves recommendations via O(1) lookups and linear-time scoring.

### Internal Interfaces

```typescript
interface SimilarGame {
  appId: number;
  name: string;
  similarity: number; // Pre-computed score  in  (0.1, ~0.92]
}

interface GameVector {
  appId: number;
  name: string;
  magnitude: number; // TF-IDF vector magnitude (L2 norm)
  topTerms: { term: string; weight: number }[]; // Top TF-IDF terms
}

interface RecommendationResult {
  appId: number;
  name: string;
  score: number;
  reason: string; // Human-readable explanation
}
```

### Data structures

```typescript
private similarityIndex: Map<number, SimilarGame[]> = new Map();
private gameVectors: Map<number, GameVector> = new Map();
private idf: Map<string, number> = new Map();
private isLoaded: boolean = false;
```

1. **`similarityIndex`**: `Map<appId, SimilarGame[]>` — For each game, stores its top-20 most similar games (pre-computed by `build-recommender.ts`). Each entry is a `{ appId, name, similarity }` triple where `similarity`  in  (0.1, ~0.92].

2. **`gameVectors`**: `Map<appId, GameVector>` — For each game, stores its name, L2 magnitude, and top weighted terms (from TF-IDF). Used for tag-based recommendations and name lookups.

3. **`idf`**: `Map<term, number>` — Inverse Document Frequency values for each term in the corpus.

### Constructor & `loadData()` — Mechanical Execution

```typescript
constructor() {
  this.loadData();
}
```

The constructor calls `loadData()` synchronously. On the first `getRecommenderService()` call, this blocks the event loop.

**`loadData()` execution**:

**Step 1 — Similarity index loading**:

```typescript
const indexPath = path.join(RECOMMENDER_DIR, "similarity-index.json");
if (fs.existsSync(indexPath)) {
  const indexData = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  for (const [appId, similar] of Object.entries(indexData)) {
    this.similarityIndex.set(parseInt(appId), similar as SimilarGame[]);
  }
}
```

1. `fs.existsSync(indexPath)` — Synchronous stat check. Returns `false` if the file doesn't exist.
2. `fs.readFileSync(indexPath, 'utf-8')` — Reads the entire file into memory as a single string. For a ~27,000-game index with 20 neighbors each, this file can be 50–100MB.
3. `JSON.parse(rawString)` — Parses the JSON string into a nested JavaScript object. This is an O(N) operation where N is the string length. V8's JSON parser is highly optimized (faster than any hand-written parser).
4. `Object.entries(indexData)` — Converts the object's key-value pairs into `[key, value]` tuples.
5. `parseInt(appId)` — The JSON keys are strings (JSON spec requires string keys). This converts them back to numbers for the Map.
6. The Map is populated with one entry per game.

**Step 2 — Vectors loading** (same pattern):

```typescript
const vectors: GameVector[] = JSON.parse(fs.readFileSync(vectorsPath, "utf-8"));
for (const v of vectors) {
  this.gameVectors.set(v.appId, v);
}
```

The vectors file is a JSON array (not an object), so it's parsed directly into `GameVector[]`.

**Step 3 — IDF loading** (same pattern):

```typescript
for (const [term, value] of Object.entries(idfData)) {
  this.idf.set(term, value as number);
}
```

**Step 4 — Readiness determination**:

```typescript
this.isLoaded = this.similarityIndex.size > 0;
```

The service is considered "ready" if at least one game has similarity data. The vectors and IDF are optional (they're only needed for tag-based recommendations).

**Error handling**: If any file read or JSON parse fails, the catch block sets `this.isLoaded = false`. The service degrades gracefully — it won't crash, but all recommendation methods will return empty results.

### Method: `getSimilarGames` — Mechanical Execution

 ->  Source: [`getSimilarGames`](backend/src/services/recommender.service.ts#L93-L100)

```typescript
getSimilarGames(appId: number, limit: number = 10): SimilarGame[] {
  const similar = this.similarityIndex.get(appId);
  if (!similar) return [];
  return similar.slice(0, limit);
}
```

**Step 1** — `Map.get(appId)` is O(1) average-case (V8 uses a hash table internally for Maps with numeric keys).
**Step 2** — If the game isn't in the index, return `[]`.
**Step 3** — `similar.slice(0, limit)` creates a shallow copy of the first `limit` elements. O(limit). The array is pre-sorted by `similarity` descending (from `build-recommender.ts`).

### Method: `getRecommendationsForLibrary` — Playtime-weighted Aggregation

 ->  Source: [`getRecommendationsForLibrary`](backend/src/services/recommender.service.ts#L102-L178)

```typescript
getRecommendationsForLibrary(
  ownedGames: { appId: number; playtimeMinutes: number }[],
  limit: number = 20
): RecommendationResult[]
```

**Step 1 — Guard checks**:

```typescript
if (!this.isLoaded || ownedGames.length === 0) return [];
```

**Step 2 — Build owned set (O(L))**:

```typescript
const ownedSet = new Set(ownedGames.map((g) => g.appId));
```

This creates a Set from an array of appIds for O(1) membership testing during candidate filtering.

**Step 3 — Compute playtime weights (O(L))**:

```typescript
const totalPlaytime = ownedGames.reduce((sum, g) => sum + g.playtimeMinutes, 0);
const gameWeights = new Map<number, number>();

for (const game of ownedGames) {
  const weight =
    totalPlaytime > 0
      ? Math.log1p(game.playtimeMinutes) / Math.log1p(totalPlaytime)
      : 1 / ownedGames.length;
  gameWeights.set(game.appId, weight);
}
```

For each game i:

```
weight(i) = log1p(playtimeMinutes_i) / log1p(totalPlaytime)
```

Where `log1p(x) = ln(1 + x)`.

**Why `log1p` instead of `log`**:

- `log(0) = -Infinity`, which would crash the scoring. `log1p(0) = ln(1) = 0`, which is safe.
- The logarithm compresses the playtime scale. Without it, a user with 10,000 hours in CS2 and 10 hours in everything else would produce recommendations dominated entirely by CS2-similar games.

**Example**: User has CS2 (10,000 min), Dota 2 (100 min), total = 10,100.

```
weight(CS2)  = log1p(10000) / log1p(10100) ~ 9.21 / 9.22 ~ 0.999
weight(Dota) = log1p(100) / log1p(10100)   ~ 4.62 / 9.22 ~ 0.501
```

CS2 gets ~2x the weight of Dota, not 100x. The log compression provides a balanced signal.

**Edge case**: If `totalPlaytime === 0` (all games have 0 minutes), each game gets equal weight `1/L`.

**Step 4 — Aggregate candidate scores (O(L × K))**:

```typescript
for (const ownedGame of ownedGames) {
  const similar = this.similarityIndex.get(ownedGame.appId);
  if (!similar) continue;

  const weight = gameWeights.get(ownedGame.appId) || 0;
  const sourceName =
    this.gameVectors.get(ownedGame.appId)?.name || `Game ${ownedGame.appId}`;

  for (const rec of similar) {
    if (ownedSet.has(rec.appId)) continue; // Skip owned games

    const addedScore = rec.similarity * weight;
    const currentScore = recommendationScores.get(rec.appId);

    if (currentScore) {
      currentScore.score += addedScore; // Accumulate
      if (!currentScore.sources.includes(sourceName)) {
        currentScore.sources.push(sourceName); // Track source games
      }
    } else {
      recommendationScores.set(rec.appId, {
        score: addedScore,
        sources: [sourceName],
      });
    }
  }
}
```

For each owned game, retrieve its top-K similar games. For each candidate:

1. Skip if user already owns it (`ownedSet.has` — O(1)).
2. Compute `addedScore = similarity × weight`.
3. If the candidate was already seen (from another owned game's list), **add** the score. This produces a natural "voting" effect: a candidate similar to 5 owned games scores higher than one similar to only 1.
4. Track which owned games ("sources") contributed to each recommendation.

**Step 5 — Sort and return (O(C log C))**:

```typescript
recommendations.sort((a, b) => b.score - a.score);
return recommendations.slice(0, limit);
```

**Step 6 — Reason string generation**:

```typescript
reason: `Similar to: ${data.sources.slice(0, 3).join(", ")}${data.sources.length > 3 ? "..." : ""}`;
```

Shows up to 3 source game names. If more than 3, appends `"..."`.

### Method: `getRecommendationsByTags` — Tag-based Scoring

 ->  Source: [`getRecommendationsByTags`](backend/src/services/recommender.service.ts#L180-L229)

```typescript
getRecommendationsByTags(
  tags: string[],
  excludeAppIds: number[] = [],
  limit: number = 20
): RecommendationResult[]
```

**Step 1 — Normalize tags**:

```typescript
const normalizedTags = tags.map((t) => t.toLowerCase());
```

**Step 2 — Linear scan of all game vectors (O(N × T))**:

```typescript
for (const [appId, vector] of this.gameVectors) {
  if (excludeSet.has(appId)) continue;

  const gameTags = vector.topTerms.map((t) => t.term);
  const matchedTags = normalizedTags.filter((t) => gameTags.includes(t));

  if (matchedTags.length > 0) {
    let score = 0;
    for (const tag of matchedTags) {
      const termWeight =
        vector.topTerms.find((t) => t.term === tag)?.weight || 0;
      score += termWeight;
    }
    scores.push({ appId, name: vector.name, score, matchedTags });
  }
}
```

For each game in the index:

1. Get the game's pre-computed `topTerms` (TF-IDF weighted terms).
2. Find intersection of the game's terms with the requested tags.
3. Sum the TF-IDF weights of matched terms.

**Complexity**: O(N × T × K) where N = games in index (~27,000), T = requested tags, K = topTerms per game (~10). For 3 tags, this is ~810,000 comparisons — fast enough for interactive use (<50ms).

**Step 3** — Sort descending by score, slice top-K, generate reason strings.

### Method: `getGameInfo` — Simple Lookup

 ->  Source: [`getGameInfo`](backend/src/services/recommender.service.ts#L231-L242)

```typescript
getGameInfo(appId: number): { name: string; topTerms: string[] } | null {
  const vector = this.gameVectors.get(appId);
  if (!vector) return null;
  return { name: vector.name, topTerms: vector.topTerms.map(t => t.term) };
}
```

O(1) Map lookup. Returns the game's name and TF-IDF terms, or `null` if not in the index.

---

### 8.4 `user-profile.service.ts`

**File**: [`user-profile.service.ts`](backend/src/services/user-profile.service.ts)

This is the most mathematically dense module in the backend. It implements a 4-phase pipeline to build a user profile and a 3-signal composite scoring engine to rank recommendation candidates.

### Constants

```typescript
const MAX_FRIENDS_TO_ANALYZE = 10;
const WEIGHT_JACCARD = 0.5; // alpha — pre-computed content similarity
const WEIGHT_GENRE = 0.3; // beta — genre alignment with user preferences
const WEIGHT_SOCIAL = 0.2; // gamma — social proof from friend graph
const RECENCY_BOOST = 1.5; // Multiplier for recently-played games
```

### `ScoredRecommendation` Interface

```typescript
export interface ScoredRecommendation {
  appId: number;
  name: string;
  score: number; // Final composite score
  jaccardScore: number; // Signal 1 (content similarity)
  genreAlignmentScore: number; // Signal 2 (genre preference match)
  socialScore: number; // Signal 3 (friend ownership)
  reason: string; // Human-readable explanation
  // Display fields for GameCardComponent
  headerImage: string | null;
  genres: string[];
  tags: string[];
  description: string | null;
  price: number | null;
  isFree: boolean;
  developers: string[];
  publishers: string[];
  releaseDate: string | null;
}
```

This interface bundles both the scoring metadata and the display-ready fields needed by the Angular frontend's `GameCardComponent`. This avoids a second API call to fetch game details after recommendations are generated.

### Function: `buildGenreVector` — L1-Normalized Genre Preference Vector

 ->  Source: [`buildGenreVector`](backend/src/services/user-profile.service.ts#L56-L119)

```typescript
async function buildGenreVector(
  library: OwnedGame[],
  recentAppIds: Set<number>,
): Promise<Map<string, number>>;
```

**Mathematical formulation**:

Let L be the user's library of games. For each game g_i  in  L, let:

- `pt_i` = playtimeMinutes for game i
- `G_i` = set of genres/tags for game i (fetched from PostgreSQL)
- `recent(i)` = 1 if game i was played in the last 2 weeks, 0 otherwise

For each genre g across all games:

```
raw(g) = SUM_{i : g  in  G_i} [log1p(pt_i) × (1.0 + 0.5 × recent(i))]
```

**Mechanical execution**:

**Step 1 — Batch genre fetch from PostgreSQL**:

```typescript
const appIds = library.map((g) => g.appId);
const placeholders = appIds.map((_, i) => `$${i + 1}`).join(",");
const result = await query<{ app_id: number; genres: string; tags: string }>(
  `SELECT app_id, genres, tags FROM games WHERE app_id IN (${placeholders})`,
  appIds,
);
```

For a library of 200 games, this generates:

```sql
SELECT app_id, genres, tags FROM games WHERE app_id IN ($1, $2, ..., $200)
```

This is a single SQL round-trip. PostgreSQL uses an index scan on the `app_id` PRIMARY KEY — each lookup is O(log N) where N is the table size, so the total is O(L × log N).

**Step 2 — Build genre lookup map**:

```typescript
const genreMap = new Map<number, string[]>();
for (const row of result.rows) {
  const genres = (row.genres || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const tags = (row.tags || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  genreMap.set(row.app_id, [...new Set([...genres, ...tags])]);
}
```

For each row:

1. Split the comma-separated `genres` string into an array.
2. Split the comma-separated `tags` string into an array.
3. Merge both arrays, deduplicate via `new Set()`, and store.

The deduplication is important because `genres` might contain "action" and `tags` might also contain "action".

**Step 3 — Accumulate weighted genre contributions**:

```typescript
const rawVector = new Map<string, number>();
for (const game of library) {
  const genres = genreMap.get(game.appId);
  if (!genres || genres.length === 0) continue;

  const recency = recentAppIds.has(game.appId) ? RECENCY_BOOST : 1.0;
  const contribution = Math.log1p(game.playtimeMinutes) * recency;

  for (const genre of genres) {
    rawVector.set(genre, (rawVector.get(genre) ?? 0) + contribution);
  }
}
```

For each game in the library:

1. Look up its genres from the map. Skip if not found (game not in our DB).
2. Determine recency multiplier: 1.5 if played in last 2 weeks, 1.0 otherwise.
3. Compute contribution: `log1p(playtime) × recency`.
4. Add the contribution to every genre the game belongs to.

**Example**:

- Game A (RPG, Action): 1000 minutes, recently played
- Game B (RPG, Puzzle): 100 minutes, not recently played

```
Contribution of Game A to RPG:    log1p(1000) × 1.5 = 6.909 × 1.5 = 10.363
Contribution of Game A to Action:  log1p(1000) × 1.5 = 10.363
Contribution of Game B to RPG:    log1p(100) × 1.0 = 4.615
Contribution of Game B to Puzzle:  log1p(100) × 1.0 = 4.615

raw(RPG)    = 10.363 + 4.615 = 14.978
raw(Action) = 10.363
raw(Puzzle) = 4.615
```

**Step 4 — L1 Normalization**:

```typescript
const total = [...rawVector.values()].reduce((s, v) => s + v, 0);
if (total === 0) return rawVector;
for (const [genre, weight] of rawVector) {
  rawVector.set(genre, weight / total);
}
```

L1 normalization divides every value by the total sum:

```
total = 14.978 + 10.363 + 4.615 = 29.956

vector(RPG)    = 14.978 / 29.956 = 0.500
vector(Action) = 10.363 / 29.956 = 0.346
vector(Puzzle) = 4.615 / 29.956  = 0.154
```

After normalization, `SUM_g vector(g) = 1.0`. Each `vector(g)` represents the fraction of weighted engagement attributable to genre g.

**Complexity**: O(L × G) where L = library size, G = average genres per game.

### Function: `buildFriendOverlapSet` — Social Proof Signal

 ->  Source: [`buildFriendOverlapSet`](backend/src/services/user-profile.service.ts#L123-L147)

```typescript
function buildFriendOverlapSet(
  friendLibraries: Map<string, OwnedGame[]>,
  minOverlap: number = 2,
): Set<number>;
```

**Mechanical execution**:

**Step 1 — Count ownership**:

```typescript
const ownershipCount = new Map<number, number>();
for (const games of friendLibraries.values()) {
  for (const game of games) {
    ownershipCount.set(game.appId, (ownershipCount.get(game.appId) ?? 0) + 1);
  }
}
```

Iterates through all friends' games and counts how many friends own each game. The `?? 0` nullish coalescing operator provides a default of 0 for games not yet in the map.

**Step 2 — Threshold filter**:

```typescript
const overlapSet = new Set<number>();
for (const [appId, count] of ownershipCount) {
  if (count >= minOverlap) overlapSet.add(appId);
}
return overlapSet;
```

Only games owned by >= `minOverlap` (default 2) friends are included. This set represents "social proof" — games that are popular in the user's friend graph.

**Complexity**: O(F × G) where F = friends analyzed (<=10), G = average games per friend.

### Function: `buildUserProfile` — Core Profile Builder

 ->  Source: [`buildUserProfile`](backend/src/services/user-profile.service.ts#L151-L212)

```typescript
export async function buildUserProfile(steamId: string): Promise<UserProfile>;
```

**Phase 1 — Parallel I/O**:

```typescript
const [libraryResult, recentGamesResult, friendListResult] =
  await Promise.allSettled([
    steamService.getOwnedGames(steamId),
    steamService.getRecentlyPlayedGames(steamId, 20),
    steamService.getFriendList(steamId),
  ]);
```

Three independent API calls fire simultaneously. `Promise.allSettled` ensures all complete regardless of individual failures.

Wall-clock time: `max(t_library, t_recent, t_friends)` ~ 500ms–2s (depending on Steam API latency).

**Result extraction**:

```typescript
const library =
  libraryResult.status === "fulfilled" ? libraryResult.value.games : [];
const recentGames =
  recentGamesResult.status === "fulfilled" ? recentGamesResult.value : [];
const friends =
  friendListResult.status === "fulfilled" ? friendListResult.value : [];
```

Each result is either `{ status: 'fulfilled', value }` or `{ status: 'rejected', reason }`. The ternary gracefully degrades: failed calls produce empty arrays.

**Phase 2 — Friend library batch fetch**:

```typescript
const friendIds = friends
  .slice(0, MAX_FRIENDS_TO_ANALYZE)
  .map((f) => f.steamId);
const friendLibraries =
  friendIds.length > 0
    ? await steamService.getMultipleOwnedGames(friendIds)
    : new Map<string, OwnedGame[]>();
```

Up to 10 friends' libraries are fetched in parallel. The limit mitigates Steam API rate limits (~100,000 calls/day per key).

**Phase 3 — CPU-bound vector construction**:

```typescript
const recentAppIds = new Set(recentGames.map((g) => g.appId));
const genreVector = await buildGenreVector(library, recentAppIds);
const friendOverlapSet = buildFriendOverlapSet(friendLibraries);
const ownedAppIds = new Set(library.map((g) => g.appId));
```

Three data structures are built:

1. `genreVector`: L1-normalized genre preferences (async — DB query).
2. `friendOverlapSet`: Games owned by >=2 friends (sync — pure computation).
3. `ownedAppIds`: Set of all owned game IDs (sync — used for O(1) exclusion).

**Top genres derivation**:

```typescript
const topGenres: UserGenreProfile[] = [...genreVector.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([genre, weight]) => ({ genre, weight: parseFloat(weight.toFixed(4)) }));
```

Converts the Map to a sorted array and takes the top 10. The `.toFixed(4)` rounds to 4 decimal places (e.g., 0.3462 instead of 0.34615384615384615). This is a display concern — the full precision is preserved in the Map for scoring.

**Player summary fetch**:

```typescript
try {
  const summary = await steamService.getPlayerSummary(steamId);
  personaName = summary.personaName;
  avatar = summary.avatar;
} catch {
  // Non-fatal: proceed without display name
}
```

This is wrapped in a try/catch because the player summary is purely cosmetic. A failure here should not prevent recommendations.

### Function: `scoreWithUserContext` — 3-Signal Composite Scoring Engine

 ->  Source: [`scoreWithUserContext`](backend/src/services/user-profile.service.ts#L216-L336)

```typescript
export async function scoreWithUserContext(
  steamId: string,
  profile: UserProfile,
  limit: number = 20,
): Promise<ScoredRecommendation[]>;
```

**Step 1 — Candidate collection**:

```typescript
const candidateScores = new Map<
  number,
  { jaccardScore: number; name: string }
>();

for (const game of profile.library) {
  const similar = recommender.getSimilarGames(game.appId, 30);
  for (const s of similar) {
    if (profile.ownedAppIds.has(s.appId)) continue;
    const existing = candidateScores.get(s.appId);
    if (!existing || s.similarity > existing.jaccardScore) {
      candidateScores.set(s.appId, {
        jaccardScore: s.similarity,
        name: s.name,
      });
    }
  }
}
```

For each owned game, retrieve its top-30 similar games. For each candidate:

1. Skip if user already owns it (O(1) Set lookup).
2. If seen before from another owned game, keep the **higher** similarity score (not accumulated like in `getRecommendationsForLibrary`).

This collects potentially thousands of unique candidates.

**Step 2 — Batch metadata fetch**:

```typescript
const candidateIds = [...candidateScores.keys()];
const placeholders = candidateIds.map((_, i) => `$${i + 1}`).join(",");
const metaResult = await query<{
  app_id: number;
  genres: string;
  tags: string;
  header_image: string | null;
  short_description: string | null;
  price: string | null;
}>(
  `SELECT app_id, genres, tags, header_image, short_description, price
   FROM games WHERE app_id IN (${placeholders})`,
  candidateIds,
);
```

Single SQL round-trip for all candidates. PostgreSQL scans the PRIMARY KEY index.

**Step 3 — Genre parsing for candidates**:

```typescript
for (const row of metaResult.rows) {
  const combined = [
    ...(row.genres || "").split(","),
    ...(row.tags || "").split(","),
  ]
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  candidateGenres.set(row.app_id, [...new Set(combined)]);
  candidateMeta.set(row.app_id, row);
}
```

**Step 4 — Composite score computation**:

For each candidate c:

```
finalScore(c) = alpha × jaccardScore(c) + beta × genreAlignmentScore(c) + gamma × socialScore(c)
```

Where alpha = 0.50, beta = 0.30, gamma = 0.20.

**Signal 1 — `jaccardScore(c)`**:

```typescript
// Already computed — it's the max pre-computed similarity across owned games
```

**Signal 2 — `genreAlignmentScore(c)`**:

```typescript
const genreAlignmentScore = genres.reduce(
  (sum, g) => sum + (profile.genreVector.get(g) ?? 0),
  0,
);
```

This is the dot product of the candidate's genre set against the user's preference vector. For each genre in the candidate's genre list, look up its weight in the user's genre vector and sum.

**Example**: User's vector: `{RPG: 0.50, Action: 0.35, Puzzle: 0.15}`. Candidate genres: `{RPG, Action}`.

```
genreAlignmentScore = 0.50 + 0.35 = 0.85
```

Note: This is a one-sided sum (not cosine similarity). The user's vector is L1-normalized but the candidate's genres are unweighted.

**Signal 3 — `socialScore(c)`**:

```typescript
const socialScore = profile.friendOverlapSet.has(appId) ? 1.0 : 0.0;
```

Binary signal: 1 if >=2 friends own this game, 0 otherwise. The social boost is `gamma × 1.0 = 0.20`.

**Reason generation**:

```typescript
const reasons: string[] = [];
if (jaccardScore > 0.5) reasons.push("Highly similar content");
if (genreAlignmentScore > 0.15) reasons.push("Matches your genre preferences");
if (socialScore > 0) reasons.push("Popular among your friends");
```

These thresholds determine which human-readable reasons are attached. A recommendation with all three: `"Highly similar content · Matches your genre preferences · Popular among your friends"`.

**Step 5 — Display field population**:

```typescript
scored.push({
  appId,
  name,
  score: parseFloat(finalScore.toFixed(6)),
  jaccardScore: parseFloat(jaccardScore.toFixed(4)),
  genreAlignmentScore: parseFloat(genreAlignmentScore.toFixed(4)),
  socialScore,
  reason: reasons.join(" · ") || "Recommended for you",
  headerImage: meta?.header_image ?? null,
  genres: displayGenres,
  tags: displayTags,
  description: meta?.short_description ?? null,
  price: meta?.price != null ? parseFloat(meta.price) : null,
  isFree: parseFloat(meta?.price ?? "NaN") === 0,
  developers: [], // Not fetched from DB — would require another column
  publishers: [], // Same
  releaseDate: null, // Same
});
```

Note: `developers`, `publishers`, and `releaseDate` are hardcoded as empty/null. These fields exist in the `ScoredRecommendation` interface (for the `GameCardComponent`) but are not fetched from the database in the current implementation.

**Step 6 — Sort and truncate**:

```typescript
scored.sort((a, b) => b.score - a.score);
return scored.slice(0, limit);
```

Timsort (O(N log N)). Returns top `limit` results.

---

## 9. Data Pipeline Scripts

These scripts form an offline ETL (Extract, Transform, Load) pipeline that prepares the recommendation engine's data. They are run manually before the server starts, not during request handling.

### 9.1 `download-dataset.ts`

**File**: [`download-dataset.ts`](backend/src/scripts/download-dataset.ts)

This script checks if the raw Kaggle dataset exists and provides download instructions if not.

#### Mechanical Execution

**Step 1 — Directory creation**:

```typescript
fs.mkdirSync(DATA_DIR, { recursive: true });
```

`{ recursive: true }` creates all parent directories if they don't exist (equivalent to `mkdir -p`). No-ops if the directory already exists.

**Step 2 — Existence check**:

```typescript
async function checkExistingData(): Promise<boolean> {
  if (fs.existsSync(STEAM_CSV)) {
    const stats = fs.statSync(STEAM_CSV);
    const sizeMB = stats.size / (1024 * 1024);
    console.log(`✓ Dataset already exists: ${STEAM_CSV}`);
    console.log(`  Size: ${sizeMB.toFixed(2)} MB`);
    return true;
  }
  return false;
}
```

`fs.statSync` returns an `fs.Stats` object with `size` (in bytes), `mtime` (last modification), etc. The `size / (1024 * 1024)` converts bytes to megabytes.

**Step 3 — Download helper (currently unused)**:

```typescript
async function downloadFromUrl(url: string, dest: string): Promise<boolean> {
  return new Promise((resolve) => {
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          fs.unlinkSync(dest);
          downloadFromUrl(redirectUrl, dest).then(resolve);
          return;
        }
      }
      // ...
    });
  });
}
```

This function handles HTTP redirects recursively. When a 301/302 is received:

1. Close the partially-written file.
2. Delete it (`fs.unlinkSync`).
3. Recursively call `downloadFromUrl` with the redirect URL.
4. Resolve the outer Promise with the recursive result.

This is currently commented out because the Kaggle dataset requires authentication.

### 9.2 `process-dataset.ts`

**File**: [`process-dataset.ts`](backend/src/scripts/process-dataset.ts)

**Input**: `data/raw/games.csv`
**Output**: Multiple JSON files in `data/processed/`

#### Interfaces

```typescript
interface RawGame {
  appid: string;
  name: string;
  release_date: string;
  developer: string;
  publisher: string;
  platforms: string;
  categories: string;
  genres: string;
  steamspy_tags: string;
  positive_ratings: string;
  negative_ratings: string;
  average_playtime: string;
  median_playtime: string;
  owners: string;
  price: string;
}
```

All fields are `string` because CSV parsing always produces strings. The `processGame` function converts each field to its proper type.

#### Function: `parseList` — Semicolon Splitting

 ->  Source: [`parseList`](backend/src/scripts/process-dataset.ts#L75-L78)

```typescript
function parseList(value: string): string[] {
  if (!value || value.trim() === "") return [];
  return value
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
```

The Kaggle CSV uses semicolons (not commas) to separate multi-value fields. For `"Action;RPG;Indie"`:

1. `.split(';')`  ->  `['Action', 'RPG', 'Indie']`.
2. `.map(s => s.trim())`  ->  removes whitespace.
3. `.filter(s => s.length > 0)`  ->  removes empty strings (from trailing semicolons like `"Action;"`).

#### Function: `parseOwnerRange` — Range String Parsing

 ->  Source: [`parseOwnerRange`](backend/src/scripts/process-dataset.ts#L83-L93)

```typescript
function parseOwnerRange(value: string): { min: number; max: number } {
  const cleaned = value.replace(/,/g, "").replace(/\s/g, "");
  const parts = cleaned.split("-");
  return {
    min: parseInt(parts[0]) || 0,
    max: parseInt(parts[1]) || parseInt(parts[0]) || 0,
  };
}
```

For `"10,000 - 20,000"`:

1. Remove commas: `"10000 - 20000"`.
2. Remove whitespace: `"10000-20000"`.
3. Split on `-`: `['10000', '20000']`.
4. Parse: `{ min: 10000, max: 20000 }`.

#### Function: `processGame` — Single Record Processing

 ->  Source: [`processGame`](backend/src/scripts/process-dataset.ts#L98-L142)

```typescript
function processGame(raw: RawGame): ProcessedGame | null;
```

**Step 1** — Parse appId and validate:

```typescript
const appId = parseInt(raw.appid);
if (isNaN(appId) || !raw.name) return null;
```

Games with invalid IDs or missing names are skipped.

**Step 2** — Parse multi-value fields:

```typescript
const genres = parseList(raw.genres);
const categories = parseList(raw.categories);
const steamspyTags = parseList(raw.steamspy_tags);
```

**Step 3** — Compute rating ratio:

```typescript
const totalRatings = positiveRatings + negativeRatings;
const ratingRatio = totalRatings > 0 ? positiveRatings / totalRatings : 0;
```

This is the "approval rate" — e.g., 80% means 80% of reviews are positive.

**Step 4** — Build deduplicated tag set:

```typescript
const allTagsSet = new Set<string>();
genres.forEach((g) => allTagsSet.add(g.toLowerCase()));
categories.forEach((c) => allTagsSet.add(c.toLowerCase()));
steamspyTags.forEach((t) => allTagsSet.add(t.toLowerCase()));
const allTags = Array.from(allTagsSet);
```

Three classification sources are merged:

1. **Genres**: Steam's official categories (e.g., "Action", "RPG").
2. **Categories**: Feature labels (e.g., "Single-player", "Multi-player", "Steam Achievements").
3. **SteamSpy Tags**: Community-voted labels (e.g., "Open World", "Souls-like").

All are lowercased and deduplicated. The result is a comprehensive feature vector for the game.

**Step 5** — Build feature vector string:

```typescript
featureVector: allTags.join(" ");
```

Space-separated tags for potential TF-IDF processing: `"action rpg indie open world"`.

#### Function: `calculateStats` — Dataset Statistics

Iterates all processed games once, computing:

- Unique genres (via `Set`).
- Tag frequency counts (via `Map<string, number>`).
- Free game count.
- Average rating ratio (only for games with reviews).
- Top 50 tags by frequency.

#### Function: `saveProcessedData` — Output Generation

Produces 5 output files:

1. `games.json` — Full processed game objects (all fields).
2. `games-light.json` — Lightweight version omitting descriptions.
3. `stats.json` — Dataset statistics.
4. `tag-vocabulary.json` — Top 50 tags by frequency.
5. `app-id-map.json` — `{ appId: name }` mapping.

All files use `JSON.stringify(data, null, 2)` for human-readable formatting (2-space indentation).

#### Main Flow

```typescript
async function main(): Promise<void> {
  // 1. Check input file exists
  // 2. Read and parse CSV
  // 3. Process each game (processGame)
  // 4. Calculate statistics
  // 5. Save processed data
  // 6. Print summary
}
```

### 9.3 `build-recommender.ts`

**File**: [`build-recommender.ts`](backend/src/scripts/build-recommender.ts)

This is the offline computation engine that builds the similarity index. It reads all games from PostgreSQL, computes pairwise similarity scores, and saves the top-K neighbors for each game.

#### Score Weights

 ->  See [`SCORE_WEIGHTS`](backend/src/scripts/build-recommender.ts#L53-L62)

Total weight: 0.92. The remaining 0.08 was the `metacritic` weight from the Python prototype (dropped in TypeScript).

#### Function: `fetchGamesFromDB` — Data Loading

 ->  Source: [`fetchGamesFromDB`](backend/src/scripts/build-recommender.ts#L64-L120)

```typescript
async function fetchGamesFromDB(): Promise<LightGame[]>;
```

**Step 1** — `SELECT * FROM games` — fetches all rows from PostgreSQL.

**Step 2** — For each row, parse comma-separated strings into arrays, compute derived fields, and **precompute Sets**:

```typescript
const genresSet = new Set<string>(genres.map((s: string) => s.toLowerCase()));
const tagsSet = new Set<string>(tags.map((s: string) => s.toLowerCase()));
const categoriesSet = new Set<string>(
  categories.map((s: string) => s.toLowerCase()),
);
const studiosSet = new Set<string>(
  [...developers, ...publishers].map((s: string) => s.toLowerCase()),
);
```

These Sets are computed **once** per game. Without precomputation, the O(N²) pairwise loop would create 4 new Sets per comparison × 729 million comparisons = ~2.9 billion Set instantiations. Precomputing reduces this to 4 × N.

#### Function: `computeGlobalMaxes` — Normalization Constants

 ->  Source: [`computeGlobalMaxes`](backend/src/scripts/build-recommender.ts#L122-L134)

```typescript
function computeGlobalMaxes(games: LightGame[]): GlobalMaxes;
```

Scans all games once (O(N)) to find the maximum price, popularity, and playtime values. These are used as denominators in score normalization.

- `maxPrice` starts at 60 (not 0) — this prevents edge cases when all games are free.
- `maxPop = max(positive + negative + ownersMin)` across all games.
- `maxPt = max(averagePlaytime)` across all games.

#### Function: `getJaccard` — Optimized Set Intersection

 ->  Source: [`getJaccard`](backend/src/scripts/build-recommender.ts#L136-L149)

```typescript
function getJaccard(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0.0;
  let intersect = 0;
  const [smaller, larger] = setA.size < setB.size ? [setA, setB] : [setB, setA];
  for (const item of smaller) {
    if (larger.has(item)) intersect++;
  }
  const union = setA.size + setB.size - intersect;
  return intersect / union;
}
```

**Mathematical definition**: J(A, B) = |A  intersection  B| / |A  union  B|

**Optimization**: Iterate the smaller set. `Set.has()` is O(1). Total: O(min(|A|, |B|)).

**Union computed algebraically**: |A  union  B| = |A| + |B| - |A  intersection  B|. No actual union set is constructed.

#### Function: `getStudioOverlap` — Binary Match

 ->  Source: [`getStudioOverlap`](backend/src/scripts/build-recommender.ts#L151-L159)

```typescript
function getStudioOverlap(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0.0;
  const [smaller, larger] = setA.size < setB.size ? [setA, setB] : [setB, setA];
  for (const item of smaller) {
    if (larger.has(item)) return 1.0; // Return immediately on first match
  }
  return 0.0;
}
```

Returns `1.0` if any developer or publisher is shared between two games, `0.0` otherwise. Short-circuits on the first match (O(1) best case).

#### Function: `calculateScore` — 8-Factor Weighted Score

 ->  Source: [`calculateScore`](backend/src/scripts/build-recommender.ts#L161-L191)

For each pair (target, candidate):

```typescript
function calculateScore(
  target: LightGame,
  candidate: LightGame,
  allMax: GlobalMaxes,
): number;
```

1. **Genres (0.25)**: Jaccard of genre sets.
2. **Tags (0.25)**: Jaccard of tag sets.
3. **Categories (0.10)**: Jaccard of category sets.
4. **Developer (0.04)**: Binary studio overlap.
5. **Price (0.10)**: `1 - min(|candPrice - prefPrice| / maxPrice, 1.0)`.
6. **Review ratio (0.10)**: Candidate's `positiveRatings / totalRatings`.
7. **Popularity (0.05)**: `log1p(pop) / log1p(maxPop)`.
8. **Playtime (0.03)**: `log1p(playtime) / log1p(maxPlaytime)`.

#### The Pairwise Loop — O(N²) Complexity

```typescript
for (let i = 0; i < games.length; i++) {
  const game = games[i];
  const similar = findSimilarGames(game.appId, games, allMax, topK);
  index.set(game.appId, similar);
}
```

Inside `findSimilarGames`, every game is compared to every other game:

```typescript
for (const other of games) {
  if (other.appId === targetId) continue;
  const similarity = calculateScore(target, other, allMax);
  if (similarity > 0.1) {
    similarities.push({ appId: other.appId, name: other.name, similarity });
  }
}
```

For N ~ 27,000 games (filtered to >=50 reviews), this is ~729 million pairwise comparisons. Progress is logged every 1,000 games with ETA.

The threshold `similarity > 0.1` filters out very dissimilar games, reducing storage requirements.

#### Output

```typescript
function saveRecommenderData(index: Map<number, SimilarGame[]>): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const indexObj = Object.fromEntries(index);
  fs.writeFileSync(indexPath, JSON.stringify(indexObj, null, 2));
}
```

`Object.fromEntries(index)` converts the `Map<number, SimilarGame[]>` to a plain object `{ "730": [...], "570": [...] }`. This is necessary because `JSON.stringify` doesn't natively serialize `Map` objects.

### 9.4 Inspection Utilities

**`inspect-csv-columns.ts`**: 7 lines. Reads the CSV header and prints columns with indices:

```typescript
const first = fs.readFileSync(path, "utf-8").split("\n")[0];
const cols = first.split(",").map((c, i) => `${i + 1}. ${c.trim()}`);
console.log("Columns in CSV:\n" + cols.join("\n"));
```

**`inspect-csv-and-interface.ts`**: A schema validation tool:

1. Parses the CSV header using `csv-parse` (handles quoted commas correctly).
2. Reads `process-dataset.ts` source code and extracts `RawGame` interface fields via regex:
   ```typescript
   const interfaceMatch = source.match(/interface RawGame\s*\{([^}]+)\}/s);
   ```
3. Compares the two lists using Set difference operations.
4. Reports fields in CSV but not in the interface, and vice versa.

---

## 10. Shell Scripts

### 10.1 `dev-start.sh`

**File**: `backend/scripts/dev-start.sh`

Launches both the backend and frontend in parallel, with graceful shutdown.

**Mechanical execution**:

1. **Pre-flight checks**: Runs `check-data.sh` and `db-health.sh`.
2. **Background processes**: `npm run dev &` and `npx ng serve &`. The `&` runs each in the background, capturing PIDs via `$!`.
3. **Signal trap**: `trap cleanup SIGINT SIGTERM` registers a handler for Ctrl+C.
4. **Cleanup function**: `kill $BACKEND_PID $FRONTEND_PID; wait $BACKEND_PID $FRONTEND_PID` sends SIGTERM and waits for graceful exit.
5. **Wait loop**: `wait` blocks the script until both background processes exit.

### 10.2 `db-health.sh`

**File**: `backend/scripts/db-health.sh`

A 5-step PostgreSQL health check:

1. `pg_isready` — TCP connectivity test.
2. `SELECT to_regclass('public.games')` — Table existence check.
3. `SELECT COUNT(*)` — Row count + basic statistics.
4. `SELECT ... ORDER BY positive_votes DESC LIMIT 5` — Data sanity check.
5. Index count query — Performance optimization verification.

### 10.3 `test-api.sh`

**File**: `backend/scripts/test-api.sh`

Smoke tests every API endpoint via `curl`:

```bash
curl -s -o /tmp/pse_api_response.json -w '%{http_code} %{time_total}'
```

- `-s` (silent) suppresses progress bars.
- `-o /tmp/...` writes the response body to a file.
- `-w '%{http_code} %{time_total}'` prints HTTP status and timing.

User-specific endpoints require `STEAM_ID` environment variable.

### 10.4 `check-data.sh`

**File**: `backend/scripts/check-data.sh`

Validates the data pipeline across three stages:

1. **Raw data**: `games.csv` or `games.json` existence.
2. **Processed data**: All 5 JSON files from `process-dataset.ts`.
3. **Recommender data**: `similarity-index.json`, `vectors.json`, `idf.json`.

JSON validation via `python3 -m json.tool`. Empty files flagged as corrupt.

---

## 11. Python Scripts

### 11.1 `games_to_db.py`

**File**: [`games_to_db.py`](backend/games_to_db.py)

This Python script is the primary data loader. It reads `games.json` and inserts all games into the PostgreSQL `games` table.

#### Function: `create_table` — Schema Definition

Creates a `games` table with 28 columns:

```sql
CREATE TABLE games (
    app_id              INTEGER PRIMARY KEY,
    game_name           VARCHAR(500) NOT NULL,
    estimated_owners    VARCHAR(50),
    peak_ccu            INTEGER DEFAULT 0,
    required_age        INTEGER DEFAULT 0,
    price               DECIMAL(10,2) DEFAULT 0.00,
    long_description    TEXT,
    short_description   TEXT,
    -- ... 20 more columns ...
    windows_support     BOOLEAN DEFAULT FALSE,
    mac_support         BOOLEAN DEFAULT FALSE,
    linux_support       BOOLEAN DEFAULT FALSE
);
```

`DROP TABLE IF EXISTS games CASCADE;` ensures idempotent re-runs. `CASCADE` drops dependent objects (indexes, foreign keys).

#### Function: `parse_game` — Field Extraction

```python
def parse_game(app_id, game):
    return (
        int(app_id),
        game.get('name', 'Unknown')[:500],
        # ... 24 more fields ...
        ','.join(game.get('tags', {}).keys()) if isinstance(game.get('tags'), dict) else ''
    )
```

Notable transformations:

- `game.get('name', 'Unknown')[:500]` — Truncates to 500 chars (matches VARCHAR(500)).
- `','.join(game.get('developers', []))` — Converts array to comma-separated string.
- `game.get('tags', {}).keys()` — Tags in the JSON are a dict (`{"Action": 50, "RPG": 30}`). Only keys are stored; vote counts are discarded.

#### Function: `load_games_batch` — Optimized Batch Insert

```python
BATCH_SIZE = 1000
COMMIT_EVERY = 10000
```

**Step 1** — Load JSON: `json.load(f)` reads the entire file into a Python dict.

**Step 2** — Iterate and batch:

```python
for app_id, game in dataset.items():
    parsed = parse_game(app_id, game)
    if parsed:
        batch.append(parsed)
        if len(batch) >= BATCH_SIZE:
            psycopg2.extras.execute_values(cur, insert_sql, batch)
            loaded += len(batch)
            batch = []
```

`execute_values` generates a single `INSERT ... VALUES (row1), (row2), ..., (row1000)` statement. This is dramatically faster than 1,000 individual INSERTs:

- 1 network round-trip instead of 1,000.
- PostgreSQL optimizes multi-row inserts internally.

`ON CONFLICT (app_id) DO NOTHING` makes re-runs idempotent.

**Step 3** — Periodic commits: Every 10,000 rows. Balances durability vs performance.

#### Function: `load_games_streaming` — Memory-Efficient Alternative

For files >500MB, uses `ijson` for SAX-style JSON streaming:

```python
parser = ijson.kvitems(f, '')
for app_id, game in parser:
    # Process one game at a time
```

Memory usage: O(batch_size) instead of O(file_size).

#### Function: `create_indexes`

```sql
CREATE INDEX IF NOT EXISTS idx_games_price ON games (price);
CREATE INDEX IF NOT EXISTS idx_games_positive ON games (positive_votes);
CREATE INDEX IF NOT EXISTS idx_games_metacritic ON games (metacritic_score);
```

B-tree indexes for columns used in `ORDER BY` and `WHERE` clauses. `idx_games_positive` directly accelerates the `ORDER BY positive_votes DESC` in `search.service.ts`.

---

## 12. Test Suite

The test suite follows a 2-layer strategy:

### Layer 1: Unit Tests (isolated logic, mocked I/O)

#### `recommender.service.test.ts`

**File**: [`recommender.service.test.ts`](backend/src/services/__tests__/recommender.service.test.ts)

**Mocking strategy**: Mocks `fs` to inject deterministic test data:

```typescript
jest.mock("fs");
const mockFs = fs as jest.Mocked<typeof fs>;

const FAKE_SIMILARITY_INDEX = {
  730: [
    { appId: 10, name: "Counter-Strike", similarity: 0.85 },
    { appId: 440, name: "Team Fortress 2", similarity: 0.72 },
  ],
  570: [
    { appId: 730, name: "Counter-Strike 2", similarity: 0.6 },
    { appId: 10, name: "Counter-Strike", similarity: 0.55 },
  ],
  999: [],
};
```

**Test cases**:

1. **`isReady()` — readiness detection**:
   - Test: When `similarity-index.json` loads  ->  `isReady() === true`.
   - Test: When file missing  ->  `isReady() === false`.

2. **`getSimilarGames()` — O(1) lookup**:
   - Test: Returns correct sorted results for known appId.
   - Test: Respects `limit` parameter.
   - Test: Returns `[]` for unknown appId.
   - Test: Returns `[]` for game with empty similarity list.

3. **`getRecommendationsForLibrary()` — aggregation engine**:
   - Test: Empty input  ->  empty output.
   - Test: Not-ready state  ->  empty output.
   - Test: **Ownership exclusion** — owned games must not appear.
   - Test: **Cross-library aggregation** — Game 10 appears in both 730's and 570's lists  ->  should rank highest.
   - Test: **Playtime weighting** — heavily-played games contribute proportionally more weight.

#### `search.service.test.ts`

**File**: `backend/src/services/__tests__/search.service.test.ts`

**Mocking strategy**: Mocks the `query` function from `db.ts`.

**Test cases**:

- No genres  ->  SQL has no `WHERE` clause.
- Multiple genres  ->  compound `ILIKE` conditions.
- Row mapping  ->  verifies snake_case  ->  camelCase transformation.

### Layer 2: Route Integration Tests (full Express pipeline)

#### `game.routes.test.ts`

**Mocking**: Mocks `getSteamService` to return a fake service.

**Test cases**:

- 400 for invalid appId (`/api/game/abc`).
- 404 for unknown game (`/api/game/999`).
- 200 for valid game (`/api/game/730`).

#### `search.routes.test.ts`

**Test layers**:

- **Layer A**: Zod middleware validation.
- **Layer B**: Parameter delegation to service.
- **Layer C**: Response body shape contract.
- **Layer D**: Error handling (service throws  ->  500).

#### `validate.middleware.test.ts`

Tests validation middleware in isolation with mock Express objects. Verifies valid input calls `next()` and invalid input returns 400.

---

## 13. Architectural Diagrams

### 13.1 Request Flow

```
Browser (Angular, port 4200)
    │
    │  HTTP GET /api/recommend/user/76561198012345678
    │
    ▼
Express Server (port 3000)
    │
    ├─ cors()                     ->  Add CORS headers
    ├─ express.json()             ->  Parse body
    ├─ Router: /api/recommend
    │   ├─ validate(schema)       ->  Zod validation
    │   └─ async handler          ->  Route logic
    │       ├─ buildUserProfile()
    │       │   ├─ Steam API: getOwnedGames()
    │       │   ├─ Steam API: getRecentlyPlayedGames()
    │       │   ├─ Steam API: getFriendList()
    │       │   ├─ Steam API: getMultipleOwnedGames()
    │       │   ├─ PostgreSQL: genre metadata query
    │       │   └─ CPU: buildGenreVector + buildFriendOverlapSet
    │       └─ scoreWithUserContext()
    │           ├─ In-memory: similarity index lookup
    │           ├─ PostgreSQL: candidate metadata query
    │           └─ CPU: 3-signal composite scoring
    │
    ├─ 404 handler                ->  Unmatched routes
    └─ Error handler              ->  Uncaught errors
```

### 13.2 Data Pipeline

```
Kaggle Dataset (steam.csv / games.json)
    │
    ├─ [Python] games_to_db.py
    │   └─ PostgreSQL: games table (batch INSERT)
    │
    ├─ [TypeScript] process-dataset.ts
    │   ├─ Input:  data/raw/games.csv
    │   └─ Output: data/processed/
    │       ├─ games.json
    │       ├─ games-light.json
    │       ├─ stats.json
    │       ├─ tag-vocabulary.json
    │       └─ app-id-map.json
    │
    └─ [TypeScript] build-recommender.ts
        ├─ Input:  PostgreSQL games table
        └─ Output: data/processed/recommender/
            └─ similarity-index.json (O(N²) precomputation)
```

### 13.3 Service Dependencies

```
Routes
  │
  ├─ user.routes.ts ──────────► SteamService (singleton)
  │                                   │
  ├─ game.routes.ts ──────────► SteamService
  │                                   │
  ├─ search.routes.ts ────────► SearchService ──────► pg.Pool (db.ts)
  │                                                        │
  └─ recommend.routes.ts ─┬──► RecommenderService          │
                          │    (in-memory index)            │
                          │                                 │
                          └──► UserProfileService           │
                               ├─► SteamService ────────────┤ (Steam API)
                               └─► pg.Pool ─────────────────┘ (PostgreSQL)
```

### 13.4 Scoring Pipeline Detail

```
User Steam ID
    │
    ▼
Phase 1: Parallel I/O (Promise.allSettled)
    ├─ getOwnedGames()        ->  OwnedGame[]     (library)
    ├─ getRecentlyPlayedGames()  ->  OwnedGame[]   (recent)
    └─ getFriendList()         ->  Friend[]         (friends)
    │
    ▼
Phase 2: Friend Library Batch (Promise.allSettled)
    └─ getMultipleOwnedGames(friends.slice(0,10))
        ->  Map<steamId, OwnedGame[]>
    │
    ▼
Phase 3: CPU-Bound Computation
    ├─ buildGenreVector(library, recent)
    │   └─ PostgreSQL: SELECT genres, tags WHERE app_id IN (...)
    │   └─ L1 normalization  ->  Map<genre, weight>
    │
    ├─ buildFriendOverlapSet(friendLibraries)
    │   └─ Count ownership  ->  threshold >= 2  ->  Set<appId>
    │
    └─ ownedAppIds = Set(library.map(g => g.appId))
    │
    ▼
Phase 4: 3-Signal Composite Scoring
    ├─ Candidate Collection
    │   └─ For each owned game  ->  getSimilarGames(appId, 30)
    │   └─ Deduplicate, skip owned  ->  candidateScores Map
    │
    ├─ Metadata Fetch
    │   └─ PostgreSQL: SELECT ... WHERE app_id IN (candidates)
    │
    ├─ Score Computation (per candidate)
    │   ├─ Signal 1: jaccardScore     (alpha = 0.50) — pre-computed
    │   ├─ Signal 2: genreAlignment   (beta = 0.30) — SUM genreVector[g]
    │   └─ Signal 3: socialScore      (gamma = 0.20) —  in  friendOverlapSet?
    │   └─ finalScore = alpha·S1 + beta·S2 + gamma·S3
    │
    └─ Sort by finalScore DESC  ->  Top K
```

---

## 14. Formal Algorithmic & Systems-Level Decomposition

This section deconstructs every major backend operation into its **root O(1) primitive operations**, traces **system-level execution** from application code down to kernel syscalls, and formally defines the **interface boundaries** with their input/output vectors and memory side-effects.

---

### 14.1 Primitive Operations Catalog

Every algorithm in this backend is composed from the following O(1) atomic operations:

| Primitive   | Operation                                    | Time                | Space          | Hardware                                              |
| ----------- | -------------------------------------------- | ------------------- | -------------- | ----------------------------------------------------- |
| `MAP_GET`   | `Map.get(key)` — V8 hash table lookup        | O(1) amortized      | O(1)           | Hash computation  ->  bucket index  ->  pointer dereference |
| `MAP_SET`   | `Map.set(key, value)` — V8 hash table insert | O(1) amortized      | O(1) per entry | Hash  ->  probe  ->  write to heap                          |
| `SET_HAS`   | `Set.has(value)` — V8 hash set membership    | O(1) amortized      | O(1)           | Hash  ->  bucket scan  ->  boolean                          |
| `SET_ADD`   | `Set.add(value)` — V8 hash set insert        | O(1) amortized      | O(1) per entry | Hash  ->  probe  ->  write                                  |
| `ARR_PUSH`  | `Array.push(value)` — amortized append       | O(1) amortized      | O(1) amortized | Write to backing store, possible realloc (2x growth)  |
| `ARR_IDX`   | `Array[i]` — direct index access             | O(1)                | O(1)           | Base pointer + offset computation                     |
| `NUM_ADD`   | `a + b` — IEEE 754 double addition           | O(1)                | O(1)           | FPU `FADD` instruction                                |
| `NUM_MUL`   | `a * b` — IEEE 754 double multiply           | O(1)                | O(1)           | FPU `FMUL` instruction                                |
| `NUM_DIV`   | `a / b` — IEEE 754 double division           | O(1)                | O(1)           | FPU `FDIV` instruction                                |
| `NUM_CMP`   | `a > b` — numeric comparison                 | O(1)                | O(1)           | `FCMP` + conditional flags                            |
| `LOG1P`     | `Math.log1p(x)` — ln(1+x)                    | O(1)                | O(1)           | FPU `FYL2XP1` or polynomial approx                    |
| `PARSE_INT` | `parseInt(s, 10)` — string -> integer           | O(d) where d=digits | O(1)           | Byte scan + multiply-accumulate                       |
| `STR_LOWER` | `s.toLowerCase()` — case folding             | O(n)                | O(n)           | Byte-by-byte copy with case map                       |
| `STR_SPLIT` | `s.split(delim)` — tokenization              | O(n)                | O(k) k=tokens  | Linear scan + heap alloc per token                    |
| `STR_TRIM`  | `s.trim()` — whitespace removal              | O(n)                | O(n)           | Scan from both ends                                   |

**V8 Map/Set internals**: V8 uses a deterministic hash table variant (ordered insertion). Hash computation for integers: identity function masked to table size. For strings: `StringHasher` computes a 32-bit hash via iterative multiply-add. Collision resolution: open addressing with quadratic probing. Load factor threshold: 0.75 triggers reallocation (2x capacity).

---

### 14.2 Algorithmic Composition — From Primitives to Algorithms

#### 14.2.1 Jaccard Similarity — `getJaccard(A, B)`

 ->  Source: [`getJaccard`](backend/src/scripts/build-recommender.ts#L136-L149)

**Formal definition**: J(A, B) = |A  intersection  B| / |A  union  B|

**Primitive decomposition**:

```
FUNCTION getJaccard(setA: Set<string>, setB: Set<string>)  ->  float:

  # Step 1: Empty-set guard — 2× SET_SIZE + 1× NUM_CMP
  IF setA.size == 0 AND setB.size == 0:       # 2× O(1) reads + 1× O(1) compare
    RETURN 0.0

  # Step 2: Size comparison for iteration order — 1× NUM_CMP
  [smaller, larger] ← sort_by_size(setA, setB)  # 1× compare

  # Step 3: Intersection count — |smaller| × (SET_HAS)
  intersect ← 0
  FOR item IN smaller:                          # |smaller| iterations
    IF larger.HAS(item):                        # O(1) hash lookup per iteration
      intersect ← intersect + 1                 # O(1) increment

  # Step 4: Union computation — 2× SET_SIZE + 1× NUM_ADD + 1× NUM_SUB
  union ← setA.size + setB.size - intersect

  # Step 5: Division — 1× NUM_DIV
  RETURN intersect / union
```

**Complexity**:

- **Time**: O(min(|A|, |B|)) — dominated by Step 3
- **Space**: O(1) — no auxiliary data structures allocated
- **Primitive count**: min(|A|,|B|) × `SET_HAS` + 4 × `NUM_ADD/SUB` + 1 × `NUM_DIV`

---

#### 14.2.2 Playtime-Weighted Score Aggregation — `getRecommendationsForLibrary`

 ->  Source: [`getRecommendationsForLibrary`](backend/src/services/recommender.service.ts#L102-L178)

**Primitive decomposition**:

**Phase A — Owned Set Construction** (O(L)):

```
ownedSet ← new Set()                           # 1× heap alloc
FOR game IN ownedGames:                         # L iterations
  ownedSet.ADD(game.appId)                      # L × SET_ADD
```

Primitives: L × `SET_ADD`

**Phase B — Weight Computation** (O(L)):

```
totalPlaytime ← 0
FOR game IN ownedGames:                         # L iterations
  totalPlaytime ← totalPlaytime + game.playtimeMinutes  # L × NUM_ADD

gameWeights ← new Map()
FOR game IN ownedGames:                         # L iterations
  w ← LOG1P(game.playtimeMinutes) / LOG1P(totalPlaytime)  # 1× LOG1P + 1× LOG1P + 1× NUM_DIV
  gameWeights.SET(game.appId, w)                # 1× MAP_SET
```

Primitives: L × `NUM_ADD` + L × (2 × `LOG1P` + 1 × `NUM_DIV` + 1 × `MAP_SET`)

**Phase C — Candidate Scoring** (O(L × K)):

```
FOR ownedGame IN ownedGames:                    # L iterations
  similar ← similarityIndex.GET(ownedGame.appId)  # 1× MAP_GET
  weight ← gameWeights.GET(ownedGame.appId)     # 1× MAP_GET
  FOR rec IN similar:                           # K iterations (K <= 20)
    IF ownedSet.HAS(rec.appId): CONTINUE        # 1× SET_HAS
    addedScore ← rec.similarity × weight        # 1× NUM_MUL
    existing ← scores.GET(rec.appId)            # 1× MAP_GET
    IF existing:
      existing.score ← existing.score + addedScore  # 1× NUM_ADD
    ELSE:
      scores.SET(rec.appId, {score: addedScore}) # 1× MAP_SET
```

Primitives per inner iteration: 1 × `SET_HAS` + 1 × `NUM_MUL` + 1 × `MAP_GET` + 1 × (`NUM_ADD` or `MAP_SET`)

**Phase D — Sort** (O(C log C)):

```
recommendations.SORT((a, b)  ->  b.score - a.score)  # Timsort: C log C × NUM_CMP
```

Timsort decomposes to: C × `NUM_CMP` per merge pass × log_2(C) passes

**Total asymptotic complexity**:

- **Time**: O(L × K + C log C) where L = library size, K = neighbors per game (20), C = unique candidates
- **Space**: O(L + C) — ownedSet (L entries) + scores Map (C entries)

---

#### 14.2.3 L1-Normalized Genre Vector — `buildGenreVector`

 ->  Source: [`buildGenreVector`](backend/src/services/user-profile.service.ts#L56-L119)

**Formal definition**:

For user library L with games g_1...g_n:

```
raw(genre) = SUM_i [log_1₊(pt_i) × (1 + 0.5 × recent(g_i))]   ∀ genre  in  genres(g_i)
vector(genre) = raw(genre) / SUMⱼ raw(genreⱼ)                  L1 normalization
```

**Primitive decomposition**:

**Phase A — DB Fetch** (I/O-bound, not decomposable to O(1) primitives):

```
SQL: SELECT app_id, genres, tags FROM games WHERE app_id IN ($1...$L)
```

PostgreSQL execution: L × B-tree index seek (O(log N) per seek)

**Phase B — Genre Map Construction** (O(R × G)):

```
FOR row IN dbResult.rows:                       # R rows returned
  genres ← row.genres.SPLIT(',')                # O(|genres_string|) — STR_SPLIT
  tags ← row.tags.SPLIT(',')                    # O(|tags_string|) — STR_SPLIT
  FOR g IN genres:
    g ← g.TRIM().TO_LOWER_CASE()                # STR_TRIM + STR_LOWER
  merged ← new Set([...genres, ...tags])        # dedup via SET_ADD
  genreMap.SET(row.app_id, Array.from(merged))  # MAP_SET
```

Primitives per row: 2 × `STR_SPLIT` + G × (`STR_TRIM` + `STR_LOWER` + `SET_ADD`) + 1 × `MAP_SET`

**Phase C — Weighted Accumulation** (O(L × G)):

```
FOR game IN library:                            # L iterations
  genres ← genreMap.GET(game.appId)             # 1× MAP_GET
  recency ← recentSet.HAS(game.appId) ? 1.5 : 1.0  # 1× SET_HAS + 1× NUM_CMP
  contrib ← LOG1P(game.playtimeMinutes) × recency   # 1× LOG1P + 1× NUM_MUL
  FOR genre IN genres:                          # G iterations
    rawVector.SET(genre,
      (rawVector.GET(genre) ?? 0) + contrib)    # 1× MAP_GET + 1× NUM_ADD + 1× MAP_SET
```

**Phase D — L1 Normalization** (O(|V|)):

```
total ← 0
FOR [_, weight] IN rawVector:                   # |V| iterations
  total ← total + weight                        # |V| × NUM_ADD
FOR [genre, weight] IN rawVector:               # |V| iterations
  rawVector.SET(genre, weight / total)          # |V| × (NUM_DIV + MAP_SET)
```

**Total complexity**:

- **Time**: O(L × G + R × G) — dominated by accumulation loop
- **Space**: O(R × G + |V|) — genreMap + rawVector

---

#### 14.2.4 3-Signal Composite Scoring — `scoreWithUserContext`

 ->  Source: [`scoreWithUserContext`](backend/src/services/user-profile.service.ts#L216-L336)

**Formal definition**:

```
finalScore(c) = alpha × jaccardScore(c) + beta × genreAlignment(c) + gamma × socialProof(c)

where:
  alpha = 0.50, beta = 0.30, gamma = 0.20
  jaccardScore(c) = max_{g  in  owned} similarity(g, c)
  genreAlignment(c) = SUM_{genre  in  genres(c)} genreVector[genre]
  socialProof(c) = 1{c  in  friendOverlapSet}
```

**Per-candidate primitive count**:

```
jaccardScore:      Already computed — 0 additional primitives
genreAlignment:    |genres(c)| × (MAP_GET + NUM_ADD) = G × 2 primitives
socialProof:       1 × SET_HAS = 1 primitive
final computation: 3 × NUM_MUL + 2 × NUM_ADD = 5 primitives
```

**Total per candidate**: G × 2 + 6 primitives ~ 16 primitives for G=5

**Total complexity**:

- **Time**: O(L × K + C × G + C log C) — candidate collection + scoring + sort
- **Space**: O(C) — candidateScores Map + scored array

---

#### 14.2.5 8-Factor Weighted Similarity — `calculateScore`

 ->  Source: [`calculateScore`](backend/src/scripts/build-recommender.ts#L161-L191)

**Primitive decomposition per game pair**:

```
score = 0.0
score += 0.25 × getJaccard(a.genresSet, b.genresSet)         # O(min(|G_a|,|G_b|))
score += 0.25 × getJaccard(a.tagsSet, b.tagsSet)             # O(min(|T_a|,|T_b|))
score += 0.10 × getJaccard(a.categoriesSet, b.categoriesSet) # O(min(|C_a|,|C_b|))
score += 0.04 × getStudioOverlap(a.studiosSet, b.studiosSet) # O(min(|S_a|,|S_b|))
score += 0.10 × (1 - min(|a.price - b.price|/maxPrice, 1.0)) # 4× NUM ops
score += 0.10 × b.ratingRatio                                 # 1× NUM_MUL
score += 0.05 × (LOG1P(b.pop) / LOG1P(maxPop))               # 2× LOG1P + 1× NUM_DIV
score += 0.03 × (LOG1P(b.playtime) / LOG1P(maxPt))           # 2× LOG1P + 1× NUM_DIV
```

**Fixed-cost primitives**: 8 × `NUM_MUL` + 7 × `NUM_ADD` + 2 × `NUM_DIV` + 4 × `LOG1P` + 4 × `NUM_CMP` = **25 arithmetic ops**

**Variable-cost (Jaccard calls)**: ~3-4 × `SET_HAS` per Jaccard (avg set size ~5) × 4 calls = **~16 hash lookups**

**Total per pair**: ~41 primitive operations

**O(N²) loop total**: 41 × N² ~ 41 × 27,000² ~ **29.9 billion primitive operations** for the full index build.

---

### 14.3 System-Level Execution Traces

#### 14.3.1 `fs.readFileSync(path, 'utf-8')` — File Read

Used in `RecommenderService.loadData()` to load `similarity-index.json`.

```
Application Layer:
  fs.readFileSync(path, 'utf-8')
    │
    ▼
Node.js Layer:
  node::fs::ReadFileUtf8()        // C++ binding in node_file.cc
    │
    ├─ uv_fs_open()               // libuv synchronous wrapper
    │   └─ SYSCALL: open(path, O_RDONLY, 0)
    │       ├─ Kernel: VFS path resolution (dentry cache lookup)
    │       │   └─ APFS inode lookup  ->  file descriptor allocation
    │       └─ Returns: int fd (file descriptor index into process fd table)
    │
    ├─ uv_fs_fstat(fd)            // Get file size for buffer pre-allocation
    │   └─ SYSCALL: fstat(fd, &statbuf)
    │       └─ Kernel: Read inode metadata  ->  return stat struct
    │           └─ statbuf.st_size = file size in bytes
    │
    ├─ uv_fs_read(fd, buf, size, 0)  // Read entire file
    │   └─ SYSCALL: read(fd, buf, count)
    │       ├─ Kernel: Page cache check
    │       │   ├─ HIT: memcpy from page cache  ->  user buffer
    │       │   └─ MISS: Block I/O request  ->  DMA from SSD
    │       │       ├─ NVMe driver: submit I/O command to SSD controller
    │       │       ├─ SSD: NAND flash read  ->  DMA to kernel page cache
    │       │       └─ memcpy: page cache  ->  user-space buffer
    │       └─ Returns: ssize_t bytes_read
    │
    ├─ uv_fs_close(fd)
    │   └─ SYSCALL: close(fd)
    │       └─ Kernel: Decrement fd refcount, release if zero
    │
    └─ StringBytes::Encode(buf, len, UTF8)
        ├─ V8: Allocate SeqOneByteString on heap (if ASCII)
        │   └─ GC-managed memory: NewSpace (young generation) if < 512KB
        │   └─ LargeObjectSpace if >= 512KB (typical for 50MB+ index files)
        └─ Decode UTF-8 bytes  ->  V8 string (memcpy for ASCII subset)

Memory Profile:
  Stack: ~128 bytes (local variables, fd, stat struct)
  Heap:  2 × file_size (raw Buffer + V8 String copy)
  Kernel: file_size pages in page cache (may persist for subsequent reads)
```

---

#### 14.3.2 `JSON.parse(string)` — JSON Deserialization

Used immediately after `fs.readFileSync` to parse the similarity index.

```
Application Layer:
  JSON.parse(rawString)       // ~50-100MB string for similarity-index.json
    │
    ▼
V8 Internal:
  JsonParser::Parse()         // src/json/json-parser.cc
    │
    ├─ Phase 1: Tokenization (single-pass scanner)
    │   ├─ Byte-by-byte scan of input string
    │   ├─ Token classification: { } [ ] , : string number true false null
    │   └─ String interning: repeated keys ("appId", "name", "similarity")
    │       are deduplicated via V8's string table (hash-consing)
    │
    ├─ Phase 2: Object/Array Construction
    │   ├─ '{'  ->  Allocate JSObject (HeapObject) in V8 heap
    │   │   ├─ Hidden class chain: {}  ->  {appId}  ->  {appId, name}  ->  {appId, name, similarity}
    │   │   │   Each property addition transitions to a new hidden class
    │   │   │   V8 caches these transitions  ->  subsequent objects with same shape reuse classes
    │   │   └─ Property storage: in-object properties (fast) for <= 4 props,
    │   │       external property array (slower) for > 4 props
    │   │
    │   ├─ '['  ->  Allocate JSArray (FixedArray backing store)
    │   │   ├─ Initial capacity: pre-computed from scan (V8 peeks ahead)
    │   │   └─ Element kind: PACKED_ELEMENTS (mixed types) or PACKED_DOUBLE_ELEMENTS
    │   │
    │   └─ Number parsing: strtod() equivalent  ->  IEEE 754 double
    │       └─ "0.85"  ->  0x3FEB333333333333 (64-bit)
    │
    └─ Returns: JSObject (root of parsed object tree)

Memory Profile:
  Stack: O(depth) — recursive descent depth (max ~4 for this schema)
  Heap:  ~3-5× input string size (object headers, hidden classes, property arrays)
         For 50MB input  ->  ~150-250MB heap allocation
  GC Impact: Triggers multiple minor GC cycles during parsing
             May trigger major GC (mark-sweep) if OldSpace is pressured
```

---

#### 14.3.3 `pool.query(sql, params)` — PostgreSQL Query Execution

Used in `searchByGenres`, `buildGenreVector`, and `scoreWithUserContext`.

```
Application Layer:
  pool.query('SELECT ... WHERE app_id IN ($1,$2,...)', [ids])
    │
    ▼
node-postgres (pg) Layer:
  Pool.query()
    ├─ Pool._acquireClient()
    │   ├─ Check idle client queue (FIFO)
    │   │   ├─ HIT: Dequeue idle client  ->  skip connection phase
    │   │   └─ MISS: Create new Client()
    │   │       ├─ net.connect({host, port})
    │   │       │   └─ SYSCALL: socket(AF_INET, SOCK_STREAM, 0)
    │   │       │   └─ SYSCALL: connect(fd, sockaddr{127.0.0.1:5432}, 16)
    │   │       │       └─ Kernel: TCP 3-way handshake (SYN  ->  SYN-ACK  ->  ACK)
    │   │       │
    │   │       └─ PostgreSQL Wire Protocol:
    │   │           ├─ StartupMessage(user, database)
    │   │           ├─ AuthenticationMD5Password
    │   │           │   └─ md5(md5(password + user) + salt)
    │   │           └─ ReadyForQuery
    │   │
    │   └─ Returns: Client (active connection)
    │
    ├─ Client.query(sql, params)
    │   ├─ Serialize to PostgreSQL Extended Query Protocol:
    │   │   ├─ Parse message ('P'): SQL text + parameter types
    │   │   ├─ Bind message ('B'): Parameter values (binary or text)
    │   │   ├─ Describe message ('D'): Request result schema
    │   │   ├─ Execute message ('E'): Run the prepared statement
    │   │   └─ Sync message ('S'): End of pipeline
    │   │
    │   ├─ SYSCALL: write(fd, buffer, length)
    │   │   └─ Kernel: Copy to socket send buffer  ->  TCP segmentation
    │   │       └─ TCP: MSS-sized segments  ->  IP  ->  NIC  ->  loopback (for localhost)
    │   │
    │   ├─ SYSCALL: read(fd, buffer, length)  // Blocks on epoll_wait internally
    │   │   └─ Kernel: TCP receive buffer  ->  copy to user space
    │   │
    │   └─ Parse response:
    │       ├─ RowDescription: Column names + OIDs
    │       ├─ DataRow × N: Binary column values
    │       │   └─ Each DataRow: 4-byte length prefix + column data
    │       └─ CommandComplete: "SELECT N"
    │
    └─ Pool._releaseClient(client)
        └─ Push client back to idle queue (no TCP teardown)

PostgreSQL Backend Execution:
  ├─ Parse: SQL  ->  AST  ->  Query Tree
  ├─ Rewrite: Rule system (views, etc.)
  ├─ Plan: Optimizer  ->  Execution Plan
  │   └─ For IN ($1...$N): Index Scan on app_id PRIMARY KEY (B-tree)
  │       └─ Cost: O(N × log(table_rows)) — N index seeks
  ├─ Execute: Scan B-tree  ->  fetch heap tuples  ->  project columns
  └─ Return: Result rows via wire protocol

Memory Profile (application side):
  Stack: ~256 bytes (function frames)
  Heap:  N × row_size (result.rows array) + protocol buffers (~8KB)
  Network: SQL text + N × 4 bytes (int parameters)  ->  wire protocol overhead ~40 bytes/row
```

---

#### 14.3.4 `axios.get(url, config)` — HTTP Request to Steam API

Used in `SteamService` for all Steam API calls.

```
Application Layer:
  this.apiClient.get('/IPlayerService/GetOwnedGames/v1/', { params })
    │
    ▼
Axios Layer:
  ├─ Interceptor chain (request interceptors, if any)
  ├─ URL construction: baseURL + path + querystring encoding
  │   └─ encodeURIComponent() for each param value
  ├─ Adapter selection: http adapter (Node.js)
  │
  ▼
Node.js http Module:
  http.request(options)
    ├─ DNS Resolution (if not cached):
    │   └─ dns.lookup('api.steampowered.com')
    │       └─ SYSCALL: getaddrinfo()  ->  libc  ->  /etc/resolv.conf  ->  UDP to DNS server
    │           ├─ DNS query: A record for api.steampowered.com
    │           └─ Response: IP address (e.g., 23.58.73.90)
    │       └─ Node.js caches result in dns module (TTL-based)
    │
    ├─ TLS Handshake (HTTPS):
    │   └─ tls.connect()
    │       ├─ SYSCALL: socket(AF_INET, SOCK_STREAM, 0)
    │       ├─ SYSCALL: connect(fd, sockaddr{23.58.73.90:443}, 16)
    │       │   └─ Kernel: TCP 3-way handshake (~50ms RTT to Steam servers)
    │       ├─ TLS ClientHello  ->  ServerHello (cipher negotiation)
    │       │   └─ Cipher: TLS_AES_256_GCM_SHA384 (TLS 1.3 typical)
    │       ├─ Certificate verification (OpenSSL):
    │       │   └─ Chain: Steam cert  ->  DigiCert  ->  Root CA (system trust store)
    │       ├─ Key exchange: ECDHE (Elliptic Curve Diffie-Hellman)
    │       │   └─ CPU: ~1ms for curve25519 key generation
    │       └─ Session established: ~2-3 RTTs total
    │
    ├─ HTTP/1.1 Request:
    │   └─ SYSCALL: write(fd, "GET /IPlayerService/... HTTP/1.1\r\nHost: ...\r\n\r\n")
    │       └─ TLS: Encrypt with AES-256-GCM  ->  TCP  ->  IP  ->  NIC
    │
    ├─ HTTP/1.1 Response:
    │   └─ SYSCALL: read(fd, buffer, size) [via libuv event loop / epoll]
    │       └─ TLS: Decrypt  ->  HTTP response parsing
    │           ├─ Status line: "HTTP/1.1 200 OK"
    │           ├─ Headers: Content-Type, Content-Length
    │           └─ Body: JSON string (accumulated in Buffer chunks)
    │
    └─ Connection: Keep-Alive (reused for subsequent requests)
        └─ Axios connection pool retains the TLS session

Axios Post-Processing:
  ├─ Response interceptors (if any)
  ├─ JSON.parse(response.data) — auto-triggered by Content-Type
  └─ Returns: AxiosResponse<T> object

Memory Profile:
  Stack: ~512 bytes
  Heap:  Response body (JSON string) + parsed object + TLS buffers (~32KB)
  Kernel: Socket buffers (send: ~16KB, recv: ~87KB default)
```

---

#### 14.3.5 `express.json()` Middleware — Request Body Parsing

```
Application Layer:
  app.use(express.json())       // Registers body-parser middleware
    │
    ▼
Per-Request Execution:
  body_parser.json()(req, res, next)
    │
    ├─ Content-Type Check:
    │   └─ req.headers['content-type'] === 'application/json' ?
    │       ├─ YES: Proceed
    │       └─ NO: call next() immediately (skip parsing)
    │
    ├─ Content-Length Check:
    │   └─ parseInt(req.headers['content-length'])
    │       └─ If > limit (default 100KB): 413 Payload Too Large
    │
    ├─ Raw Body Accumulation:
    │   └─ req.on('data', (chunk: Buffer) => { ... })
    │       ├─ Kernel: read() from TCP socket  ->  Buffer allocation
    │       ├─ Each chunk: Buffer.concat() or array push
    │       └─ Total: O(body_size) time, O(body_size) space
    │
    ├─ req.on('end', () => { ... })
    │   ├─ Charset decoding: Buffer  ->  string (UTF-8)
    │   │   └─ StringDecoder.write(buffer)  ->  V8 string allocation
    │   ├─ JSON.parse(bodyString)  ->  req.body
    │   │   └─ (See 14.3.2 for JSON.parse internals)
    │   └─ next()  // Continue middleware chain
    │
    └─ Error Handling:
        ├─ Malformed JSON: SyntaxError  ->  400 Bad Request
        └─ Encoding error: UnsupportedMediaType  ->  415

Memory Profile:
  Stack: ~128 bytes (middleware closure)
  Heap:  body_size (raw Buffer) + body_size (decoded string) + parsed object
         Total: ~3× body_size peak (before GC reclaims Buffer and string)
```

---

### 14.4 Interface & Abstract Boundary Decomposition

#### 14.4.1 Express Middleware Interface

**Abstract boundary**: `(req: Request, res: Response, next: NextFunction) => void`

**Primitive virtual methods**:

| Method             | Input Vector           | Output Vector                   | Side Effects                                                           |
| ------------------ | ---------------------- | ------------------------------- | ---------------------------------------------------------------------- |
| `req.params[key]`  | key: string            | string \| undefined             | None (read-only)                                                       |
| `req.query[key]`   | key: string            | string \| string[] \| undefined | None (read-only)                                                       |
| `req.body`         | —                      | any (parsed JSON)               | None (set by body-parser)                                              |
| `res.status(code)` | code: number (100-599) | Response (chainable this)       | Mutates `res.statusCode`                                               |
| `res.json(body)`   | body: any              | void                            | Serializes body  ->  sets Content-Type  ->  writes to socket  ->  ends response |
| `next()`           | —                      | void                            | Transfers control to next middleware in stack                          |
| `next(err)`        | err: Error             | void                            | Skips remaining normal middleware  ->  jumps to error handler             |

**`res.json(body)` execution pipeline**:

```
res.json(body)
  ├─ body = JSON.stringify(body)           // O(|body|) serialization
  │   └─ Heap: allocate result string
  ├─ res.setHeader('Content-Type', 'application/json; charset=utf-8')
  │   └─ Mutates internal headers map
  ├─ res.setHeader('Content-Length', Buffer.byteLength(body))
  │   └─ O(n) UTF-8 byte count
  └─ res.end(body)
      └─ SYSCALL: write(fd, http_response_bytes)
          └─ Kernel: TCP send buffer  ->  segmentation  ->  NIC
```

**Memory side-effects of `res.json()`**:

- **Stack**: 2 frames (res.json  ->  res.end)
- **Heap**: JSON string allocation (~1x body size)
- **Kernel**: Socket send buffer write (body + HTTP headers ~200 bytes)
- **GC**: Original `body` object eligible for collection after serialization

---

#### 14.4.2 Zod Schema Interface

**Abstract boundary**: `ZodSchema<T>`

**Primitive virtual methods**:

| Method                    | Input Vector  | Output                                                        | Side Effects                        |
| ------------------------- | ------------- | ------------------------------------------------------------- | ----------------------------------- |
| `schema.parseAsync(data)` | data: unknown | Promise<T>                                                    | Heap: allocates ZodError on failure |
| `schema.safeParse(data)`  | data: unknown | {success: true, data: T} \| {success: false, error: ZodError} | None (pure)                         |

**`parseAsync` execution pipeline**:

```
schema.parseAsync({ body, query, params })
  │
  ├─ Type discrimination:
  │   └─ Check root schema type (z.object)  ->  delegate to ZodObject._parse()
  │
  ├─ ZodObject._parse(input):
  │   ├─ For each key in schema shape:
  │   │   ├─ Extract input[key]                    # O(1) property access
  │   │   ├─ Delegate to child schema._parse()     # Recursive
  │   │   │   ├─ z.string(): typeof input === 'string' ? OK : issue
  │   │   │   ├─ z.string().length(17): input.length === 17 ? OK : issue
  │   │   │   ├─ z.string().regex(/^\d+$/): regex.test(input) ? OK : issue
  │   │   │   └─ z.number().int(): Number.isInteger(input) ? OK : issue
  │   │   └─ Accumulate issues (ZodIssue[]) on failure
  │   │
  │   ├─ Strip unknown keys (default: .strip() mode)
  │   │   └─ Allocate new object with only known keys
  │   │
  │   └─ Return: parsed object or throw ZodError
  │
  └─ ZodError construction (on failure):
      ├─ issues: ZodIssue[] — array of validation failures
      │   └─ Each issue: { code, path: string[], message, ... }
      └─ Heap: ~200 bytes per issue

Memory side-effects:
  Success path: O(|schema|) — new object with validated values (strip copies)
  Failure path: O(|issues|) — ZodError + ZodIssue array
```

---

#### 14.4.3 `pg.Pool` Interface

**Abstract boundary**: `Pool` from `node-postgres`

**Primitive virtual methods**:

| Method                         | Input Vector                | Output                  | Side Effects                                |
| ------------------------------ | --------------------------- | ----------------------- | ------------------------------------------- |
| `pool.query<T>(text, params?)` | text: string, params: any[] | Promise<QueryResult<T>> | Network I/O, connection acquisition/release |
| `pool.connect()`               | —                           | Promise<PoolClient>     | Network I/O, TCP connection, auth           |
| `pool.end()`                   | —                           | Promise<void>           | Close all connections, drain idle queue     |

**`QueryResult<T>` output structure**:

```typescript
interface QueryResult<T> {
  rows: T[]; // Parsed result rows (heap-allocated array)
  rowCount: number; // Number of rows affected/returned
  command: string; // 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'
  oid: number; // OID of inserted row (INSERT only)
  fields: FieldDef[]; // Column metadata (name, dataTypeID, tableID)
}
```

**Connection lifecycle state machine**:

```
         connect()          query()          release()
IDLE ──────────► ACTIVE ──────────► EXECUTING ──────────► IDLE
  │                                     │                   │
  │              error                  │    error          │
  └──────────────────► ERRORED ◄────────┘                   │
                          │                                 │
                          └─────── end() ──► CLOSED ◄───────┘
```

**Pool internal state**:

- `_idle: Client[]` — available connections (LIFO stack for cache locality)
- `_pendingQueue: Deferred[]` — requests waiting for a connection
- `_clients: Client[]` — all connections (idle + active)
- `_ending: boolean` — shutdown flag

---

#### 14.4.4 Axios HTTP Client Interface

**Abstract boundary**: `AxiosInstance`

**Primitive virtual methods**:

| Method                                | Input Vector                                     | Output                    | Side Effects                     |
| ------------------------------------- | ------------------------------------------------ | ------------------------- | -------------------------------- |
| `client.get<T>(url, config?)`         | url: string, config?: {params, headers, timeout} | Promise<AxiosResponse<T>> | Network I/O (TLS + HTTP)         |
| `client.post<T>(url, data?, config?)` | url: string, data?: any                          | Promise<AxiosResponse<T>> | Network I/O + body serialization |

**`AxiosResponse<T>` output structure**:

```typescript
interface AxiosResponse<T> {
  data: T; // Parsed response body (auto JSON.parse if Content-Type matches)
  status: number; // HTTP status code (200, 404, 500, etc.)
  statusText: string; // 'OK', 'Not Found', etc.
  headers: Record<string, string>; // Response headers (lowercased keys)
  config: AxiosRequestConfig; // Original request config
}
```

**Error classification pipeline**:

```
Axios error handling:
  ├─ Network error (ECONNREFUSED, ETIMEDOUT):
  │   └─ error.code = 'ECONNREFUSED'
  │   └─ error.response = undefined (no HTTP response received)
  │
  ├─ HTTP error (status >= 400):
  │   └─ error.response.status = 401 | 403 | 404 | 500 | ...
  │   └─ error.response.data = parsed error body
  │
  └─ Request error (invalid config):
      └─ error.request = ClientRequest object
      └─ error.response = undefined
```

**Memory side-effects per request**:

- **Heap**: Request config object (~500 bytes) + response body + parsed JSON
- **Kernel**: TLS session state (~4KB) + socket buffers (~103KB)
- **Network**: HTTP headers (~200 bytes) + body + TLS record overhead (~40 bytes/record)

---

#### 14.4.5 `RecommenderService` — Singleton Interface

**Abstract boundary**: Class `RecommenderService` (no abstract base, but functionally an interface)

 ->  Source: [`RecommenderService`](backend/src/services/recommender.service.ts#L34-L243)

**Interface contract**:

| Method                                             | Input Vector                                                 | Output                   | Time             | Space    | I/O  |
| -------------------------------------------------- | ------------------------------------------------------------ | ------------------------ | ---------------- | -------- | ---- |
| `isReady()`                                        | —                                                            | boolean                  | O(1)             | O(1)     | None |
| `getSimilarGames(appId, limit?)`                   | appId: number, limit: number=10                              | SimilarGame[]            | O(1) + O(limit)  | O(limit) | None |
| `getRecommendationsForLibrary(games, limit?)`      | games: {appId, playtimeMinutes}[], limit: number=20          | RecommendationResult[]   | O(L×K + C log C) | O(L+C)   | None |
| `getRecommendationsByTags(tags, exclude?, limit?)` | tags: string[], excludeAppIds: number[]=[], limit: number=20 | RecommendationResult[]   | O(N×T×K)         | O(N)     | None |
| `getGameInfo(appId)`                               | appId: number                                                | {name, topTerms} \| null | O(1)             | O(1)     | None |

**Singleton state footprint** (after `loadData()`):

| Data Structure          | Entries | Estimated Heap Size | Access Pattern       |
| ----------------------- | ------- | ------------------- | -------------------- |
| `similarityIndex` (Map) | ~27,000 | ~50MB               | O(1) lookup by appId |
| `gameVectors` (Map)     | ~27,000 | ~15MB               | O(1) lookup by appId |
| `idf` (Map)             | ~5,000  | ~0.5MB              | O(1) lookup by term  |
| **Total resident**      | —       | **~65MB**           | —                    |

**Invariants**:

- `isLoaded === (similarityIndex.size > 0)` — always true after construction
- `similarityIndex.get(appId)` arrays are pre-sorted by `similarity` descending
- All methods are **pure functions over immutable state** after construction (thread-safe in concept, though Node.js is single-threaded)
