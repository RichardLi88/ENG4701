# Contributing

## Development Workflow

To develop in this repository:

1. Create a new branch named `<name>/<feature>`.
2. Open a merge request for your branch.
3. Ensure the merge request is approved by at least one other person before merging.

## Pull Request Size

Keep pull requests short, ideally under 1000 lines per PR.

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
