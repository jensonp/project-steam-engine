# Official Documentation & Learning Resources

## 🚀 LESSON-SPECIFIC READING LIST (Start Here)

| File                    | Read These Pages (In Order)                                                                                                                                                                                                                                                          | Why?                                                                                                             |
| :---------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| **01_hello_express.js** | 1. [Express "Hello World"](https://expressjs.com/en/starter/hello-world.html)<br>2. [Basic Routing](https://expressjs.com/en/starter/basic-routing.html)<br>3. [req.query](https://expressjs.com/en/api.html#req.query) & [req.params](https://expressjs.com/en/api.html#req.params) | Explains `app.get()`, routing, and how to get data from URLs (`?q=...` or `/games/:id`).                         |
| **02_db_connection.js** | 1. [node-postgres: Connecting](https://node-postgres.com/features/connecting)<br>2. [node-postgres: Queries](https://node-postgres.com/features/queries)                                                                                                                             | Explains `new Pool()`, `pool.query()`, and crucially: **Parameterized Queries** (`$1`, `$2`) to prevent hacking. |
| **03_search_api.js**    | 1. [PostgreSQL: Pattern Matching (ILIKE)](https://www.postgresql.org/docs/current/functions-matching.html#FUNCTIONS-LIKE)<br>2. [PostgreSQL: Full Text Search](https://www.postgresql.org/docs/current/textsearch-intro.html#TEXTSEARCH-MATCHING)                                    | Explains the `WHERE game_name ILIKE ...` and `@@ to_tsquery(...)` syntax used for search.                        |

---

## 📚 Broad Reference Documentation (Bookmark These)

### 1. Node.js (Runtime)

The core JavaScript runtime.

- **Official Docs:** [nodejs.org/docs](https://nodejs.org/en/docs/)
- **Key Guide:** [Node.js Architecture](https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick/) (Understanding the Event Loop is crucial for performance)

### 2. Express.js (Web Framework)

The standard framework for Node.js APIs.

- **Official Docs:** [expressjs.com](https://expressjs.com/)
- **Routing Guide:** [Basic Routing](https://expressjs.com/en/starter/basic-routing.html)
- **Middleware Guide:** [Writing Middleware](https://expressjs.com/en/guide/writing-middleware.html) (Important/Powerful concept!)

### 3. node-postgres (Database Driver)

The low-level driver we are using to connect Node.js to PostgreSQL.

- **Official Docs:** [node-postgres.com](https://node-postgres.com/)
- **Connecting:** [Async/Await Connection](https://node-postgres.com/features/connecting)
- **Queries:** [Parameterized Queries](https://node-postgres.com/features/queries) (CRITICAL for security/avoiding SQL injection)

### 4. PostgreSQL (Database)

- **Official Docs:** [postgresql.org/docs/current](https://www.postgresql.org/docs/current/)
- **Full Text Search:** [Text Search Types](https://www.postgresql.org/docs/current/textsearch.html) (For your content-based search)

## Recommended Tutorial Flow for You

Since you have a strong CS background (CS 121, 178, etc.), don't get stuck in "tutorial hell."

1.  **Read ONLY the specific guides linked above.** Don't read the whole documentation.
2.  **Run the learning scripts** I created (`01_hello_express.js`, etc.) to see code in action.
3.  **Experiment:** Modify the scripts. Break them. Fix them.
4.  **Reference the docs** only when you need to know "what other options does this function have?"
