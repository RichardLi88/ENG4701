# ENG4701

T3/Next.js application with Prisma and a local Postgres development database.

## Local development setup

1. Install prerequisites:
- Node.js 20+
- npm (project is configured for npm)
- Docker or Podman (for local Postgres)

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. If you are on Windows, check `./start-database.sh` first for Windows/WSL setup instructions.

5. Start the local database and LLVM service:
```bash
./start-database.sh
./start-llvm.sh
```
Notes:
- First run: creates the Postgres and LLVM containers.
- Later runs: use these scripts when you need to start the services again (for example after a restart).
- `./start-database.sh` exits without changes if the database container is already running.
- `./start-llvm.sh` rebuilds the image and removes/recreates the LLVM container if it already exists.
- The LLVM service runs on port 3001 by default (configurable via `LLVM_SERVICE_URL` in `.env`)

6. Apply Prisma schema to the database:
```bash
npm run db:push
```

7. Start the app:
```bash
npm run dev
```

8. Open:
```text
http://localhost:3000
```

## Useful commands

- `npm run dev` - start local dev server
- `npm run build` - production build
- `npm run start` - run production build
- `npm run lint` - run ESLint
- `npm run typecheck` - run TypeScript checks
- `npm run check` - lint + typecheck
- `npm run db:push` - push Prisma schema to DB
- `npm run db:migrate` - run deployed migrations
- `npm run db:studio` - open Prisma Studio

## Notes

- `DATABASE_URL` is defined in `.env.example` and should match your local Postgres container settings.
- `./start-database.sh` reads `.env` and creates/starts the database container automatically.
- Local Postgres installation is not required for development when using `./start-database.sh`; Postgres runs inside Docker/Podman.
