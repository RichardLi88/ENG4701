# ENG4701

Compiler optimisation and program reduction visualiser built with Next.js, tRPC and Prisma. Local development uses PostgreSQL and a Docker-based LLVM service. Optional AI explanations use `gpt-5.6-luna` with trace + knowledge + grounding.

## Prerequisites

- Node.js **24.x** and npm **11.x** (the locally verified toolchain).
- Docker Desktop running with Linux containers enabled, or Docker Engine on Linux.
- Available local ports: **3000** (app), **3001** (LLVM), **5432** (PostgreSQL).

Run all commands from the project root. These instructions use **Windows PowerShell**; Docker and npm commands also work in Bash. No separate local PostgreSQL or LLVM installation is required.

## First-time startup

Use this section for a fresh checkout without existing project containers. Otherwise, follow [Subsequent startup](#subsequent-startup).

### 1. Configure the environment

If `.env` does not already exist:

```powershell
Copy-Item .env.example .env
```

In Bash, use `cp .env.example .env`. Keep existing environment files when returning to the project. The container commands below match these settings:

```dotenv
DATABASE_URL="postgresql://postgres:password@localhost:5432/ENG4701"
LLVM_SERVICE_URL="http://localhost:3001"
```

`password` is a local development example. If you change it, use the same value in `POSTGRES_PASSWORD` when creating the database container. Keep database configuration in `.env` so the Prisma CLI can read it.

To enable AI explanations, create or edit the ignored `.env.local` file:

```dotenv
OPENAI_API_KEY="your-api-key"
```

Use a key with access to `gpt-5.6-luna`. The key stays on the server; do not commit it. Without a key the visualisers still work, but explanation requests report a configuration error. API calls may incur charges. See [AI_EXPLANATIONS.md](AI_EXPLANATIONS.md) for the feature and research exports.

### 2. Install dependencies

```powershell
npm install
```

This also generates the Prisma client through the `postinstall` script.

### 3. Create the database and LLVM containers

Start Docker Desktop first. Check for existing containers:

```powershell
docker ps -a
```

If the project containers already exist, start them using the next section instead of creating them again. For a fresh setup:

```powershell
docker run -d --name ENG4701-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=ENG4701 -p 127.0.0.1:5432:5432 -v eng4701-postgres-data:/var/lib/postgresql/data postgres:17
docker build -f dockerfile.llvm -t llvm-service .
docker run -d --name ENG4701-llvm-service -p 127.0.0.1:3001:3001 llvm-service
```

The database uses a named volume to retain data. The first LLVM build downloads and installs the compiler toolchain, so it can take several minutes. These commands assume the default ports above.

Check database readiness:

```powershell
docker exec ENG4701-postgres pg_isready -U postgres -d ENG4701
```

Wait until it reports `accepting connections`. Open [http://localhost:3001/health](http://localhost:3001/health) to check the LLVM service.

### 4. Initialise the local database and start the app

```powershell
npm run db:push
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** once Next.js reports that it is ready. Keep the terminal running.

## Subsequent startup

1. Start Docker Desktop and wait for its engine to be ready.
2. Open a terminal in the project root.
3. Start the existing containers and the app:

```powershell
docker start ENG4701-postgres ENG4701-llvm-service
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**. If the containers are already running, only run `npm run dev`. Allow the database a few seconds to become ready.

You do **not** need to copy environment files, install dependencies, push the schema or build Docker images on every startup.

If existing containers have different names from an earlier setup, find them with `docker ps -a` and substitute their names in `docker start` and `docker stop`. Reuse the containers already serving ports 5432 and 3001 instead of creating competing containers.

## Stopping the app

Press **Ctrl+C** in the Next.js terminal. To also stop the background services:

```powershell
docker stop ENG4701-postgres ENG4701-llvm-service
```

Stopping containers preserves them for the next session. Do not delete the database container or volume as part of routine shutdown.

## After pulling changes or changing configuration

| Change                                | Required action                                                                                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application source only               | Start `npm run dev`; an already running development server normally reloads changes.                                                                                        |
| `package.json` or `package-lock.json` | Run `npm install` before starting the app.                                                                                                                                  |
| `prisma/schema.prisma`                | With the local database running, run `npm run db:push`. Review any data-loss warning before proceeding.                                                                     |
| `.env` or `.env.local`                | Restart Next.js. Changing database credentials or published ports also requires matching service configuration; editing `.env` alone does not change an existing container. |
| `llvm-service/` or `dockerfile.llvm`  | Rebuild and recreate only the LLVM container using the commands below.                                                                                                      |

To update an existing LLVM container with the default name and port:

```powershell
docker build -f dockerfile.llvm -t llvm-service .
docker stop ENG4701-llvm-service
docker rm ENG4701-llvm-service
docker run -d --name ENG4701-llvm-service -p 127.0.0.1:3001:3001 llvm-service
```

Only continue after the build succeeds. Substitute your actual LLVM container name if different. Rebuild once when upgrading from a version without AI support: explanations require the LLVM service's `meta.toolVersion` evidence. This is not a routine startup step.

## Production-mode local demo

With the same environment files and containers ready:

```powershell
npm run build
npm run start
```

On later sessions, start the containers and run `npm run start` again. Rebuild after changing application code or build-time configuration. `npm run start` requires a successful build. Run either it or `npm run dev`, since both use port 3000.

## Troubleshooting

- **Docker cannot connect:** start Docker Desktop and wait for its engine to be ready.
- **Container name already exists:** use `docker ps -a` and `docker start` instead of creating it again.
- **Port already in use:** check `docker ps` and existing app terminals. Stop the conflicting project instance, or configure matching service ports and environment URLs.
- **Database connection/authentication error:** check `docker logs ENG4701-postgres`, wait for readiness, and ensure `.env` matches the actual database credentials. Changing `POSTGRES_PASSWORD` does not reset a password in an already initialised volume.
- **LLVM unavailable:** check the `/health` URL above, `docker logs ENG4701-llvm-service`, and `LLVM_SERVICE_URL`.
- **AI configuration/access error:** check the server-side key in `.env.local`, restart Next.js, and confirm model access. Never paste the key into a browser field or commit it.

### Existing Bash scripts

`bash ./start-database.sh` and `bash ./start-llvm.sh` remain available for Bash/WSL users with Docker or Podman. They read `.env`; the database script can generate a password and update that file. Use these as an alternative to the manual first-time container commands, not in addition to them.

The LLVM script **always rebuilds and removes/recreates its container**. For subsequent sessions, use `docker start` (or `podman start` for containers created with Podman). If Windows line endings cause `$'\r'` errors, use the PowerShell-compatible Docker commands above.

## Useful commands

| Command                 | Purpose                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `npm run dev`           | Start the development server.                                   |
| `npm run build`         | Create a production build.                                      |
| `npm run start`         | Serve an existing production build.                             |
| `npm run check`         | Run ESLint and TypeScript checks.                               |
| `npm test`              | Run unit and React component tests.                             |
| `npm run test:ai`       | Run AI unit tests; no live model calls.                         |
| `npm run test:e2e:llvm` | Run real LLVM success/failure cases; requires the LLVM service. |
| `npm run db:push`       | Apply the Prisma schema to the local development database.      |
| `npm run db:studio`     | Open Prisma Studio.                                             |

Docker container lifecycle reference: [Docker CLI cheat sheet](https://docs.docker.com/get-started/docker_cheatsheet.pdf).
