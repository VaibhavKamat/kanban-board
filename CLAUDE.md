# The Project Management MVP web app

## Business Requirements

This project is building a Project Management App. Key features:
- A user can sign in
- When signed in, the user sees a Kanban board representing their project
- The Kanban board has fixed columns that can be renamed
- The cards on the Kanban board can be moved with drag and drop, and edited
- There is an AI chat feature in a sidebar; the AI is able to create / edit / move one or more cards
- Each user has a private personal board, and can switch to shared "projects" (visible and editable by every signed-in user) via a dropdown under the board heading

## Limitations

Sign in supports both the seeded demo account (`user`/`password`) and self-service sign up (email, username, password) - the database supports multiple users.

Every user has exactly 1 private personal board. In addition, only the seeded demo account (`user`) can create shared projects; once created, a project is visible to and editable by every signed-in user. There is no project rename/delete and no per-card attribution.

For the MVP, this will run locally (in a docker container)

## Technical Decisions

- NextJS frontend
- Python FastAPI backend, including serving the static NextJS site at /
- Everything packaged into a Docker container
- Use Anthropic Dev for the AI calls. An ANTHROPIC_API_KEY is in .env in the project root
- Use SQLLite local database for the database, creating a new db if it doesn't exist
- Start and Stop server scripts for Mac, PC, Linux in scripts/

## Starting Point

The frontend does not exist yet. It will be scaffolded from scratch as a pure frontend-only demo (mock data, no backend calls) as part of docs/PLAN.md Part 3, then wired to the Docker setup and the real backend in later parts.

## Color Scheme

- Accent Yellow: `#ecad0a` - accent lines, highlights
- Blue Primary: `#209dd7` - links, key sections
- Purple Secondary: `#753991` - submit buttons, important actions
- Dark Navy: `#032147` - main headings
- Gray Text: `#888888` - supporting text, labels

## Coding standards

1. Use latest versions of libraries and idiomatic approaches as of today
2. Keep it simple - NEVER over-engineer, ALWAYS simplify, NO unnecessary defensive programming. No extra features - focus on simplicity.
3. Be concise. Keep README minimal. IMPORTANT: no emojis ever
4. When hitting issues, always identify root cause before trying a fix. Do not guess. Prove with evidence, then fix the root cause.

## Working documentation

All documents for planning and executing this project will be in the docs/ directory.
Please review the docs/PLAN.md document before proceeding.