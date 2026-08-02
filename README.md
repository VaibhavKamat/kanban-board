# Kanban Board

A single-user project management app with a drag-and-drop Kanban board and an AI chat sidebar that can create, edit, and move cards on your behalf. Built as a Docker-packaged MVP: Next.js frontend, FastAPI backend, SQLite storage, and Claude for the AI chat.

## Features

- Sign in, or create an account (username, email, password), then view a Kanban board with 5 fixed, renamable columns (Backlog, To Do, In Progress, Review, Done)
- Create, edit, delete, and drag-and-drop cards between columns
- AI chat sidebar that can create/edit/move cards through natural language requests
- All data persists in SQLite across restarts

## Tech stack

- Frontend: Next.js (App Router, TypeScript, Tailwind CSS), statically exported
- Backend: Python, FastAPI, serves the static frontend and the API from one process
- Database: SQLite
- AI: Anthropic API (Claude)
- Packaging: single Docker container

## Prerequisites

- Docker
- An Anthropic API key (for the AI chat feature)

## Setup

1. Clone the repo.
2. Create a `.env` file in the project root with your Anthropic API key:

   ```
   ANTHROPIC_API_KEY=your-api-key-here
   ```

## Running the app

From the project root:

**macOS / Linux**

```
./scripts/start.sh
```

**Windows (PowerShell)**

```
./scripts/start.ps1
```

This builds the Docker image and runs the container, with data persisted in a `kanban-data` Docker volume across restarts. The app is available at [http://localhost:8000](http://localhost:8000).

Sign in with the seeded demo account:

- Username: `user`
- Password: `password`

Or create your own account from the sign-in page ("Don't have an account? Sign up") with a username, email, and password (minimum 8 characters). Signing up only creates the account - you're returned to the sign-in page to log in with your new credentials. Each account gets its own private board.

To stop the app:

```
./scripts/stop.sh      # macOS / Linux
./scripts/stop.ps1     # Windows
```

## Development

To work on the frontend and backend directly instead of via Docker:

**Backend**

```
cd backend
pip install -r requirements-dev.txt
uvicorn main:app --reload
```

**Frontend**

```
cd frontend
npm install
npm run dev
```

The frontend dev server has no API proxy, so board data will only load when served through the FastAPI backend (`npm run build`, then run the backend, which serves `frontend/out/`).

Run tests with `pytest` in `backend/` and `npm test` in `frontend/`.
