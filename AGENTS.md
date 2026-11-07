<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Local development

The Cloud Agent environment starts PostgreSQL and the Next.js dev server on port 3000. Open the app at http://localhost:3000. Next.js blocks dev JavaScript when the site is opened as 127.0.0.1.

`DATABASE_URL` in `.env.local` is `postgres://tumble:tumble@127.0.0.1:5432/tumble`. The app requires TLS, and the local cluster serves the Ubuntu snakeoil certificate. On boot, the start script creates the till tables when they are missing and inserts a dev admin only when `staff` is empty. Sign in at `/login` with PIN `2468`.

`npm run build` type-checks and compiles the app. `npm run lint` reports existing issues in the till UI.
