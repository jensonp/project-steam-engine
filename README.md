# Project Steam Engine

A web-based [Steam](https://store.steampowered.com/) games recommendation software that takes into account of the user's own game library.

<img width="500" alt="image" src="https://github.com/user-attachments/assets/afe6df2b-56db-4704-839b-29d98b588f38" />


## Technologies

This project is using modern day web technologies seen in bigger development. The developers of this project has no prior knowledge to these frameworks and software prior to the start of development, so everything are done on a best effort basis from everyone involved :heart:

For the front-end user interface, we used [Angular 21](https://angular.dev/). It was developed using TypeScript, HTML, and CSS.

The back-end are ran on [Node.js](https://nodejs.org/en) and [Express.js](https://en.wikipedia.org/wiki/Express.js). All codes are written in JavaScript. For data storage, we used PostgreSQL

Retrieval of user's data are done with the [Steam Web API](https://steamcommunity.com/dev/).

## Running the software

### Quick start with Docker (recommended)

Prerequisites:
- Docker Desktop (or Docker Engine + Docker Compose)

Run everything (frontend + backend + Postgres):

```bash
docker compose up --build
```

Open:
- Frontend: `http://localhost:4200`
- Backend health check: `http://localhost:3000/api/health`

Stop everything:

```bash
docker compose down
```

If you also want to remove Postgres volume data:

```bash
docker compose down -v
```

Notes:
- The backend container uses `PGHOST=db` and connects to the Postgres service in `docker-compose.yml`.
- On first run with an empty DB volume, the backend now auto-creates a starter `games` table and seeds a local sample catalog so `/api/search` works immediately.
- If you already have an old/empty Postgres volume, reset once with `docker compose down -v` and then re-run `docker compose up --build`.
- To use Steam API endpoints, set `STEAM_API_KEY` in your shell or `.env` before `docker compose up`.

### UI quality checks (terminal)

The project includes visual guardrails to catch UI regressions like overlapping controls:

- Existing checks (off-the-shelf):
  - Playwright visual snapshot diffs.
  - Axe serious/critical accessibility checks.
- Custom checks:
  - Layout overlap detection on key controls.
  - Panel-bound checks (controls escaping container).
  - Button label clipping and viewport overflow checks.

Run checks:

```bash
bash scripts/ui-check.sh
```

Update visual baselines intentionally:

```bash
bash scripts/ui-check.sh --update
```

## CI/CD

GitHub Actions CI is configured in `.github/workflows/ci.yml`.

On every push/PR to `main`, it runs:
- Backend install + tests + build
- Frontend install + tests + build
- `docker compose build` to validate container builds

## Local development

### Prerequisites

In order to run our web application, you need to have the following software installed on your system. All are cross-platform
- npm
- Angular CLI
- Node.js
- PostgreSQL Server
- Python

### Running the front-end

Beforehand, run `npm install` on the front-end directory to install all dependencies automatically. To then start the front-end interface, run the following command within the front-end root directory:

```bash
ng serve –open
```

This will automatically open up a browser tab showing the UI. It will be running on port 4200 on your localhost. You can also interact with the UI without the back-end, but the recommendation system won’t work.

### Running the back-end & database

Similar to the front-end, run `npm install` on the back-end directory for the dependencies. To run the core back-end code, run the following command within the back-end root directory:

```bash
npm start
```

You must also configure the database name, user, and host of PostgreSQL in the backend/src/.env file.

### Using the software

In the configuration page, provide your account Steam ID as well as the [API Key](https://steamcommunity.com/dev/). Then, click on the button to build the storefront index (or you may also run the games_to_db.py in the backend folder manually as well). All of these needs to be done before querying the recommendation
