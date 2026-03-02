# Steam Recommendation Engine Backend

This is the backend server for our Steam Recommendation Engine (CS 125). It provides data on Steam games, user libraries, and algorithmic recommendations using pre-processed TF-IDF and Cosine Similarity datasets.

## Prerequisites

To run this project, you will need:

- [Node.js](https://nodejs.org/) (v22+ recommended)
- [PostgreSQL](https://www.postgresql.org/) running locally
- A [Steam Web API Key](https://steamcommunity.com/dev/apikey) (You will need to use your own or get one from Jenson)

## 1. Environment Setup

The backend relies on environment variables for sensitive keys and database connections.
**Do not commit real passwords or API keys to GitHub.**

1. Copy the example environment file:
   ```bash
   cp src/.env.example src/.env
   ```
2. Open `src/.env` and replace the placeholder values with your actual Steam API Key and your local PostgreSQL credentials.

## 2. Install Dependencies

Install all required Node.js packages:

```bash
npm install
```

## 3. Database & Data Setup

Before the API will work fully, you must have the PostgreSQL database running and the data pipeline processed.

1. Ensure the `cs122_hw2` (or `steam_collab`) database exists in your local PostgreSQL instance and the `games` table is populated.
2. The recommendation engine requires vector data. If `data/processed/recommender` is empty, you must run the data pipeline scripts defined in the root of the UI project.

## 4. Running the Server

Start the development server with hot-reloading:

```bash
npm run dev
```

Alternatively, you can run the full monolithic launch script which boots both the backend and frontend simultaneously:

```bash
npm run dev:full
```

## 5. Automated Testing

To verify the installation works without manually hitting endpoints:

```bash
# Runs the internal Jest unit tests
npm run test

# Runs an end-to-end API smoke test (Requires server to be running)
npm run test:api
```

### Note on Database Ports

Jenson's local PostgreSQL instance runs on port `8080`. If your local PostgreSQL uses the standard port `5432` or `5433`, ensure you update `PGPORT=5432` inside your `src/.env` file. The backend and the testing scripts will automatically parse this value.
