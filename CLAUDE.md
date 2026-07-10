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
- In commit messages, only include a body paragraph if it says something not already obvious from the diff itself, or the diff is non-trivial. Don't restate what the changed lines already show.
