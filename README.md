# Steam Game Recommendation System

A full-stack application for Steam game recommendations using Node.js/Express backend and Angular frontend.

## Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: Angular 17 + Angular Material + TypeScript
- **API**: Steam Web API

## Project Structure

```
├── backend/          # Node.js Express API
│   ├── src/
│   │   ├── routes/   # API endpoints
│   │   ├── services/ # Steam API client
│   │   └── types/    # TypeScript interfaces
│   └── package.json
│
├── frontend/         # Angular app
│   ├── src/app/
│   │   ├── components/
│   │   └── services/
│   └── package.json
│
└── .env              # Environment variables
```

## Setup

### 1. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your Steam API key
```

Get your API key at: https://steamcommunity.com/dev/apikey

### 2. Backend Setup

```bash
cd backend
npm install
npm run dev
```

Backend runs at http://localhost:3000

### 3. Frontend Setup

```bash
cd frontend
npm install
ng serve
```

Frontend runs at http://localhost:4200

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user/:steamId/library` | GET | Fetch user's owned games |
| `/api/user/:steamId/profile` | GET | Get user profile |
| `/api/game/:appId` | GET | Get game details |
| `/api/health` | GET | API health check |

## Development

Run both servers simultaneously:

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd frontend && ng serve
```

The Angular dev server proxies API requests to the backend automatically.
