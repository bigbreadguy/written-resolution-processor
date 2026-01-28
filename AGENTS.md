## General Instructions
- Never rush to write code, always plan how to address request.
- Act like a senior frontend engineer; all ideas, recommendations, or arguments should be rated with a confidence scale from 0 to 100.
- Write users a series of commands to commit, with brief one-liner commit message for each change, after writing code.

## Project Goal

Written Resolution Processor helps users who needs to process captured images, printed PDF files, of written resolutions(서면결의서) to parse information that matters to them. The app leverages gemini API to outsource this task, by splitting uploaded files into bulk of file sets per request, then integrate the result into single tabular file(.xlsx).

**Core Problem:** Manually processing written resolutions is tedious. You will check the vote counting results on and on and on, until gain confidence.

**Solution:** An automated solution for the vote counting, and you can focus on analyzing the result itself.

---

## Package Manager
- Use pnpm (not npm or yarn)
- Enable via `corepack enable pnpm` if not installed
- Common commands: `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`

## How to commit
- `a-z\:\s\-` are only allowed characters in commit message.
- Each commit message should starts with prefixes in following list.
    - `feat`: New feature for the user.
    - `fix`: Bug fix for the user.
    - `chore`: Any changes other than `feat` and `fix`.
- Each commit message should be in imperative mood.
- Decompose any pascal case to lower case and space separated words.

## Code style

### TypeScript
- Use strict mode with all strict flags enabled
- Define explicit return types for all functions
- Use `interface` for object shapes, `type` for unions and primitives
- Prefer `unknown` over `any`
- Use `readonly` for immutable data

### Components
- One component per file
- Use named exports, not default exports
- Props interface named `{ComponentName}Props`
- Destructure props in function signature
- Place hooks at the top of component body

### Naming
- Components: PascalCase (`TagSelector.tsx`)
- Hooks: camelCase with `use` prefix (`useDropdown.ts`)
- Utils: camelCase (`formatDate.ts`)
- Constants: SCREAMING_SNAKE_CASE
- CSS classes: kebab-case

### Imports
- Order: react, external libs, internal components, utils, types, css
- Use absolute imports with `@/` alias (maps to `src/`)

### File structure
```
src/
├── components/
│   ├── ui/           # Reusable primitives
│   └── features/     # Feature-specific components
├── utils/
├── types/
└── constants/
```

### CSS
- Use CSS modules or colocated CSS files for scoping
- Follow BEM-like naming for global styles
- Keep component styles colocated with component

## Deployment

- **Platform**: Vercel (private repo)
- **Config**: `vercel.json` with `framework: "vite"`
- **Analytics**: Vercel Analytics (`@vercel/analytics`) + Google Analytics (gtag.js)
- **Important**: Do not add `base` path in vite.config.ts for Vercel deployment
