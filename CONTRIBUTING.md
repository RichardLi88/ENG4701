# Contributing

## Development Workflow

To develop in this repository:

1. Create a new branch named `<name>/<feature>`.
2. Open a merge request for your branch.
3. Ensure the merge request is approved by at least one other person before merging.

## Pull Request Size

Keep pull requests short, ideally under 1000 lines per PR.

## Code Style

- Keep route pages focused on composition and move interactive UI into colocated `_components` folders.
- Keep user-facing strings in a `content.ts` or constants file instead of inline JSX or event handlers.
- Split content by ownership. For example, feature headings, upload labels, errors, units, and theme toggle labels should be separate exported objects when they are used for different purposes.
- Put shared frontend helpers in `src/app/_helpers` when they can be reused by multiple route sections.
- Avoid `unknown` in TypeScript. Define an explicit type or validate data into a known shape. The Prisma global client singleton cast in `src/server/db.ts` is the exception.
- Prefer scoped CSS variables for scalable light/dark themes. Components should consume theme tokens instead of duplicating light and dark color classes.
- Theme toggles should use typed modes, accessible switch semantics, and labels from the appropriate content file.

## Verification

Before opening a merge request, run the relevant checks:

- `npm run typecheck` for TypeScript changes.
- `npx prettier --check <changed-files>` for formatting-sensitive changes.
- Prisma generation or migration commands when `prisma/schema.prisma` changes.

## Next.js Routing

Use the Next.js App Router convention consistently:

- Use kebab-case for route folder names.
- Folder structure under `src/app` defines the final URL path.
- Create folders to match the exact URL you want.

### Naming Rules

- Prefer `kebab-case`: `compiler-optimisation`, `program-reduction`.
- Do not use spaces, underscores, PascalCase, or camelCase in route folder names.

Good:

- `src/app/program-reduction/page.tsx` -> `/program-reduction`
- `src/app/compiler-optimisation/page.tsx` -> `/compiler-optimisation`

Avoid:

- `src/app/programReduction/page.tsx` -> `/programReduction` (not kebab-case)
- `src/app/program_reduction/page.tsx` -> `/program_reduction` (underscore in URL)
- `src/app/ProgramReduction/page.tsx` -> `/ProgramReduction` (inconsistent style)

### Folder Structure to URL Mapping

Examples:

- `src/app/about/page.tsx` -> `/about`
- `src/app/docs/getting-started/page.tsx` -> `/docs/getting-started`
- `src/app/team/members/page.tsx` -> `/team/members`

Rule of thumb: each nested folder adds one URL segment.

### Dynamic Routes

Use dynamic segments when part of the URL is variable:

- `src/app/posts/[slug]/page.tsx` -> `/posts/my-first-post`
- `src/app/users/[id]/page.tsx` -> `/users/123`

Use descriptive parameter names like `[slug]` or `[id]`.
