# Paper Scan Processor

Wails desktop app (Go backend + React/TS frontend) for post-processing scanned PDFs. See `spec.md` for the full feature spec and implementation checklist — check it off as steps land.

## Commands

- Go tests: `go test ./...`
- Frontend typecheck: `cd frontend && npm run tsc`
- Frontend tests: `cd frontend && npm test`

Don't run `wails dev`/`wails build` or try to screenshot the app — the user tests manually in the running app.

## Conventions

- Don't hand-edit `frontend/wailsjs/` bindings; Wails regenerates them from Go RPCs.
- Break checklist work into small, independently reviewable steps (1a/1b/1c-style) unless a step is trivial.
- Before implementing any non-trivial request — whether from a `spec.md` checklist item or an ad-hoc chat message — flag if it looks like it'll produce a large/churned diff, and propose splitting it into smaller reviewable steps before writing code.
- Point out unrelated cleanups rather than folding them into feature commits; commit them separately.
- Never `git commit` without an explicit go-ahead in the same turn — an earlier approval doesn't carry forward.
