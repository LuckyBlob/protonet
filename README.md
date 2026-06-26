# Protonet

Protonet is a Next.js browser game prototype backed by SQLite. Players can register and log in, load shared server state, manage planets, upgrade buildings, and build units from a single app that contains both the UI and the API routes.

## Project workflow

- The app runs locally with `next dev` on **http://localhost:3001**.
- Persistent game data lives in **`data/game.db`** and is ignored by git.
- A fresh database is created from **`db/schema.sql`** with `npm run db:init`.
- The initial world data is seeded with `npm run db:seed`.
- Schema changes for an existing local database are applied with `npm run db:migrate`.

## Developer quick start

```bash
npm install
mkdir -p data
npm run db:init
npm run db:seed
npm run dev
```

Then open **http://localhost:3001**.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server on port 3001. |
| `npm run build` | Build the production app. |
| `npm run start` | Run the production server on port 3000. |
| `npm run lint` | Run ESLint. |
| `npm run db:init` | Create a new local SQLite database from the base schema and register existing migrations as applied. |
| `npm run db:migrate` | Apply new SQL migrations to an existing local database and create a backup first. |
| `npm run db:migrateData` | Run the one-off data transfer/migrateData script in `db/migrateData.ts`. |

## Notes for contributors

- If you clone the repo fresh, create the `data/` directory before running database commands.
- If you already have a local database and pull schema changes, run `npm run db:migrate` instead of `npm run db:init`.
- If you need to reset your local game state, delete `data/game.db`, rerun `npm run db:init`, then rerun `npm run db:seed`.
"" 
 
 
"" 
  git add README.md git commit -m "test deploy restart" git push origin main
 
 
 
 
 
