# Official Documentation & Learning Resources

Here are the **authoritative** sources for the stack we are using. I recommend bookmarking these.

## 1. Node.js (Runtime)

The core JavaScript runtime.

- **Official Docs:** [nodejs.org/docs](https://nodejs.org/en/docs/)
- **Key Guide:** [Node.js Architecture](https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick/) (Understanding the Event Loop is crucial for performance)

## 2. Express.js (Web Framework)

The standard framework for Node.js APIs.

- **Official Docs:** [expressjs.com](https://expressjs.com/)
- **Routing Guide:** [Basic Routing](https://expressjs.com/en/starter/basic-routing.html)
- **Middleware Guide:** [Writing Middleware](https://expressjs.com/en/guide/writing-middleware.html) (Important/Powerful concept!)

## 3. node-postgres (Database Driver)

The low-level driver we are using to connect Node.js to PostgreSQL.

- **Official Docs:** [node-postgres.com](https://node-postgres.com/)
- **Connecting:** [Async/Await Connection](https://node-postgres.com/features/connecting)
- **Queries:** [Parameterized Queries](https://node-postgres.com/features/queries) (CRITICAL for security/avoiding SQL injection)

## 4. PostgreSQL (Database)

- **Official Docs:** [postgresql.org/docs/current](https://www.postgresql.org/docs/current/)
- **Full Text Search:** [Text Search Types](https://www.postgresql.org/docs/current/textsearch.html) (For your content-based search)

## Recommended Tutorial Flow for You

Since you have a strong CS background (CS 121, 178, etc.), don't get stuck in "tutorial hell."

1.  **Read ONLY the specific guides linked above.** Don't read the whole documentation.
2.  **Run the learning scripts** I created (`01_hello_express.js`, etc.) to see code in action.
3.  **Experiment:** Modify the scripts. Break them. Fix them.
4.  **Reference the docs** only when you need to know "what other options does this function have?"
