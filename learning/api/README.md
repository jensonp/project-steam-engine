# Node.js API Learning Path

## Prerequisites

- Node.js installed
- PostgreSQL running with `steam_collab` database

## Lessons (Run in Order)

### Lesson 1: Basic Express Server

```bash
cd backend/api
node 01_hello_express.js
# Visit: http://localhost:3000
```

### Lesson 2: Connect to PostgreSQL

```bash
node 02_db_connection.js
```

### Lesson 3: Search API Endpoint

```bash
node 03_search_api.js
# Test: http://localhost:3000/api/search?q=survival
```

### Lesson 4: Full API (Production-Ready)

```bash
node server.js
```

## API Endpoints (Final)

| Method | Endpoint            | Description                  |
| ------ | ------------------- | ---------------------------- |
| GET    | `/api/search?q=...` | Search games by text         |
| GET    | `/api/games/:id`    | Get game details             |
| POST   | `/api/recommend`    | Get recommendations for user |
