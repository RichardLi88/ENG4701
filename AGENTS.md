# Agent Instructions

## Project Context

- This is a TypeScript Next.js app using tRPC, React Query, Prisma, and PostgreSQL.
- Keep changes small, explicit, and easy to review.
- Match the existing T3-style layout and imports:
  - tRPC routers live in `src/server/api/routers`.
  - The root tRPC router is `src/server/api/root.ts`.
  - Shared tRPC setup is `src/server/api/trpc.ts`.
  - Prisma access goes through `src/server/db.ts`.
  - The Prisma schema is `prisma/schema.prisma`.
  - Use the `~/*` path alias for files under `src`.

## Working Rules

- Understand the current code before editing.
- Make the smallest change that fully solves the task.
- Do not refactor unrelated code.
- Do not overwrite user changes.
- Do not edit generated files unless there is no practical alternative.
- Do not modify lock files or migrations unless the task requires it.
- Prefer TypeScript, Zod validation, and explicit error handling.
- Keep user-facing string text in a separate content or constants file instead of inline JSX or handlers.
- Avoid the TypeScript `unknown` type; define an explicit type or validate into a known shape.
- Exception: `unknown` is acceptable for the Prisma global client singleton cast in `src/server/db.ts`.

## tRPC Guidelines

- Add or change API behavior in a router under `src/server/api/routers`.
- Register new routers in `src/server/api/root.ts`.
- Use `createTRPCRouter` and `publicProcedure` from `~/server/api/trpc`.
- Validate all procedure inputs with Zod.
- Use `ctx.db` for Prisma access inside procedures.
- Keep procedure return values predictable and typed by inference instead of duplicating manual types.

## Prisma Guidelines

- Update `prisma/schema.prisma` only for real data model changes.
- Prefer creating migrations with the existing npm scripts instead of hand-editing migration SQL.
- After schema changes, ensure the Prisma client is regenerated through the existing workflow.
- Keep database queries scoped and readable; include `orderBy`, `where`, and `select`/`include` deliberately.

## Frontend Guidelines

- Use server components by default in `src/app` unless client-side state or browser APIs are needed.
- Use `"use client"` only for components that require it.
- Use tRPC client helpers from `src/trpc/server.ts` for server components and `src/trpc/react.tsx` for client components.
- Keep UI changes consistent with the existing app structure and styling.

## Verification

Before finishing a coding task, self-review the diff and run the most relevant checks available:

- For TypeScript or API changes, run `npm run typecheck` or `npm run check`.
- For formatting-only or markdown-only changes, inspect the file and run formatting only if useful.
- For Prisma schema changes, run the appropriate Prisma generation or migration command.
- If a check cannot be run, explain why in the final response.

## Self-Review Checklist

- The change directly addresses the request.
- The diff is minimal and does not include unrelated edits.
- tRPC inputs are validated and database access goes through `ctx.db`.
- Prisma schema, migrations, and generated client expectations are consistent.
- TypeScript strictness is preserved.
- Errors and empty states are handled intentionally.
- Relevant checks were run, or skipped with a clear reason.

## Response Format

Use this format when summarizing completed work:

### Summary

- What changed.

### Why

- Why the change was made.

### Verification

- What was run, or `Not run` with the reason.

### Risks / follow-ups

- Any remaining risk or useful next step.
