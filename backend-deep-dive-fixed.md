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

15. [JavaScript Runtime Fundamentals](#15-javascript-runtime-fundamentals)

- 15.1 [V8 Engine Architecture](#151-v8-engine-architecture)
- 15.2 [Memory Model: Heap and Stack](#152-memory-model-heap-and-stack)
- 15.3 [Hoisting](#153-hoisting)
- 15.4 [Closures and Lexical Scope](#154-closures-and-lexical-scope)
- 15.5 [Prototypal Inheritance](#155-prototypal-inheritance-and-the-class-keyword)
- 15.6 [The Event Loop](#156-the-event-loop)
- 15.7 [Promises](#157-promises--mechanical-execution)
- 15.8 [`this` Binding Rules](#158-this-binding-rules)
- 15.9 [TypeScript Type Erasure](#159-typescript-type-erasure)

16. [Node.js Runtime Internals](#16-nodejs-runtime-internals)

- 16.1 [Module Resolution](#161-module-resolution--require-algorithm)
- 16.2 [`process.​env` Mechanics](#162-processenv--environment-variable-mechanics)
- 16.3 [Buffers and Binary Data](#163-buffers-and-binary-data)

17. [`node_​modules` Library Internals](#17-node_modules-library-internals)

- 17.1 [Express](#171-express--application-and-router-mechanics)
- 17.2 [CORS](#172-cors--cors-module)
- 17.3 [Axios](#173-axios--http-client-internals)
- 17.4 [pg (PostgreSQL)](#174-pg--postgresql-client-internals)
- 17.5 [Zod](#175-zod--schema-validation-internals)
- 17.6 [dotenv](#176-dotenv--environment-file-parser)

18. [Systems-Engineering Critical Analysis](#18-systems-engineering-critical-analysis)

- 18.1 [V8 Event Loop Starvation](#181-v8-event-loop-starvation--microtask-queue-mechanics)
- 18.2 [PostgreSQL Sequential Scan Catastrophe](#182-the-postgresql-sequential-scan-catastrophe)
- 18.3 [Formal TF-IDF Mathematical Definitions](#183-formal-mathematical-definition-of-tf-idf-vectors)
- 18.4 [TCP Socket Exhaustion & Connection Pooling](#184-tcp-socket-exhaustion--connection-pooling)
- 18.5 [PostgreSQL Execution Plans](#185-postgresql-query-execution-plans--mechanical-breakdown)
19. [Error Propagation & Exception Mechanics](#19-error-propagation--exception-mechanics)
   - 19.1 [Express Error Pipeline](#191-the-express-error-pipeline)
   - 19.2 [Stack Trace Capture](#192-stack-trace-capture-mechanics)
20. [HTTP/1.1 Protocol Mechanics](#20-http11-protocol-mechanics)
   - 20.1 [Request Wire Format](#201-request-wire-format)
   - 20.2 [Response Wire Format](#202-response-wire-format)
   - 20.3 [Keep-Alive](#203-keep-alive-connection-reuse)
   - 20.4 [Chunked Transfer Encoding](#204-chunked-transfer-encoding)
21. [Memory Management & Tail Latency](#21-memory-management--tail-latency)
   - 21.1 [GC Pauses and P99 Latency](#211-garbage-collection-pauses-and-p99-latency)
   - 21.2 [Connection Pool Sizing via Little's Law](#212-connection-pool-sizing-via-littles-law)
   - 21.3 [Memory Leak Patterns](#213-memory-leak-patterns-in-nodejs)
22. [Security Mechanics](#22-security-mechanics)
   - 22.1 [SQL Injection Prevention Proof](#221-sql-injection-prevention----formal-proof)
   - 22.2 [Dynamic WHERE Clause Safety](#222-dynamic-where-clause-safety)
   - 22.3 [CORS Origin Validation](#223-cors-origin-validation)
23. [IEEE 754 Floating-Point Precision](#23-ieee-754-floating-point-precision)
24. [RegExp Engine Mechanics](#24-regexp-engine-mechanics)
25. [Graceful Shutdown & Process Signal Handling](#25-graceful-shutdown--process-signal-handling)
26. [JSON.stringify Serialization Cost](#26-jsonstringify----serialization-cost-analysis)
27. [Node.js Process Lifecycle](#27-nodejs-process-lifecycle)
28. [TCP Connection State Machine](#28-tcp-connection-state-machine)
29. [TLS Session Lifecycle](#29-tls-session-lifecycle)
30. [V8 Object Lifecycle](#30-v8-object-lifecycle----allocation-to-collection)
31. [Stream & Backpressure Mechanics](#31-stream--backpressure-mechanics)
32. [Timer Internals](#32-timer-internals----settimeout-and-setinterval)
33. [Module System Deep-Dive](#33-module-system-deep-dive----commonjs-vs-esm)
34. [TypeScript Compilation Pipeline](#34-typescript-compilation-pipeline----deep-mechanics)
35. [npm Package Resolution](#35-npm-package-resolution--node_modules-structure)
36. [Concurrency Model](#36-concurrency-model----how-nodejs-handles-multiple-requests)

---

## 1. Configuration Layer

### 1.1 `package.​json`

**File**: `backend/​package.​json`

This manifest declares the backend as `pse-​backend` v1.0.0 and defines the complete dependency graph and script interface.

**Runtime Dependencies — why each exists:**

| Dependency  | Version | Role                                                                                                                                                                                                                                                                    |
| ------------ | ------------ | --------------------------------------------------------------------------- |
| `express`   | ^4.18.0 | HTTP framework. Provides the `Router`, middleware pipeline, `req`/`res` abstraction. Version 4 uses the callback-based error model (4-arity handler).                                                                                                                   |
| `cors`      | ^2.8.5  | Express middleware that sets `Access-​Control-​Allow-​*` headers. Required because the Angular frontend (port 4200) makes cross-origin requests to the API (port 3000). Without this, browsers enforce the Same-Origin Policy and block the preflight `OPTIONS` request.   |
| `pg`        | ^8.18.0 | PostgreSQL client for Node.js. Exposes `Pool` (connection pooling) and `Client` (single connection). This project uses `Pool` exclusively. The driver communicates over the PostgreSQL wire protocol (libpq binary format) on the configured port.                      |
| `axios`     | ^1.6.0  | HTTP client used to call the Steam Web API and Steam Store API. Chosen over `fetch` (which is available in Node 18+) because Axios provides typed response generics (`get<T>`), automatic JSON parsing, configurable `base​URL`, and interceptor support out of the box. |
| `zod`       | ^4.3.6  | Schema declaration and validation library. Used to validate every inbound HTTP request (params, query, body) before it reaches route handler logic. Zod schemas double as TypeScript type inference sources via `z.​infer<typeof schema>`.                               |
| `csv-​parse` | ^6.1.0  | Parses CSV files from the Kaggle Steam dataset during the offline data pipeline. Uses the synchronous `parse` API (`csv-​parse/​sync`) to load the entire CSV into memory at once.                                                                                        |
| `dotenv`    | ^16.3.0 | Reads `.​env` files and injects their key-value pairs into `process.​env`. This project loads two `.​env` files with a defined precedence (see Section 3).                                                                                                                 |

**Dev Dependencies — key choices:**

| Dependency                         | Purpose                                                                                                                                                                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `typescript` ^5.3.0                | Compiler. `strict: true` mode enforces `strict​Null​Checks`, `no​Implicit​Any`, `strict​Function​Types`, etc.                                                                                                                                                  |
| `ts-​node-​dev` ^2.0.0               | Development server. Combines `ts-​node` (JIT TypeScript compilation via the TypeScript compiler API) with file-watching and process restart. `-​-​transpile-​only` skips type-checking at dev time for speed; type errors are caught by `tsc` at build time. |
| `jest` ^30.2.0 + `ts-​jest` ^29.4.6 | Test runner. `ts-​jest` transforms `.​ts` files on the fly so Jest can execute them. The `preset: 'ts-​jest'` in `jest.​config.​js` handles this.                                                                                                             |
| `supertest` ^7.2.2                 | HTTP assertion library. Spins up an in-memory Express server (no network socket) via `request(app)` and allows chaining assertions on status codes, headers, and response bodies.                                                                        |
| `@types/​*`                         | TypeScript declaration files for `express`, `cors`, `pg`, `node`, `jest`, `supertest`. These provide type information for libraries written in JavaScript.                                                                                               |

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

The `data:pipeline` script chains `process` then `build-​recommender` sequentially via `&&`. This enforces the dependency: `build-​recommender` requires the processed output from `process-​dataset`.

### 1.2 `tsconfig.​json`

**File**: `backend/​tsconfig.​json`

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

- **`target: "ES2020"`** — The compiler emits ES2020 syntax, which means `optional chaining` (`?.​`), `nullish coalescing` (`??`), `Big​Int`, `Promise.​all​Settled`, and `global​This` are emitted as-is rather than downleveled. This is safe because the runtime is Node.js (which supports ES2020 natively since v14).

- **`module: "commonjs"`** — Output uses `require()` / `module.​exports`. This is necessary because `ts-​node-​dev` and Node.js (without the `-​-​experimental-​modules` flag or `"type": "module"` in `package.​json`) expect CommonJS modules. When you write `import express from 'express'` in TypeScript, the compiler emits `const express_​1 = require("express")`.

- **`es​Module​Interop: true`** — Enables synthetic default imports. Without this, `import express from 'express'` would fail because the `express` package uses `module.​exports = create​Application` (a CommonJS default export), not `export default`. With `es​Module​Interop`, the compiler generates a `_​_​import​Default` helper that wraps CommonJS modules to provide a `.​default` property.

- **`strict: true`** — Enables the entire `strict` family: `strict​Null​Checks`, `strict​Function​Types`, `strict​Bind​Call​Apply`, `strict​Property​Initialization`, `no​Implicit​Any`, `no​Implicit​This`, `always​Strict`. This forces you to handle `null | undefined` explicitly, catch missing properties, and fully type function signatures.

- **`declaration: true` + `declaration​Map: true`** — Generates `.​d.​ts` declaration files and `.​d.​ts.​map` files alongside the JavaScript output. These are useful if the backend were consumed as a library, and they allow IDEs to navigate from compiled output back to source.

- **`source​Map: true`** — Generates `.​js.​map` files so stack traces in errors point to the original `.​ts` line numbers rather than the compiled `.​js` lines.

- **`resolve​Json​Module: true`** — Allows `import data from '.​/​file.​json'` with full type inference on the JSON structure.

### 1.3 `.​env.​example`

**File**: `backend/​src/​.​env.​example`

```
STEAM_API_KEY=your_steam_api_key_here
PORT=3000
PGHOST=localhost
PGDATABASE=steam_collab
PGUSER=postgres
PGPASSWORD=your_postgres_password
PGPORT=8080
```

This documents the six environment variables the backend requires. The `STEAM_​API_​KEY` is obtained from [Valve's developer portal](https://steamcommunity.com/dev/apikey). The `PG*` variables follow the libpq convention (PostgreSQL's C client library), which means tools like `psql` also recognize them natively. Note that `PGPORT` defaults to 8080 here (non-standard; PostgreSQL's default is 5432) — this suggests the developer's local Postgres instance runs on a custom port.

### 1.4 `jest.​config.​js`

**File**: `backend/​jest.​config.​js`

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

- **`preset: 'ts-​jest'`** — Tells Jest to use `ts-​jest` as the transformer for `.​ts` files. Under the hood, `ts-​jest` invokes the TypeScript compiler API (`ts.​transpile​Module`) on each test file before Jest executes it.
- **`test​Environment: 'node'`** — Uses Node.js globals (`process`, `Buffer`, `require`) instead of a jsdom browser emulation. Correct for a server-side project.
- **`roots: ['<root​Dir>/​src']`** — Jest only looks inside `src/​` for test files. This prevents it from scanning `node_​modules/​` or `dist/​`.
- **`test​Match`** — Glob pattern: any file matching `**/​_​_​tests_​_​/​**/​*.​test.​ts` is treated as a test. This convention co-locates tests next to the modules they test (e.g., `services/​_​_​tests_​_​/​search.​service.​test.​ts` sits next to `services/​search.​service.​ts`).
- **`clear​Mocks: true`** — Automatically calls `jest.​clear​All​Mocks()` between every test. This resets mock call counts and return values, preventing state leakage between tests.
- **`silent: false`** — Allows `console.​log` output from tests to appear in the terminal. Useful during development; you would set this to `true` in CI to reduce noise.

---

## 2. Entry Point — `index.​ts`

**File**: [`index.​ts`](backend/src/index.ts)

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

### Mechanical step-by-step execution of `index.​ts`

**Step 1 — Module imports (lines 1–7)**:

When Node.js evaluates `require('.​/​config')`, the `config.​ts` module is loaded and executed **synchronously**. This triggers `dotenv.​config()` twice (see Section 3), populating `process.​env`. The config object is constructed and cached in the module system.

When `require('.​/​routes/​user.​routes')` is evaluated, Node.js loads and evaluates `user.​routes.​ts`, which in turn `require`s `steam.​service.​ts` (for `get​Steam​Service`), `steam.​types.​ts` (for `Steam​Api​Error`), `zod` (for schema definitions), and `validate.​middleware.​ts`. Each module is loaded once and cached — if two route files both import `steam.​service.​ts`, the module is only evaluated once. This is the CommonJS module singleton guarantee.

**Step 2 — Config validation (lines 9–13)**:

```typescript
if (!config.port) {
  console.error("FATAL ERROR: PORT is not defined in config.");
  process.exit(1);
}
```

The `!config.​port` check leverages JavaScript's falsy evaluation. Since `parse​Int` returns `Na​N` for unparseable strings, and `Na​N` is falsy, this guard catches both missing and invalid PORT values. `process.​exit(1)` terminates the Node.js process with exit code 1 (indicating failure). The exit code is consumed by process managers (systemd, Docker, PM2) to determine restart behavior.

**Step 3 — Express application construction (line 15)**:

```typescript
const app = express();
```

`express()` returns a function with signature `(req: Incoming​Message, res: Server​Response) => void`. This function is also augmented with methods like `.​use()`, `.​get()`, `.​listen()`. Internally, Express creates a new `Application` prototype instance that maintains an ordered array of middleware layers (the "stack").

**Step 4 — Global middleware registration (lines 19–20)**:

```typescript
app.use(cors());
app.use(express.json());
```

`cors()` is invoked immediately (not deferred) and returns a middleware function `(req, res, next) => void`. This function is pushed onto the application's middleware stack. When a request arrives, Express walks the stack top-to-bottom. `cors()` inspects the request's `Origin` header and, if present, sets `Access-​Control-​Allow-​Origin`, `Access-​Control-​Allow-​Methods`, and `Access-​Control-​Allow-​Headers` on the response. For `OPTIONS` preflight requests, it responds immediately with 204 (no content) and terminates the middleware chain.

`express.​json()` is a built-in middleware (added in Express 4.16). It checks the `Content-​Type` header; if it matches `application/​json`, it reads the full request body from the stream, parses it with `JSON.​parse()`, and assigns the result to `req.​body`. If the body is not valid JSON, it calls `next(err)` with a `Syntax​Error`, which propagates to the error handler.

**Step 5 — Router mounting (lines 23–26)**:

```typescript
app.use("/api/user", userRoutes);
app.use("/api/recommend", recommendRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/search", searchRoutes);
```

Each `app.​use(prefix, router)` call creates a "layer" in the Express stack that matches any request whose path starts with the given prefix. When a request arrives at `/​api/​user/​76561198012345678/​library`, Express:

1. Strips the prefix `/​api/​user` from the path.
2. Passes the remainder `/​:steam​Id/​library` to the `user​Routes` router.
3. The router matches this against its own routes (registered via `router.​get('/​:steam​Id/​library', .​.​.​)`).

**Step 6 — Health check endpoint (lines 29–34)**:

```typescript
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
```

This is a simple 2-arity handler (no `next`). `res.​json()` internally calls `JSON.​stringify()` on the object, sets `Content-​Type: application/​json`, and sends the response. The `timestamp` provides a liveness signal — monitoring systems can poll this endpoint and verify the server is responsive.

**Step 7 — 404 handler (lines 37–39)**:

```typescript
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});
```

This is a **2-arity middleware** registered after all routes. Express only reaches this if no prior route handler called `res.​send()`, `res.​json()`, or `res.​end()`. The 2-arity signature distinguishes it from the error handler (which has 4 parameters). Express uses `Function.​length` (the number of declared parameters) to differentiate.

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

`app.​listen(PORT)` is sugar for `http.​create​Server(app).​listen(PORT)`. Internally:

1. Node.js creates an `http.​Server` instance.
2. Passes the Express `app` function as the `request​Listener` (called on every incoming HTTP request).
3. Calls `server.​listen(PORT)`, which instructs the OS kernel to bind a TCP socket on the specified port.
4. The OS places the socket in the `LISTEN` state, ready to accept incoming TCP connections.
5. When the bind succeeds, Node.js emits the `'listening'` event, which triggers the callback.

### Middleware ordering matters

Express processes middleware in **registration order**. The sequence here is:

1. `cors()` runs first — it adds CORS headers to every response and handles `OPTIONS` preflight requests. If this were registered after the routers, preflight requests would hit the 404 handler instead.

2. `express.​json()` parses the `Content-​Type: application/​json` request body into `req.​body`. If this were missing, `req.​body` would be `undefined` for POST requests (e.g., `/​api/​recommend/​bytags`).

3. Route handlers run in mount order. Because Express matches routes top-down, the order of `app.​use('/​api/​user', .​.​.​)` etc. does not matter for non-overlapping prefixes — but it would matter if two routers claimed the same path.

4. The 404 handler is a **2-arity middleware** `(req, res)` registered after all routes. Express only reaches this if no route handler called `res.​send()` / `res.​json()`.

5. The error handler is a **4-arity middleware** `(err, req, res, next)`. Express identifies error-handling middleware by its 4-parameter signature. This catches any `throw` or `next(err)` from upstream middleware/routes. It logs the error and returns a generic 500.

---

## 3. Config Module — `config.​ts`

**File**: [`config.​ts`](backend/src/config.ts)

### Mechanical execution flow

When this module is first `require`d (triggered by `import { config } from '.​/​config'` in `index.​ts`), Node.js evaluates the entire file top-to-bottom:

**Step 1 — Import resolution**:

```typescript
import dotenv from "dotenv";
import path from "path";
```

Both are CommonJS modules. `dotenv` is loaded from `node_​modules/​dotenv/​lib/​main.​js`; `path` is a Node.js built-in (no disk I/O needed — it's compiled into the Node.js binary).

**Step 2 — First dotenv load (root monorepo)**:

```typescript
const rootEnv =
  dotenv.config({ path: path.join(process.cwd(), "..", ".env") }).parsed || {};
```

Execution flow of `dotenv.​config()`:

1. `path.​join(process.​cwd(), '.​.​', '.​env')` constructs an absolute path. If `cwd` is `/​project/​backend`, this resolves to `/​project/​.​env`.
2. `dotenv.​config({ path })` calls `fs.​read​File​Sync(path, 'utf8')` — synchronous, blocking I/O.
3. If the file exists, `dotenv` parses it line-by-line: splits on the first `=`, trims whitespace, handles quoted values, and builds a `{ key: value }` object.
4. Each key-value pair is injected into `process.​env` via `process.​env[key] = value` (but only if the key doesn't already exist in `process.​env` — dotenv does not overwrite existing environment variables by default).
5. The `.​parsed` property contains the parsed object. If the file doesn't exist, `.​parsed` is `undefined`, and the `|| {}` fallback produces an empty object.

**Step 3 — Second dotenv load (local src/.env)**:

```typescript
const localEnv =
  dotenv.config({ path: path.join(process.cwd(), "src", ".env") }).parsed || {};
```

Same process, but for `backend/​src/​.​env`. Since `dotenv.​config()` was already called once, any keys from `root​Env` are already in `process.​env`. The second call won't overwrite them (due to dotenv's default behavior), but the `.​parsed` object captures the local file's values regardless.

**Step 4 — Object spread merge**:

```typescript
const envConfig = { ...rootEnv, ...localEnv };
```

JavaScript's spread operator creates a new object. Keys from `local​Env` overwrite same-named keys from `root​Env`. This is the precedence mechanism — **local values win**.

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

The `||` operator returns the first truthy value. Empty strings `''` are falsy, so if a `.​env` file has `PORT=` (empty value), the chain falls through to `process.​env.​PORT`, then to the default.

**The full precedence chain** for any config value is:

```
localEnv (src/.env)  >  rootEnv (../.env)  >  process.env  >  hardcoded default
```

### `parse​Int` for PORT and PGPORT:

Environment variables are always strings. `parse​Int(str, 10)` converts to a base-10 integer. The radix `10` is explicit to avoid the historical JavaScript pitfall where `parse​Int('08')` was interpreted as octal in older engines (returning 0 instead of 8). Modern engines default to base 10, but explicit radix is a defensive practice.

---

## 4. Database Layer — `config/​db.​ts`

**File**: [`db.​ts`](backend/src/config/db.ts)

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

`new Pool({.​.​.​})` does **not** immediately open a TCP connection to PostgreSQL. The `pg.​Pool` constructor only stores the configuration and initializes internal state:

- `this.​_​clients = []` — array of active `Client` connections.
- `this.​_​idle = []` — array of idle clients available for reuse.
- `this.​_​pending​Queue = []` — queue of pending query callbacks waiting for a free client.
- `this.​_​ending = false` — pool lifecycle flag.

The first actual TCP connection is established lazily, on the first `pool.​query()` call.

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

### Connection Pooling — what `pg.​Pool` actually does when `pool.​query()` is called:

1. **Check idle clients**: If `this.​_​idle.​length > 0`, pop the most recently used idle client (LIFO order for TCP keepalive efficiency).
2. **Check capacity**: If no idle clients exist and `this.​_​clients.​length < max` (default 10), create a new `Client`:
   a. Open a TCP socket to `host:port`.
   b. Perform the PostgreSQL startup handshake (send `Startup​Message` with protocol version 3.0, database, user).
   c. PostgreSQL responds with an `Authentication​Request` (e.g., `Authentication​MD5Password`).
   d. Client sends the password hash. PostgreSQL responds with `Authentication​Ok`.
   e. PostgreSQL sends `Parameter​Status` messages (server version, encoding, timezone), then `Backend​Key​Data` (process ID, secret key for cancel), then `Ready​For​Query`.
   f. The client is now ready to execute queries.
3. **Queue if at capacity**: If all `max` clients are busy, the query callback is pushed onto `_​pending​Queue`. When any client finishes its current query, it dequeues the next pending callback and executes it.

**What `pool.​query<T>(text, params)` does internally**:

1. Acquires a client from the pool (steps above).
2. Sends a `Parse` message (SQL text -> prepared statement), `Bind` message (parameter values), and `Execute` message to PostgreSQL. This is the **extended query protocol**.
3. Parameters (`params` array) are transmitted separately from the SQL text as binary values. PostgreSQL's parser never sees them as SQL — they are bound at the protocol level, preventing SQL injection.
4. PostgreSQL executes the query and sends `Data​Row` messages (one per result row) followed by `Command​Complete` and `Ready​For​Query`.
5. The `pg` client assembles the `Data​Row` messages into a `Query​Result<T>` object with `.​rows: T[]`, `.​row​Count: number`, `.​fields: Field​Def[]`.
6. The client is returned to the idle pool.

### The generic `query<T>` helper:

The type parameter `T extends Query​Result​Row` constrains `T` to be an object (since `Query​Result​Row` is `{ [column: string]: any }`). When a caller writes:

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

## 5. Type System — `steam.​types.​ts`

**File**: [`steam.​types.​ts`](backend/src/types/steam.types.ts)

This file defines the entire type vocabulary of the backend. It serves two distinct roles:

### 5.1 Domain Models (application-level types)

These types represent the **application's internal data model** — the cleaned, normalized shape of data after it has been transformed from raw API responses or database rows.

**`Owned​Game`**: Represents a single game in a user's library.

```typescript
interface OwnedGame {
  appId: number; // Steam's unique integer identifier for the application
  name: string | null; // Nullable because the API may omit it for delisted games
  playtimeMinutes: number;
  playtime2Weeks: number | null; // Null if the user hasn't played in 2 weeks
  imgIconUrl?: string; // Optional — only present when include_appinfo=1
}
```

**`User​Library`**: Aggregate of a user's game collection.

```typescript
interface UserLibrary {
  steamId: string; // 64-bit Steam ID represented as string (JS number loses precision beyond 2^53)
  gameCount: number;
  games: OwnedGame[];
}
```

The `steam​Id` is a `string` rather than `number` because Steam IDs are 64-bit unsigned integers (e.g., `76561198012345678`). JavaScript's `number` type is an IEEE 754 double-precision float, which can only represent integers exactly up to 2^53 - 1 (9,007,199,254,740,991). Steam IDs exceed this range, so representing them as numbers would cause precision loss. String representation is exact.

**`Player​Summary`**: Profile metadata for display.

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

This distinction is critical because API calls to private profiles return empty responses rather than errors — the backend must handle this gracefully (see `steam.​service.​ts`).

**`Friend`**: Represents a relationship in the user's friend graph.

```typescript
interface Friend {
  steamId: string;
  relationship: string; // 'friend' | 'all'
  friendSince: number; // Unix timestamp (seconds since 1970-01-01T00:00:00Z)
}
```

The `friend​Since` field is a Unix epoch timestamp. JavaScript's `Date` constructor accepts milliseconds, so conversion requires `new Date(friend​Since * 1000)`. The `relationship` field is always `'friend'` in practice because the API is called with `relationship=friend`.

**`User​Genre​Profile`**: A single entry in the user's genre preference vector.

```typescript
interface UserGenreProfile {
  genre: string;
  weight: number; // L1-normalized share of total weighted playtime
}
```

The `weight` field is a probability-like value in [0, 1] where all weights across the vector sum to exactly 1.0. This is the result of L1 normalization (see Section 8.4 for the full derivation).

**`User​Profile`**: The aggregated user context object.

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

Note the use of `Set<number>` and `Map<string, number>` for internal computation fields. These provide O(1) membership testing and key lookup, which is critical when scoring thousands of recommendation candidates. However, `Set` and `Map` are not JSON-serializable — `JSON.​stringify(new Set([1,2,3]))` produces `'{}'` because `Set` has no enumerable own properties. The route handler in `recommend.​routes.​ts` must strip these fields before sending the response.

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

**`Steam​Owned​Games​Response`**: Response from `/​IPlayer​Service/​Get​Owned​Games/​v1/​`.

-> See [`Steam​Owned​Games​Response`](backend/src/types/steam.types.ts#L66-L77)

The `games` array is `optional` (marked with `?`) because the Steam API returns an empty `response: {}` object (no `games` key at all) when the user's profile is private. This is not an HTTP error — it's a 200 OK with a semantically empty payload. The service layer must check for this case explicitly.

**`Steam​Player​Summary​Response`**: Response from `/​ISteam​User/​Get​Player​Summaries/​v2/​`.

-> See [`Steam​Player​Summary​Response`](backend/src/types/steam.types.ts#L79-L89)

This endpoint accepts comma-separated Steam IDs and returns an array of player objects. In this project, only one ID is queried at a time (`steamids: steam​Id`), so `players[0]` is always the target user. The `players` array is non-optional (it's always present), but may be empty if the Steam ID is invalid.

**`Steam​App​Details​Response`**: Response from `/​api/​appdetails`.

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

The response is keyed by `app​Id` as a string (e.g., `{ "730": { success: true, data: { .​.​.​ } } }`). The `price_​overview.​final` is in **cents** (e.g., 5999 = $59.99).

**`Steam​Friend​List​Response`**: Response from `/​ISteam​User/​Get​Friend​List/​v1/​`.

-> See [`Steam​Friend​List​Response`](backend/src/types/steam.types.ts#L123-L131)

Note the snake_case (`friend_​since`). The service layer maps this to camelCase (`friend​Since`) when constructing `Friend` objects.

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

**Mechanical execution when `new Steam​Api​Error('msg', 403)` is called**:

1. JavaScript allocates a new object with prototype `Steam​Api​Error.​prototype`.
2. `super(message)` calls `Error(message)`, which sets `this.​message = message` and captures the call stack into `this.​stack` (V8's `Error.​capture​Stack​Trace`).
3. TypeScript's `public status​Code?: number` parameter property is syntactic sugar — it declares `this.​status​Code` as a public property and assigns the constructor argument to it. At runtime, this compiles to `this.​status​Code = status​Code`.
4. `this.​name = 'Steam​Api​Error'` overrides the inherited `Error.​prototype.​name` ('Error'). Without this, stack traces would show `Error: msg` instead of `Steam​Api​Error: msg`.

The `status​Code` field allows route handlers to set the HTTP response status code to match the error type:

- `403` -> private profile
- `404` -> player not found
- `undefined` -> defaults to 500

---

## 6. Validation Middleware — `validate.​middleware.​ts`

**File**: [`validate.​middleware.​ts`](backend/src/middleware/validate.middleware.ts)

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

When a route file calls `validate(steam​Id​Schema)`, the outer function executes immediately and returns a new anonymous async function. This returned function is the actual Express middleware. It captures `schema` in its closure (lexical scope).

```typescript
// This happens at module load time:
router.get("/:steamId/library", validate(steamIdSchema), handler);
//                               ↑ This returns middleware fn
```

**Step 2 — Middleware execution** (at request time):

When a request arrives at `GET /​api/​user/​76561198012345678/​library`, Express calls the middleware function with `(req, res, next)`.

**Step 3 — Validation target construction**:

```typescript
await schema.parseAsync({
  body: req.body, // {} for GET requests (no body)
  query: req.query, // { includeFreeGames: 'true' } for ?includeFreeGames=true
  params: req.params, // { steamId: '76561198012345678' }
});
```

The three Express request properties are bundled into a single object that matches the Zod schema structure. This means Zod schemas must be structured as `z.​object({ params: z.​object({.​.​.​}), query: z.​object({.​.​.​}), body: z.​object({.​.​.​}) })`.

**Step 4 — Zod parsing internals**:

`schema.​parse​Async(target)` executes the following internally:

1. **Root object check**: Verify `target` is an object.
2. **Nested object validation**: For each key (`body`, `query`, `params`), descend into the nested schema.
3. **Field validation**: For each field (e.g., `params.​steam​Id`), run the validation chain:
   - `z.​string()` — check `typeof value === 'string'`.
   - `.​length(17)` — check `value.​length === 17`.
   - `.​regex(/​^\d+$/​)` — check `value.​match(/​^\d+$/​) !== null`.
4. **Error accumulation**: Zod does **not** short-circuit on the first error. It validates all fields and accumulates all errors into a `Zod​Error` object with an `issues` array.
5. **On success**: Returns the parsed (and possibly coerced) data.
6. **On failure**: Throws a `Zod​Error`.

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

- `path`: An array of path segments, e.g., `['params', 'steam​Id']`.
- `message`: Human-readable error, e.g., `'Steam ID must be exactly 17 characters long'`.
- `code`: The Zod error code, e.g., `'too_​small'`, `'invalid_​string'`.

The `path.​join('.​')` produces `'params.​steam​Id'`, giving the caller a dot-notation path to the offending field. This is concatenated with the message: `'params.​steam​Id -​ Steam ID must be exactly 17 characters long'`.

The `(error as any).​issues || (error as any).​errors` handles both Zod 3 (which uses `errors`) and Zod 4 (which uses `issues`).

**Concrete example**: If the request is `GET /​api/​user/​abc/​library`:

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

Separation of concerns. Route handlers assume their inputs are valid and focus on business logic. Validation middleware acts as a **gate** — invalid requests are rejected before they ever reach the handler. This also centralizes the error response format: every validation failure across all routes produces the same `{ error: 'Validation failed', details: [.​.​.​] }` shape.

---

## 7. Route Layer

The route layer follows Express's `Router` pattern. Each file creates a `Router()` instance, attaches handlers, and exports it. The `index.​ts` mounts each router at a specific path prefix.

### 7.1 `user.​routes.​ts`

**File**: [`user.​routes.​ts`](backend/src/routes/user.routes.ts)

**Mount point**: `/​api/​user`

**Endpoints**:

| Method | Path                | Purpose                            |
| ------------ | ------------------- | ---------------------------------- |
| GET    | `/​:steam​Id/​library` | Fetch user's complete game library |
| GET    | `/​:steam​Id/​recent`  | Fetch recently played games        |
| GET    | `/​:steam​Id/​profile` | Fetch player profile summary       |

#### Zod Schema Definition

-> See [`steam​Id​Schema`](backend/src/routes/user.routes.ts#L10-L17)

This schema is shared across all three endpoints. It validates that `:steam​Id` is exactly 17 digits — the length of a 64-bit Steam ID in decimal notation (e.g., `76561198012345678`). The validation chain is conjunctive: both `.​length(17)` AND `.​regex(/​^\d+$/​)` must pass.

#### Endpoint: `GET /​:steam​Id/​library` — Mechanical Execution

-> Source: [`library handler`](backend/src/routes/user.routes.ts#L23-L47)

**Step 1** — Express matches the path `/​:steam​Id/​library` and runs the middleware chain: `validate(steam​Id​Schema)` -> `async handler`.

**Step 2** — Boolean-from-string query parameter conversion:

```typescript
const includeFreeGames = req.query.includeFreeGames !== "false";
```

Query parameters are always strings. This expression evaluates to:

- `true` if `include​Free​Games` is `undefined` (parameter not provided) — because `undefined !== 'false'` is `true`.
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

`get​Steam​Service()` returns the singleton `Steam​Service` instance (creating it on first call). The `get​Owned​Games` method makes an HTTP request to the Steam Web API (see Section 8.1).

**Step 4** — Response:

```typescript
res.json(library);
```

`res.​json()` calls `JSON.​stringify(library)`, sets `Content-​Type: application/​json; charset=utf-​8`, writes the string to the response stream, and ends the response. The `User​Library` object with `steam​Id`, `game​Count`, and `games[]` is serialized.

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

The `instanceof` check differentiates between known application errors (private profile, rate limit) and unexpected errors (network timeout, code bugs). Known errors preserve the `status​Code` from the exception; unknown errors always return 500.

#### Endpoint: `GET /​:steam​Id/​recent` — Mechanical Execution

-> Source: [`recent handler`](backend/src/routes/user.routes.ts#L53-L73)

**Step 1** — Count parameter parsing and clamping:

```typescript
const count = Math.min(parseInt(req.query.count as string) || 10, 100);
```

This expression evaluates right-to-left:

1. `req.​query.​count` -> `string | undefined` (Express query params are strings).
2. `parse​Int(undefined)` -> `Na​N`.
3. `Na​N || 10` -> `10` (NaN is falsy, so the `||` short-circuits to the default).
4. `Math.​min(10, 100)` -> `10`.

If the user passes `?count=50`: `parse​Int('50')` -> `50`, `50 || 10` -> `50`, `Math.​min(50, 100)` -> `50`.
If the user passes `?count=999`: `Math.​min(999, 100)` -> `100`. The cap prevents abuse.

**Step 2** — Service call:

```typescript
const games = await steamService.getRecentlyPlayedGames(
  req.params.steamId,
  count,
);
```

This calls `/​IPlayer​Service/​Get​Recently​Played​Games/​v1/​` on the Steam API. Unlike `get​Owned​Games`, this method returns the raw `Owned​Game[]` array (not a `User​Library` wrapper), since the recently-played endpoint doesn't include a game count.

#### Endpoint: `GET /​:steam​Id/​profile` — Mechanical Execution

-> Source: [`profile handler`](backend/src/routes/user.routes.ts#L79-L99)

**Step 1** — Service call:

```typescript
const profile = await steamService.getPlayerSummary(req.params.steamId);
```

This calls `/​ISteam​User/​Get​Player​Summaries/​v2/​`, which returns public profile metadata (persona name, avatar URL, visibility state).

**Step 2** — Error handling specifics:

```typescript
const status = error.statusCode === 404 ? 404 : 500;
```

Unlike the library endpoint (which forwards the `status​Code` directly), the profile endpoint only distinguishes between "not found" (404) and everything else (500). This is because a 403 (private profile) for the `get​Player​Summary` endpoint has different semantics — the player _exists_ but their profile is private, which is arguably a 200 with reduced data, not a client error.

### 7.2 `game.​routes.​ts`

**File**: [`game.​routes.​ts`](backend/src/routes/game.routes.ts)

**Mount point**: `/​api/​game`

**Endpoints**:

| Method | Path      | Purpose                                       |
| ------------ | ------------ | --------------------------------------------- |
| GET    | `/​:app​Id` | Fetch detailed game info from Steam Store API |

#### Zod Schema

-> See [`get​Game​Params​Schema`](backend/src/routes/game.routes.ts#L10-L14)

Note: The schema validates `app​Id` as a string matching `/​^\d+$/​`. This is correct because Express route parameters are always strings. The conversion to number happens in the handler.

#### Mechanical Execution

**Step 1** — Parse string to integer:

```typescript
const appId = parseInt(req.params.appId, 10);
```

After Zod validation, we know `req.​params.​app​Id` is a numeric string. `parse​Int` converts it to a JavaScript number. The radix `10` is explicit for safety.

**Step 2** — Service call:

```typescript
const game = await steamService.getAppDetails(appId);
```

This calls the Steam Store API (`/​appdetails?appids=730&cc=us&l=en`). Unlike the Web API methods, `get​App​Details` returns `null` on failure (rather than throwing). This is because Store API failures are non-exceptional — games can be delisted, region-locked, or the endpoint may be temporarily rate-limited.

**Step 3** — Null check:

```typescript
if (!game) {
  res.status(404).json({ error: `Game with app ID ${appId} not found` });
  return;
}
```

The `return` after `res.​status(404).​json(.​.​.​)` is critical. Without it, execution would fall through to `res.​json(game)`, causing a "headers already sent" error (Express can only send one response per request).

### 7.3 `search.​routes.​ts`

**File**: [`search.​routes.​ts`](backend/src/routes/search.routes.ts)

**Mount point**: `/​api/​search`

**Endpoints**:

| Method | Path | Purpose                                           |
| ------------ | ------------ | ------------------------------------------------- |
| GET    | `/​`  | Search games by genres, keyword, and player count |

This is the database-backed search endpoint. It does not call the Steam API — it queries the local PostgreSQL `games` table.

#### Zod Schema — All Optional Parameters

-> See [`search​Schema`](backend/src/routes/search.routes.ts#L10-L16)

All three query parameters are optional. A request with no parameters (`GET /​api/​search`) is valid and returns the top 10 games by positive votes.

#### Mechanical Execution

**Step 1** — Type-safe query extraction:

```typescript
const queryData = req.query as z.infer<typeof searchSchema>["query"];
```

The `z.​infer<typeof search​Schema>` extracts the TypeScript type from the Zod schema. The `['query']` index type narrows it to the `query` property. This cast tells TypeScript that `query​Data` has the exact shape defined in the schema.

**Step 2** — Genre string processing:

```typescript
const genresRaw = queryData.genres || "";
const genreList = genresRaw
  .split(",")
  .map((g) => g.trim())
  .filter((g) => g.length > 0);
```

Concrete example: `?genres=RPG,Action,%20Puzzle`

1. `genres​Raw` = `'RPG,Action, Puzzle'` (URL-decoded by Express).
2. `.​split(',')` = `['RPG', 'Action', ' Puzzle']`.
3. `.​map(g => g.​trim())` = `['RPG', 'Action', 'Puzzle']`.
4. `.​filter(g => g.​length > 0)` = `['RPG', 'Action', 'Puzzle']` (filters out empty strings from trailing commas like `"RPG,"`).

**Step 3** — Service delegation:

```typescript
const games = await searchService.searchByGenres(
  genreList,
  keyword,
  playerCount,
);
```

The `search​Service` is instantiated at module load time (`const search​Service = new Search​Service()`). It's stateless, so multiple instances would behave identically.

### 7.4 `recommend.​routes.​ts`

**File**: [`recommend.​routes.​ts`](backend/src/routes/recommend.routes.ts)

**Mount point**: `/​api/​recommend`

This is the most complex route file, with five endpoints orchestrating the recommendation engine.

**Endpoints**:

| Method | Path                     | Purpose                                                        |
| ------------ | ------------------------ | -------------------------------------------------------------- |
| GET    | `/​status`                | Check if the recommender is loaded and ready                   |
| GET    | `/​similar/​:app​Id`        | Get games similar to a specific game                           |
| GET    | `/​user/​:steam​Id`         | Get personalized recommendations for a user                    |
| GET    | `/​user/​:steam​Id/​profile` | Get the user's aggregated profile (genre vector, friend stats) |
| POST   | `/​bytags`                | Get recommendations matching specific tags                     |

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

Note: The `by​Tags​Schema` validates `limit` as a `z.​number()` (not `z.​string()`), because it comes from a JSON body (which preserves JavaScript types), not a query parameter (which is always a string).

#### Endpoint: `GET /​status` — Mechanical Execution

-> Source: [`status handler`](backend/src/routes/recommend.routes.ts#L44-L62)

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

**Step 1** — `get​Recommender​Service()` returns the singleton. If this is the first call, the constructor runs and attempts to load `similarity-​index.​json`, `vectors.​json`, and `idf.​json` from disk (synchronous I/O). If the files don't exist, `is​Loaded` is set to `false`.

**Step 2** — If the constructor throws (e.g., malformed JSON file), the catch block returns 503 (Service Unavailable) with setup instructions.

**Step 3** — `recommender.​is​Ready()` returns `this.​is​Loaded`, which is `true` only if `similarity​Index.​size > 0`.

#### Endpoint: `GET /​similar/​:app​Id` — Mechanical Execution

-> Source: [`similar handler`](backend/src/routes/recommend.routes.ts#L67-L98)

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

`Map.​get(app​Id)` is an O(1) hash table lookup. The result is a pre-sorted array of `Similar​Game` objects. `.​slice(0, limit)` extracts the top-K.

**Step 4** — Empty result handling:

```typescript
if (recommendations.length === 0) {
  res
    .status(404)
    .json({ error: `No recommendations found for app ID ${appId}` });
  return;
}
```

#### Endpoint: `GET /​user/​:steam​Id` — The Personalized Recommendation Pipeline

-> Source: [`user recommendation handler`](backend/src/routes/recommend.routes.ts#L103-L136)

This is the crown jewel of the API. The complete mechanical execution flow:

**Step 1** — Readiness guard (same as `/​similar`).

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
- Compute `final​Score = alpha·jaccard + beta·genre​Alignment + gamma·social` for each candidate.
- Sort and return top-K.

**Step 5** — Response: `res.​json(recommendations)` serializes the `Scored​Recommendation[]` array.

#### Endpoint: `GET /​user/​:steam​Id/​profile`

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

Fields omitted: `owned​App​Ids` (Set), `friend​Overlap​Set` (Set), `genre​Vector` (Map), `library` (OwnedGame[]). `JSON.​stringify` would produce `{}` for `Set` and `Map` — this explicit field selection prevents silent data loss.

#### Endpoint: `POST /​bytags`

```typescript
const { tags, limit = 10 } = req.body;
const recommendations = recommender.getRecommendationsByTags(tags, limit);
```

Destructuring with default: if `req.​body.​limit` is `undefined`, `limit` defaults to `10`. The Zod schema has already validated that `tags` is a non-empty string array.

Note: The route handler passes `tags` directly as the `exclude​App​Ids` parameter position, but looking at the actual `get​Recommendations​By​Tags` signature: `(tags: string[], exclude​App​Ids: number[] = [], limit: number = 20)`, the `limit` here is passed as the second argument (not third). This means `limit` is actually being interpreted as `exclude​App​Ids`. However, since `limit` is a number and `exclude​App​Ids` expects `number[]`, JavaScript's type coercion handles this gracefully — `new Set(10)` creates an empty Set, so no games are excluded. The actual limit defaults to 20 from the function signature. This is a subtle bug/inconsistency in the route handler.

---

## 8. Service Layer

### 8.1 `steam.​service.​ts`

**File**: [`steam.​service.​ts`](backend/src/services/steam.service.ts)

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

Two separate `Axios​Instance` objects are created because the Steam Web API and the Steam Store API have different base URLs, different authentication models (Web API uses `key` parameter; Store API uses no auth but requires `cc` and `l` for country/language), and different response formats.

The 30-second timeout prevents the backend from hanging indefinitely if the Steam API is slow or unresponsive. When the timeout fires, Axios rejects the promise with a `ECONNABORTED` error, which the service translates into a `Steam​Api​Error`.

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

**Step 1** — API key resolution: The optional `api​Key` parameter allows tests to inject a test key. If not provided, the constructor falls back to `config.​steam​Api​Key`. The `||` operator means an empty string `''` is treated as missing.

**Step 2** — API key validation: If no key is available, the constructor throws immediately. This is a fail-fast pattern — better to crash at `get​Steam​Service()` call time than to discover the key is missing during an API request.

**Step 3** — Axios instance creation: `axios.​create()` returns a new `Axios​Instance` with the given defaults. Each instance maintains its own defaults (baseURL, timeout) but shares the same underlying HTTP adapter (`http` or `https` module).

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

This is the **lazy singleton** pattern. The instance is created on first access and cached in module scope. Since Node.js modules are singletons themselves (the `require` cache ensures a module is evaluated only once), this means exactly one `Steam​Service` instance exists for the lifetime of the process.

The `get​Steam​Service()` factory function (rather than direct export of an instance) defers construction to first use, which means the error occurs at request time (with a clear stack trace) rather than at module import time.

### Method: `get​Owned​Games` — Mechanical Execution

-> Source: [`get​Owned​Games`](backend/src/services/steam.service.ts#L46-L101)

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

Axios constructs the URL: `https:/​/​api.​steampowered.​com/​IPlayer​Service/​Get​Owned​Games/​v1/​?key=XXXX&steamid=76561198012345678&include_​appinfo=1&include_​played_​free_​games=1&format=json`.

The `<Steam​Owned​Games​Response>` generic tells TypeScript (at compile time only) that `response.​data` has type `Steam​Owned​Games​Response`. Axios adds `Content-​Type: application/​json` automatically and parses the response body with `JSON.​parse()`.

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

When Steam returns `{ response: {} }` (private profile), `data` is `{}` and `data.​games` is `undefined`. The `!data.​games` check catches this. A 403 statusCode is assigned to signal "forbidden" (the user exists but their data is inaccessible).

**Step 3** — Data mapping (snake_case -> camelCase):

```typescript
const games: OwnedGame[] = data.games.map((game) => ({
  appId: game.appid,
  name: game.name || null,
  playtimeMinutes: game.playtime_forever || 0,
  playtime2Weeks: game.playtime_2weeks || null,
  imgIconUrl: game.img_icon_url,
}));
```

The `.​map()` produces a new array where each element is transformed from the API's snake_case naming to the application's camelCase convention. The `|| null` and `|| 0` fallbacks handle missing/falsy values:

- `game.​name` -> `null` if undefined (delisted games).
- `game.​playtime_​forever` -> `0` if undefined or 0 (both are handled the same).
- `game.​playtime_​2weeks` -> `null` if undefined (user hasn't played recently).

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

1. `Steam​Api​Error` already thrown (from the private profile check) — re-throw as-is.
2. Axios error (HTTP 4xx/5xx, timeout, network error) — wrap in `Steam​Api​Error` with the HTTP status.
3. Unknown error — wrap in generic `Steam​Api​Error`.

### Method: `get​Recently​Played​Games` — Mechanical Execution

-> Source: [`get​Recently​Played​Games`](backend/src/services/steam.service.ts#L103-L140)

```typescript
async getRecentlyPlayedGames(steamId: string, count: number = 10): Promise<OwnedGame[]>
```

**Step 1** — HTTP request to `/​IPlayer​Service/​Get​Recently​Played​Games/​v1/​`.

**Step 2** — Graceful empty handling:

```typescript
const games = response.data.response?.games || [];
```

The `?.​` operator short-circuits if `response.​data.​response` is undefined (private profile). The `|| []` ensures the result is always an array.

**Step 3** — Data mapping (same as `get​Owned​Games` but without `img​Icon​Url`).

### Method: `get​Player​Summary` — Mechanical Execution

-> Source: [`get​Player​Summary`](backend/src/services/steam.service.ts#L142-L183)

```typescript
async getPlayerSummary(steamId: string): Promise<PlayerSummary>
```

**Step 1** — HTTP request to `/​ISteam​User/​Get​Player​Summaries/​v2/​`.

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

The `|| 'Unknown'` default for `persona​Name` handles edge cases where the API returns no name. The `|| 1` default for `visibility` treats missing visibility as "private" (the safest assumption).

### Method: `get​App​Details` — Mechanical Execution

-> Source: [`get​App​Details`](backend/src/services/steam.service.ts#L185-L241)

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

The Store API returns `{ "730": { success: false } }` for delisted/invalid games. The `String(app​Id)` conversion is necessary because the response keys are strings, not numbers.

**Step 3** — Genre/tag extraction:

```typescript
const genres = details.genres?.map((g) => g.description) || [];
const tags = details.categories?.map((c) => c.description) || [];
```

Steam's Store API returns genres as `[{ id: "1", description: "Action" }]`. The `.​map()` extracts just the description strings.

**Step 4** — Price conversion:

```typescript
if (!isFree && details.price_overview) {
  price = details.price_overview.final / 100;
}
```

Steam's API returns prices in cents (5999 = $59.99). Division by 100 converts to dollars. The `!is​Free` guard prevents free games from getting a price of `$0.​00` (they should have `null` price).

**Step 5** — Error handling:

```typescript
} catch (error) {
  console.error(`Failed to fetch app details for ${appId}:`, error);
  return null;
}
```

Unlike other methods, `get​App​Details` returns `null` on failure rather than throwing. This is because Store API failures are expected (rate limits, delisted games) and should not crash the calling code.

### Method: `get​Friend​List` — Mechanical Execution

-> Source: [`get​Friend​List`](backend/src/services/steam.service.ts#L243-L277)

```typescript
async getFriendList(steamId: string): Promise<Friend[]>
```

**Step 1** — HTTP request to `/​ISteam​User/​Get​Friend​List/​v1/​` with `relationship: 'friend'`.

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

Unlike `get​Owned​Games` (which throws on private profiles), `get​Friend​List` returns `[]` on 401/403 errors. This is intentional: the friend list is an **optional** signal for recommendations. If unavailable, the recommendation engine still works — it just lacks social data. Throwing would abort the entire profile-building pipeline.

### Method: `get​Multiple​Owned​Games` — Mechanical Execution

-> Source: [`get​Multiple​Owned​Games`](backend/src/services/steam.service.ts#L279-L299)

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

`steam​Ids.​map(.​.​.​)` creates an array of Promises, one per Steam ID. `Promise.​all​Settled` waits for all of them to complete (either fulfilled or rejected).

**Why `Promise.​all​Settled` vs `Promise.​all`**:

- `Promise.​all` rejects immediately if **any** promise rejects. If 9/10 friends have public profiles and 1 is private, all 9 successful results would be discarded.
- `Promise.​all​Settled` always resolves (never rejects). It returns an array of `{ status: 'fulfilled', value }` or `{ status: 'rejected', reason }` objects.

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

### 8.2 `search.​service.​ts`

**File**: [`search.​service.​ts`](backend/src/services/search.service.ts)

This service constructs dynamic SQL queries to search the `games` table.

### Interface: `Game​Search​Result`

-> See [`Game​Search​Result`](backend/src/services/search.service.ts#L3-L10)

This is the response shape sent to the frontend. It's a subset of the full `games` table — only the fields needed for search result cards.

### Method: `search​By​Genres` — Mechanical Execution

-> Source: [`search​By​Genres`](backend/src/services/search.service.ts#L16-L62)

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

- `where​Clauses`: Accumulates SQL fragments like `(genres ILIKE $1 OR tags ILIKE $1)`.
- `params`: Accumulates parameter values like `'%RPG%'`.
- `param​Index`: Tracks the next `$N` placeholder number.

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

1. Iteration 1: `params = ['%RPG%']`, `param​Index = 2`, clause = `(genres ILIKE $1 OR tags ILIKE $1)`.
2. Iteration 2: `params = ['%RPG%', '%Action%']`, `param​Index = 3`, clause = `(genres ILIKE $2 OR tags ILIKE $2)`.
3. `where​Clauses = ['((genres ILIKE $1 OR tags ILIKE $1) AND (genres ILIKE $2 OR tags ILIKE $2))']`.

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

The `player​Count === 'Online'` -> `'Online Pv​P'` mapping handles a UI/data mismatch: the frontend sends "Online" but the database stores "Online PvP" in the categories column.

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

If no filters are provided, `where​String` is empty, and the query returns the 10 most positively-reviewed games globally.

**Step 6 — Query execution**:

```typescript
const result = await query(sqlQuery, params);
return this.mapRows(result.rows);
```

### Row mapping — `map​Rows`:

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

The `price` column comes from PostgreSQL as a `DECIMAL(10,2)`, which the `pg` driver returns as a string (to avoid floating-point precision loss). `parse​Float(row.​price)` converts it back.

Note: `is​Free: parse​Float(row.​price) === 0` has an edge case — if `row.​price` is `null`, `parse​Float(null)` returns `Na​N`, and `Na​N === 0` is `false`. This correctly treats null-price games as non-free.

---

### 8.3 `recommender.​service.​ts`

**File**: [`recommender.​service.​ts`](backend/src/services/recommender.service.ts)

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

1. **`similarity​Index`**: `Map<app​Id, Similar​Game[]>` — For each game, stores its top-20 most similar games (pre-computed by `build-​recommender.​ts`). Each entry is a `{ app​Id, name, similarity }` triple where `similarity` in (0.1, ~0.92].

2. **`game​Vectors`**: `Map<app​Id, Game​Vector>` — For each game, stores its name, L2 magnitude, and top weighted terms (from TF-IDF). Used for tag-based recommendations and name lookups.

3. **`idf`**: `Map<term, number>` — Inverse Document Frequency values for each term in the corpus.

### Constructor & `load​Data()` — Mechanical Execution

```typescript
constructor() {
  this.loadData();
}
```

The constructor calls `load​Data()` synchronously. On the first `get​Recommender​Service()` call, this blocks the event loop.

**`load​Data()` execution**:

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

1. `fs.​exists​Sync(index​Path)` — Synchronous stat check. Returns `false` if the file doesn't exist.
2. `fs.​read​File​Sync(index​Path, 'utf-​8')` — Reads the entire file into memory as a single string. For a ~27,000-game index with 20 neighbors each, this file can be 50–100MB.
3. `JSON.​parse(raw​String)` — Parses the JSON string into a nested JavaScript object. This is an O(N) operation where N is the string length. V8's JSON parser is highly optimized (faster than any hand-written parser).
4. `Object.​entries(index​Data)` — Converts the object's key-value pairs into `[key, value]` tuples.
5. `parse​Int(app​Id)` — The JSON keys are strings (JSON spec requires string keys). This converts them back to numbers for the Map.
6. The Map is populated with one entry per game.

**Step 2 — Vectors loading** (same pattern):

```typescript
const vectors: GameVector[] = JSON.parse(fs.readFileSync(vectorsPath, "utf-8"));
for (const v of vectors) {
  this.gameVectors.set(v.appId, v);
}
```

The vectors file is a JSON array (not an object), so it's parsed directly into `Game​Vector[]`.

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

**Error handling**: If any file read or JSON parse fails, the catch block sets `this.​is​Loaded = false`. The service degrades gracefully — it won't crash, but all recommendation methods will return empty results.

### Method: `get​Similar​Games` — Mechanical Execution

-> Source: [`get​Similar​Games`](backend/src/services/recommender.service.ts#L93-L100)

```typescript
getSimilarGames(appId: number, limit: number = 10): SimilarGame[] {
  const similar = this.similarityIndex.get(appId);
  if (!similar) return [];
  return similar.slice(0, limit);
}
```

**Step 1** — `Map.​get(app​Id)` is O(1) average-case (V8 uses a hash table internally for Maps with numeric keys).
**Step 2** — If the game isn't in the index, return `[]`.
**Step 3** — `similar.​slice(0, limit)` creates a shallow copy of the first `limit` elements. O(limit). The array is pre-sorted by `similarity` descending (from `build-​recommender.​ts`).

### Method: `get​Recommendations​For​Library` — Playtime-weighted Aggregation

-> Source: [`get​Recommendations​For​Library`](backend/src/services/recommender.service.ts#L102-L178)

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

- `log(0) = -​Infinity`, which would crash the scoring. `log1p(0) = ln(1) = 0`, which is safe.
- The logarithm compresses the playtime scale. Without it, a user with 10,000 hours in CS2 and 10 hours in everything else would produce recommendations dominated entirely by CS2-similar games.

**Example**: User has CS2 (10,000 min), Dota 2 (100 min), total = 10,100.

```
weight(CS2)  = log1p(10000) / log1p(10100) ~ 9.21 / 9.22 ~ 0.999
weight(Dota) = log1p(100) / log1p(10100)   ~ 4.62 / 9.22 ~ 0.501
```

CS2 gets ~2x the weight of Dota, not 100x. The log compression provides a balanced signal.

**Edge case**: If `total​Playtime === 0` (all games have 0 minutes), each game gets equal weight `1/​L`.

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

1. Skip if user already owns it (`owned​Set.​has` — O(1)).
2. Compute `added​Score = similarity × weight`.
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

Shows up to 3 source game names. If more than 3, appends `".​.​.​"`.

### Method: `get​Recommendations​By​Tags` — Tag-based Scoring

-> Source: [`get​Recommendations​By​Tags`](backend/src/services/recommender.service.ts#L180-L229)

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

1. Get the game's pre-computed `top​Terms` (TF-IDF weighted terms).
2. Find intersection of the game's terms with the requested tags.
3. Sum the TF-IDF weights of matched terms.

**Complexity**: O(N × T × K) where N = games in index (~27,000), T = requested tags, K = topTerms per game (~10). For 3 tags, this is ~810,000 comparisons — fast enough for interactive use (<50ms).

**Step 3** — Sort descending by score, slice top-K, generate reason strings.

### Method: `get​Game​Info` — Simple Lookup

-> Source: [`get​Game​Info`](backend/src/services/recommender.service.ts#L231-L242)

```typescript
getGameInfo(appId: number): { name: string; topTerms: string[] } | null {
  const vector = this.gameVectors.get(appId);
  if (!vector) return null;
  return { name: vector.name, topTerms: vector.topTerms.map(t => t.term) };
}
```

O(1) Map lookup. Returns the game's name and TF-IDF terms, or `null` if not in the index.

---

### 8.4 `user-​profile.​service.​ts`

**File**: [`user-​profile.​service.​ts`](backend/src/services/user-profile.service.ts)

This is the most mathematically dense module in the backend. It implements a 4-phase pipeline to build a user profile and a 3-signal composite scoring engine to rank recommendation candidates.

### Constants

```typescript
const MAX_FRIENDS_TO_ANALYZE = 10;
const WEIGHT_JACCARD = 0.5; // alpha — pre-computed content similarity
const WEIGHT_GENRE = 0.3; // beta — genre alignment with user preferences
const WEIGHT_SOCIAL = 0.2; // gamma — social proof from friend graph
const RECENCY_BOOST = 1.5; // Multiplier for recently-played games
```

### `Scored​Recommendation` Interface

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

This interface bundles both the scoring metadata and the display-ready fields needed by the Angular frontend's `Game​Card​Component`. This avoids a second API call to fetch game details after recommendations are generated.

### Function: `build​Genre​Vector` — L1-Normalized Genre Preference Vector

-> Source: [`build​Genre​Vector`](backend/src/services/user-profile.service.ts#L56-L119)

```typescript
async function buildGenreVector(
  library: OwnedGame[],
  recentAppIds: Set<number>,
): Promise<Map<string, number>>;
```

**Mathematical formulation**:

Let L be the user's library of games. For each game g_i in L, let:

- `pt_​i` = playtimeMinutes for game i
- `G_​i` = set of genres/tags for game i (fetched from PostgreSQL)
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

This is a single SQL round-trip. PostgreSQL uses an index scan on the `app_​id` PRIMARY KEY — each lookup is O(log N) where N is the table size, so the total is O(L × log N).

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

After normalization, `SUM_​g vector(g) = 1.​0`. Each `vector(g)` represents the fraction of weighted engagement attributable to genre g.

**Complexity**: O(L × G) where L = library size, G = average genres per game.

### Function: `build​Friend​Overlap​Set` — Social Proof Signal

-> Source: [`build​Friend​Overlap​Set`](backend/src/services/user-profile.service.ts#L123-L147)

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

Only games owned by >= `min​Overlap` (default 2) friends are included. This set represents "social proof" — games that are popular in the user's friend graph.

**Complexity**: O(F × G) where F = friends analyzed (<=10), G = average games per friend.

### Function: `build​User​Profile` — Core Profile Builder

-> Source: [`build​User​Profile`](backend/src/services/user-profile.service.ts#L151-L212)

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

Three independent API calls fire simultaneously. `Promise.​all​Settled` ensures all complete regardless of individual failures.

Wall-clock time: `max(t_​library, t_​recent, t_​friends)` ~ 500ms–2s (depending on Steam API latency).

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

1. `genre​Vector`: L1-normalized genre preferences (async — DB query).
2. `friend​Overlap​Set`: Games owned by >=2 friends (sync — pure computation).
3. `owned​App​Ids`: Set of all owned game IDs (sync — used for O(1) exclusion).

**Top genres derivation**:

```typescript
const topGenres: UserGenreProfile[] = [...genreVector.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([genre, weight]) => ({ genre, weight: parseFloat(weight.toFixed(4)) }));
```

Converts the Map to a sorted array and takes the top 10. The `.​to​Fixed(4)` rounds to 4 decimal places (e.g., 0.3462 instead of 0.34615384615384615). This is a display concern — the full precision is preserved in the Map for scoring.

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

### Function: `score​With​User​Context` — 3-Signal Composite Scoring Engine

-> Source: [`score​With​User​Context`](backend/src/services/user-profile.service.ts#L216-L336)

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
2. If seen before from another owned game, keep the **higher** similarity score (not accumulated like in `get​Recommendations​For​Library`).

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

**Signal 1 — `jaccard​Score(c)`**:

```typescript
// Already computed — it's the max pre-computed similarity across owned games
```

**Signal 2 — `genre​Alignment​Score(c)`**:

```typescript
const genreAlignmentScore = genres.reduce(
  (sum, g) => sum + (profile.genreVector.get(g) ?? 0),
  0,
);
```

This is the dot product of the candidate's genre set against the user's preference vector. For each genre in the candidate's genre list, look up its weight in the user's genre vector and sum.

**Example**: User's vector: `{RPG: 0.​50, Action: 0.​35, Puzzle: 0.​15}`. Candidate genres: `{RPG, Action}`.

```
genreAlignmentScore = 0.50 + 0.35 = 0.85
```

Note: This is a one-sided sum (not cosine similarity). The user's vector is L1-normalized but the candidate's genres are unweighted.

**Signal 3 — `social​Score(c)`**:

```typescript
const socialScore = profile.friendOverlapSet.has(appId) ? 1.0 : 0.0;
```

Binary signal: 1 if >=2 friends own this game, 0 otherwise. The social boost is `gamma × 1.​0 = 0.​20`.

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

Note: `developers`, `publishers`, and `release​Date` are hardcoded as empty/null. These fields exist in the `Scored​Recommendation` interface (for the `Game​Card​Component`) but are not fetched from the database in the current implementation.

**Step 6 — Sort and truncate**:

```typescript
scored.sort((a, b) => b.score - a.score);
return scored.slice(0, limit);
```

Timsort (O(N log N)). Returns top `limit` results.

---

## 9. Data Pipeline Scripts

These scripts form an offline ETL (Extract, Transform, Load) pipeline that prepares the recommendation engine's data. They are run manually before the server starts, not during request handling.

### 9.1 `download-​dataset.​ts`

**File**: [`download-​dataset.​ts`](backend/src/scripts/download-dataset.ts)

This script checks if the raw Kaggle dataset exists and provides download instructions if not.

#### Mechanical Execution

**Step 1 — Directory creation**:

```typescript
fs.mkdirSync(DATA_DIR, { recursive: true });
```

`{ recursive: true }` creates all parent directories if they don't exist (equivalent to `mkdir -​p`). No-ops if the directory already exists.

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

`fs.​stat​Sync` returns an `fs.​Stats` object with `size` (in bytes), `mtime` (last modification), etc. The `size /​ (1024 * 1024)` converts bytes to megabytes.

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
2. Delete it (`fs.​unlink​Sync`).
3. Recursively call `download​From​Url` with the redirect URL.
4. Resolve the outer Promise with the recursive result.

This is currently commented out because the Kaggle dataset requires authentication.

### 9.2 `process-​dataset.​ts`

**File**: [`process-​dataset.​ts`](backend/src/scripts/process-dataset.ts)

**Input**: `data/​raw/​games.​csv`
**Output**: Multiple JSON files in `data/​processed/​`

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

All fields are `string` because CSV parsing always produces strings. The `process​Game` function converts each field to its proper type.

#### Function: `parse​List` — Semicolon Splitting

-> Source: [`parse​List`](backend/src/scripts/process-dataset.ts#L75-L78)

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

1. `.​split(';')` -> `['Action', 'RPG', 'Indie']`.
2. `.​map(s => s.​trim())` -> removes whitespace.
3. `.​filter(s => s.​length > 0)` -> removes empty strings (from trailing semicolons like `"Action;"`).

#### Function: `parse​Owner​Range` — Range String Parsing

-> Source: [`parse​Owner​Range`](backend/src/scripts/process-dataset.ts#L83-L93)

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

For `"10,000 -​ 20,000"`:

1. Remove commas: `"10000 -​ 20000"`.
2. Remove whitespace: `"10000-​20000"`.
3. Split on `-​`: `['10000', '20000']`.
4. Parse: `{ min: 10000, max: 20000 }`.

#### Function: `process​Game` — Single Record Processing

-> Source: [`process​Game`](backend/src/scripts/process-dataset.ts#L98-L142)

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

#### Function: `calculate​Stats` — Dataset Statistics

Iterates all processed games once, computing:

- Unique genres (via `Set`).
- Tag frequency counts (via `Map<string, number>`).
- Free game count.
- Average rating ratio (only for games with reviews).
- Top 50 tags by frequency.

#### Function: `save​Processed​Data` — Output Generation

Produces 5 output files:

1. `games.​json` — Full processed game objects (all fields).
2. `games-​light.​json` — Lightweight version omitting descriptions.
3. `stats.​json` — Dataset statistics.
4. `tag-​vocabulary.​json` — Top 50 tags by frequency.
5. `app-​id-​map.​json` — `{ app​Id: name }` mapping.

All files use `JSON.​stringify(data, null, 2)` for human-readable formatting (2-space indentation).

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

### 9.3 `build-​recommender.​ts`

**File**: [`build-​recommender.​ts`](backend/src/scripts/build-recommender.ts)

This is the offline computation engine that builds the similarity index. It reads all games from PostgreSQL, computes pairwise similarity scores, and saves the top-K neighbors for each game.

#### Score Weights

-> See [`SCORE_​WEIGHTS`](backend/src/scripts/build-recommender.ts#L53-L62)

Total weight: 0.92. The remaining 0.08 was the `metacritic` weight from the Python prototype (dropped in TypeScript).

#### Function: `fetch​Games​From​DB` — Data Loading

-> Source: [`fetch​Games​From​DB`](backend/src/scripts/build-recommender.ts#L64-L120)

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

#### Function: `compute​Global​Maxes` — Normalization Constants

-> Source: [`compute​Global​Maxes`](backend/src/scripts/build-recommender.ts#L122-L134)

```typescript
function computeGlobalMaxes(games: LightGame[]): GlobalMaxes;
```

Scans all games once (O(N)) to find the maximum price, popularity, and playtime values. These are used as denominators in score normalization.

- `max​Price` starts at 60 (not 0) — this prevents edge cases when all games are free.
- `max​Pop = max(positive + negative + owners​Min)` across all games.
- `max​Pt = max(average​Playtime)` across all games.

#### Function: `get​Jaccard` — Optimized Set Intersection

-> Source: [`get​Jaccard`](backend/src/scripts/build-recommender.ts#L136-L149)

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

**Mathematical definition**: J(A, B) = |A intersection B| / |A union B|

**Optimization**: Iterate the smaller set. `Set.​has()` is O(1). Total: O(min(|A|, |B|)).

**Union computed algebraically**: |A union B| = |A| + |B| - |A intersection B|. No actual union set is constructed.

#### Function: `get​Studio​Overlap` — Binary Match

-> Source: [`get​Studio​Overlap`](backend/src/scripts/build-recommender.ts#L151-L159)

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

Returns `1.​0` if any developer or publisher is shared between two games, `0.​0` otherwise. Short-circuits on the first match (O(1) best case).

#### Function: `calculate​Score` — 8-Factor Weighted Score

-> Source: [`calculate​Score`](backend/src/scripts/build-recommender.ts#L161-L191)

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
5. **Price (0.10)**: `1 -​ min(|cand​Price -​ pref​Price| /​ max​Price, 1.​0)`.
6. **Review ratio (0.10)**: Candidate's `positive​Ratings /​ total​Ratings`.
7. **Popularity (0.05)**: `log1p(pop) /​ log1p(max​Pop)`.
8. **Playtime (0.03)**: `log1p(playtime) /​ log1p(max​Playtime)`.

#### The Pairwise Loop — O(N²) Complexity

```typescript
for (let i = 0; i < games.length; i++) {
  const game = games[i];
  const similar = findSimilarGames(game.appId, games, allMax, topK);
  index.set(game.appId, similar);
}
```

Inside `find​Similar​Games`, every game is compared to every other game:

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

The threshold `similarity > 0.​1` filters out very dissimilar games, reducing storage requirements.

#### Output

```typescript
function saveRecommenderData(index: Map<number, SimilarGame[]>): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const indexObj = Object.fromEntries(index);
  fs.writeFileSync(indexPath, JSON.stringify(indexObj, null, 2));
}
```

`Object.​from​Entries(index)` converts the `Map<number, Similar​Game[]>` to a plain object `{ "730": [.​.​.​], "570": [.​.​.​] }`. This is necessary because `JSON.​stringify` doesn't natively serialize `Map` objects.

### 9.4 Inspection Utilities

**`inspect-​csv-​columns.​ts`**: 7 lines. Reads the CSV header and prints columns with indices:

```typescript
const first = fs.readFileSync(path, "utf-8").split("\n")[0];
const cols = first.split(",").map((c, i) => `${i + 1}. ${c.trim()}`);
console.log("Columns in CSV:\n" + cols.join("\n"));
```

**`inspect-​csv-​and-​interface.​ts`**: A schema validation tool:

1. Parses the CSV header using `csv-​parse` (handles quoted commas correctly).
2. Reads `process-​dataset.​ts` source code and extracts `Raw​Game` interface fields via regex:
   ```typescript
   const interfaceMatch = source.match(/interface RawGame\s*\{([^}]+)\}/s);
   ```
3. Compares the two lists using Set difference operations.
4. Reports fields in CSV but not in the interface, and vice versa.

---

## 10. Shell Scripts

### 10.1 `dev-​start.​sh`

**File**: `backend/​scripts/​dev-​start.​sh`

Launches both the backend and frontend in parallel, with graceful shutdown.

**Mechanical execution**:

1. **Pre-flight checks**: Runs `check-​data.​sh` and `db-​health.​sh`.
2. **Background processes**: `npm run dev &` and `npx ng serve &`. The `&` runs each in the background, capturing PIDs via `$!`.
3. **Signal trap**: `trap cleanup SIGINT SIGTERM` registers a handler for Ctrl+C.
4. **Cleanup function**: `kill $BACKEND_​PID $FRONTEND_​PID; wait $BACKEND_​PID $FRONTEND_​PID` sends SIGTERM and waits for graceful exit.
5. **Wait loop**: `wait` blocks the script until both background processes exit.

### 10.2 `db-​health.​sh`

**File**: `backend/​scripts/​db-​health.​sh`

A 5-step PostgreSQL health check:

1. `pg_​isready` — TCP connectivity test.
2. `SELECT to_​regclass('public.​games')` — Table existence check.
3. `SELECT COUNT(*)` — Row count + basic statistics.
4. `SELECT .​.​.​ ORDER BY positive_​votes DESC LIMIT 5` — Data sanity check.
5. Index count query — Performance optimization verification.

### 10.3 `test-​api.​sh`

**File**: `backend/​scripts/​test-​api.​sh`

Smoke tests every API endpoint via `curl`:

```bash
curl -s -o /tmp/pse_api_response.json -w '%{http_code} %{time_total}'
```

- `-​s` (silent) suppresses progress bars.
- `-​o /​tmp/​.​.​.​` writes the response body to a file.
- `-​w '%{http_​code} %{time_​total}'` prints HTTP status and timing.

User-specific endpoints require `STEAM_​ID` environment variable.

### 10.4 `check-​data.​sh`

**File**: `backend/​scripts/​check-​data.​sh`

Validates the data pipeline across three stages:

1. **Raw data**: `games.​csv` or `games.​json` existence.
2. **Processed data**: All 5 JSON files from `process-​dataset.​ts`.
3. **Recommender data**: `similarity-​index.​json`, `vectors.​json`, `idf.​json`.

JSON validation via `python3 -​m json.​tool`. Empty files flagged as corrupt.

---

## 11. Python Scripts

### 11.1 `games_​to_​db.​py`

**File**: [`games_​to_​db.​py`](backend/games_to_db.py)

This Python script is the primary data loader. It reads `games.​json` and inserts all games into the PostgreSQL `games` table.

#### Function: `create_​table` — Schema Definition

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

#### Function: `parse_​game` — Field Extraction

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

- `game.​get('name', 'Unknown')[:500]` — Truncates to 500 chars (matches VARCHAR(500)).
- `','.​join(game.​get('developers', []))` — Converts array to comma-separated string.
- `game.​get('tags', {}).​keys()` — Tags in the JSON are a dict (`{"Action": 50, "RPG": 30}`). Only keys are stored; vote counts are discarded.

#### Function: `load_​games_​batch` — Optimized Batch Insert

```python
BATCH_SIZE = 1000
COMMIT_EVERY = 10000
```

**Step 1** — Load JSON: `json.​load(f)` reads the entire file into a Python dict.

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

`execute_​values` generates a single `INSERT .​.​.​ VALUES (row1), (row2), .​.​.​, (row1000)` statement. This is dramatically faster than 1,000 individual INSERTs:

- 1 network round-trip instead of 1,000.
- PostgreSQL optimizes multi-row inserts internally.

`ON CONFLICT (app_​id) DO NOTHING` makes re-runs idempotent.

**Step 3** — Periodic commits: Every 10,000 rows. Balances durability vs performance.

#### Function: `load_​games_​streaming` — Memory-Efficient Alternative

For files >500MB, uses `ijson` for SAX-style JSON streaming:

```python
parser = ijson.kvitems(f, '')
for app_id, game in parser:
    # Process one game at a time
```

Memory usage: O(batch_size) instead of O(file_size).

#### Function: `create_​indexes`

```sql
CREATE INDEX IF NOT EXISTS idx_games_price ON games (price);
CREATE INDEX IF NOT EXISTS idx_games_positive ON games (positive_votes);
CREATE INDEX IF NOT EXISTS idx_games_metacritic ON games (metacritic_score);
```

B-tree indexes for columns used in `ORDER BY` and `WHERE` clauses. `idx_​games_​positive` directly accelerates the `ORDER BY positive_​votes DESC` in `search.​service.​ts`.

---

## 12. Test Suite

The test suite follows a 2-layer strategy:

### Layer 1: Unit Tests (isolated logic, mocked I/O)

#### `recommender.​service.​test.​ts`

**File**: [`recommender.​service.​test.​ts`](backend/src/services/__tests__/recommender.service.test.ts)

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

1. **`is​Ready()` — readiness detection**:
   - Test: When `similarity-​index.​json` loads -> `is​Ready() === true`.
   - Test: When file missing -> `is​Ready() === false`.

2. **`get​Similar​Games()` — O(1) lookup**:
   - Test: Returns correct sorted results for known appId.
   - Test: Respects `limit` parameter.
   - Test: Returns `[]` for unknown appId.
   - Test: Returns `[]` for game with empty similarity list.

3. **`get​Recommendations​For​Library()` — aggregation engine**:
   - Test: Empty input -> empty output.
   - Test: Not-ready state -> empty output.
   - Test: **Ownership exclusion** — owned games must not appear.
   - Test: **Cross-library aggregation** — Game 10 appears in both 730's and 570's lists -> should rank highest.
   - Test: **Playtime weighting** — heavily-played games contribute proportionally more weight.

#### `search.​service.​test.​ts`

**File**: `backend/​src/​services/​_​_​tests_​_​/​search.​service.​test.​ts`

**Mocking strategy**: Mocks the `query` function from `db.​ts`.

**Test cases**:

- No genres -> SQL has no `WHERE` clause.
- Multiple genres -> compound `ILIKE` conditions.
- Row mapping -> verifies snake_case -> camelCase transformation.

### Layer 2: Route Integration Tests (full Express pipeline)

#### `game.​routes.​test.​ts`

**Mocking**: Mocks `get​Steam​Service` to return a fake service.

**Test cases**:

- 400 for invalid appId (`/​api/​game/​abc`).
- 404 for unknown game (`/​api/​game/​999`).
- 200 for valid game (`/​api/​game/​730`).

#### `search.​routes.​test.​ts`

**Test layers**:

- **Layer A**: Zod middleware validation.
- **Layer B**: Parameter delegation to service.
- **Layer C**: Response body shape contract.
- **Layer D**: Error handling (service throws -> 500).

#### `validate.​middleware.​test.​ts`

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

| Primitive   | Operation                                    | Time                | Space          | Hardware                                                |
| ------------ | -------------------------------------------- | ------------------- | -------------- | ------------------------------------------------------- |
| `MAP_​GET`   | `Map.​get(key)` — V8 hash table lookup        | O(1) amortized      | O(1)           | Hash computation -> bucket index -> pointer dereference |
| `MAP_​SET`   | `Map.​set(key, value)` — V8 hash table insert | O(1) amortized      | O(1) per entry | Hash -> probe -> write to heap                          |
| `SET_​HAS`   | `Set.​has(value)` — V8 hash set membership    | O(1) amortized      | O(1)           | Hash -> bucket scan -> boolean                          |
| `SET_​ADD`   | `Set.​add(value)` — V8 hash set insert        | O(1) amortized      | O(1) per entry | Hash -> probe -> write                                  |
| `ARR_​PUSH`  | `Array.​push(value)` — amortized append       | O(1) amortized      | O(1) amortized | Write to backing store, possible realloc (2x growth)    |
| `ARR_​IDX`   | `Array[i]` — direct index access             | O(1)                | O(1)           | Base pointer + offset computation                       |
| `NUM_​ADD`   | `a + b` — IEEE 754 double addition           | O(1)                | O(1)           | FPU `FADD` instruction                                  |
| `NUM_​MUL`   | `a * b` — IEEE 754 double multiply           | O(1)                | O(1)           | FPU `FMUL` instruction                                  |
| `NUM_​DIV`   | `a /​ b` — IEEE 754 double division           | O(1)                | O(1)           | FPU `FDIV` instruction                                  |
| `NUM_​CMP`   | `a > b` — numeric comparison                 | O(1)                | O(1)           | `FCMP` + conditional flags                              |
| `LOG1P`     | `Math.​log1p(x)` — ln(1+x)                    | O(1)                | O(1)           | FPU `FYL2XP1` or polynomial approx                      |
| `PARSE_​INT` | `parse​Int(s, 10)` — string -> integer        | O(d) where d=digits | O(1)           | Byte scan + multiply-accumulate                         |
| `STR_​LOWER` | `s.​to​Lower​Case()` — case folding             | O(n)                | O(n)           | Byte-by-byte copy with case map                         |
| `STR_​SPLIT` | `s.​split(delim)` — tokenization              | O(n)                | O(k) k=tokens  | Linear scan + heap alloc per token                      |
| `STR_​TRIM`  | `s.​trim()` — whitespace removal              | O(n)                | O(n)           | Scan from both ends                                     |

**V8 Map/Set internals**: V8 uses a deterministic hash table variant (ordered insertion). Hash computation for integers: identity function masked to table size. For strings: `String​Hasher` computes a 32-bit hash via iterative multiply-add. Collision resolution: open addressing with quadratic probing. Load factor threshold: 0.75 triggers reallocation (2x capacity).

---

### 14.2 Algorithmic Composition — From Primitives to Algorithms

#### 14.2.1 Jaccard Similarity — `get​Jaccard(A, B)`

-> Source: [`get​Jaccard`](backend/src/scripts/build-recommender.ts#L136-L149)

**Formal definition**: J(A, B) = |A intersection B| / |A union B|

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
- **Primitive count**: min(|A|,|B|) × `SET_​HAS` + 4 × `NUM_​ADD/​SUB` + 1 × `NUM_​DIV`

---

#### 14.2.2 Playtime-Weighted Score Aggregation — `get​Recommendations​For​Library`

-> Source: [`get​Recommendations​For​Library`](backend/src/services/recommender.service.ts#L102-L178)

**Primitive decomposition**:

**Phase A — Owned Set Construction** (O(L)):

```
ownedSet ← new Set()                           # 1× heap alloc
FOR game IN ownedGames:                         # L iterations
  ownedSet.ADD(game.appId)                      # L × SET_ADD
```

Primitives: L × `SET_​ADD`

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

Primitives: L × `NUM_​ADD` + L × (2 × `LOG1P` + 1 × `NUM_​DIV` + 1 × `MAP_​SET`)

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

Primitives per inner iteration: 1 × `SET_​HAS` + 1 × `NUM_​MUL` + 1 × `MAP_​GET` + 1 × (`NUM_​ADD` or `MAP_​SET`)

**Phase D — Sort** (O(C log C)):

```
recommendations.SORT((a, b)  ->  b.score - a.score)  # Timsort: C log C × NUM_CMP
```

Timsort decomposes to: C × `NUM_​CMP` per merge pass × log_2(C) passes

**Total asymptotic complexity**:

- **Time**: O(L × K + C log C) where L = library size, K = neighbors per game (20), C = unique candidates
- **Space**: O(L + C) — ownedSet (L entries) + scores Map (C entries)

---

#### 14.2.3 L1-Normalized Genre Vector — `build​Genre​Vector`

-> Source: [`build​Genre​Vector`](backend/src/services/user-profile.service.ts#L56-L119)

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

Primitives per row: 2 × `STR_​SPLIT` + G × (`STR_​TRIM` + `STR_​LOWER` + `SET_​ADD`) + 1 × `MAP_​SET`

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

#### 14.2.4 3-Signal Composite Scoring — `score​With​User​Context`

-> Source: [`score​With​User​Context`](backend/src/services/user-profile.service.ts#L216-L336)

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

#### 14.2.5 8-Factor Weighted Similarity — `calculate​Score`

-> Source: [`calculate​Score`](backend/src/scripts/build-recommender.ts#L161-L191)

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

**Fixed-cost primitives**: 8 × `NUM_​MUL` + 7 × `NUM_​ADD` + 2 × `NUM_​DIV` + 4 × `LOG1P` + 4 × `NUM_​CMP` = **25 arithmetic ops**

**Variable-cost (Jaccard calls)**: ~3-4 × `SET_​HAS` per Jaccard (avg set size ~5) × 4 calls = **~16 hash lookups**

**Total per pair**: ~41 primitive operations

**O(N²) loop total**: 41 × N² ~ 41 × 27,000² ~ **29.9 billion primitive operations** for the full index build.

---

### 14.3 System-Level Execution Traces

#### 14.3.1 `fs.​read​File​Sync(path, 'utf-​8')` — File Read

Used in `Recommender​Service.​load​Data()` to load `similarity-​index.​json`.

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

#### 14.3.2 `JSON.​parse(string)` — JSON Deserialization

Used immediately after `fs.​read​File​Sync` to parse the similarity index.

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

#### 14.3.3 `pool.​query(sql, params)` — PostgreSQL Query Execution

Used in `search​By​Genres`, `build​Genre​Vector`, and `score​With​User​Context`.

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

#### 14.3.4 `axios.​get(url, config)` — HTTP Request to Steam API

Used in `Steam​Service` for all Steam API calls.

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

#### 14.3.5 `express.​json()` Middleware — Request Body Parsing

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

**Abstract boundary**: `(req: Request, res: Response, next: Next​Function) => void`

**Primitive virtual methods**:

| Method             | Input Vector           | Output Vector                   | Side Effects                                                              |
| ------------------ | ---------------------- | ------------------------- | ------------------------------------------------------------------------- |
| `req.​params[key]`  | key: string            | string \| undefined             | None (read-only)                                                          |
| `req.​query[key]`   | key: string            | string \| string[] \| undefined | None (read-only)                                                          |
| `req.​body`         | —                      | any (parsed JSON)               | None (set by body-parser)                                                 |
| `res.​status(code)` | code: number (100-599) | Response (chainable this)       | Mutates `res.​status​Code`                                                  |
| `res.​json(body)`   | body: any              | void                            | Serializes body -> sets Content-Type -> writes to socket -> ends response |
| `next()`           | —                      | void                            | Transfers control to next middleware in stack                             |
| `next(err)`        | err: Error             | void                            | Skips remaining normal middleware -> jumps to error handler               |

**`res.​json(body)` execution pipeline**:

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

**Memory side-effects of `res.​json()`**:

- **Stack**: 2 frames (res.json -> res.end)
- **Heap**: JSON string allocation (~1x body size)
- **Kernel**: Socket send buffer write (body + HTTP headers ~200 bytes)
- **GC**: Original `body` object eligible for collection after serialization

---

#### 14.4.2 Zod Schema Interface

**Abstract boundary**: `Zod​Schema<T>`

**Primitive virtual methods**:

| Method                    | Input Vector  | Output                                                        | Side Effects                        |
| ------------------------- | ------------- | -------------------------- | ----------------------------------- |
| `schema.​parse​Async(data)` | data: unknown | Promise<T>                                                    | Heap: allocates ZodError on failure |
| `schema.​safe​Parse(data)`  | data: unknown | {success: true, data: T} \| {success: false, error: ZodError} | None (pure)                         |

**`parse​Async` execution pipeline**:

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

#### 14.4.3 `pg.​Pool` Interface

**Abstract boundary**: `Pool` from `node-​postgres`

**Primitive virtual methods**:

| Method                         | Input Vector                | Output                  | Side Effects                                |
| ------------------------------ | --------------------------- | ----------------------- | ------------------------------------------- |
| `pool.​query<T>(text, params?)` | text: string, params: any[] | Promise<QueryResult<T>> | Network I/O, connection acquisition/release |
| `pool.​connect()`               | —                           | Promise<PoolClient>     | Network I/O, TCP connection, auth           |
| `pool.​end()`                   | —                           | Promise<void>           | Close all connections, drain idle queue     |

**`Query​Result<T>` output structure**:

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

- `_​idle: Client[]` — available connections (LIFO stack for cache locality)
- `_​pending​Queue: Deferred[]` — requests waiting for a connection
- `_​clients: Client[]` — all connections (idle + active)
- `_​ending: boolean` — shutdown flag

---

#### 14.4.4 Axios HTTP Client Interface

**Abstract boundary**: `Axios​Instance`

**Primitive virtual methods**:

| Method                                | Input Vector                                     | Output                    | Side Effects                     |
| ------------------------------------- | ------------------------------------------------ | ------------------------- | -------------------------------- |
| `client.​get<T>(url, config?)`         | url: string, config?: {params, headers, timeout} | Promise<AxiosResponse<T>> | Network I/O (TLS + HTTP)         |
| `client.​post<T>(url, data?, config?)` | url: string, data?: any                          | Promise<AxiosResponse<T>> | Network I/O + body serialization |

**`Axios​Response<T>` output structure**:

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

#### 14.4.5 `Recommender​Service` — Singleton Interface

**Abstract boundary**: Class `Recommender​Service` (no abstract base, but functionally an interface)

-> Source: [`Recommender​Service`](backend/src/services/recommender.service.ts#L34-L243)

**Interface contract**:

| Method                                             | Input Vector                                                 | Output                   | Time             | Space    | I/O  |
| -------------------------------------------------- | ------------------------------------------------------------ | ---------------------- | ---------------- | ------------ | ------------ |
| `is​Ready()`                                        | —                                                            | boolean                  | O(1)             | O(1)     | None |
| `get​Similar​Games(app​Id, limit?)`                   | appId: number, limit: number=10                              | SimilarGame[]            | O(1) + O(limit)  | O(limit) | None |
| `get​Recommendations​For​Library(games, limit?)`      | games: {appId, playtimeMinutes}[], limit: number=20          | RecommendationResult[]   | O(L×K + C log C) | O(L+C)   | None |
| `get​Recommendations​By​Tags(tags, exclude?, limit?)` | tags: string[], excludeAppIds: number[]=[], limit: number=20 | RecommendationResult[]   | O(N×T×K)         | O(N)     | None |
| `get​Game​Info(app​Id)`                               | appId: number                                                | {name, topTerms} \| null | O(1)             | O(1)     | None |

**Singleton state footprint** (after `load​Data()`):

| Data Structure          | Entries | Estimated Heap Size | Access Pattern       |
| ----------------------- | ------------ | ------------------- | -------------------- |
| `similarity​Index` (Map) | ~27,000 | ~50MB               | O(1) lookup by appId |
| `game​Vectors` (Map)     | ~27,000 | ~15MB               | O(1) lookup by appId |
| `idf` (Map)             | ~5,000  | ~0.5MB              | O(1) lookup by term  |
| **Total resident**      | —       | **~65MB**           | —                    |

**Invariants**:

- `is​Loaded === (similarity​Index.​size > 0)` — always true after construction
- `similarity​Index.​get(app​Id)` arrays are pre-sorted by `similarity` descending
- All methods are **pure functions over immutable state** after construction (thread-safe in concept, though Node.js is single-threaded)

---

## 15. JavaScript Runtime Fundamentals

This section deconstructs every abstracted runtime concept used in the backend, from how V8 executes a single line of TypeScript to how Promises schedule microtasks.

---

### 15.1 V8 Engine Architecture

V8 is the JavaScript engine that powers Node.js. Every `.​ts` file in this project is first compiled to `.​js` by the TypeScript compiler (`tsc`), then executed by V8.

#### 15.1.1 Compilation Pipeline

```
TypeScript Source (.ts)
    |
    v
tsc (TypeScript Compiler)               [Build-time, not runtime]
    |  Strips type annotations
    |  Downtargets syntax (e.g., optional chaining)
    |  Resolves `import` -> `require` (CommonJS target)
    v
JavaScript Source (.js)
    |
    v
V8 Parser                               [Runtime - Phase 1]
    |  Lexer: bytes -> tokens (keywords, identifiers, literals)
    |  Parser: tokens -> AST (Abstract Syntax Tree)
    |  Lazy parsing: function bodies parsed on first call, not at load
    v
Ignition (Bytecode Interpreter)          [Runtime - Phase 2]
    |  AST -> V8 Bytecode (compact, stack-based instructions)
    |  Example: LdaNamedProperty, Star, CallRuntime
    |  Executes immediately (no machine code generation yet)
    |  Collects type feedback: "this variable was always a number"
    v
TurboFan (Optimizing JIT Compiler)       [Runtime - Phase 3, if hot]
    |  Bytecode + type feedback -> optimized machine code (x86-64 / ARM64)
    |  Speculative optimizations:
    |    - Inline caching: monomorphic -> polymorphic -> megamorphic
    |    - Function inlining: small callees are embedded in callers
    |    - Dead code elimination
    |    - Loop-invariant code motion
    |  Deoptimization: if type assumption violated, falls back to Ignition
    v
Machine Code (x86-64 on Intel Mac, ARM64 on Apple Silicon)
```

**How this applies to the backend**:

- `recommender.​service.​ts` methods like `get​Similar​Games` are called thousands of times during scoring. TurboFan JIT-compiles them after ~100 invocations.
- `Map.​get()` calls in hot loops get inline-cached: V8 remembers the Map's internal shape and generates a direct memory offset read instead of a hash table lookup.

#### 15.1.2 Hidden Classes (Shapes / Maps)

Every JavaScript object has an internal "hidden class" (V8 calls them "Maps", not to be confused with `Map` the data structure). Hidden classes track the object's property layout.

```javascript
// Step 1: Create empty object -> Hidden Class C0 (no properties)
const game = {};

// Step 2: Add property -> Transition to Hidden Class C1 {appId: offset 0}
game.appId = 730;

// Step 3: Add property -> Transition to Hidden Class C2 {appId: offset 0, name: offset 1}
game.name = "CS2";
```

**Transition chain**: `C0 -​> C1 -​> C2`

**Why this matters**: When V8 sees many objects with the same shape (e.g., all `Similar​Game` objects have `{app​Id, name, similarity}`), it creates a single hidden class and shares it. Property access becomes a fixed-offset memory read (like a C struct) instead of a dictionary lookup.

**Performance trap**: Adding properties in different orders creates different hidden classes:

```javascript
const a = {};
a.x = 1;
a.y = 2; // Hidden class: {x:0, y:1}
const b = {};
b.y = 2;
b.x = 1; // Hidden class: {y:0, x:1}  -- DIFFERENT!
```

V8 cannot share the hidden class between `a` and `b`. This forces polymorphic inline caches, which are slower. The TypeScript interfaces in `steam.​types.​ts` prevent this by ensuring consistent property order.

#### 15.1.3 Inline Caches (ICs)

When V8 executes `obj.​property`, it doesn't do a dictionary lookup every time. Instead:

1. **First call (uninitialized)**: Full property lookup via hidden class chain. V8 records the hidden class and property offset.
2. **Second call (monomorphic)**: If same hidden class, V8 uses the cached offset directly. One pointer comparison + one memory read.
3. **Many different shapes (megamorphic)**: Falls back to generic dictionary lookup. Significantly slower.

**In the backend**: The `for.​.​.​of` loops in `get​Recommendations​For​Library` iterate `Similar​Game[]` objects. All `Similar​Game` objects have the same hidden class (created by `JSON.​parse` with consistent key order), so property access is monomorphic -- every `.​app​Id` and `.​similarity` read is a single memory offset operation.

---

### 15.2 Memory Model: Heap and Stack

#### 15.2.1 The Call Stack

The call stack is a contiguous region of memory (default 1MB in V8, configurable via `-​-​stack-​size`). Each function call pushes a **stack frame**.

```
Stack Frame Layout (x86-64):
+---------------------------+
| Return address (8 bytes)  |  <- Where to jump back after function returns
| Saved base pointer (RBP)  |  <- Previous frame's base pointer
| Local variable 1          |  <- Primitives (numbers, booleans) stored here
| Local variable 2          |
| Local variable N          |
| Temporaries               |  <- Intermediate computation results
+---------------------------+
     ^
     |
     Stack Pointer (RSP) - grows downward in memory
```

**What lives on the stack**:

- Primitive values: `number`, `boolean`, `undefined`, `null`, `string` (small strings in some cases)
- References (pointers) to heap objects
- Function arguments
- Return addresses

**What does NOT live on the stack**:

- Objects (`{}`)
- Arrays (`[]`)
- Functions (closures)
- Strings (longer than ~kMaxInlineStringLength)

**Stack overflow example**:

```typescript
// This WILL crash with "Maximum call stack size exceeded"
function recurse() {
  recurse();
} // Each call adds ~80 bytes to stack
// 1MB / 80 bytes per frame = ~12,500 frames before overflow
```

**How the backend avoids stack overflow**:

- All I/O is async (Promises), so the call stack never grows linearly with data size.
- The `for` loops in `get​Recommendations​For​Library` and `calculate​Score` are iterative, not recursive.
- `JSON.​parse` uses an internal iterative parser (not recursive descent) for deeply nested structures.

#### 15.2.2 The Heap

The heap is V8's garbage-collected memory space. All objects, arrays, closures, Maps, and Sets live here.

```
V8 Heap Layout:
+-------------------------------------------------------------------+
| New Space (Young Generation)     | ~1-8 MB                       |
|   Semi-space A (active)          | Objects allocated here first   |
|   Semi-space B (inactive)        | Used during Scavenge GC        |
+-------------------------------------------------------------------+
| Old Space (Old Generation)       | ~700MB-1.4GB (default limit)  |
|   Old Object Space               | Objects surviving 2+ GC cycles |
|   Old Code Space                 | JIT-compiled machine code      |
+-------------------------------------------------------------------+
| Large Object Space               | Objects > 512KB                |
|   (e.g., large JSON strings,     | Not moved during GC            |
|    similarity-index arrays)       |                               |
+-------------------------------------------------------------------+
| Map Space                        | Hidden class objects            |
| Code Space                       | Bytecode + builtins            |
+-------------------------------------------------------------------+
```

**Garbage Collection cycles**:

1. **Scavenge (Minor GC)**: Triggered when New Space is full (~every few ms under load).
   - Copies live objects from Semi-space A to Semi-space B.
   - Dead objects are simply abandoned (their memory is reclaimed by flipping spaces).
   - Promotion: Objects surviving 2 scavenges are moved to Old Space.
   - **Time**: 1-5ms (proportional to live objects, not total space).

2. **Mark-Sweep-Compact (Major GC)**: Triggered when Old Space approaches limit.
   - **Mark phase**: Traverse all reachable objects from GC roots (global object, stack, handles). Mark each as "alive."
   - **Sweep phase**: Iterate Old Space. Unmarked objects are freed.
   - **Compact phase**: Move surviving objects together to eliminate fragmentation.
   - **Time**: 10-100ms (proportional to Old Space size). V8 does this incrementally via "Incremental Marking" to avoid long pauses.

**How the backend uses the heap**:

- `similarity​Index` Map (~50MB) lives in Old Space (promoted after first GC cycle).
- Each HTTP request creates temporary objects (req, res, parsed body) in New Space. These die quickly and are collected by Scavenge.
- `JSON.​parse` of the 50MB similarity index triggers a Major GC during startup because the input string + output objects temporarily double heap usage.

---

### 15.3 Hoisting

Hoisting is V8's treatment of declarations during the parsing phase, before any code executes.

#### 15.3.1 `var` Hoisting -- Full Declaration Hoisting

```typescript
console.log(x); // undefined (NOT ReferenceError)
var x = 5;
console.log(x); // 5
```

**What V8 actually does** (conceptual transformation):

```typescript
var x = undefined; // Declaration hoisted to top of function scope
console.log(x); // undefined
x = 5; // Assignment stays in place
console.log(x); // 5
```

**Scope**: `var` is function-scoped, not block-scoped:

```typescript
function example() {
  if (true) {
    var x = 10; // x is scoped to `example`, NOT to the if-block
  }
  console.log(x); // 10 (accessible outside the block)
}
```

**In the backend**: The codebase uses `const` and `let` exclusively (TypeScript best practice). No `var` declarations exist.

#### 15.3.2 `let` / `const` -- Temporal Dead Zone (TDZ)

```typescript
console.log(y); // ReferenceError: Cannot access 'y' before initialization
let y = 5;
```

**Mechanical execution**:

1. During parsing, V8 records that `y` exists in this block scope.
2. At runtime, `y` is in the TDZ from the start of the block until the `let y = 5` line executes.
3. Any access to `y` before initialization throws `Reference​Error`.
4. After `let y = 5` executes, `y` is initialized and accessible.

`const` behaves identically to `let` for hoisting, but additionally prevents reassignment (the binding is immutable, not the value).

#### 15.3.3 Function Hoisting

```typescript
greet(); // Works! "Hello"
function greet() {
  console.log("Hello");
}
```

Function declarations are fully hoisted -- both the name AND the body are available at the top of the scope.

**Arrow functions and `const` are NOT hoisted**:

```typescript
greet(); // ReferenceError -- TDZ
const greet = () => {
  console.log("Hello");
};
```

**In the backend**: All services use `const` + arrow functions (e.g., `const validate = (schema) => .​.​.​`), so they are NOT hoisted. Import order matters.

#### 15.3.4 Import Hoisting in ES Modules / CommonJS

In CommonJS (`require()`), module loading is synchronous and ordered:

```typescript
// config.ts
const x = require("./a"); // a.js executes NOW, completely, before moving on
const y = require("./b"); // b.js executes NOW
```

In ES Modules (`import`), imports are hoisted and resolved before any module code runs:

```typescript
import { config } from "./config"; // This is evaluated FIRST, regardless of position
console.log(config.port); // config is already available
```

TypeScript compiles `import` to `require()` (CommonJS target in `tsconfig.​json`), so the actual runtime behavior follows CommonJS ordering.

---

### 15.4 Closures and Lexical Scope

A **closure** is a function that captures variables from its enclosing scope. The captured variables remain alive as long as the closure exists, even if the enclosing function has returned.

#### 15.4.1 Closure Mechanics

```typescript
function createCounter() {
  let count = 0; // Captured by the returned function
  return function increment() {
    count++; // Accesses `count` from the enclosing scope
    return count;
  };
}

const counter = createCounter();
counter(); // 1
counter(); // 2
```

**V8 internal representation**:

```
Stack (during createCounter call):
  [count: 0]  <- local variable

After createCounter returns:
  Stack frame is destroyed, BUT:

Heap (Context object):
  Context {
    count: 0   <- "escaped" to heap because `increment` captures it
  }

  increment (Function object):
    code: [bytecode pointer]
    context: [pointer to Context above]

counter() call:
  1. V8 reads `increment.context` -> Context object on heap
  2. V8 reads Context.count -> context[slot 0] -> 0
  3. Increments: count = 0 + 1 = 1
  4. Writes back: context[slot 0] = 1
  5. Returns 1
```

**Memory side-effect**: The `count` variable moves from stack to heap. V8 detects this during compilation ("escape analysis") and allocates a `Context` object to hold escaped variables.

#### 15.4.2 Closures in the Backend

**Singleton pattern** (`steam.​service.​ts`):

```typescript
let steamServiceInstance: SteamService | null = null; // Module-level closure variable

export function getSteamService(): SteamService {
  if (!steamServiceInstance) {
    steamServiceInstance = new SteamService(); // Captured by closure
  }
  return steamServiceInstance;
}
```

`steam​Service​Instance` is a module-scoped variable captured by `get​Steam​Service`. It persists for the lifetime of the process.

**Middleware factory** (`validate.​middleware.​ts`):

```typescript
export const validate = (schema: ZodSchema) => {    // schema is captured
  return async (req, res, next) => {                 // This inner function closes over `schema`
    await schema.parseAsync({ body: req.body, ... });
  };
};
```

Each call to `validate(some​Schema)` creates a new closure that captures that specific schema. The Zod schema object lives on the heap and is referenced by the closure's Context.

---

### 15.5 Prototypal Inheritance and the `class` Keyword

TypeScript/JavaScript `class` is syntactic sugar over prototypal inheritance.

#### 15.5.1 What `class` Actually Creates

```typescript
class SteamService {
  private apiClient: AxiosInstance;
  constructor(apiKey?: string) { ... }
  async getOwnedGames(steamId: string): Promise<UserLibrary> { ... }
}
```

**Desugared to** (conceptual):

```javascript
function SteamService(apiKey) {
  this.apiClient = axios.create({ ... });
}
SteamService.prototype.getOwnedGames = async function(steamId) { ... };
```

**Memory layout**:

```
Heap:
  SteamService (Function object)
    .prototype -> SteamServicePrototype {
      constructor: [pointer to SteamService function]
      getOwnedGames: [pointer to async function]
      getRecentlyPlayedGames: [pointer to async function]
      getPlayerSummary: [pointer to async function]
      ...
    }

  instance = new SteamService()
    .__proto__ -> SteamServicePrototype (shared, not copied)
    .apiClient -> AxiosInstance { ... }
    .storeClient -> AxiosInstance { ... }
    .apiKey -> "ABC123..."
```

**Key insight**: Methods live on the prototype (one copy shared by all instances). Properties live on each instance. `new Steam​Service()` does NOT copy methods -- it sets `instance.​_​_​proto_​_​` to `Steam​Service.​prototype`.

#### 15.5.2 `extends Error` -- Prototype Chain

```typescript
class SteamApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "SteamApiError";
  }
}
```

**Prototype chain**:

```
instance.__proto__ -> SteamApiError.prototype
  .__proto__ -> Error.prototype
    .__proto__ -> Object.prototype
      .__proto__ -> null  (end of chain)
```

`instanceof` walks this chain:

```typescript
error instanceof SteamApiError; // true (found SteamApiError.prototype)
error instanceof Error; // true (found Error.prototype)
error instanceof Object; // true (found Object.prototype)
error instanceof Array; // false (Array.prototype not in chain)
```

---

### 15.6 The Event Loop

Node.js runs on a single thread. All concurrent I/O is managed by the event loop, implemented by libuv (a C library).

#### 15.6.1 Event Loop Phases

```
   |------------------------------------|
   |           EVENT LOOP               |
   |                                    |
   |  Phase 1: TIMERS                   |
   |    Execute setTimeout/setInterval  |
   |    callbacks whose time has come   |
   |                                    |
   |  Phase 2: PENDING CALLBACKS        |
   |    I/O callbacks deferred from     |
   |    previous cycle (e.g., TCP       |
   |    errors)                         |
   |                                    |
   |  Phase 3: IDLE / PREPARE           |
   |    Internal use only               |
   |                                    |
   |  Phase 4: POLL                     |  <- Most time spent here
   |    Retrieve new I/O events         |
   |    Execute I/O callbacks:          |
   |      - File reads (fs.readFile cb) |
   |      - Network data (HTTP resp)    |
   |      - Database results (pg query) |
   |    Blocks here if nothing to do    |
   |                                    |
   |  Phase 5: CHECK                    |
   |    setImmediate() callbacks        |
   |                                    |
   |  Phase 6: CLOSE CALLBACKS          |
   |    socket.on('close') callbacks    |
   |                                    |
   |------------------------------------|
   |                                    |
   | BETWEEN EVERY PHASE:              |
   |   Process ALL microtasks:          |
   |     1. process.nextTick() queue    |
   |     2. Promise resolution queue    |
   |                                    |
   |------------------------------------|
```

#### 15.6.2 Microtasks vs Macrotasks

**Macrotasks** (one per event loop iteration):

- `set​Timeout`, `set​Interval`
- I/O callbacks (file read, network response, DB query result)
- `set​Immediate`

**Microtasks** (ALL processed between each macrotask):

- `Promise.​then/​catch/​finally` callbacks
- `process.​next​Tick` callbacks
- `queue​Microtask` callbacks

**Execution order guarantee**:

```
1. Current synchronous code completes (call stack empties)
2. ALL microtasks are drained (Promises, nextTick)
3. ONE macrotask executes
4. ALL microtasks are drained again
5. Repeat
```

**Critical implication for the backend**:
When `score​With​User​Context` does:

```typescript
const [libraryResult, recentResult, friendResult] = await Promise.allSettled([...]);
```

The `await` suspends the function (returns control to the event loop). The three API calls run as separate I/O operations in the POLL phase. When all three complete, their Promise resolution callbacks are queued as microtasks and processed before any other macrotask.

---

### 15.7 Promises -- Mechanical Execution

#### 15.7.1 Promise Internal State Machine

A Promise is a state machine with three states:

```
                resolve(value)
  PENDING  ---------------------->  FULFILLED
     |                                  |
     |         reject(reason)           |
     +----------------------------  REJECTED
                                        |
                                        v
                                  [immutable -- cannot transition again]
```

**V8 internal representation** (simplified from `src/​builtins/​promise.​tq`):

```
Promise (JSPromise object on heap):
  state: PENDING | FULFILLED | REJECTED          (2-bit flag)
  result: undefined | fulfillment_value | rejection_reason
  reactions: LinkedList<PromiseReaction>          (then/catch handlers waiting)
    PromiseReaction:
      fulfill_handler: Function | undefined
      reject_handler: Function | undefined
      promise: Promise  (the promise returned by .then())
```

#### 15.7.2 `new Promise()` -- Mechanical Execution

```typescript
const p = new Promise((resolve, reject) => {
  // executor runs SYNCHRONOUSLY, right now, on the current call stack
  setTimeout(() => resolve(42), 1000);
});
```

**Step-by-step**:

1. V8 allocates a `JSPromise` object on the heap: `{state: PENDING, result: undefined, reactions: []}`
2. V8 creates two function objects: `resolve` and `reject`, both closing over the Promise
3. V8 calls the executor function synchronously with `(resolve, reject)`
4. Inside the executor, `set​Timeout` registers a timer callback (macrotask)
5. The executor returns. The Promise is still PENDING
6. `new Promise(.​.​.​)` returns the Promise object. Stored in `p`
7. ...1000ms later, the timer fires (macrotask in TIMERS phase)
8. `resolve(42)` is called:
   a. Set `p.​state = FULFILLED`
   b. Set `p.​result = 42`
   c. For each reaction in `p.​reactions`, enqueue a microtask: `() => reaction.​fulfill_​handler(42)`
9. Microtask queue is drained: all `.​then()` handlers execute

#### 15.7.3 `.​then()` Chaining -- How It Works

```typescript
promise
  .then((value) => value * 2) // Returns Promise B
  .then((doubled) => doubled + 1); // Returns Promise C
```

**Step 1**: `.​then(handler)` creates a new Promise (B) and pushes a reaction onto `promise.​reactions`:

```
promise.reactions = [
  { fulfill_handler: (value) => value * 2, promise: B }
]
```

**Step 2**: When `promise` resolves with value `42`:

1. Enqueue microtask: `() => { const result = handler(42); resolve​Promise(B, result); }`
2. Microtask executes: `result = 42 * 2 = 84`. B resolves with `84`.
3. B's reactions fire: enqueue microtask for the next `.​then()`.

**Each `.​then()` creates a new Promise.** A chain of 5 `.​then()` calls allocates 5 Promise objects on the heap.

#### 15.7.4 `Promise.​all​Settled()` -- Mechanical Execution

Used in `build​User​Profile` and `get​Multiple​Owned​Games`.

```typescript
Promise.allSettled([promiseA, promiseB, promiseC]);
```

**Internal algorithm**:

```
1. Create result Promise (R)
2. Create results array: [undefined, undefined, undefined]
3. Create counter: remainingCount = 3
4. For each input promise (index i):
   a. Attach .then() handler:
      onFulfilled(value):
        results[i] = { status: 'fulfilled', value }
        remainingCount--
        if (remainingCount === 0) resolve(R, results)
   b. Attach .catch() handler:
      onRejected(reason):
        results[i] = { status: 'rejected', reason }
        remainingCount--
        if (remainingCount === 0) resolve(R, results)
5. Return R
```

**Key difference from `Promise.​all()`**:

- `Promise.​all()`: Rejects immediately when ANY promise rejects. Other promises are abandoned (but still execute -- they just have no effect).
- `Promise.​all​Settled()`: Waits for ALL promises, regardless of success/failure. Returns the full results array.

**Why `all​Settled` is used in the backend**: When fetching friend libraries, some friends may have private profiles (API returns 401). `Promise.​all​Settled` ensures the 9 successful responses are still collected even if 1 fails.

#### 15.7.5 `async/​await` -- Desugaring

`async/​await` is syntactic sugar over Promises and generators. V8 transforms:

```typescript
async function buildUserProfile(steamId: string) {
  const library = await steamService.getOwnedGames(steamId);
  const profile = processLibrary(library);
  return profile;
}
```

Into (conceptual):

```typescript
function buildUserProfile(steamId: string) {
  return new Promise((resolve, reject) => {
    // State machine with suspension points
    let state = 0;
    let library, profile;

    function step(value) {
      try {
        switch (state) {
          case 0:
            state = 1;
            // Suspend: wait for getOwnedGames to resolve
            return steamService.getOwnedGames(steamId).then(step, reject);

          case 1:
            library = value; // Resume with resolved value
            profile = processLibrary(library);
            resolve(profile);
            break;
        }
      } catch (err) {
        reject(err);
      }
    }

    step(); // Start the state machine
  });
}
```

**Each `await`**:

1. Saves the current function state (local variables, instruction pointer)
2. Returns a Promise to the caller
3. Registers a `.​then()` handler on the awaited Promise
4. When the awaited Promise resolves, the microtask resumes the function from the saved state

**Stack behavior**: When hitting `await`, the async function's frame is REMOVED from the call stack. The event loop is free to process other work. When the Promise resolves, a NEW frame is pushed.

---

### 15.8 `this` Binding Rules

The `this` keyword in JavaScript follows 4 binding rules, applied in order of precedence:

#### Rule 1: `new` binding (highest precedence)

```typescript
const service = new SteamService(); // `this` = newly created object
```

#### Rule 2: Explicit binding (`call`, `apply`, `bind`)

```typescript
func.call(obj, arg1); // this = obj
func.apply(obj, [args]); // this = obj
const bound = func.bind(obj); // Returns new function with this permanently set to obj
```

#### Rule 3: Implicit binding (method call)

```typescript
service.getOwnedGames(steamId); // this = service (the object before the dot)
```

#### Rule 4: Default binding (standalone function call)

```typescript
const fn = service.getOwnedGames;
fn(steamId); // this = undefined (strict mode) or global (sloppy mode)
```

#### Arrow functions: Lexical `this` (no binding of their own)

```typescript
const handler = (req, res) => {
  // `this` is whatever `this` was in the enclosing scope where this arrow function was defined
  // Arrow functions do NOT have their own `this`
};
```

**In the backend**: Express route handlers use arrow functions, so `this` is irrelevant. The `Steam​Service` class methods use regular methods (implicit binding via `this.​api​Client`).

---

### 15.9 TypeScript Type Erasure

TypeScript types exist ONLY at compile time. They are completely erased before the code reaches V8.

```typescript
// TypeScript source:
function add(a: number, b: number): number {
  return a + b;
}

// After tsc compilation (what V8 actually runs):
function add(a, b) {
  return a + b;
}
```

**What gets erased**:

- All type annotations (`: number`, `: string`, `: Promise<User​Library>`)
- Interfaces (`interface Owned​Game { .​.​.​ }`) -- completely removed
- Generic parameters (`<T extends Query​Result​Row>`)
- Access modifiers (`private`, `public`, `protected`)
- Type assertions (`as Similar​Game[]`)

**What is NOT erased**:

- `enum` declarations -- compiled to JavaScript objects
- `class` declarations -- compiled to constructor functions + prototype assignments
- Decorators (if enabled) -- compiled to function calls

**Implication**: At runtime, there is zero type checking. A `Map<number, Similar​Game[]>` is just a `Map` with no runtime enforcement of key/value types. All type safety is compile-time only.

---

## 16. Node.js Runtime Internals

### 16.1 Module Resolution -- `require()` Algorithm

When Node.js executes `require('.​/​config')`, it follows a deterministic resolution algorithm:

```
require(X) from module at path Y:

  1. If X is a core module (e.g., 'fs', 'path', 'http'):
     -> Return the core module. STOP.

  2. If X begins with './' or '../' or '/':
     -> LOAD_AS_FILE(Y + X):
        a. Try X.js, X.json, X.node (in order)
        b. Try X/index.js, X/index.json, X/index.node
     -> STOP.

  3. Otherwise (bare specifier, e.g., 'express'):
     -> LOAD_NODE_MODULES(X, dirname(Y)):
        a. Try node_modules/X in current directory
        b. Check node_modules/X/package.json for "main" field
        c. If not found, go up one directory and repeat
        d. Stop at filesystem root
```

**Caching**: Node.js caches every module after first load in `require.​cache`. Subsequent `require()` calls return the cached `module.​exports` without re-executing the file. This is why the singleton pattern works -- `get​Steam​Service()` returns the same instance across all route files.

**Circular dependency handling**: If A requires B and B requires A:

1. A starts loading, gets a partial `module.​exports = {}`
2. A requires B -> B starts loading
3. B requires A -> Gets A's PARTIAL exports (whatever has been assigned so far)
4. B finishes loading
5. A finishes loading

The backend avoids circular dependencies through layered architecture: routes -> services -> config/db (one-directional).

### 16.2 `process.​env` -- Environment Variable Mechanics

```typescript
process.env.STEAM_API_KEY;
```

**Internal execution**:

1. `process` is a global object created during Node.js startup (C++ side: `node::Environment`)
2. `.​env` is a proxy-like object populated from the OS environment:
   - On startup: `char** environ` (C runtime) -> JavaScript object
   - `environ` is inherited from the parent process (the shell)
3. All values are **strings**. `process.​env.​PORT` returns `"3000"`, not `3000`.
4. Reading: O(1) property access on a JS object
5. Writing: `process.​env.​FOO = 'bar'` calls `setenv("FOO", "bar", 1)` -- a C library call that modifies the process's environment block. Child processes inherit this change.

**`dotenv` interaction**:

```typescript
dotenv.config({ path: ".env" });
```

1. Reads the `.​env` file synchronously (`fs.​read​File​Sync`)
2. Parses each line as `KEY=VALUE`
3. Calls `process.​env[KEY] = VALUE` for each entry
4. Returns `{ parsed: { KEY: VALUE, .​.​.​ } }`

The `config.​ts` module calls `dotenv.​config()` twice (root `.​env` and local `.​env`), then uses JavaScript's `||` fallback chain to select the first non-empty value.

### 16.3 Buffers and Binary Data

Node.js `Buffer` is a fixed-size chunk of raw binary memory allocated **outside V8's heap** (in C++ land). This is how Node.js handles binary data without GC overhead.

```typescript
// Buffer allocation:
const buf = Buffer.alloc(1024); // 1024 zero-filled bytes, allocated via malloc()
const buf2 = Buffer.from("hello"); // 5 bytes, UTF-8 encoded

// Buffer is a Uint8Array subclass:
buf[0] = 0x48; // Direct byte access, no GC involvement
```

**How Buffers interact with the backend**:

- `fs.​read​File​Sync(path, 'utf-​8')`: Reads raw bytes into a Buffer, then decodes to a string. Without `'utf-​8'`, returns the raw Buffer.
- HTTP response bodies arrive as Buffer chunks via `req.​on('data', chunk => .​.​.​)`. Express's `body-​parser` concatenates these chunks and decodes them.
- PostgreSQL wire protocol: `pg` module receives binary DataRow messages as Buffers and parses column values from byte offsets.

---

## 17. `node_​modules` Library Internals

This section deconstructs the key library files that power the backend's abstractions. These are the actual `.​js` files in `node_​modules/​` that execute at runtime.

---

### 17.1 Express -- Application and Router Mechanics

**Source**: `node_​modules/​express/​lib/​`

#### 17.1.1 `express()` -- Application Construction

```
express()                                   // lib/express.js
  |
  v
createApplication()                         // Returns app (a function!)
  |
  app = function(req, res, next) {          // app IS a request handler function
    app.handle(req, res, next);             // Delegates to the router
  };
  |
  mixin(app, EventEmitter.prototype)        // app.on(), app.emit()
  mixin(app, proto)                         // app.use(), app.get(), app.listen()
  |
  app._router = undefined                  // Router created lazily on first .use() or .get()
  app.settings = {}                        // Configuration (view engine, trust proxy, etc.)
```

**Key insight**: The `app` object returned by `express()` is itself a function with the signature `(req, res, next)`. This is why `app` can be used as a middleware in other Express apps.

#### 17.1.2 `app.​use()` -- Middleware Registration

```
app.use(cors())                             // lib/application.js
  |
  v
  app.lazyrouter()                          // Create Router if not exists
    app._router = new Router()
  |
  app._router.use(path, ...fns)             // Delegate to Router.use()
    |
    v
    For each fn:
      layer = new Layer(path, {}, fn)       // lib/router/layer.js
      layer.route = undefined               // Middleware (not a route)
      this.stack.push(layer)                // Append to Router's layer stack
```

**The Router's layer stack** is an ordered array. This is why middleware order matters:

```
app.use(cors())          -> stack[0]: Layer{path:'/', fn: corsMiddleware}
app.use(express.json())  -> stack[1]: Layer{path:'/', fn: jsonParser}
app.use('/api/user', userRoutes)  -> stack[2]: Layer{path:'/api/user', fn: userRouter}
```

#### 17.1.3 Request Handling Pipeline

When an HTTP request arrives at `app`:

```
Node.js HTTP Server
  -> app(req, res)
    -> app.handle(req, res, done)
      -> app._router.handle(req, res, done)       // lib/router/index.js
        |
        |  idx = 0
        |  next()  // Start processing
        |
        v
        function next(err) {
          // Find the next matching layer
          while (idx < stack.length) {
            layer = stack[idx++]

            // Path matching: does req.url start with layer.path?
            match = layer.match(req.url)
            if (!match) continue

            // Error handling: 4-param middleware only runs on errors
            if (err && layer.params.length !== 4) continue
            if (!err && layer.params.length === 4) continue

            // Execute the layer's handler
            layer.handle_request(req, res, next)
            return
          }

          // No more layers -> call final handler (404 or error)
          done(err)
        }
```

**Critical mechanics**:

- `next()` is called by each middleware to continue the chain. If a middleware forgets to call `next()`, the request hangs forever.
- `res.​json()` sends the response AND calls `res.​end()`. After this, the middleware chain stops (no more `next()` calls).
- Error middleware has 4 parameters: `(err, req, res, next)`. Express distinguishes them by `Function.​length` (the number of declared parameters).

#### 17.1.4 `Router` -- Sub-Application Mounting

```typescript
// In user.routes.ts:
const router = Router();
router.get("/:steamId/library", validate(schema), handler);

// In index.ts:
app.use("/api/user", router);
```

When a request comes in for `GET /​api/​user/​76561198012345678/​library`:

1. `app.​_​router` tries each layer. Layer at index 2 has `path: '/​api/​user'`.
2. Path matches. Express strips the matched prefix: `req.​url` becomes `'/​76561198012345678/​library'`.
3. The sub-router's `handle()` is called with the trimmed URL.
4. Sub-router layer `'/​:steam​Id/​library'` matches. `req.​params.​steam​Id = '76561198012345678'`.
5. Middleware chain: `validate(schema)` -> `handler`.

---

### 17.2 CORS -- `cors` Module

**Source**: `node_​modules/​cors/​lib/​index.​js`

```
cors(options)                               // Returns middleware function
  |
  v
function corsMiddleware(req, res, next) {
  |
  |  // Step 1: Is this a preflight request?
  |  if (req.method === 'OPTIONS') {
  |    // Preflight (browser sends OPTIONS before cross-origin POST/PUT)
  |    res.setHeader('Access-Control-Allow-Origin', origin)
  |    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,...')
  |    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'])
  |    res.setHeader('Access-Control-Max-Age', '86400')  // Cache preflight for 24h
  |    res.status(204).end()  // No body needed
  |    return  // DO NOT call next() -- request is complete
  |  }
  |
  |  // Step 2: Actual request -- add CORS headers
  |  res.setHeader('Access-Control-Allow-Origin', origin)
  |  res.setHeader('Access-Control-Expose-Headers', exposedHeaders)
  |  next()  // Continue to the actual route handler
  }
```

**Why `cors()` is called with no arguments in `index.​ts`**: The default configuration allows ALL origins (`*`), ALL standard methods, and ALL headers. This is permissive but appropriate for a development API.

**Preflight mechanics**: Browsers send a preflight `OPTIONS` request before any cross-origin request that uses custom headers (like `Content-​Type: application/​json`). The Angular frontend (port 4200) making requests to the Express backend (port 3000) triggers this on every API call.

---

### 17.3 Axios -- HTTP Client Internals

**Source**: `node_​modules/​axios/​lib/​`

#### 17.3.1 `axios.​create(config)`

```
axios.create({ baseURL: 'https://api.steampowered.com' })
  |
  v
  instance = new Axios(config)              // lib/core/Axios.js
    instance.defaults = mergeConfig(globalDefaults, config)
    instance.interceptors = {
      request: new InterceptorManager(),    // Queue of request transforms
      response: new InterceptorManager()    // Queue of response transforms
    }
  |
  v
  // Create a function that delegates to instance.request():
  wrapper = bind(Axios.prototype.request, instance)
  // Copy instance methods onto the wrapper:
  utils.extend(wrapper, Axios.prototype, instance)
  utils.extend(wrapper, instance)
  return wrapper
```

#### 17.3.2 `instance.​get(url, config)` -- Full Request Pipeline

```
this.apiClient.get('/IPlayerService/GetOwnedGames/v1/', { params: {...} })
  |
  v
Axios.prototype.request(configOrUrl, config)     // lib/core/Axios.js
  |
  |  // Step 1: Merge configs (instance defaults + call config)
  |  config = mergeConfig(this.defaults, config)
  |  config.method = 'get'
  |
  |  // Step 2: Build interceptor chain
  |  chain = [dispatchRequest, undefined]  // Core handler in the middle
  |
  |  // Prepend request interceptors:
  |  this.interceptors.request.forEach(interceptor => {
  |    chain.unshift(interceptor.fulfilled, interceptor.rejected)
  |  })
  |
  |  // Append response interceptors:
  |  this.interceptors.response.forEach(interceptor => {
  |    chain.push(interceptor.fulfilled, interceptor.rejected)
  |  })
  |
  |  // Step 3: Execute chain as Promise pipeline
  |  promise = Promise.resolve(config)
  |  while (chain.length) {
  |    promise = promise.then(chain.shift(), chain.shift())
  |  }
  |  return promise
  |
  v
dispatchRequest(config)                          // lib/core/dispatchRequest.js
  |
  |  // Step 4: Transform request data
  |  config.data = transformData(config.transformRequest, config.data)
  |
  |  // Step 5: Select adapter (http for Node.js, xhr for browser)
  |  adapter = getAdapter('http')               // lib/adapters/http.js
  |
  v
httpAdapter(config)                              // lib/adapters/http.js
  |
  |  // Step 6: Build URL
  |  fullURL = buildURL(config.baseURL + config.url, config.params)
  |    // Serializes params: {key: 'value', steamid: '765...'} -> '?key=value&steamid=765...'
  |
  |  // Step 7: Create Node.js http/https request
  |  transport = isHttps ? require('https') : require('http')
  |  req = transport.request(options)
  |
  |  // Step 8: Handle response
  |  req.on('response', (res) => {
  |    let data = []
  |    res.on('data', chunk => data.push(chunk))     // Accumulate Buffer chunks
  |    res.on('end', () => {
  |      responseData = Buffer.concat(data).toString('utf8')
  |      if (config.responseType !== 'text') {
  |        responseData = JSON.parse(responseData)    // Auto-parse JSON
  |      }
  |      settle(resolve, reject, response)            // Resolve or reject based on status
  |    })
  |  })
  |
  |  // Step 9: Status-based settle
  |  settle(resolve, reject, response):
  |    if (response.status >= 200 && response.status < 300) {
  |      resolve(response)
  |    } else {
  |      reject(createError('Request failed', config, null, req, response))
  |    }
```

**Error handling in `Steam​Service`**: When Axios rejects (status >= 400), the `.​catch()` in each service method checks `error.​response?.​status` to distinguish between HTTP errors (401, 403, 404) and network errors (no response at all).

---

### 17.4 `pg` -- PostgreSQL Client Internals

**Source**: `node_​modules/​pg/​lib/​` and `node_​modules/​pg-​pool/​`

#### 17.4.1 `new Pool(config)` -- Connection Pool

```
new Pool({ host, database, user, port })        // pg-pool/index.js
  |
  v
  this.options = { ...defaults, ...config }
  this.options.max = config.max || 10           // Max concurrent connections
  this.options.idleTimeoutMillis = 10000        // Close idle connections after 10s
  this.options.connectionTimeoutMillis = 0      // Wait indefinitely for a connection
  |
  this._clients = []                            // All Client objects (idle + active)
  this._idle = []                               // Available connections (LIFO)
  this._pendingQueue = []                       // Requests waiting for a connection
  this._endCallback = undefined                 // Set when pool.end() is called
  this._ended = false
```

#### 17.4.2 `pool.​query(text, params)` -- Full Query Pipeline

```
pool.query('SELECT * FROM games WHERE app_id IN ($1,$2)', [730, 570])
  |
  v
Pool.prototype.query(text, values)               // pg-pool/index.js
  |
  |  // Step 1: Acquire a client
  |  client = await this.connect()
  |    |
  |    |  // Check idle queue
  |    |  if (this._idle.length > 0) {
  |    |    client = this._idle.pop()              // LIFO (most recently used)
  |    |    // Validate: is connection still alive?
  |    |    // pg sends a lightweight query or checks socket state
  |    |    return client
  |    |  }
  |    |
  |    |  // Create new connection if under max
  |    |  if (this._clients.length < this.options.max) {
  |    |    client = new Client(this.options)       // pg/lib/client.js
  |    |    await client.connect()
  |    |      |
  |    |      |  // TCP connection to PostgreSQL:
  |    |      |  this.connection = new Connection(config)  // pg/lib/connection.js
  |    |      |    -> net.connect({host, port})
  |    |      |    -> SYSCALL: connect(fd, sockaddr, len)
  |    |      |
  |    |      |  // PostgreSQL startup protocol:
  |    |      |  this.connection.startup({user, database})
  |    |      |    -> Send: StartupMessage (protocol version 3.0, user, database)
  |    |      |    -> Receive: AuthenticationMD5Password (or trust/password)
  |    |      |    -> Send: PasswordMessage (md5(md5(password+user)+salt))
  |    |      |    -> Receive: AuthenticationOk
  |    |      |    -> Receive: ParameterStatus (server_version, encoding, etc.)
  |    |      |    -> Receive: ReadyForQuery (status: 'I' = idle)
  |    |      |
  |    |    this._clients.push(client)
  |    |    return client
  |    |  }
  |    |
  |    |  // At max connections: wait in queue
  |    |  return new Promise((resolve, reject) => {
  |    |    this._pendingQueue.push({ resolve, reject })
  |    |  })
  |
  |  // Step 2: Execute query on the client
  |  result = await client.query(text, values)
  |    |
  |    |  // PostgreSQL Extended Query Protocol:
  |    |  this.connection.parse({                   // Parse message ('P')
  |    |    text: 'SELECT * FROM games WHERE app_id IN ($1,$2)',
  |    |    types: []                                // Let PostgreSQL infer types
  |    |  })
  |    |  this.connection.bind({                    // Bind message ('B')
  |    |    values: [730, 570]                       // Parameter values
  |    |  })
  |    |  this.connection.describe({ type: 'P' })   // Describe message ('D')
  |    |  this.connection.execute({                  // Execute message ('E')
  |    |    rows: 0                                  // 0 = no row limit
  |    |  })
  |    |  this.connection.sync()                    // Sync message ('S')
  |    |
  |    |  // Wait for response:
  |    |  -> Receive: ParseComplete
  |    |  -> Receive: BindComplete
  |    |  -> Receive: RowDescription { fields: [{name: 'app_id', ...}, ...] }
  |    |  -> Receive: DataRow { values: [730, 'Counter-Strike 2', ...] }
  |    |  -> Receive: DataRow { values: [570, 'Dota 2', ...] }
  |    |  -> Receive: CommandComplete { text: 'SELECT 2' }
  |    |  -> Receive: ReadyForQuery
  |    |
  |    |  // Parse DataRows into JavaScript objects:
  |    |  For each DataRow:
  |    |    row = {}
  |    |    For each field in RowDescription:
  |    |      row[field.name] = parseValue(field.dataType, rawBytes)
  |    |        // OID 23 (int4) -> parseInt(text, 10)
  |    |        // OID 25 (text) -> text as-is
  |    |        // OID 1700 (numeric) -> text (pg returns decimals as strings)
  |    |    result.rows.push(row)
  |
  |  // Step 3: Release client back to pool
  |  client.release()
  |    -> this._idle.push(client)                 // Return to idle queue
  |    -> Check pending queue:
  |       if (this._pendingQueue.length > 0) {
  |         waiting = this._pendingQueue.shift()
  |         client = this._idle.pop()
  |         waiting.resolve(client)               // Wake up waiting query
  |       }
  |
  |  return result  // { rows: [...], rowCount: 2, command: 'SELECT' }
```

**Parameterized queries prevent SQL injection**: The `$1`, `$2` placeholders are parsed by PostgreSQL as typed parameters. The values are sent in a separate Bind message, never interpolated into the SQL string. Even if `values[0]` were `"'; DROP TABLE games; -​-​"`, PostgreSQL treats it as a literal string value, not SQL.

---

### 17.5 Zod -- Schema Validation Internals

**Source**: `node_​modules/​zod/​lib/​`

#### 17.5.1 Schema Composition

```typescript
z.object({
  params: z.object({
    steamId: z.string().length(17).regex(/^\d+$/),
  }),
});
```

**What this constructs in memory**:

```
ZodObject {
  _def: {
    typeName: 'ZodObject',
    shape: () => ({
      params: ZodObject {
        _def: {
          typeName: 'ZodObject',
          shape: () => ({
            steamId: ZodString {
              _def: {
                typeName: 'ZodString',
                checks: [
                  { kind: 'length', value: 17, message: '...' },
                  { kind: 'regex', regex: /^\d+$/, message: '...' }
                ]
              }
            }
          })
        }
      }
    })
  }
}
```

Each `.​length()` and `.​regex()` call does NOT create a new schema. Instead, it pushes a check object onto `_​def.​checks` and returns `this` (fluent pattern).

#### 17.5.2 `schema.​parse​Async(data)` -- Validation Pipeline

```
schema.parseAsync({ body: req.body, query: req.query, params: req.params })
  |
  v
ZodObject._parse(input)                      // Recursively validates
  |
  |  // Step 1: Type check
  |  if (typeof input !== 'object' || input === null) {
  |    return INVALID  + issue: { code: 'invalid_type', expected: 'object' }
  |  }
  |
  |  // Step 2: Shape validation (for each key in schema)
  |  for (const key of Object.keys(shape)) {
  |    const childSchema = shape[key]
  |    const childValue = input[key]
  |    const childResult = childSchema._parse(childValue)   // RECURSIVE
  |    if (childResult is INVALID) {
  |      accumulate issues with path: [key, ...childIssues.path]
  |    }
  |  }
  |
  |  // Step 3: Unknown key handling (strip mode = default)
  |  const output = {}
  |  for (const key of Object.keys(shape)) {
  |    output[key] = parsedValues[key]       // Only known keys copied
  |  }
  |  // Unknown keys in input are silently dropped
  |
  |  // Step 4: Return
  |  if (issues.length > 0) throw new ZodError(issues)
  |  return output

ZodString._parse(input):
  |
  |  if (typeof input !== 'string') return INVALID
  |
  |  for (const check of this._def.checks) {
  |    switch (check.kind) {
  |      case 'length':
  |        if (input.length !== check.value) -> issue
  |      case 'regex':
  |        if (!check.regex.test(input)) -> issue
  |      case 'min':
  |        if (input.length < check.value) -> issue
  |      case 'email':
  |        if (!emailRegex.test(input)) -> issue
  |    }
  |  }
```

---

### 17.6 `dotenv` -- Environment File Parser

**Source**: `node_​modules/​dotenv/​lib/​main.​js`

```
dotenv.config({ path: '.env' })
  |
  v
  // Step 1: Read file
  const src = fs.readFileSync(path, 'utf-8')   // Synchronous, blocks event loop
  |
  // Step 2: Parse
  const parsed = parse(src)
    |
    |  // State machine parser:
    |  For each line in src.split('\n'):
    |    1. Skip empty lines and comments (lines starting with #)
    |    2. Match pattern: /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/
    |       KEY = everything before '='
    |       VALUE = everything after '='
    |    3. Handle quoted values:
    |       - Double quotes: expand \n, \r, \t escape sequences
    |       - Single quotes: literal (no escaping)
    |       - No quotes: trim trailing whitespace, strip inline comments
    |    4. parsed[KEY] = VALUE
  |
  // Step 3: Populate process.env
  for (const key of Object.keys(parsed)) {
    if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = parsed[key]
      // NOTE: Does NOT overwrite existing env vars by default!
      // This is why system-level PGHOST takes precedence over .env PGHOST
    }
  }
  |
  return { parsed }
```

**Key behavior**: `dotenv` does NOT overwrite existing environment variables. If `PGHOST` is already set in the shell (e.g., via `export PGHOST=db.​example.​com`), the `.​env` file's `PGHOST=localhost` is ignored. The backend's `config.​ts` works around this by reading the `parsed` result directly instead of relying on `process.​env`.

---

## 18. Systems-Engineering Critical Analysis

This section addresses the fundamental execution realities that the preceding sections abstract. Each subsection identifies a physical hardware constraint, kernel-level scheduling issue, or mathematical formalism gap, and provides the mechanically rigorous breakdown required for system mastery.

---

### 18.1 V8 Event Loop Starvation & Microtask Queue Mechanics

#### 18.1.1 The Problem: Synchronous CPU-Bound Blocking

-> Source: [`score​With​User​Context`](backend/src/services/user-profile.service.ts#L216-L336)
-> Source: [`get​Recommendations​By​Tags`](backend/src/services/recommender.service.ts#L180-L229)

Node.js executes all JavaScript on a **single main thread**. The libuv event loop can only advance (call `kqueue()` on macOS or `epoll_​wait()` on Linux to poll for I/O) when the V8 call stack is **empty**. Any synchronous computation that occupies the call stack blocks the entire event loop.

**Mechanical timeline of event loop starvation**:

```
Time (ms)  | Call Stack               | Event Loop State
-----------+--------------------------+-----------------------------------
0          | [empty]                  | POLL phase: kqueue() waiting for I/O
1          | Express handler fires    | req A arrives
2          | scoreWithUserContext()   | Enters scoring loop
3-42       | scoring loop (40ms)      | BLOCKED: kqueue() cannot execute
           |                          | req B, C, D arrive -> queued in kernel
           |                          | TCP socket buffers accumulating
           |                          | PostgreSQL response sitting in recv buffer
42         | .sort() completes        | Still in handler
43         | res.json() sends resp    | Call stack empties
44         | [empty]                  | POLL phase resumes
45         | Express handler for B    | Finally processes req B (44ms delayed)
```

**Quantifying the blocking duration**:

The two CPU-bound operations in the scoring pipeline:

1. **Candidate iteration** in `score​With​User​Context`: O(C \* G) where C = unique candidates (~2000), G = avg genres per game (~5).
   - ~10,000 iterations, each performing ~6 MAP_GET + 2 NUM_MUL operations
   - At V8's optimized throughput of ~200M ops/sec: ~10,000 \* 8 / 200,000,000 = **0.4ms** (negligible)

2. **Sorting** via `scored.​sort((a, b) => b.​score -​ a.​score)`: O(C log C) comparisons.
   - Timsort: ~2000 \* log2(2000) = ~22,000 comparisons
   - Each comparison: 1 NUM_SUB + 1 NUM_CMP = 2 ops
   - **0.2ms** (negligible)

3. **Critical case -- `get​Recommendations​By​Tags`**: O(N _ T _ K) where N = 27,000 games, T = tag count, K = topTerms per game.
   - Inner loop at line 201: `normalized​Tags.​filter(t => game​Tags.​includes(t))`
   - `Array.​includes()` is O(K) linear scan, not O(1) hash lookup
   - 27,000 _ 5 tags _ 10 topTerms = **1,350,000** string comparisons
   - String comparison: ~10 bytes avg, ~5 CPU cycles per byte = ~50 cycles
   - At 3GHz: 1,350,000 \* 50 / 3,000,000,000 = **22ms**
   - **This 22ms synchronous block stalls the event loop for ALL concurrent users**

#### 18.1.2 Event Loop Phase Interaction

When `score​With​User​Context` executes its `await Promise.​all​Settled([.​.​.​])`:

```
Step 1: Three Promises created (Steam API calls)
Step 2: await suspends, control returns to event loop
        |
        v
Event Loop: POLL phase
  kqueue() returns 3 events (TCP responses from Steam API)
  Fires 3 I/O callbacks -> each resolves a Promise -> microtask queue
        |
        v
Microtask Queue: [resolve(libraryPromise), resolve(recentPromise), resolve(friendPromise)]
  V8 drains ALL microtasks before returning to event loop
        |
        v
All 3 Promises resolved -> await resumes scoreWithUserContext
  Now synchronous CPU-bound scoring begins (NO YIELD POINTS)
        |
        v
CPU-bound block: 10-40ms of synchronous execution
  During this time:
    - kqueue() CANNOT be called
    - Incoming HTTP connections queue in kernel's TCP backlog (default 511)
    - PostgreSQL responses sit in kernel recv buffer
    - setTimeout/setInterval callbacks accumulate in timer heap
    - Other clients' res.json() calls queue in the microtask pipeline
```

#### 18.1.3 Mitigation Strategies

**Strategy 1: Chunked processing with `set​Immediate()`** (yields to event loop between chunks):

```typescript
async function processInChunks<T, R>(
  items: T[],
  processor: (item: T) => R,
  chunkSize: number = 500,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    results.push(...chunk.map(processor));
    // YIELD: setImmediate schedules continuation in CHECK phase
    // This allows POLL phase to process pending I/O first
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  return results;
}
```

**Mechanical effect of `set​Immediate()`**:

```
Event Loop Phase    | What Happens
--------------------+-------------------------------------------
TIMERS              | Process expired setTimeout/setInterval
PENDING CALLBACKS   | Deferred I/O callbacks from previous cycle
IDLE/PREPARE        | Internal
POLL                | *** kqueue() runs *** -- processes pending I/O
CHECK               | setImmediate() callback fires -> resume scoring
CLOSE CALLBACKS     | Socket close handlers
```

By awaiting `set​Immediate()`, we force V8 to return control to the event loop, which processes the POLL phase (handling incoming HTTP requests and DB responses) before resuming the scoring computation in the CHECK phase.

**Strategy 2: Worker Threads** (separate V8 Isolate):

```typescript
import { Worker, parentPort, workerData } from "worker_threads";

// Main thread:
const worker = new Worker("./scoring-worker.js", {
  workerData: { candidates, genreVector, friendOverlapSet },
});
worker.on("message", (scoredResults) => {
  res.json(scoredResults);
});

// scoring-worker.js:
// This runs on a SEPARATE V8 Isolate with its own:
//   - Heap (~1.4GB capacity)
//   - Call stack (~1MB)
//   - GC (independent collection cycles)
//   - JIT compilation state
// The main thread's event loop is NEVER blocked.
const results = scoreWithUserContext(workerData);
parentPort.postMessage(results);
```

**Memory cost**: Each Worker thread allocates a new V8 Isolate (~2MB base overhead), a new call stack (~1MB), and does NOT share heap objects with the main thread. Data is transferred via **structured clone** (deep copy through serialization), adding latency proportional to data size.

---

### 18.2 The PostgreSQL Sequential Scan Catastrophe

#### 18.2.1 B-Tree Index Mechanics

-> Source: [`search​By​Genres`](backend/src/services/search.service.ts#L16-L62)

A B-tree index stores keys in sorted order in a balanced tree structure:

```
B-Tree for column "genres" (hypothetical):
                        [M]
                       /   \
              [D, H]          [R, V]
             / |  \          / |  \
          [A-C][E-G][I-L]  [N-Q][S-U][W-Z]
           |    |    |      |    |    |
          Leaf nodes contain: (key, ctid) pairs
          ctid = (block_number, tuple_offset) -> physical row location
```

**B-Tree lookup for equality or prefix**: `WHERE genres = 'RPG'`

1. Start at root node [M]
2. 'R' > 'M' -> go right to [R, V]
3. 'R' = 'R' -> descend to leaf [N-Q]
4. Scan leaf for 'RPG' -> found: ctid (42, 3)
5. Fetch heap page 42, tuple 3 -> return row

**Time**: O(log_B(N)) where B = branching factor (~200 for 8KB pages), N = rows.
For 27,000 rows: log_200(27,000) = ~2.3 -> **3 page reads** (often cached in shared_buffers).

#### 18.2.2 Why `ILIKE '%RPG%'` Defeats the B-Tree

The query generated by `search​By​Genres`:

```sql
WHERE (genres ILIKE $1 OR tags ILIKE $1) -- $1 = '%RPG%'
```

A leading wildcard (`%RPG%`) means the search prefix is **unknown**. The B-tree is sorted by the full string, so:

- The planner cannot determine which subtree to descend into
- Every possible string could contain 'RPG' at any position
- **Result**: The planner discards the B-tree index entirely

**What PostgreSQL actually does -- Sequential Scan (Seq Scan)**:

```
Seq Scan Execution Plan:
  |
  |  FOR each heap page (8KB block) in table "games":
  |    read_page(block_number)
  |      -> Check shared_buffers (128MB default) for cached page
  |      -> MISS: SYSCALL pread(fd, buf, 8192, offset)
  |         -> Kernel: Page cache check
  |         -> MISS: Block I/O to SSD
  |    |
  |    FOR each tuple in page:
  |      extract genres column (variable-length text, TOAST if > 2KB)
  |      execute: immovable_pattern_match('%RPG%', genres_value)
  |        -> C function: strstr() variant, byte-by-byte scan
  |        -> For ILIKE: case-fold both strings first (locale-dependent)
  |        -> O(m * n) worst case where m = pattern length, n = column length
  |      IF match:
  |        add tuple to result set
```

**Cost analysis for 27,000 rows**:

- Avg row size: ~500 bytes -> ~16 rows per 8KB page -> ~1,688 pages
- Shared_buffers hit rate: ~95% (hot data) -> 84 physical disk reads
- String comparison: 27,000 _ avg_genres_length(~50 chars) _ pattern_length(5) = 6.75M byte comparisons
- CPU time: ~5-10ms (acceptable for 27K rows)

**Catastrophic scaling at 500K rows**:

- 31,250 pages -> 1,563 physical disk reads at 95% cache hit
- String comparisons: 125M byte comparisons -> ~100ms CPU
- Combined with I/O wait: **200-500ms per query**
- At 10 concurrent queries: connection pool exhaustion (default max 10 connections)

#### 18.2.3 Resolution: GIN Index with pg_trgm

**Step 1**: Install the trigram extension:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

**Step 2**: Create a GIN trigram index:

```sql
CREATE INDEX idx_games_genres_trgm ON games USING GIN (genres gin_trgm_ops);
CREATE INDEX idx_games_tags_trgm ON games USING GIN (tags gin_trgm_ops);
```

**How GIN + pg_trgm works**:

```
1. Trigram decomposition of "RPG":
   -> {"  r", " rp", "rpg", "pg "}  (3-char sliding windows, padded)

2. GIN Index structure:
   Term     | Posting List (sorted ctids)
   ---------+----------------------------
   "  r"    | {(1,2), (5,3), (42,1), ...}
   " rp"    | {(5,3), (42,1), ...}
   "rpg"    | {(5,3), (42,1), (99,7), ...}
   "pg "    | {(5,3), (42,1), (150,2), ...}

3. Query execution:
   intersect(posting_list("  r"), posting_list(" rp"),
             posting_list("rpg"), posting_list("pg "))
   = {(5,3), (42,1)}  -- only tuples containing ALL trigrams

4. Recheck: For each candidate ctid, fetch the heap tuple
   and verify the full pattern match (trigram index may have false positives)
```

**Cost after GIN index**: O(T _ |posting_list|) where T = number of trigrams.
For 500K rows with RPG appearing in ~5% of games: 4 trigrams _ 25,000 posting entries = 100,000 comparisons -> **2-5ms** (100x faster than Seq Scan).

**Memory overhead**: GIN indexes are typically 2-3x the size of the indexed column data. For a 1MB genres column, the GIN index is ~2-3MB.

#### 18.2.4 Alternative: Full-Text Search with tsvector

```sql
-- Add a tsvector column:
ALTER TABLE games ADD COLUMN genres_tsv tsvector;
UPDATE games SET genres_tsv = to_tsvector('english', genres || ' ' || tags);
CREATE INDEX idx_games_genres_fts ON games USING GIN (genres_tsv);

-- Query:
WHERE genres_tsv @@ to_tsquery('english', 'RPG & Multiplayer')
```

**Advantage**: True linguistic stemming ('running' matches 'run'), stop word removal, ranking with `ts_​rank()`.

**Disadvantage**: Requires schema modification and trigger maintenance. The `ILIKE` approach works for the current dataset size (27K rows) without schema changes.

---

### 18.3 Formal Mathematical Definition of TF-IDF Vectors

#### 18.3.1 Term Frequency (TF)

-> Source: [`Game​Vector`](backend/src/services/recommender.service.ts#L20-L25)

For a game document `d` with tag/genre terms `t_​1, t_​2, .​.​.​, t_​k`:

**Raw Term Frequency**:

```
tf(t, d) = count of term t in document d's tag+genre list
```

For this system, each game's tags/genres are unique (no repeats), so:

```
tf(t, d) = 1 if t in tags(d) union genres(d), else 0
```

This is a **binary TF** model, which simplifies to set membership.

#### 18.3.2 Inverse Document Frequency (IDF)

The `idf.​json` file stores pre-computed IDF values. The standard IDF formula is:

```
idf(t) = log(N / df(t))
```

Where:

- `N` = total number of games in the corpus (~27,000)
- `df(t)` = number of games containing term `t`

**Smooth IDF variant** (avoids division by zero for unseen terms):

```
idf(t) = log(N / (df(t) + 1)) + 1
```

**Example**: If "RPG" appears in 5,000 of 27,000 games:

```
idf("RPG") = log(27000 / 5000) = log(5.4) = 1.686

If "Roguelike" appears in 200 of 27,000 games:
idf("Roguelike") = log(27000 / 200) = log(135) = 4.905
```

Rare terms get higher IDF weights (more discriminative), common terms get lower weights.

#### 18.3.3 TF-IDF Weight Computation

The weight of term `t` in document `d`:

```
w(t, d) = tf(t, d) * idf(t)
```

Since `tf(t, d)` is binary (0 or 1) in this system:

```
w(t, d) = idf(t)    if t in terms(d)
w(t, d) = 0          otherwise
```

The `Game​Vector.​top​Terms[i].​weight` field stores exactly `idf(t)` for each term.

#### 18.3.4 L2 Norm (Magnitude)

The `Game​Vector.​magnitude` field stores the L2 norm of the weight vector:

```
||v_d||_2 = sqrt( SUM_i [ w(t_i, d)^2 ] )
          = sqrt( SUM_{t in terms(d)} [ idf(t)^2 ] )
```

**Example**: A game with tags ["RPG", "Roguelike", "Indie"]:

```
||v||_2 = sqrt(1.686^2 + 4.905^2 + 2.303^2)
        = sqrt(2.843 + 24.059 + 5.304)
        = sqrt(32.206)
        = 5.675
```

#### 18.3.5 The Scoring Anomaly: L1 Sum vs Cosine Similarity

-> Source: [`get​Recommendations​By​Tags`](backend/src/services/recommender.service.ts#L204-L208)

The actual scoring code performs:

```typescript
for (const tag of matchedTags) {
  const termWeight = vector.topTerms.find((t) => t.term === tag)?.weight || 0;
  score += termWeight; // L1 sum, not cosine similarity
}
```

**What this computes** (mathematically):

```
score(d, query) = SUM_{t in query intersection terms(d)} idf(t)
```

**What standard Cosine Similarity would compute**:

```
cosine(d, query) = (v_d . v_q) / (||v_d||_2 * ||v_q||_2)

where:
  v_d . v_q = SUM_{t in query intersection terms(d)} w(t,d) * w(t,q)
```

With binary TF, `w(t,q) = 1` for query terms, so:

```
v_d . v_q = SUM_{t in intersection} idf(t)    <-- same numerator as L1 sum!
```

**The critical difference**: Cosine similarity divides by `||v_​d||_​2 * ||v_​q||_​2`, which normalizes by document length. The L1 sum does NOT normalize.

**Consequence**: Games with more matching tags get higher scores regardless of how many total tags they have. A game with 50 tags matching 3 query terms scores the same as a game with 3 tags matching 3 query terms. In cosine similarity, the 3-tag game would score higher (more focused match).

**Why the magnitude is stored but unused**: The `magnitude` field was likely pre-computed for a planned cosine similarity implementation that was simplified to the L1 sum approach. The L1 sum works acceptably when:

1. All games have roughly similar numbers of terms (true in this dataset: ~10-20 tags per game)
2. The query is short (1-5 tags), making normalization less impactful
3. Results are dominated by IDF weighting (rare tag matches outscore common ones)

#### 18.3.6 Computational Cost of Linear Scan

The `get​Recommendations​By​Tags` method performs a **full corpus scan**:

```
FOR each game in gameVectors (27,000 iterations):
  gameTags = vector.topTerms.map(t => t.term)     // O(K) array creation
  matchedTags = normalizedTags.filter(t =>          // O(T) outer loop
    gameTags.includes(t)                             // O(K) inner scan per tag
  )
  // Total per game: O(T * K)

Total: O(N * T * K) = O(27,000 * 5 * 10) = O(1,350,000)
```

Each iteration involves:

- `Array.​map()`: K heap allocations (new string array)
- `Array.​filter()`: T \* K string comparisons via `Array.​includes()` (linear scan, not hash lookup)
- `Array.​find()`: K string comparisons to retrieve weight

**Optimization**: Replace `Array.​includes()` with `Set.​has()`:

```typescript
const gameTagSet = new Set(vector.topTerms.map((t) => t.term));
const matchedTags = normalizedTags.filter((t) => gameTagSet.has(t));
// Cost: O(T) per game (hash lookup) instead of O(T * K)
// Total: O(N * T) = O(135,000) -- 10x reduction
```

---

### 18.4 TCP Socket Exhaustion & Connection Pooling

#### 18.4.1 The Problem: Concurrent Outbound Connections

-> Source: [`get​Multiple​Owned​Games`](backend/src/services/steam.service.ts#L279-L299)

When `build​User​Profile` fetches friend libraries, it fires up to 10 concurrent HTTP requests via `Promise.​all​Settled`:

```typescript
const results = await Promise.allSettled(
  steamIds.slice(0, 10).map((id) => this.getOwnedGames(id, false, false)),
);
```

#### 18.4.2 Kernel-Level Socket Lifecycle

**Per-request resource allocation**:

```
Application: axios.get('https://api.steampowered.com/...')
  |
  v
Node.js: http.request() -> net.createConnection()
  |
  v
Kernel:
  1. SYSCALL: socket(AF_INET, SOCK_STREAM, 0)
     -> Allocate file descriptor (fd)
     -> Allocate struct socket (~700 bytes kernel memory)
     -> Add to process's file descriptor table (default max: 256)

  2. SYSCALL: connect(fd, {addr: 23.58.73.90, port: 443})
     -> Allocate ephemeral port from ip_local_port_range
        macOS default range: 49152-65535 (16,384 ports)
     -> TCP 3-way handshake:
        SYN     -> [50ms RTT to Steam servers]
        SYN-ACK <- [50ms]
        ACK     ->
     -> Socket state: ESTABLISHED
     -> Kernel memory: struct tcp_sock (~2KB) + send buffer (16KB) + recv buffer (87KB)
     -> Total kernel memory per socket: ~105KB

  3. TLS Handshake (on top of TCP):
     -> ClientHello (with SNI: api.steampowered.com)
     -> ServerHello + Certificate (~4KB cert chain)
     -> Key exchange: ECDHE-P256 -> ~1ms CPU for key generation
     -> Cipher negotiation: AES-256-GCM (hardware accelerated via AES-NI)
     -> TLS session state: ~4KB (session ticket, master secret, cipher state)
     -> Total per-connection overhead: ~109KB kernel + ~4KB TLS userspace
```

#### 18.4.3 Concurrent Load Analysis

**Scenario**: 100 concurrent users each triggering `build​User​Profile`:

```
Concurrent connections = 100 users * 10 friend fetches = 1,000 TLS sockets

Resource consumption:
  File descriptors:    1,000 / 256 (default ulimit) = EXHAUSTED at user 26
  Ephemeral ports:     1,000 / 16,384 available = 6.1% utilization (OK)
  Kernel memory:       1,000 * 109KB = 106MB (in kernel address space)
  TLS state:           1,000 * 4KB = 3.9MB (in Node.js heap)
  TCP send buffers:    1,000 * 16KB = 15.6MB
  TCP recv buffers:    1,000 * 87KB = 84.9MB
  Total system memory: ~210MB for sockets alone
```

**Bottleneck 1 -- File Descriptor Limit**:

```bash
$ ulimit -n
256        # macOS default: 256 open files per process
```

The Node.js process will hit `EMFILE: too many open files` at ~250 concurrent sockets (reserving ~6 for stdin, stdout, stderr, the server socket, DB connection, and file I/O).

**Resolution**:

```bash
ulimit -n 10240    # Increase to 10,240 (or set in launchd.conf permanently)
```

**Bottleneck 2 -- TIME_WAIT Accumulation**:

After a TCP connection closes:

```
Socket State Machine:
  ESTABLISHED -> FIN_WAIT_1 -> FIN_WAIT_2 -> TIME_WAIT -> CLOSED
                                                |
                                          2 * MSL = 60 seconds
                                          (macOS default MSL = 30s)
```

During TIME_WAIT, the ephemeral port is **reserved**. The kernel cannot reuse it for a new connection to the same remote endpoint (IP:port) until TIME_WAIT expires.

**Under sustained load**: 100 req/sec _ 10 connections/req _ 60s TIME_WAIT = **60,000 ports in TIME_WAIT**.
This exceeds the ephemeral port range (16,384), causing `EADDRNOTAVAIL` (no available ports).

#### 18.4.4 Resolution: HTTP/HTTPS Agent Configuration

**Current code** (no agent configuration):

```typescript
this.apiClient = axios.create({
  baseURL: "https://api.steampowered.com",
  // No httpAgent or httpsAgent -> uses Node.js default globalAgent
  // globalAgent: keepAlive=false, maxSockets=Infinity (no limit, no reuse!)
});
```

**Correct configuration**:

```typescript
import https from "https";

const httpsAgent = new https.Agent({
  keepAlive: true, // Reuse TCP/TLS connections across requests
  keepAliveMsecs: 30000, // TCP keep-alive probe every 30s
  maxSockets: 20, // Max 20 concurrent connections to Steam API
  maxFreeSockets: 5, // Keep 5 idle connections in pool
  timeout: 10000, // Close idle sockets after 10s
  scheduling: "lifo", // Reuse most-recently-used socket (warm TLS session)
});

this.apiClient = axios.create({
  baseURL: "https://api.steampowered.com",
  httpsAgent,
  timeout: 15000, // Request timeout in ms
});
```

**Mechanical effect of `keep​Alive: true`**:

```
Without keepAlive (current):
  Request 1: DNS -> TCP handshake -> TLS handshake -> HTTP req/resp -> TCP close
  Request 2: DNS -> TCP handshake -> TLS handshake -> HTTP req/resp -> TCP close
  Total: 2 * (50ms DNS + 100ms TCP + 100ms TLS + 200ms API) = 900ms

With keepAlive:
  Request 1: DNS -> TCP handshake -> TLS handshake -> HTTP req/resp -> [keep alive]
  Request 2: HTTP req/resp -> [keep alive]   (reuse existing TCP+TLS connection)
  Total: 450ms + 200ms = 650ms (28% faster)
```

**`max​Sockets: 20` prevents socket exhaustion**:

- With `max​Sockets=20`, at most 20 TCP connections exist to `api.​steampowered.​com` at any time
- Request 21+ queues internally in Node.js (NOT in the kernel)
- 100 concurrent users \* 10 requests = 1000 requests queued, but only 20 sockets open
- No file descriptor exhaustion, no TIME_WAIT accumulation

**`scheduling: 'lifo'`** ensures the most recently used socket is reused first. This maximizes TLS session cache hits (the TLS session ticket is still warm) and minimizes idle socket timeout races.

#### 18.4.5 Memory Footprint of Idle Keep-Alive Sockets

```
Per idle keep-alive socket:
  Kernel: struct tcp_sock (~2KB) + send buffer (16KB) + recv buffer (87KB) = ~105KB
  Userspace: TLS session state (~4KB) + Node.js Socket wrapper (~1KB) = ~5KB
  Total: ~110KB per idle socket

With maxFreeSockets: 5:
  Idle memory: 5 * 110KB = 550KB (negligible)
  vs. creating new connections: saves 250ms per request
```

#### 18.4.6 Steam API Rate Limiting Interaction

Steam's Web API enforces rate limits:

- ~100,000 requests per day per API key
- Undocumented per-second burst limit (~10-20 req/s)

`max​Sockets: 20` implicitly rate-limits outbound requests to ~20 concurrent requests (plus serialized queuing), which aligns with the burst limit and prevents `429 Too Many Requests` responses.

---

### 18.5 PostgreSQL Query Execution Plans -- Mechanical Breakdown

To visualize the performance impact of the sequential scan catastrophe described in 18.2, one must understand how to read PostgreSQL's execution plan output.

#### 18.5.1 `EXPLAIN (ANALYZE, BUFFERS)` Output Structure

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT app_id, game_name, genres, price, header_image
FROM games
WHERE genres ILIKE '%RPG%'
ORDER BY positive_votes DESC
LIMIT 10;
```

**Hypothetical output** (no GIN index):

```
Limit  (cost=1234.56..1234.58 rows=10 width=200) (actual time=45.2..45.3 rows=10 loops=1)
  -> Sort  (cost=1234.56..1247.89 rows=5400 width=200) (actual time=45.1..45.2 rows=10 loops=1)
        Sort Key: positive_votes DESC
        Sort Method: top-N heapsort  Memory: 29kB
        -> Seq Scan on games  (cost=0.00..1100.00 rows=5400 width=200) (actual time=0.02..38.5 rows=5234 loops=1)
              Filter: (genres ~~* '%RPG%'::text)
              Rows Removed by Filter: 21766
              Buffers: shared hit=1500 read=188
```

**Reading the plan**:

| Field                               | Meaning                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `cost=0.​00.​.​1100.​00`                | Estimated cost: 0 startup, 1100 total (arbitrary units, ~1 unit = 1 seq page read) |
| `rows=5400`                         | Estimated rows matching filter (planner's guess from table statistics)             |
| `actual time=0.​02.​.​38.​5`            | Real execution: first row at 0.02ms, last row at 38.5ms                            |
| `rows=5234`                         | Actual rows matching (vs 5400 estimated)                                           |
| `Rows Removed by Filter: 21766`     | 21,766 rows scanned but did not match `ILIKE '%RPG%'`                              |
| `Buffers: shared hit=1500 read=188` | 1500 pages from shared_buffers cache, 188 from disk                                |
| `Sort Method: top-​N heapsort`       | PostgreSQL uses a heap of size N=10 instead of full sort (since LIMIT 10)          |
| `Memory: 29k​B`                      | Sort used 29KB of work_mem                                                         |

**After GIN index**:

```
Limit  (cost=50.12..50.14 rows=10 width=200) (actual time=2.1..2.2 rows=10 loops=1)
  -> Sort  (cost=50.12..63.45 rows=5400 width=200) (actual time=2.0..2.1 rows=10 loops=1)
        Sort Key: positive_votes DESC
        Sort Method: top-N heapsort  Memory: 29kB
        -> Bitmap Heap Scan on games  (cost=44.00..48.00 rows=5400 width=200) (actual time=1.5..1.8 rows=5234 loops=1)
              Recheck Cond: (genres ~~* '%RPG%'::text)
              -> Bitmap Index Scan on idx_games_genres_trgm  (cost=0.00..43.00 rows=5400 width=0) (actual time=1.2..1.2 rows=5300 loops=1)
                    Index Cond: (genres ~~* '%RPG%'::text)
                    Buffers: shared hit=12
```

**Key difference**: `Bitmap Index Scan` reads 12 index pages instead of 1,688 heap pages. Execution time drops from 38.5ms to 1.8ms (**21x speedup**).


---

## 19. Error Propagation & Exception Mechanics

### 19.1 The Express Error Pipeline

 -> Source: [`index.​ts`](backend/src/index.ts)

Express has two distinct middleware chains: the **normal chain** and the **error chain**. They are distinguished by function arity (number of declared parameters).

```
Request arrives:
  |
  v
Normal Middleware Chain:
  cors()                       (req, res, next) -> 3 params
    |  next()
    v
  express.json()               (req, res, next) -> 3 params
    |  next()
    v
  validate(schema)             (req, res, next) -> 3 params
    |  next()
    v
  Route Handler                async (req, res) -> 2-3 params
    |
    |  throw new SteamApiError("Profile is private", 403)
    |                          ^^^ uncaught in async handler
    v
Express Async Gap:
  Express 4 does NOT catch Promise rejections from async handlers.
  The rejection becomes an unhandledRejection event on process.

  To bridge this gap, each route handler wraps its body in try/catch:
    try {
      const result = await service.doSomething();
      res.json(result);
    } catch (error) {
      if (error instanceof SteamApiError) {
        res.status(error.statusCode || 500).json({ error: error.message });
        return;    // <-- CRITICAL: must return to prevent further execution
      }
      next(error);  // <-- Forward unknown errors to error middleware
    }
    |
    |  next(error) called with an error argument
    v
Error Middleware Chain:
  Express scans the middleware stack for handlers with 4 parameters:

  (err, req, res, next) -> 4 params = error handler
    |
    |  In index.ts, the catch-all error handler:
    |  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    |    console.error('Unhandled error:', err.message);
    |    res.status(500).json({ error: 'Internal server error' });
    |  });
    v
  Response sent. Connection closed.
```

#### 19.1.1 The `Function.​length` Detection Mechanism

Express identifies error handlers by checking `fn.​length`:

```javascript
// Express source: lib/router/layer.js
Layer.prototype.handle_error = function handle_error(error, req, res, next) {
  var fn = this.handle;
  if (fn.length !== 4) {
    // Skip this layer -- it's not an error handler
    return next(error);
  }
  try {
    fn(error, req, res, next);
  } catch (err) {
    next(err);
  }
};
```

**Implication**: If you write an error handler with destructured or default parameters that reduce `fn.​length` below 4, Express will silently skip it:

```typescript
// BUG: This handler will NEVER be called because fn.length === 1
app.use(({}: { err: Error; req: Request; res: Response; next: NextFunction }) => {
  // unreachable
});
```

#### 19.1.2 Async Error Handling -- The Express 4 Gap

Express 4 does NOT natively catch Promise rejections:

```typescript
// This will crash the process with UnhandledPromiseRejection:
router.get('/profile/:steamId', async (req, res) => {
  const profile = await steamService.getPlayerSummary(req.params.steamId);
  // If getPlayerSummary throws, Express WILL NOT catch it
  res.json(profile);
});
```

**What happens mechanically**:
1. The async handler returns a Promise (all `async` functions return Promises)
2. Express calls the handler and receives the Promise
3. Express does NOT call `.​catch()` on the returned Promise
4. When the Promise rejects, V8 enqueues a `unhandled​Rejection` microtask
5. Node.js emits `process.​on('unhandled​Rejection')` event
6. Default behavior (Node 15+): print warning and continue (or crash if `-​-​unhandled-​rejections=throw`)
7. The HTTP connection hangs -- `res.​json()` was never called, and no error handler was invoked

**The backend's solution**: Every async route handler wraps its body in `try/​catch`, explicitly calling `res.​status().​json()` in the catch block. This is a manual workaround for Express 4's async gap.

**Express 5 fix**: Express 5 (beta) automatically calls `.​catch()` on returned Promises, forwarding rejections to the error middleware chain.

#### 19.1.3 Error Object Serialization

When `res.​json({ error: error.​message })` is called with a `Steam​Api​Error`:

```
SteamApiError instance:
  .name = 'SteamApiError'              (own property, set in constructor)
  .message = 'Profile is private'      (inherited from Error.prototype)
  .statusCode = 403                     (own property, TypeScript public param)
  .stack = 'SteamApiError: Profile...' (inherited from Error.prototype)

JSON.stringify({ error: error.message }):
  Only serializes: { "error": "Profile is private" }
  .stack is NOT included (not enumerable by default)
  .statusCode is NOT included (not in the serialized object)
```

The `Error.​stack` property is non-enumerable (set by V8 via `Error.​capture​Stack​Trace`), so `JSON.​stringify` skips it. This prevents stack traces from leaking to API consumers -- a security feature.

---

### 19.2 Stack Trace Capture Mechanics

When `new Steam​Api​Error(message, status​Code)` is constructed:

```
V8 Internal:
  1. Error.captureStackTrace(this, SteamApiError)
     |
     |  V8 walks the call stack (frame by frame):
     |    Frame 0: SteamApiError constructor     <- EXCLUDED (2nd arg to captureStackTrace)
     |    Frame 1: getOwnedGames()               <- included
     |    Frame 2: handler() in user.routes.ts   <- included
     |    Frame 3: Layer.handle_request()         <- included (Express internal)
     |    Frame 4: next()                         <- included
     |    ...
     |
     |  For each frame, record:
     |    - Function name (or "<anonymous>")
     |    - Source file path
     |    - Line number + column number
     |    - Whether it's native code
     |
     |  Format as string:
     |    "SteamApiError: Profile is private\n"
     |    "    at SteamService.getOwnedGames (/backend/src/services/steam.service.ts:85:15)\n"
     |    "    at /backend/src/routes/user.routes.ts:28:42\n"
     |    ...
     |
  2. Define non-enumerable property:
     Object.defineProperty(this, 'stack', {
       value: stackString,
       writable: true,
       configurable: true,
       enumerable: false    // <-- Hidden from JSON.stringify and Object.keys
     });
```

**Performance cost**: Stack trace capture is expensive (~10-50us depending on depth). V8 has a configurable `Error.​stack​Trace​Limit` (default: 10 frames). Each frame read requires V8 to decode bytecode offsets back to source positions via the source map.

---

## 20. HTTP/1.1 Protocol Mechanics

### 20.1 Request Wire Format

When the Angular frontend calls `GET /​api/​user/​76561198012345678/​library`, here is the exact byte sequence sent over the TCP socket:

```
Bytes on the wire (after TLS decryption):
-------------------------------------------
47 45 54 20 2F 61 70 69 2F 75 73 65 72 2F 37 36    GET /api/user/76
35 36 31 31 39 38 30 31 32 33 34 35 36 37 38 2F    561198012345678/
6C 69 62 72 61 72 79 20 48 54 54 50 2F 31 2E 31    library HTTP/1.1
0D 0A                                                \r\n
48 6F 73 74 3A 20 6C 6F 63 61 6C 68 6F 73 74 3A    Host: localhost:
33 30 30 30 0D 0A                                    3000\r\n
41 63 63 65 70 74 3A 20 61 70 70 6C 69 63 61 74    Accept: applicat
69 6F 6E 2F 6A 73 6F 6E 0D 0A                      ion/json\r\n
4F 72 69 67 69 6E 3A 20 68 74 74 70 3A 2F 2F 6C    Origin: http://l
6F 63 61 6C 68 6F 73 74 3A 34 32 30 30 0D 0A       ocalhost:4200\r\n
0D 0A                                                \r\n (empty line = end of headers)
```

**Parsing in Node.js**:

```
Node.js HTTP Server (lib/http.js):
  |
  v
llhttp (C parser, successor to http-parser):
  |
  |  State machine with 60+ states:
  |  
  |  STATE: s_req_method
  |    Read bytes until SP (0x20): "GET" -> method = GET
  |                                        (3 bytes compared via lookup table)
  |  STATE: s_req_url
  |    Read bytes until SP: "/api/user/76561198012345678/library" -> url
  |    No URL decoding yet (deferred to application layer)
  |
  |  STATE: s_req_http_version
  |    Read "HTTP/1.1" -> major=1, minor=1
  |
  |  STATE: s_header_field
  |    Read until ':': "Host" -> current header name (lowercased by Node.js)
  |  STATE: s_header_value
  |    Read until CRLF: "localhost:3000" -> current header value
  |    Repeat for each header
  |
  |  STATE: s_headers_done
  |    Empty line (CRLF CRLF) -> headers complete
  |    Emit 'request' event with IncomingMessage object
  |
  v
Express receives IncomingMessage:
  req.method = 'GET'
  req.url = '/api/user/76561198012345678/library'
  req.headers = { host: 'localhost:3000', accept: 'application/json', origin: '...' }
```

### 20.2 Response Wire Format

When `res.​json({ steam​Id: '765.​.​.​', game​Count: 150, games: [.​.​.​] })` is called:

```
Express res.json():
  1. body = JSON.stringify(data)           // Serialize (O(n) where n = object nodes)
  2. Content-Type = 'application/json; charset=utf-8'
  3. Content-Length = Buffer.byteLength(body, 'utf8')   // O(n) byte count
  4. res.end(body)
     |
     v
Node.js HTTP Response:
  Construct response bytes:

  HTTP/1.1 200 OK\r\n
  X-Powered-By: Express\r\n
  Content-Type: application/json; charset=utf-8\r\n
  Content-Length: 45231\r\n
  Connection: keep-alive\r\n
  \r\n
  {"steamId":"76561198012345678","gameCount":150,"games":[...]}

  Total bytes = headers (~200 bytes) + body (45,231 bytes) = ~45,431 bytes
     |
     v
Kernel:
  SYSCALL: writev(fd, [{headers_iov}, {body_iov}], 2)
     -> Scatter-gather write: combines header and body into TCP send buffer
     -> TCP segmentation: split into MSS-sized segments (~1460 bytes for Ethernet)
        45,431 / 1460 = 32 TCP segments
     -> Each segment gets TCP header (20 bytes) + IP header (20 bytes)
     -> Nagle's algorithm: coalesce small writes (disabled for HTTP via TCP_NODELAY)
```

### 20.3 Keep-Alive Connection Reuse

HTTP/1.1 defaults to persistent connections (`Connection: keep-​alive`):

```
Connection lifecycle (single TCP socket):

  Request 1: GET /api/user/765.../library
  Response 1: 200 OK (45KB)
  [socket stays open]
  
  Request 2: GET /api/user/765.../recent
  Response 2: 200 OK (2KB)
  [socket stays open]
  
  Request 3: GET /api/game/730
  Response 3: 200 OK (1KB)
  [socket stays open until idle timeout (default 5s in Node.js)]
  
  After 5 seconds of inactivity:
  Node.js emits 'timeout' event -> calls socket.destroy()
  -> SYSCALL: close(fd) -> TCP FIN sequence -> TIME_WAIT
```

**Why Keep-Alive matters for the Angular frontend**: The browser opens 6 parallel TCP connections to `localhost:3000` (Chrome's per-host limit). Each connection handles multiple sequential requests. Without Keep-Alive, each request would require a new TCP handshake (1 RTT = ~0.1ms for localhost, ~50ms for remote servers).

### 20.4 Chunked Transfer Encoding

For streaming responses where `Content-​Length` is unknown at the start:

```
HTTP/1.1 200 OK\r\n
Transfer-Encoding: chunked\r\n
\r\n
1A\r\n                          (chunk size: 26 bytes, in hex)
{"partial":"data","more":t\r\n  (26 bytes of body)
12\r\n                          (chunk size: 18 bytes)
rue,"end":false}\r\n            (18 bytes of body)
0\r\n                           (chunk size: 0 = end of response)
\r\n
```

The backend uses `res.​json()` which sets `Content-​Length` (not chunked), but `res.​write()` calls would trigger chunked encoding. This is relevant if the recommendation engine were to stream results.

---

## 21. Memory Management & Tail Latency

### 21.1 Garbage Collection Pauses and P99 Latency

#### 21.1.1 GC Pause Impact on API Latency

When V8's garbage collector runs, JavaScript execution is paused (stop-the-world for Major GC):

```
Normal request latency:
  Time (ms): |--[5ms scoring]--|--[2ms JSON.stringify]--|--[res.end]--|
  Total: 7ms

Request during Minor GC (Scavenge):
  Time (ms): |--[5ms scoring]--[1-3ms GC pause]--[2ms JSON.stringify]--|
  Total: 10ms  (+43%)

Request during Major GC (Mark-Sweep-Compact):
  Time (ms): |--[5ms scoring]--[50-200ms GC pause]--[2ms JSON.stringify]--|
  Total: 57-207ms  (+714-2857%)
```

**Percentile impact**:
```
P50 latency: 7ms   (no GC during request)
P95 latency: 10ms  (Minor GC during request, happens every ~100ms)
P99 latency: 57ms  (Major GC during request, happens every ~5-30s under load)
P99.9:       207ms (Full compaction during request)
```

#### 21.1.2 The Similarity Index GC Pressure

At startup, `load​Data()` parses ~50MB of JSON:

```
Phase 1: fs.readFileSync -> 50MB Buffer (C++ heap, outside V8)
Phase 2: Buffer.toString('utf-8') -> 50MB V8 String (New Space -> Large Object Space)
Phase 3: JSON.parse() -> ~150-250MB of JS objects:
  - 27,000 keys in the root object -> 27,000 string allocations
  - 27,000 arrays of SimilarGame objects -> 27,000 * 20 = 540,000 objects
  - Each SimilarGame: {appId: number, name: string, similarity: number}
  - Total objects: ~567,000

Memory timeline:
  t=0:    Heap: 20MB (baseline)
  t=100:  Heap: 70MB (Buffer + String)     -> Minor GC triggered
  t=200:  Heap: 220MB (parsed objects)     -> MAJOR GC triggered
  t=250:  Heap: 175MB (String + Buffer freed) -> post-GC
  t=300:  Heap: 175MB (stable -- all objects in Old Space)
```

After startup, the similarity index is **immortal** -- it is never garbage collected because it is referenced by the singleton `Recommender​Service`. This is ideal for GC performance: immortal objects in Old Space cause zero GC pressure during normal operation.

**The transient danger**: During startup, the 250MB peak heap can trigger a 200ms Major GC pause. If the server starts accepting requests before `load​Data()` completes, early requests hit this pause.

#### 21.1.3 Request-Level Object Lifecycle

Each API request creates temporary objects:

```
GET /api/recommend/user/76561198012345678

Objects created (approximate):
  1. IncomingMessage (req)     ~2KB    -> Express parses headers
  2. ServerResponse (res)      ~1KB    -> Express creates response object
  3. Route params              ~100B   -> { steamId: '765...' }
  4. Zod validation result     ~200B   -> Parsed schema output
  5. SteamAPI response         ~50KB   -> User library JSON
  6. UserProfile               ~5KB    -> buildUserProfile result
  7. Scored candidates         ~40KB   -> 2000 ScoredRecommendation objects
  8. Sorted array              ~20KB   -> .sort() result (in-place, same array)
  9. JSON.stringify output     ~2KB    -> Response body string
  
  Total transient allocation: ~120KB per request
  All eligible for GC after res.end()
```

At 100 requests/second:
- 12MB/s of transient allocation
- New Space fills every ~500ms (8MB capacity)
- Scavenge GC runs 2x per second
- Each Scavenge: ~1-3ms pause
- No objects survive to Old Space (all die within one request lifecycle)

**This is the ideal GC pattern**: short-lived objects in New Space, long-lived data in Old Space, minimal promotion.

---

### 21.2 Connection Pool Sizing via Little's Law

#### 21.2.1 Little's Law

```
L = lambda * W

Where:
  L = average number of items in the system (active connections)
  lambda = arrival rate (queries per second)
  W = average time each item spends in the system (query duration)
```

**Applied to pg.Pool**:

```
Given:
  lambda = 50 queries/second (from 50 concurrent API requests)
  W = 5ms average query duration (shared_buffers cache hit for simple SELECT)

Required pool size:
  L = 50 * 0.005 = 0.25 connections (average)
```

Only 0.25 connections are active on average. The default `max: 10` is 40x oversized for this workload.

**Under heavy load**:
```
  lambda = 500 queries/second
  W = 20ms (includes some disk I/O for cache misses)
  L = 500 * 0.020 = 10 connections

  -> pool.max = 10 is exactly right
  -> At 11 concurrent queries, the 11th waits in _pendingQueue
```

**Under the sequential scan catastrophe** (no GIN index, 500K rows):
```
  lambda = 50 queries/second
  W = 300ms (sequential scan + string matching)
  L = 50 * 0.300 = 15 connections

  -> pool.max = 10 is UNDERSIZED
  -> Queries queue up, timeouts cascade, connection pool exhausted
```

#### 21.2.2 Pool Timeout Mechanics

```
pool.query() when all connections are busy and queue is growing:

  t=0:     query A arrives, all 10 connections busy -> enqueue in _pendingQueue
  t=50ms:  query B arrives -> enqueue
  t=100ms: connection freed -> dequeue A, execute A
  t=150ms: connection freed -> dequeue B, execute B

  If connectionTimeoutMillis = 0 (default): wait indefinitely
  If connectionTimeoutMillis = 5000: after 5s in queue -> reject with timeout error
```

**The cascading failure pattern**:
```
1. Slow query blocks connection for 300ms (sequential scan)
2. 10 slow queries fill all connections
3. New queries queue up in _pendingQueue
4. Queue grows: 10... 50... 100 pending queries
5. Each queued query adds to response time for the client
6. Clients timeout after 15s (Axios default) -> retry -> MORE requests
7. Retry storm: arrivals double -> queue grows faster
8. Server becomes unresponsive
```

**Resolution**: Set `connection​Timeout​Millis: 5000` and `statement_​timeout` in PostgreSQL:
```sql
ALTER SYSTEM SET statement_timeout = '5000';  -- Kill any query running > 5s
```

---

### 21.3 Memory Leak Patterns in Node.js

#### 21.3.1 Event Listener Accumulation

```typescript
// LEAK: Each request adds a listener, never removed
app.get('/status', (req, res) => {
  process.on('SIGTERM', () => { /* cleanup */ });
  // After 1000 requests: 1000 listeners on 'SIGTERM'
  // Node.js warnings at > 10 listeners: "MaxListenersExceededWarning"
  res.json({ ok: true });
});
```

**In the backend**: Route handlers are defined once at startup (not per-request), so this pattern does not occur. However, if event listeners were added inside request handlers, they would accumulate because `process` is a singleton that persists for the lifetime of the process.

#### 21.3.2 Closure-Captured References

```typescript
const cache = new Map();  // Module-level: never GC'd

function processRequest(largeData: Buffer) {
  const result = heavyComputation(largeData);
  
  // LEAK: closure captures `largeData` even though only `result` is needed
  cache.set(Date.now(), () => {
    console.log(largeData.length);  // <-- forces `largeData` to stay alive
    return result;
  });
}
// After 1000 calls: cache holds 1000 closures, each retaining a large Buffer
```

**In the backend**: The `similarity​Index` Map is the largest in-memory structure (~50MB). It is loaded once and never grows, so it is not a leak. However, if a future caching layer were added to `Steam​Service` without eviction, it would exhibit this growth pattern.

#### 21.3.3 Unbounded Cache Growth

```typescript
// LEAK: Map grows without bound
const responseCache = new Map<string, any>();

async function cachedFetch(url: string) {
  if (responseCache.has(url)) return responseCache.get(url);
  const data = await axios.get(url);
  responseCache.set(url, data);  // Never evicted!
  return data;
}
// After querying 100,000 unique URLs: 100,000 entries in memory
```

**Mitigation**: Use a bounded cache with LRU (Least Recently Used) eviction:
```typescript
class LRUCache<K, V> {
  private map = new Map<K, V>();
  constructor(private maxSize: number) {}
  
  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }
  
  set(key: K, value: V): void {
    this.map.delete(key);  // Remove if exists (for re-ordering)
    this.map.set(key, value);
    if (this.map.size > this.maxSize) {
      // Delete oldest entry (first key in Map iteration order)
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
  }
}
// JavaScript Map preserves insertion order -- this is guaranteed by the spec.
// Deletion + re-insertion moves a key to the end -> O(1) LRU.
```

---

## 22. Security Mechanics

### 22.1 SQL Injection Prevention -- Formal Proof

 -> Source: [`db.​ts`](backend/src/config/db.ts)
 -> Source: [`search.​service.​ts`](backend/src/services/search.service.ts)

**Claim**: Parameterized queries prevent SQL injection for all input strings.

**Proof**:

The backend constructs queries like:
```typescript
query('SELECT * FROM games WHERE genres ILIKE $1', ['%RPG%'])
```

**Step 1: Wire protocol separation**

The `pg` module sends this as two separate protocol messages:

```
Parse message (type 'P'):
  Statement: "SELECT * FROM games WHERE genres ILIKE $1"
  Parameter types: [0]  (0 = infer type)

Bind message (type 'B'):
  Parameter values: ["%RPG%"]  (as raw bytes, NOT interpolated into SQL)
```

The SQL text and parameter values are **physically separated** in the wire protocol. PostgreSQL parses the SQL text first, establishing the query structure (AST), and then binds parameter values as typed data.

**Step 2: Why injection fails**

An attacker submits:
```
steamId = "'; DROP TABLE games; --"
```

Without parameterization (string interpolation):
```sql
SELECT * FROM games WHERE app_id = ''; DROP TABLE games; --'
-- PostgreSQL sees TWO statements: SELECT and DROP
```

With parameterization:
```
Parse: "SELECT * FROM games WHERE app_id = $1"
  PostgreSQL AST: SelectStmt { fromClause: games, whereClause: OpExpr{=, app_id, Param{1}} }
  The AST has ONE statement with ONE parameter placeholder -- structural parsing is complete.

Bind: value = "'; DROP TABLE games; --"
  PostgreSQL treats this as a LITERAL STRING value for $1.
  It is NEVER re-parsed as SQL.
  Equivalent to: WHERE app_id = '''; DROP TABLE games; --'
  (The entire string, including semicolon and dashes, is a single text value)
```

**Step 3: The invariant**

The security invariant is: **the query structure (number of statements, clause types, table references) is fixed at Parse time and cannot be altered by Bind values.** This holds because the PostgreSQL parser processes SQL text and parameter values in separate, non-overlapping phases.

### 22.2 Dynamic WHERE Clause Safety

 -> Source: [`search​By​Genres`](backend/src/services/search.service.ts#L16-L62)

The `search​By​Genres` method constructs WHERE clauses dynamically:
```typescript
params.push(`%${g}%`);
const clause = `(genres ILIKE $${paramIndex})`;
```

**Is this safe?** Yes, because:
1. The `$${param​Index}` is a **positional parameter placeholder**, not user input.
2. `param​Index` is a counter (1, 2, 3...) controlled by the server.
3. The user-supplied string `g` is placed in the `params` array, which is sent via Bind -- never interpolated into SQL text.
4. Even if `g` contains SQL keywords, they are treated as literal strings by the Bind phase.

**The only injection risk** would be if the column name or operator were user-controlled:
```typescript
// UNSAFE: column name from user input
const clause = `(${userColumn} ILIKE $${paramIndex})`;  // <-- SQL injection via column name!
```

The backend hardcodes all column names (`genres`, `tags`, `game_​name`, `categories`), so this risk does not exist.

### 22.3 CORS Origin Validation

 -> Source: [`index.​ts`](backend/src/index.ts)

The backend uses `cors()` with no arguments, which sets:
```
Access-Control-Allow-Origin: *
```

**Security implication**: Any website can make API requests to this backend. In production, this should be restricted:
```typescript
app.use(cors({
  origin: ['http://localhost:4200', 'https://your-production-domain.com'],
  methods: ['GET', 'POST'],
  credentials: true,  // Allow cookies/auth headers
}));
```

**How the browser enforces CORS**:
```
1. Browser sends request to https://api.example.com
2. Browser includes Origin header: "https://my-app.com"
3. Server responds with Access-Control-Allow-Origin: "https://my-app.com"
4. Browser compares Origin with ACAO header:
   MATCH: Response is exposed to JavaScript
   NO MATCH: Response is BLOCKED by browser (network request still completed!)
```

**Critical**: CORS is a **browser-only** enforcement mechanism. Server-side tools (`curl`, `axios` from another Node.js server, Postman) completely ignore CORS headers. CORS does NOT prevent server-to-server API abuse.

---

## 23. IEEE 754 Floating-Point Precision

### 23.1 How Numbers Are Stored in V8

JavaScript has only one numeric type: `number`, which is a 64-bit IEEE 754 double-precision float.

```
64 bits = 1 sign bit + 11 exponent bits + 52 mantissa bits

Layout:
  [S][EEEEEEEEEEE][MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM]
   ^   11 bits          52 bits
   |   exponent         mantissa (fractional part)
   sign (0=positive, 1=negative)

Value = (-1)^S * 2^(E-1023) * (1 + M/2^52)
```

**Precision limits**:
- Maximum safe integer: `Number.​MAX_​SAFE_​INTEGER = 2^53 -​ 1 = 9,007,199,254,740,991`
- Numbers above this lose precision: `9007199254740992 === 9007199254740993` is `true`
- Decimal precision: ~15-17 significant digits

### 23.2 Precision Issues in the Backend

#### 23.2.1 Steam ID Precision

Steam IDs are 64-bit integers (e.g., `76561198012345678`).

```
76561198012345678 has 17 digits.
Number.MAX_SAFE_INTEGER has 16 digits (9007199254740991).
```

**If Steam IDs were stored as numbers**: `76561198012345678` would lose precision:
```javascript
const id = 76561198012345679;  // 17 digits
console.log(id);                // 76561198012345680 -- WRONG! Last digit corrupted
```

**The backend's solution**: All Steam IDs are stored and transmitted as **strings** (`steam​Id: string` in `User​Library`, `Player​Summary`, etc.). This avoids IEEE 754 truncation entirely.

#### 23.2.2 Price Arithmetic

Steam API returns prices in cents (integer):
```typescript
price_overview: { final: 2999 }  // $29.99 = 2999 cents
```

The backend stores price as a float after division:
```typescript
price: data.price_overview ? data.price_overview.final / 100 : null
// 2999 / 100 = 29.99 (exact in IEEE 754)
```

**When precision breaks**:
```javascript
0.1 + 0.2;                    // 0.30000000000000004 (NOT 0.3)
29.99 + 0.01;                 // 30.000000000000004
19.99 * 100;                  // 1998.9999999999998 (NOT 1999)
```

**Why**: `0.​1` cannot be represented exactly in binary:
```
0.1 in binary: 0.0001100110011001100110011... (repeating)
Stored as: 0.1000000000000000055511151231257827021181583404541015625
```

**Impact on scoring**: The similarity scores (0.0 to 1.0) and composite scores accumulate floating-point error:
```typescript
score = 0.25 * jaccard + 0.25 * tagSim + 0.10 * categorySim + ...
// Each multiplication may introduce ~1e-16 error
// After 8 additions: cumulative error ~8e-16
// This is negligible for ranking (differences between candidates are >> 1e-10)
```

#### 23.2.3 The Sorting Stability Guarantee

```typescript
scored.sort((a, b) => b.score - a.score);
```

If two candidates have scores that differ by less than `Number.​EPSILON` (2.22e-16), their relative order is determined by V8's Timsort stability: elements with equal comparison values retain their original order. This means insertion order (which is arbitrary -- Map iteration order) determines the tiebreaker.

For recommendation quality, this is irrelevant (two games with score difference < 1e-16 are effectively equivalent recommendations).

---

## 24. RegExp Engine Mechanics

### 24.1 How V8 Compiles Regular Expressions

The Zod schemas in the backend use regex for validation:
```typescript
z.string().regex(/^\d+$/, 'Steam ID must contain only numbers')
```

#### 24.1.1 Irregexp -- V8's Regex Engine

V8 uses **Irregexp**, which compiles regular expressions to native machine code:

```
/^\d+$/
  |
  v
Parse: RegExp AST
  ^         -> AssertionStart
  \d+       -> Quantifier(Greedy, 1..inf, CharacterClass([0-9]))
  $         -> AssertionEnd
  |
  v
Compile to bytecode (for short strings) or native code (for long strings):
  
Bytecode (simplified):
  0: CHECK_AT_START          // Assert position == 0 (for ^)
  1: LOAD_CURRENT_CHAR      // Read character at current position
  2: CHECK_CHAR_IN_RANGE '0' '9'  // Is it a digit?
  3: ON_FAIL -> 6           // If not a digit, fail
  4: ADVANCE_CP 1           // Move position forward by 1
  5: GOTO 1                 // Repeat (greedy: match as many digits as possible)
  6: CHECK_AT_END           // Assert position == end (for $)
  7: SUCCEED                // Match!

Native code (x86-64, for hot regexes):
  cmp byte [rsi + rdi], '0'     // Compare current char with '0'
  jb fail                        // If below '0', not a digit
  cmp byte [rsi + rdi], '9'     // Compare with '9'
  ja fail                        // If above '9', not a digit
  inc rdi                        // Advance position
  cmp rdi, rcx                   // Check if at end of string
  jne loop                       // If not at end, check next char
  ; success                      // All chars are digits and we're at end
```

#### 24.1.2 Backtracking and ReDoS

**Dangerous regex pattern** (NOT used in the backend, but important to understand):
```
/(a+)+$/
```

For input `"aaaaaaaaaaax"`:
- The `(a+)+` creates an exponential number of ways to partition the `a`s
- V8 tries all partitions before concluding failure
- 20 `a`s + `x` -> ~1 million backtrack steps -> ~1 second
- 30 `a`s + `x` -> ~1 billion backtrack steps -> **minutes**
- This is a Regular Expression Denial of Service (ReDoS)

**The backend's regex patterns are safe**:
```
/^\d+$/    -> No nested quantifiers, no alternation -> O(n) linear scan
/^\d{1,5}$/ -> Bounded quantifier -> max 5 iterations
```

Both patterns are processed in a single left-to-right pass with no backtracking possibility.

#### 24.1.3 Regex Compilation Caching

V8 caches compiled regex code:
```javascript
// First call: compile /^\d+$/ to bytecode + (if hot) native code
const re = /^\d+$/;

// Subsequent calls: reuse compiled code (O(1) lookup in compilation cache)
re.test("76561198012345678");  // Uses cached compiled code
re.test("76561198012345679");  // Same compiled code, different input
```

The Zod schema objects store the regex pattern (`this.​_​def.​checks[i].​regex`). The regex is compiled once when the schema is created (at module load time) and reused for every validation call.

---

## 25. Graceful Shutdown & Process Signal Handling

### 25.1 Signal Lifecycle

When the server process receives a termination signal:

```
SIGTERM (kill <pid>) or SIGINT (Ctrl+C):
  |
  v
Node.js signal handler (if registered):
  process.on('SIGTERM', () => {
    // Application-level cleanup:
    //   1. Stop accepting new connections
    //   2. Finish in-flight requests
    //   3. Close database connections
    //   4. Close file handles
    //   5. Exit
  });

Without handler:
  Node.js default: process.exit(128 + signal_number)
  SIGTERM: exit(143)   (128 + 15)
  SIGINT:  exit(130)   (128 + 2)
```

### 25.2 Graceful Shutdown Implementation

The backend does NOT currently implement graceful shutdown. Here is what it should do:

```typescript
const server = app.listen(config.port, () => { ... });

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  
  // Step 1: Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed. No new connections.');
  });
  //   Mechanical effect: the server socket is removed from kqueue/epoll.
  //   New TCP SYN packets are rejected with RST.
  //   In-flight requests on existing connections continue processing.
  
  // Step 2: Close database pool
  await pool.end();
  //   Mechanical effect:
  //   - pool._ending = true
  //   - For each idle client: client.end() -> sends Terminate message to PostgreSQL
  //   - For each active client: wait for current query to complete, then end
  //   - PostgreSQL backend process exits for each closed connection
  
  // Step 3: Exit
  process.exit(0);
  //   Mechanical effect:
  //   - V8 heap is not freed (OS reclaims all process memory)
  //   - File descriptors are closed by kernel
  //   - TCP sockets enter TIME_WAIT (or are RST'd if abrupt)
}
```

**Why graceful shutdown matters**:
- Without it, in-flight database queries are aborted mid-transaction (potential data corruption for writes)
- Without it, clients receive `ECONNRESET` instead of a proper HTTP response
- Without it, the PostgreSQL connection pool leaks connections (PostgreSQL backend processes remain until `idle_​in_​transaction_​session_​timeout`)

---

## 26. `JSON.​stringify` -- Serialization Cost Analysis

### 26.1 Mechanical Execution

Every `res.​json()` call invokes `JSON.​stringify()`. For the recommendation endpoint returning 20 results:

```
JSON.stringify(data):
  |
  v
V8 JsonStringifier::SerializeObject()
  |
  |  Recursive traversal of object graph:
  |
  |  For each property:
  |    1. Check if property is enumerable (Object.getOwnPropertyDescriptor)
  |    2. Serialize key: add quotes, escape special chars -> "appId"
  |    3. Serialize value based on type:
  |       number:    dtoa() conversion (double to ASCII)
  |                  0.85324 -> "0.85324" (7 chars)
  |                  Uses Grisu2 algorithm: O(1) per number
  |       string:    Scan for chars needing escape (\n, \t, ", \)
  |                  Copy with escaping: O(n) where n = string length
  |       boolean:   "true" or "false" (literal)
  |       null:      "null" (literal)
  |       array:     "[" + serialize each element + "]"
  |       object:    "{" + serialize each key-value + "}"
  |       undefined: SKIP (not valid in JSON)
  |       function:  SKIP (not valid in JSON)
  |
  |  Output: append to IncrementalStringBuilder (resizable char buffer)
  |    Initial capacity: 64 bytes
  |    Growth: 2x when full (amortized O(1) per character)
  |
  v
  Return: V8 String (heap allocated)

Cost for 20 RecommendationResult objects:
  Each result: ~4 properties * ~20 chars avg = ~80 chars per object
  20 objects + array syntax + keys = ~2000 characters
  Time: ~0.05ms (negligible)

Cost for full user library (1000 games):
  Each game: ~8 properties * ~30 chars avg = ~240 chars
  1000 games: ~240,000 characters = ~240KB
  Time: ~2ms (measurable at P99)
```

### 26.2 Circular Reference Detection

`JSON.​stringify` throws `Type​Error: cyclic object value` for circular references.

V8 maintains a **stack of visited objects** during serialization. Before recursing into an object, it checks if the object is already on the stack:

```
Serialize object A:
  stack = [A]
  Serialize A.child -> object B:
    stack = [A, B]
    Serialize B.parent -> object A:
      A is in stack! -> TypeError: cyclic object value
```

**In the backend**: All response objects are plain data (no circular references). TypeScript interfaces enforce this structurally -- interfaces cannot reference themselves circularly without explicit `Optional` or array wrapping.


---

## 27. Node.js Process Lifecycle

### 27.1 Startup Sequence -- From `node index.​js` to Accepting Requests

```
Shell: $ node dist/index.js
  |
  v
OS: fork() + execve("node", ["dist/index.js"])
  |
  |  Kernel allocates:
  |    - Virtual address space (user: 128TB on x86-64, kernel: 128TB)
  |    - Process control block (PCB): PID, memory maps, fd table
  |    - Initial stack (8MB default on macOS)
  |    - Load dynamic linker -> load libnode.dylib, libv8.dylib, libuv.dylib
  |
  v
Node.js C++ Initialization (src/node_main.cc):
  |
  |  Phase 1: Platform Setup
  |    v8::V8::InitializePlatform()
  |      -> Create worker threads for V8 background tasks (GC, JIT, ICU)
  |      -> Number of threads = max(1, CPU_cores - 1)
  |    v8::V8::Initialize()
  |      -> Initialize V8 snapshot (pre-compiled builtins: Array, Map, Promise, etc.)
  |      -> Initialize Wasm engine (if enabled)
  |
  |  Phase 2: V8 Isolate Creation
  |    v8::Isolate::New(create_params)
  |      -> Allocate V8 heap (initial: ~4MB, max: ~1.4GB by default)
  |      -> Create NewSpace (2 semi-spaces, 1-4MB each)
  |      -> Create OldSpace, CodeSpace, MapSpace, LargeObjectSpace
  |      -> Initialize built-in object templates
  |
  |  Phase 3: Environment Setup
  |    node::Environment::Create(isolate, context)
  |      -> Create process object (process.env, process.argv, process.pid)
  |      -> Register internal bindings (fs, net, http, crypto, etc.)
  |      -> Set up module loader (CommonJS and ESM)
  |      -> Register signal handlers (SIGINT default)
  |
  |  Phase 4: Bootstrap Scripts
  |    Run internal/bootstrap/loaders.js:
  |      -> Set up require() function
  |      -> Set up internal module cache
  |    Run internal/bootstrap/node.js:
  |      -> Set up global objects (console, setTimeout, setInterval)
  |      -> Set up process.nextTick()
  |      -> Set up Promise rejection handlers
  |
  v
Module Loading (user code):
  |
  |  require('./index.js')  (the compiled TypeScript entry point)
  |    |
  |    v
  |    Module._load('./index.js')
  |      -> Read file: fs.readFileSync('./index.js')
  |      -> Compile: new Module() -> module._compile(source, filename)
  |         -> V8: v8::Script::Compile(source)
  |            -> Parser -> AST -> Ignition bytecode
  |         -> Wraps in: (function(exports, require, module, __filename, __dirname) { ... })
  |         -> Execute the wrapper function
  |
  |    Top-level execution order (synchronous):
  |      1. require('dotenv').config()      -> Load .env, populate process.env
  |      2. require('express')              -> Load Express from node_modules
  |      3. require('cors')                 -> Load CORS middleware
  |      4. require('./config')             -> Load config.ts (reads process.env)
  |      5. require('./routes/...')          -> Load route files
  |         Each route file requires its service:
  |           require('./services/steam.service')    -> SteamService singleton created
  |           require('./services/search.service')   -> SearchService instance created
  |           require('./services/recommender.service') -> RecommenderService singleton created
  |             -> loadData() runs synchronously: reads JSON files, builds Maps
  |             -> THIS BLOCKS THE MAIN THREAD FOR 1-3 SECONDS
  |      6. app.use(cors())                 -> Register middleware
  |      7. app.use(express.json())         -> Register middleware
  |      8. app.use('/api/...', router)     -> Mount routes
  |      9. app.listen(port, callback)      -> Start TCP server
  |
  v
app.listen(port, callback):
  |
  |  http.Server.listen(port)
  |    -> SYSCALL: socket(AF_INET, SOCK_STREAM, 0) -> fd
  |    -> SYSCALL: setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, 1)
  |    -> SYSCALL: bind(fd, {addr: 0.0.0.0, port: 3000}, sizeof)
  |    -> SYSCALL: listen(fd, backlog=511)
  |       Kernel creates:
  |         - SYN queue (incomplete connections): max = somaxconn (128 default)
  |         - Accept queue (completed connections): max = backlog (511)
  |    -> Register fd with kqueue: SYSCALL kevent(kq, {fd, EVFILT_READ, EV_ADD})
  |    -> callback() fires: console.log('Server running on port 3000')
  |
  v
Event Loop Begins:
  |
  |  uv_run(loop, UV_RUN_DEFAULT)
  |    -> First iteration:
  |       TIMERS: no timers registered
  |       POLL: kevent(kq, events, max_events, timeout=infinity)
  |             Blocks here until:
  |               - TCP SYN arrives on port 3000 (new connection)
  |               - A timer expires
  |               - A signal arrives
  |
  v
Server is ready and accepting connections.

Total startup time (typical):
  V8 initialization:      ~50ms
  Module loading:          ~100ms
  RecommenderService load: ~1-3s (JSON parse of similarity index)
  TCP server bind:         ~1ms
  ---
  Total:                   ~1.2-3.2s
```

---

### 27.2 Request Processing Lifecycle

```
Phase 1: TCP Accept
  Kernel: SYN received -> SYN-ACK -> ACK -> connection moves to accept queue
  libuv: kevent() returns readable event on server fd
  Node.js: SYSCALL accept4(server_fd) -> client_fd
  Create Socket wrapper -> emit 'connection' event on http.Server

Phase 2: HTTP Parsing (streaming)
  Node.js: client_fd registered with kqueue for READ events
  Data arrives in TCP recv buffer -> kevent() fires
  SYSCALL read(client_fd, buffer, 64KB) -> raw bytes
  llhttp.execute(buffer):
    -> Parse method, URL, HTTP version
    -> Parse headers (one by one as bytes arrive)
    -> Detect end of headers (CRLF CRLF)
    -> Emit 'request' event: (IncomingMessage, ServerResponse)

Phase 3: Express Middleware Chain
  app.handle(req, res):
    Layer 0: cors()           -> Set CORS headers, call next()
    Layer 1: express.json()   -> If POST: accumulate body chunks, JSON.parse, call next()
                              -> If GET: call next() immediately (no body)
    Layer 2: router.match()   -> Match URL to route, extract params
    Layer 3: validate()       -> Zod validation, call next() on success
    Layer 4: handler()        -> Execute route logic

Phase 4: Service Execution (async)
  await steamService.getOwnedGames(steamId)
    -> axios.get() -> TLS -> TCP -> Steam API -> response
    -> await suspends handler
    -> Event loop processes other requests while waiting
    -> Steam API responds -> Promise resolves -> handler resumes

Phase 5: Response Serialization
  res.json(data):
    -> JSON.stringify(data) -> string
    -> Set Content-Type, Content-Length headers
    -> res.end(body)
    -> Node.js: construct HTTP response bytes
    -> SYSCALL writev(client_fd, iov, 2) -> kernel TCP send buffer
    -> TCP: segment into MSS-sized packets -> transmit

Phase 6: Cleanup
  Request objects (req, res) become unreferenced
  Next Scavenge GC: collected from NewSpace (~1-5ms later)
  TCP connection: kept alive for potential next request (Keep-Alive)
  After idle timeout (5s): socket.destroy() -> close(client_fd) -> TIME_WAIT
```

---

## 28. TCP Connection State Machine

### 28.1 Full State Diagram

```
                              CLOSED
                                |
            passive open:       |        active open:
            listen()            |        connect()
                |               |             |
                v               |             v
              LISTEN            |         SYN_SENT
                |               |             |
    recv SYN    |               |             | recv SYN-ACK
    send SYN-ACK|               |             | send ACK
                v               |             v
            SYN_RCVD ------+   |    +---> ESTABLISHED
                |          |   |    |         |
                | recv ACK |   |    |         |
                +----------+---+----+         |
                                              |
                     active close:            |        passive close:
                     close()                  |        recv FIN
                     send FIN                 |        send ACK
                        |                     |            |
                        v                     |            v
                   FIN_WAIT_1                 |       CLOSE_WAIT
                        |                     |            |
           recv ACK     |     recv FIN+ACK    |            | close()
                        |     send ACK        |            | send FIN
                        v          |          |            v
                   FIN_WAIT_2      |          |        LAST_ACK
                        |          |          |            |
           recv FIN     |          |          |            | recv ACK
           send ACK     |          |          |            |
                        v          v          |            v
                     TIME_WAIT               |          CLOSED
                        |                     |
                    2*MSL timeout              |
                    (60s on macOS)             |
                        |                     |
                        v                     |
                      CLOSED -----------------+
```

### 28.2 States Encountered by the Backend

**Server-side (Express listening on port 3000)**:
```
LISTEN           -> app.listen(3000): server socket waiting for connections
SYN_RCVD         -> Client SYN received, SYN-ACK sent, awaiting ACK
ESTABLISHED      -> 3-way handshake complete, HTTP requests flow
CLOSE_WAIT       -> Client sent FIN (browser closed tab), server hasn't closed yet
LAST_ACK         -> Server called close(), sent FIN, awaiting client's ACK
TIME_WAIT        -> Final ACK sent, waiting 60s before port reuse
```

**Client-side (Axios to Steam API)**:
```
SYN_SENT         -> connect() called, SYN sent to api.steampowered.com:443
ESTABLISHED      -> Handshake complete, TLS negotiation begins
FIN_WAIT_1       -> Request complete, close() called, FIN sent
FIN_WAIT_2       -> ACK received for our FIN, awaiting server's FIN
TIME_WAIT        -> Server's FIN received, ACK sent, 60s wait
```

### 28.3 Observing TCP States

```bash
# Count TCP connections by state for the Node.js process:
netstat -anp tcp | grep 3000 | awk '{print $6}' | sort | uniq -c

# Typical output during load:
#   12 ESTABLISHED    (active client connections)
#    3 TIME_WAIT      (recently closed connections)
#    1 LISTEN         (server socket)
#    2 CLOSE_WAIT     (client disconnected, server hasn't cleaned up)
```

---

## 29. TLS Session Lifecycle

### 29.1 Full TLS 1.3 Handshake

Every HTTPS request from Axios to Steam's API goes through this:

```
Client (Node.js)                         Server (api.steampowered.com)
      |                                         |
      |--- ClientHello ----------------------->|    1 RTT
      |   - Supported cipher suites             |
      |   - Key share (ECDHE public key)        |
      |   - SNI: api.steampowered.com           |
      |   - Supported TLS versions: [1.3, 1.2]  |
      |                                         |
      |<-- ServerHello -------------------------|
      |   - Selected cipher: TLS_AES_256_GCM_SHA384
      |   - Server's key share (ECDHE public key)
      |   - Session ticket (for resumption)     |
      |                                         |
      |<-- EncryptedExtensions -----------------|    (encrypted from here)
      |<-- Certificate -------------------------|
      |   - api.steampowered.com certificate    |
      |   - Certificate chain (intermediate CA) |
      |                                         |
      |<-- CertificateVerify -------------------|
      |   - Server's signature (proves key ownership)
      |                                         |
      |<-- Finished ----------------------------|    Server done
      |                                         |
      |  Client verifies:                       |
      |  1. Certificate chain to trusted root CA|
      |  2. Certificate validity dates          |
      |  3. SNI matches certificate CN/SAN      |
      |  4. Signature verification (ECDSA)      |
      |                                         |
      |--- Finished --------------------------->|    2 RTT total
      |                                         |
      |  Both sides derive session keys:        |
      |  ECDHE shared secret -> HKDF -> 4 keys: |
      |    client_write_key (AES-256)           |
      |    server_write_key (AES-256)           |
      |    client_write_iv  (12 bytes)          |
      |    server_write_iv  (12 bytes)          |
      |                                         |
      |=== Encrypted Application Data =========>|    HTTP request
      |<== Encrypted Application Data ==========|    HTTP response
```

### 29.2 TLS Session Resumption (0-RTT)

After the first handshake, the server sends a **session ticket**. On the next connection:

```
Client                                    Server
  |                                         |
  |--- ClientHello + early_data ----------->|    0 RTT overhead!
  |   - Pre-shared key (from session ticket)|
  |   - Early data: GET /IPlayerService/... |  (sent BEFORE handshake completes)
  |                                         |
  |<-- ServerHello + Finished --------------|
  |                                         |
  |=== Application Data ===================>|
```

**Security trade-off**: 0-RTT data is vulnerable to **replay attacks**. An attacker can capture and resend the 0-RTT data. Safe for GET requests (idempotent), unsafe for POST (state-changing).

**Axios with `keep​Alive: true`**: The TLS session stays active on the persistent TCP connection. No re-handshake needed for subsequent requests on the same socket. TLS resumption only matters when a new TCP connection is opened.

### 29.3 TLS Record Layer

After the handshake, all data flows as TLS records:

```
TLS Record Structure:
  +------------------+
  | Content Type (1B)| 0x17 = Application Data
  | Version (2B)     | 0x0303 = TLS 1.2 (wire compat, actual is 1.3)
  | Length (2B)      | Payload length (max 16384 = 16KB)
  +------------------+
  | Encrypted Data   | AES-256-GCM ciphertext
  |  (variable)      | Includes 16-byte authentication tag (AEAD)
  +------------------+

Per-record overhead:
  Header: 5 bytes
  IV: 8 bytes (explicit, per-record)
  Auth tag: 16 bytes (GCM MAC)
  Total: 29 bytes per record

  For a 1000-byte HTTP request body:
    Plaintext: 1000 bytes
    TLS record: 1000 + 29 = 1029 bytes (2.9% overhead)
    TCP segment: 1029 + 20 (TCP) + 20 (IP) = 1069 bytes
```

---

## 30. V8 Object Lifecycle -- Allocation to Collection

### 30.1 Object Allocation

```typescript
const game = { appId: 730, name: 'CS2', score: 0.85 };
```

**V8 internal steps**:

```
Step 1: Hidden Class Lookup
  V8 checks if this object shape {appId, name, score} has been seen before.
  If yes: reuse existing Map (hidden class)
  If no:  create transition chain: C0{} -> C1{appId} -> C2{appId,name} -> C3{appId,name,score}

Step 2: Memory Allocation (NewSpace)
  Bump allocator: allocationPointer += objectSize
  
  NewSpace layout:
  +----------------------------------------------------+
  | [Header][appId:730][name:ptr][score:0.85] |  ...   |
  +----------------------------------------------------+
  ^                                           ^
  allocationTop                       allocationPointer
  
  Object header (8 bytes on 64-bit):
    - Map pointer (4 bytes, compressed) -> hidden class
    - Hash/instance size (4 bytes)
  
  Properties (in-object, up to 4):
    - appId: 730 (Smi = Small Integer, tagged, stored inline)
    - name: pointer to SeqOneByteString 'CS2' (3 bytes + header)
    - score: 0.85 (HeapNumber, boxed double, 16 bytes on heap)
  
  Total object size: 8 (header) + 4 (Smi) + 8 (pointer) + 8 (pointer) = 28 bytes
  Aligned to 8 bytes: 32 bytes

Step 3: Write Barrier
  If any property points to an OldSpace object (e.g., a cached string):
    V8 records this cross-generation pointer in the remembered set
    This ensures the old object is scanned during Scavenge GC
```

### 30.2 Small Integer (Smi) Optimization

V8 uses **tagged pointers** to avoid boxing small integers:

```
Pointer tagging (64-bit, pointer compression enabled):
  Pointers:  aligned to 4 bytes, so lowest 2 bits are always 00
  Smi:       lowest bit set to 0, value shifted left by 1
  
  Value 730:
    Smi representation: 730 << 1 = 1460 = 0x000005B4
    Stored directly in the object slot (no heap allocation!)
    
  Value 0.85:
    Cannot be Smi (not an integer)
    Allocated as HeapNumber: separate 16-byte heap object
    Object slot contains pointer to HeapNumber
```

**Performance implication**: `app​Id` (integer) is stored as Smi (inline, no GC pressure). `score` (float) requires a HeapNumber allocation (16 bytes, GC tracked). In loops processing thousands of `Similar​Game` objects, the HeapNumber allocations for `similarity` float values contribute to NewSpace fill rate and GC frequency.

### 30.3 Object Promotion -- NewSpace to OldSpace

```
Scavenge GC #1:
  game object is alive (still referenced)
  Copy from Semi-space A to Semi-space B
  Mark as "survived 1 GC"

Scavenge GC #2:
  game object is alive
  Already survived 1 GC -> PROMOTE to OldSpace
  Copy from Semi-space B to OldSpace
  Object is now tenured: only collected by Major GC (much less frequent)

Scavenge GC #3+:
  game is in OldSpace, not scanned by Scavenge
  Only Major GC (Mark-Sweep-Compact) can collect it
```

**In the backend**: The `similarity​Index` Map and its 540,000+ `Similar​Game` objects are promoted to OldSpace during startup (they survive the first 2 GC cycles during `load​Data()`). They become immortal residents of OldSpace, consuming ~50MB permanently but causing zero GC overhead during steady-state operation.

### 30.4 Object Finalization -- When Objects Die

```
When game is no longer referenced:

Major GC (Mark-Sweep-Compact):
  Mark Phase:
    1. Start from GC roots:
       - Global object (window/globalThis)
       - Stack frames (all active closures and locals)
       - Persistent handles (C++ pointers to V8 objects)
    2. Traverse reachable objects (breadth-first marking)
    3. game object is NOT reached -> unmarked -> dead

  Sweep Phase:
    4. Scan OldSpace linearly
    5. Unmarked objects: add their memory to free list
    6. game's 32 bytes: returned to OldSpace free list
    7. game's HeapNumber (score): 16 bytes returned to free list

  Compact Phase (optional, if fragmentation > threshold):
    8. Move surviving objects to eliminate holes
    9. Update all pointers to moved objects
    10. This is the most expensive phase: O(live_objects)

No destructor/finalizer runs. V8 objects do not have destructors.
Memory is simply reclaimed by zeroing and adding to the free list.
```

---

## 31. Stream & Backpressure Mechanics

### 31.1 Node.js Stream Types

The backend interacts with streams at multiple levels:

```
Readable Streams:
  - HTTP IncomingMessage (req)     -> Request body chunks
  - fs.createReadStream()         -> File data chunks (not used; readFileSync used instead)
  - net.Socket                    -> Raw TCP data

Writable Streams:
  - HTTP ServerResponse (res)     -> Response body
  - net.Socket                    -> Raw TCP data

Transform Streams:
  - zlib.createGzip()             -> Compression (not used in backend)

Duplex Streams:
  - net.Socket                    -> TCP is bidirectional
  - TLS socket (tls.TLSSocket)   -> Encrypted bidirectional
```

### 31.2 Backpressure -- When the Consumer Can't Keep Up

```
Scenario: Server sends a 5MB JSON response to a slow client (mobile on 3G):

Without backpressure awareness:
  res.write(chunk1)  ->  kernel TCP send buffer: [chunk1 ----]
  res.write(chunk2)  ->  kernel TCP send buffer: [chunk1-chunk2]
  res.write(chunk3)  ->  kernel TCP send buffer: FULL
                         write() returns false (backpressure signal!)
  
  If we ignore the false return and keep writing:
    Node.js buffers in userspace -> memory grows unboundedly
    10 slow clients * 5MB each = 50MB of buffered data
    100 slow clients = 500MB -> process OOM kill

With backpressure handling:
  res.write(chunk) returns false?
    -> Stop producing data
    -> Wait for 'drain' event on the stream
    -> 'drain' fires when kernel send buffer has space
    -> Resume writing

  res.json() handles this internally:
    1. Constructs the full response body as a string
    2. Calls res.end(body) which calls socket.write(body)
    3. If body is small (< 16KB): written in one syscall
    4. If body is large: Node.js internally chunks and respects backpressure
```

### 31.3 Pipe Mechanics

`stream.​pipe(destination)` is syntactic sugar for:

```javascript
source.on('data', (chunk) => {
  const canContinue = destination.write(chunk);
  if (!canContinue) {
    source.pause();   // Stop reading from source (remove fd from kqueue)
  }
});

destination.on('drain', () => {
  source.resume();    // Re-register fd with kqueue, resume reading
});

source.on('end', () => {
  destination.end();  // Signal end of data
});

source.on('error', (err) => {
  destination.destroy(err);  // Propagate error
});
```

**In the backend**: Pipes are not used explicitly, but the HTTP server internally pipes the TCP socket (Readable) through the HTTP parser and pipes the response through the TCP socket (Writable). The TLS layer wraps this with encryption/decryption Transform streams.

---

## 32. Timer Internals -- `set​Timeout` and `set​Interval`

### 32.1 Timer Heap Data Structure

Node.js stores timers in a **min-heap** (priority queue) sorted by expiration time:

```
Timer Heap (binary min-heap):
                [expires: 100ms]
               /               \
    [expires: 250ms]     [expires: 300ms]
    /           \
[expires: 500ms] [expires: 1000ms]

Properties:
  - Insert: O(log n) -- bubble up
  - Extract-min: O(log n) -- remove root, heapify
  - Peek-min: O(1) -- read root

When the event loop reaches the TIMERS phase:
  now = uv_hrtime()  // High-resolution clock (nanosecond precision)
  while (heap.peek().expires <= now) {
    timer = heap.extractMin()
    timer.callback()          // Execute the timer callback
    if (timer.repeat > 0) {   // setInterval: re-insert with new expiry
      timer.expires = now + timer.repeat
      heap.insert(timer)
    }
  }
```

### 32.2 Timer Precision and Drift

```javascript
setTimeout(callback, 100)  // "Execute after approximately 100ms"
```

**Why "approximately"**:
1. Timer check only runs in the TIMERS phase of the event loop
2. If POLL phase is handling I/O for 50ms, the timer callback is delayed by 50ms
3. Minimum precision: ~1ms (libuv clamps to 1ms minimum)
4. Actual precision depends on event loop busy-ness

```
Ideal:   |----100ms----|callback|
Reality: |----100ms----|--50ms I/O--|callback|  (150ms actual delay)
```

**`set​Interval` drift accumulation**:
```javascript
setInterval(callback, 1000)  // Intended: fire every 1000ms

Without drift correction:
  t=0:     fire (scheduled for t=1000)
  t=1005:  fire (5ms late, scheduled for t=2000)
  t=2008:  fire (8ms late, scheduled for t=3000)
  t=3015:  fire (15ms late) -- drift accumulates!

Node.js mitigation:
  setInterval schedules based on the ORIGINAL start time, not the actual fire time:
  t=0:     fire (next: t=1000)
  t=1005:  fire (next: t=2000, NOT t=2005)
  t=2008:  fire (next: t=3000, NOT t=3008)
  This prevents drift accumulation.
```

**In the backend**: `idle​Timeout​Millis` in pg.Pool uses `set​Timeout` to close idle database connections. Timer imprecision means connections may live 1-50ms longer than configured, which is negligible.

---

## 33. Module System Deep-Dive -- CommonJS vs ESM

### 33.1 CommonJS (Backend's Module System)

The TypeScript compiler outputs CommonJS (`"module": "commonjs"` in `tsconfig.​json`):

```typescript
// TypeScript source:
import { config } from './config';
export function getPort(): number { return config.port; }

// Compiled to CommonJS:
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
function getPort() { return config_1.config.port; }
exports.getPort = getPort;
```

**`require()` execution mechanics**:

```
require('./config')
  |
  v
Module._resolveFilename('./config', parentModule)
  Try: ./config.js     -> EXISTS? yes -> resolved
  Try: ./config.json   -> (only if .js not found)
  Try: ./config/index.js -> (only if .js not found)
  |
  v
Module._cache[resolvedPath]
  EXISTS? -> return cached exports (O(1) hash lookup)
  NOT EXISTS? -> continue to load
  |
  v
Module._load(resolvedPath)
  module = new Module(resolvedPath)
  Module._cache[resolvedPath] = module  // Cache BEFORE execution (handles circular deps)
  |
  v
module._compile(source, filename)
  // Wrap in function:
  wrapper = '(function(exports, require, module, __filename, __dirname) {\n'
           + source
           + '\n});'
  
  // V8 compile + execute:
  fn = v8::Script::Compile(wrapper)
  fn(module.exports, require, module, filename, dirname)
  
  // After execution, module.exports contains the exported values
  return module.exports
```

**The `module.​exports` vs `exports` distinction**:

```javascript
// Inside the wrapper function:
exports === module.exports  // true (they start as the same object)

// This works (adding properties to the shared object):
exports.foo = 'bar';
// module.exports is now { foo: 'bar' }

// This BREAKS the link (exports is reassigned, module.exports is not):
exports = { foo: 'bar' };
// module.exports is still {}!  (require() returns module.exports, not exports)

// The correct way to replace the entire export:
module.exports = { foo: 'bar' };
```

### 33.2 ESM (Not Used, but Relevant for Future Migration)

ES Modules use a different execution model:

```
import { config } from './config.js';
  |
  v
Phase 1: Parsing (static analysis, no execution)
  Parse all import/export declarations
  Build a Module Record containing:
    - importEntries: [{module: './config.js', importName: 'config', localName: 'config'}]
    - exportEntries: [{exportName: 'getPort', localName: 'getPort'}]
  
Phase 2: Instantiation (link bindings)
  For each import:
    Create a LIVE BINDING to the export in the source module
    This is NOT a copy -- it's a pointer to the original variable
    If the source module updates its export, the import sees the new value

Phase 3: Evaluation (execute module code)
  Execute the module body
  Exports become available through the live bindings
```

**Key difference from CommonJS**:
- CommonJS: `require()` returns a **copy** of `module.​exports` at the time of the call
- ESM: `import` creates a **live binding** that always reflects the current value

---

## 34. TypeScript Compilation Pipeline -- Deep Mechanics

### 34.1 `tsc` Internal Phases

```
Source File (.ts)
  |
  v
Phase 1: Scanner (Lexer)
  Converts source bytes into tokens:
    "const x: number = 5;" -> [const, x, :, number, =, 5, ;]
  
  Token types: Keyword, Identifier, NumericLiteral, StringLiteral,
               Punctuation, Operator, Whitespace, Comment
  
  Performance: O(n) single pass, ~500MB/s throughput

Phase 2: Parser
  Tokens -> Abstract Syntax Tree (AST):
    VariableStatement
      VariableDeclarationList (const)
        VariableDeclaration
          name: Identifier "x"
          type: TypeReference "number"
          initializer: NumericLiteral 5
  
  TypeScript's parser is a recursive descent parser with
  unlimited lookahead (needed for JSX, generics, arrow functions)

Phase 3: Binder
  Walk the AST, create Symbols and assign them to nodes:
    Symbol "x": {
      name: "x",
      flags: BlockScopedVariable,
      declarations: [VariableDeclaration node],
      valueDeclaration: VariableDeclaration node,
      type: undefined (resolved in checker)
    }
  
  Build scope chain (LexicalEnvironment):
    Module scope -> Function scope -> Block scope
    Each has a symbol table (Map<string, Symbol>)

Phase 4: Checker (Type Checking)
  The most complex phase (~50% of tsc codebase):
    
    For each expression, compute its type:
      NumericLiteral 5 -> type: number
      Identifier x    -> lookup symbol -> declared type: number
      Assignment x = 5 -> check: isAssignableTo(number, number) -> OK
    
    Type inference:
      const arr = [1, 2, 3] -> type: number[] (inferred from elements)
      
    Generic instantiation:
      query<Game>(sql, params) -> T = Game
        -> return type: Promise<QueryResult<Game>>
        -> result.rows[0] has type Game
    
    Structural type compatibility:
      interface A { x: number }
      interface B { x: number; y: string }
      B is assignable to A (B has all properties of A)
      A is NOT assignable to B (A is missing y)

Phase 5: Emitter
  AST -> JavaScript output (.js) + Declaration output (.d.ts) + Source map (.js.map)
    
  Transformations:
    - Strip all type annotations
    - Strip interfaces and type aliases
    - Convert enum to object literal
    - Downlevel async/await if target < ES2017
    - Convert import/export to require/module.exports (CommonJS target)
    - Generate __esModule marker
    
  Output: pure JavaScript that V8 can execute
```

### 34.2 Source Maps -- Debugging Compiled Code

The `.​js.​map` files allow debuggers and stack traces to map compiled JS back to TypeScript:

```
Source map structure:
{
  "version": 3,
  "file": "steam.service.js",
  "sourceRoot": "",
  "sources": ["../src/services/steam.service.ts"],
  "mappings": "AAAA,OAAO,EAAE,MAAM,EAAE,..."  // VLQ-encoded position mappings
}

VLQ encoding maps:
  Generated line 85, column 12 -> Original line 142, column 8 in steam.service.ts
  Generated line 85, column 20 -> Original line 142, column 16 in steam.service.ts
```

When `Error.​capture​Stack​Trace` generates a stack trace, Node.js reads the source map (if `-​-​enable-​source-​maps` flag) and translates compiled JS positions back to TypeScript line numbers. This is why stack traces in development show `.​ts` file references despite V8 executing `.​js` files.

---

## 35. npm Package Resolution & `node_​modules` Structure

### 35.1 Dependency Resolution Algorithm

```
npm install:
  |
  v
Phase 1: Build dependency tree
  Read package.json -> { express: "^4.18.0", cors: "^2.8.5", ... }
  
  For each dependency:
    Query npm registry: GET https://registry.npmjs.org/express
    Get version list -> find highest satisfying version for "^4.18.0"
      ^4.18.0 means: >= 4.18.0 AND < 5.0.0
      Latest: 4.21.2 -> resolved
    
    Read express@4.21.2 package.json -> subdependencies:
      { "accepts": "~1.3.8", "body-parser": "1.20.3", ... }
    
    Recurse for each subdependency

Phase 2: Flatten (hoist)
  npm v3+ flattens the dependency tree:
  
  Instead of:
    node_modules/
      express/
        node_modules/
          body-parser/
            node_modules/
              raw-body/   <- deeply nested!

  Hoisted to:
    node_modules/
      express/
      body-parser/        <- hoisted to top level
      raw-body/           <- hoisted to top level
  
  Conflict resolution: if two packages need different versions of the same dependency,
  the conflicting version stays nested:
    node_modules/
      lodash@4.17.21/     <- version needed by most packages
      some-package/
        node_modules/
          lodash@3.10.1/  <- different version needed by some-package

Phase 3: Install
  Download tarballs from registry
  Extract to node_modules/
  Run postinstall scripts (if any)
  Generate package-lock.json (exact versions, integrity hashes)
```

### 35.2 `package-​lock.​json` -- Reproducible Builds

```json
{
  "node_modules/express": {
    "version": "4.21.2",
    "resolved": "https://registry.npmjs.org/express/-/express-4.21.2.tgz",
    "integrity": "sha512-28HqgMZAmih1Czt9ny7qr6ek...",
    "dependencies": {
      "body-parser": "1.20.3",
      "cors": "2.8.5"
    }
  }
}
```

**`integrity` field**: A Subresource Integrity (SRI) hash. npm verifies the SHA-512 hash of the downloaded tarball matches this value. If a malicious actor modifies the package on the registry, the hash mismatch causes `npm install` to fail.

---

## 36. Concurrency Model -- How Node.js Handles Multiple Requests

### 36.1 Single-Thread Request Multiplexing

```
Common misconception: "Node.js can only handle one request at a time"
Reality: Node.js handles thousands of concurrent requests on ONE thread

How it works:

  Thread         Time ->
  Main    |--[req A: parse]--[req A: validate]--[req A: await DB]--... gap ...-[req A: respond]--|
          |                                                        |
          |                         [req B: parse]--[req B: validate]--[req B: await API]--...
          |                                                                              |
          |                                               [req C: parse]--[req C: respond]
          ^                                                        ^
          |                                                        |
     kqueue: "client A data ready"                            kqueue: "DB response ready"
                                                              kqueue: "client B data ready"
```

**The key insight**: When a request hits an `await` (DB query, HTTP request, file read), the function is SUSPENDED and the thread is FREE to process other requests. The event loop polls `kqueue()` for any I/O that has completed, then resumes the corresponding suspended function.

### 36.2 Throughput vs Latency

```
Synchronous (blocking) server model:
  1 thread per request
  1000 concurrent requests = 1000 threads
  Each thread: ~1MB stack + context switch overhead (~10us)
  Memory: 1000 * 1MB = 1GB
  Context switches: 1000 threads * 10us = 10ms overhead per cycle

Node.js (event-driven) model:
  1 thread for ALL requests
  1000 concurrent requests = 1000 Promise states on heap
  Each Promise state: ~200 bytes
  Memory: 1000 * 200B = 200KB (5000x less!)
  No context switches (single thread)

Trade-off:
  Latency per request: slightly higher in Node.js (event loop overhead ~0.1ms)
  Throughput: much higher in Node.js (no thread management overhead)
  CPU-bound work: catastrophic in Node.js (blocks all requests)
```

### 36.3 The Thread Pool (libuv Worker Threads)

Some operations CANNOT be made non-blocking at the kernel level. For these, libuv uses a **thread pool** (default 4 threads):

```
Operations using the thread pool:
  - DNS lookups (dns.lookup -> getaddrinfo)
  - File system operations (fs.readFile, fs.stat)
  - Crypto operations (crypto.pbkdf2, crypto.randomBytes)
  - Zlib compression (zlib.deflate)

NOT using the thread pool (kernel-level async):
  - TCP/UDP networking (kqueue/epoll)
  - Timers (internal to libuv)
  - Child processes (fork/exec)
  
Thread pool execution:
  Main thread: fs.readFile(path, callback)
    -> Post work item to thread pool queue
    -> Main thread returns immediately (not blocked)
    
  Thread pool worker (thread 1 of 4):
    -> Dequeue work item
    -> SYSCALL: open(path) -> read(fd, buf, size) -> close(fd)
    -> Post completion event to main thread's event loop
    
  Main thread (on next POLL phase):
    -> Process completion event
    -> Execute callback(err, data)

Pool exhaustion:
  If all 4 threads are busy (e.g., 4 concurrent DNS lookups):
    Thread 5+ work items QUEUE until a thread is free
    
  Increase pool size:
    UV_THREADPOOL_SIZE=16 node index.js  (max 1024)
```

**In the backend**: The `load​Data()` method uses `fs.​read​File​Sync()` (synchronous, BLOCKS the main thread). If changed to `fs.​read​File()` (async), it would use the thread pool instead, allowing the server to start accepting connections before the similarity index is fully loaded.
