# Implementation checklist

Tracks progress against [`spec.md`](spec.md), mode by mode. Entries note what shipped (RPC/function names, implementation detail) and point back at the spec.md section that documents the actual behavior/rationale — check it off as steps land.

## Primitives

- [x] **Go: PDF merge/split** — interleave and split PDFs with pdfcpu; hardcoded paths; `_test.go` harness, no UI
- [x] **Frontend: Thumbnail panel** — virtualized vertical scroll, on-demand per-page render via Go/mutool, resizable width with drag handle
- [x] **Frontend: Detail panel** — pan and zoom with `react-zoom-pan-pinch`, driven by selected page

## Merge mode

- [x] **Step 1: End-to-end merge pipeline** — Go `OpenFileDialog` / `SaveFileDialog` RPCs; `MergePDFs` Wails RPC; minimal UI with two file-picker buttons and a Merge & Save button; no thumbnails
- [x] **Step 2: Thumbnail strips** — two-column layout using existing `ThumbnailPanel` primitive, one per file, side by side; Merge & Save moves to toolbar
- [x] **Step 3: A/B selector + visual offset** — "First page in" toggle (File A / File B); second strip offset down by half a thumbnail height
- [x] **Step 4: Reverse checkbox + page-count warning** — "Reverse File B" checkbox wired into merge call; implements the unequal-counts toolbar indicator described in spec.md's "Unequal page counts" section
- [x] **Step 5: Detail panel** — existing `DetailPanel` primitive on the right; selection in either strip updates it; `←` / `→` keyboard navigation
- [x] **Step 6: Page editing** — rotate and skip within the merge view, applied before the merge call

## Split mode

- [x] **Step 1: Split points UI** — resizable left panel + detail panel; clickable gaps between thumbnails toggle a visual divider; no drag-and-drop yet
- [x] **Step 2: Export pipeline** — Go split/export backend; Export button wired up; no filename control yet
- [x] **Step 3: Filename inputs** — per-output-file editable filename field in each section header
- [x] **Step 4: Filename prefill** — global filename template with `{date}` / `{name}` tokens; prefills each section header on creation
- [x] **Step 5: Output folder** — global output folder picker; per-file folder override in section header
- [ ] ~~Step 6: Divider drag-and-drop — reposition or delete dividers by dragging~~
- [x] **Step 7: Rotate pages**
- [x] **Step 8: Skip pages**
- [x] **Step 9a: Reorder pages via up/down buttons**
- [x] **Step 9b: Reorder pages via drag and drop**
- [x] **Step 10: Export polish** — filename conflict check before export; keep/move/delete prompt for input file after export; "Open in Drive Upload" button in success modal
- [ ] **Step 11: Keyboard shortcuts** — `Space` to toggle split point, `Tab` to move between filename inputs
- [ ] **Step 12: Persisted settings** — last-used output folder, filename template

## Drive Upload mode

- [x] **Step 1a: OAuth authentication** — Go backend only, no UI; browser-based OAuth with a localhost callback; credentials stored locally and reused across sessions
- [x] **Step 1b: Folder listing** — list contents of a hardcoded root folder and a hardcoded subfolder via Drive API
- [x] **Step 1c: File upload** — upload a hardcoded local file to a hardcoded Drive folder
- [x] **Step 1d: OAuth token refresh** — fixes `oauth2: "invalid_grant" "Token has been expired or revoked."` seen after the app has been left open a day or two; implements the eager-renew and re-prompt behavior described in spec.md's Authentication section
- [x] **Step 2a: Filesystem scan backend** — `scanLocalRoot` + `ScanLocalRoot` RPC; implements the scan behavior described in spec.md's Drive Upload Workflow/Layout sections
- [x] **Step 2b: File tree UI** — new Drive Upload tab; root folder picker; three-column layout shell; implements the file tree described in spec.md's Drive Upload Layout section
- [x] **Step 2c: Non-PDF file support** — `LocalFile.IsPDF` distinguishes non-PDF files from PDFs; `Corrupt` only applies to the latter (per spec.md's Drive Upload Layout section)
- [x] **Step 3a: Drive folder browser backend** — `ListDriveFolder` App RPC, thin wrapper over the existing `DriveListFolder`
- [x] **Step 3b: Folder browser modal UI** — lazy-loaded Drive tree browsing and folder selection; no recently-used list yet
- [ ] **Step 3c: Recently used folders list** — persisted MRU list, shown in the modal
- [x] **Step 3d: Drive folder assignment UI** — implements the assignment/propagation/clear behavior described in spec.md's "Drive folder assignment" section
- [x] **Step 3e: Drive folder assignment UI** — batch assignment for multi-select; implements the selection/preview behavior described in spec.md's Drive Upload Layout section and the batch-assignment/pruning behavior in "Drive folder assignment"; reworked `PickerTarget`/`onSelect` to apply to multiple targets at once
- [ ] **Step 3f: Create new Drive folder** — from within the folder browser modal, per spec.md's "Drive folder assignment" section
- [ ] **Step 4: Inline renaming** — inline editable name for each subfolder and file, per spec.md's Drive Upload Layout section; becomes read-only once locked (see spec.md's Locking section), alongside Drive folder assignment (see [`spec-drive-upload-step6.md`](spec-drive-upload-step6.md))
- [x] **Step 5: PDF preview** — selecting a file loads it into the middle thumbnail strip and right detail panel (reuses existing primitives)
- [x] **Step 6 prerequisite: Toolbar layout** — full-width toolbar strip above the three-column layout, matching the `Box` + `Group` toolbar pattern in `SplitMode`/`MergeMode`; root-folder picker moved into it (left-aligned); pure layout move, no behavior change
- [x] **Step 6a: Upload queue state model** — `uploadQueue` module-level singleton (matching `lib/pageCache`'s pattern); sequential (concurrency=1) worker; shared `flattenFiles(group)` tree-traversal utility; `UploadFile` App RPC wrapper around `drive.UploadFile`; no UI yet
- [x] **Step 6b: Upload modal** — implements the upload progress modal described in spec.md's Drive Upload Workflow section; see also [`spec-drive-upload-step6.md`](spec-drive-upload-step6.md) for the original UI/UX plan
- [x] **Step 6c-i: "Open in Drive" links** — `DriveAssignmentField` (shared by `GroupNode` headers and `FileList` rows) plus a per-row link in the upload modal, per spec.md's Drive Upload Workflow/Locking sections; backed by a new `OpenDriveFolder` App RPC (`runtime.BrowserOpenURL`)
- [x] **Step 6c-ii: Read-only lock** — implements the Locking behavior described in spec.md
- [x] **Step 6d: Cancel in-flight upload** — per-job `context.WithCancel` passed through `UploadFile` down to the Drive API call, backing the Cancel behavior described in spec.md's Drive Upload Workflow section
- [ ] **Step 7: Remembered folder mappings** — auto-fill Drive destination from saved subfolder-name→Drive-folder mapping; persisted across sessions
- [ ] **Step 8: Post-upload cleanup** — prompt to delete or archive source files; archive moves files to a user-specified local archive folder
- [ ] **Step 9: Conflict detection** — check Drive for filename conflicts before uploading; flag conflicting files
- [ ] **Step 10: Keychain storage** — store the Drive refresh token in the macOS Keychain instead of a plain JSON file, so it is encrypted at rest and not readable by other user-level processes
- [x] **Step 11: Inclusion selection** — implements the tri-state checkbox/propagation behavior described in spec.md's "Inclusion selection" section

## Global error handling

- [x] **Step 1a: Backend panic recovery** — a shared helper wraps each Wails-exposed RPC method with `recover()`, converting a panic into a returned error instead of crashing the process; verify with a deliberately panicking RPC
- [x] **Step 1b: Frontend unhandled-error listener** — `window.addEventListener` for `'unhandledrejection'` and `'error'`, installed once at startup, shows a persistent Mantine notification ("An unexpected error occurred" + the underlying error text) for anything not already caught by feature-specific handling
- [x] **Step 1c: React error boundary** — a top-level boundary around the app catches render-time exceptions and replaces the crashed subtree with a generic fallback notice instead of a blank/frozen screen

## Code cleanup

- [x] **Move `pageCache.ts` to `src/lib/`** — it's a module-level singleton, not a hook; only `usePageCacheRender` is a hook
- [x] **Move `usePDFFile.ts` into `MergeMode/`** — only used by MergeMode; SplitMode re-implements `rotate`/`toggleSkip` independently, so the hook is not truly shared
- [x] **Fix duplicate global keydown handlers** — both `SplitMode/ThumbnailPanel` and `DetailPanel` listen to `ArrowLeft`/`ArrowRight`/`Delete` on `window`; after page reordering, the panel navigates by visual order while DetailPanel navigates by numeric order — the last-registered handler wins, producing wrong navigation; remove the overlapping keys from `DetailPanel` and handle them only in the mode-level panel
- [x] **Remove unused packages** — `@mantine/dropzone` (CSS imported in `main.tsx` but component never used) and `zustand` (in `package.json` but never imported) can both be removed
- [ ] ~~**Wrap `toggle` in `useCallback` in `useOutputFiles.ts:25`** — the only exported function not memoized; causes `handleToggleSplitPoint` (which depends on it) to recreate every render despite its own `useCallback`~~
- [ ] ~~**Memoize `getSplitPoints` in `useOutputFiles.ts:79`** — creates a new `Set` on every call; make it a `useMemo` like `duplicateFirstPages`~~
- [x] **Name the magic pixel offsets in `MergeMode/index.tsx`** — `totalWidth - 22` and `colWidth + 26` are two different values for what comments describe as "scrollbar + gap"; name them as constants and reconcile
- [x] **Add `out.Sync()` in `pdf.go:copyFile`** — without a sync before close, a crash between write completion and OS flush can silently corrupt the output PDF
- [x] **Wrap `ThumbColumn` return in a Fragment** — currently returns a raw `JSX.Element[]` array; wrapping in `<>...</>` is more conventional and clarifies intent

## Styling cleanup

Low-hanging fruit from a review of how styling is done across the frontend (all inline `style={{}}`, no CSS modules/styled-components; Mantine tokens are already used consistently for color where a token exists).

- [x] **Extract shared `ResizeHandle` component** — the vertical resize-drag handle (`width: DRAG_HANDLE_WIDTH, height: '100%', cursor: 'col-resize', flexShrink: 0, background: 'var(--mantine-color-gray-3)'`, paired with `onMouseDown={startDrag}` from `makeResizeDragHandler`) is duplicated identically in `SplitMode/ThumbnailPanel.tsx`, `DriveUploadMode/ResizableLeftPanel.tsx`, `DriveUploadMode/ThumbnailPanel.tsx`, and `MergeMode/ThumbnailPanel.tsx`
- [x] **Move `TruncatedText` out of `DriveUploadMode/`** — it's a generic label+tooltip-on-truncation component built on the shared `useIsTruncated` hook, nothing Drive-specific about it; relocate next to `ClippedPath` in `components/` so it's discoverable for reuse elsewhere
- [x] **Migrate inline `style={{}}` objects to CSS Modules** — convert inline `style={{}}` objects to a per-component `*.module.css` file (native Vite support, no extra dependency); genuinely dynamic per-instance values (JS constants/computed values) stay as a minimal inline `style` prop alongside the module class. (Originally planned around `goober`, a CSS-in-JS library, but it has an unresolved `this`-binding bug under Vite's SSR transform — used by Vitest — that throws on first render in tests; the upstream fix, [goober#589](https://github.com/cristianbote/goober/pull/589), has sat open and unmerged since Aug 2024. CSS Modules gets the same no-build-plugin, no-runtime-cost goal without that risk.) Hover-state-driven styling (`PageThumbnail`'s icon buttons, `GapZone`) was deliberately left inline — that's the next item.
- [x] **Replace JS-driven hover state with CSS `:hover`** — remove the `isHovered`/`hoveredPage`/`hoveredGap` state and `onMouseEnter`/`onMouseLeave` wiring in `PageThumbnail`, `SplitMode/ThumbnailPanel`, `MergeMode/ThumbnailPanel`'s `ThumbColumn`, and `GapZone`, replacing it with real `:hover` styles (now straightforward once those components have a CSS Modules file); the existing accessibility gap (thumbnail controls not keyboard-reachable, tracked in Code review findings) means these should pair with `:focus-within` rather than `:hover` alone if addressed at the same time

## Various

- Fixes for keyboard naviation:
  - [ ] in MergeMode navigation is implemented in index.ts, in SplitMode it's implemented in ThumbnailPanel.tsx. That's inconsistent
  - [ ] Change going to previous / next page to up / down arrows
  - [ ] Make MergeMode previous / next action to follow the order of the target PDF; meaning to go back and forth between file A and B
- [x] **Guard async-triggering buttons against repeat clicks while in flight** — `lib/useAsyncAction.ts` wraps an async handler with a re-entrancy guard (rejects a second call until the first settles) and routes failures through `handleUnexpectedError`; `components/AsyncButton.tsx` wraps it for the common Mantine `Button` case (disables + shows a spinner while pending). Applied to: MergeMode's Merge & Save, Choose… (File A/B), Open in Default App; SplitMode's Export, both Open PDF buttons (sharing one guard since they can both be visible at once), Output folder…, Open in Finder, and the per-row output-folder override in `OutputFileHeader`; DriveUploadMode's Choose root folder…, the per-file "open Drive folder" icon in `UploadModal`, and the locked-state Drive-folder badge in `DriveAssignmentField` (shared by `GroupNode`/`FileList`). `DriveFolderPickerModal`'s per-node expand toggle got a narrower fix (disabled while its own `ListDriveFolder` call is in flight) since it already had feature-specific inline error handling worth keeping as-is. Buttons that were already correctly guarded (Upload All, per-file Retry, Cancel/Resume) were left untouched.
- [x] **Surface `pageCache.ts` render failures in the UI** — `failed` now stores the error message alongside the width, plus `getFailureMessage()` and `retry(path, page, width)` exports; `PageThumbnail` shows a red `IconPhotoOff` with a hover tooltip, `DetailPanel` shows the icon, message, and a Retry button. See spec.md's "Thumbnail panel" and "Page detail panel" sections.

## Code review findings

Findings from a source review of the current codebase (non-Drive code). Drive Upload findings are tracked separately below since that mode is still under construction.

- [x] **Split mode leaks page-cache memory** — `SplitMode` never calls `pageCache.evict()`, on file change or unmount, unlike `MergeMode` which does both. Every PDF opened in Split mode leaves its rendered thumbnails and full-res detail images in memory permanently.
- [x] **`Shift+R` (rotate counter-clockwise) is not implemented** — documented in the keyboard shortcuts table, but only clockwise rotation exists anywhere (thumbnail button and the `r` key both just do `+90°`); there is no CCW code path at all.
- [x] **`DetailPanel`'s rotate shortcut breaks under Shift/Caps Lock** — its keydown handler checks `e.key === 'r'` only, so with Shift held (or Caps Lock on) `e.key` is `'R'` and nothing happens, not even a clockwise rotate.
- [x] **Thumbnail controls are keyboard/screen-reader unreachable** — rotate/skip/move buttons on thumbnails, split-point gap zones, and the folder-path click target are all unlabeled `<div onClick>`s: not focusable, no `role`/`aria-label`.
- [x] **Unthrottled page-cache effect causes re-renders on every mouse move** — `SplitMode/ThumbnailPanel` and `MergeMode/ThumbnailPanel` both run a page-cache-loading `useEffect` with no dependency array, so hovering a thumbnail (`hoveredPage`/`hoveredGap` state) re-runs the load loop over the whole visible virtual window on every render.
- [x] **Spec says `mutool`, code uses `pdftoppm`** — `app.go`'s `RenderPage` shells out to `pdftoppm` (poppler), not `mutool draw` as documented in spec.md's Tech stack section; system dependency claim is stale.
- [x] **Spec still lists Zustand as the state library** — it was removed as an unused dependency (see Code cleanup above); state is plain React hooks throughout. Tech stack section needs updating.
- [x] **`.gitignore` is incomplete** — doesn't cover `.DS_Store` or the compiled `paper-scan-processor` binary at repo root; both currently show as untracked.
- [x] **`pdfFromPage` silently falls back to page `0` on parse failure** — `pdf.go`'s `fmt.Sscanf` result is never checked; if pdfcpu's split-filename convention ever changes, a page would silently sort to the front instead of raising an error.
- [x] **No frontend tests at all** — Go has solid coverage but there isn't a single frontend test file. The pure-logic hooks (`useOutputFiles`, especially `duplicateFirstPages`/`getSplitPoints`) are exactly the kind of thing that's easy to get subtly wrong and hard to verify by eye in the running app; worth unit-testing even if UI itself stays manually tested.

### Drive Upload (code not finished)

- [x] **Drive API queries are built with unescaped string interpolation** — `DriveFindFolder`/`DriveListFolder` use `fmt.Sprintf` to embed `name`/`parentID` into the query string. A folder name containing a single quote breaks the query (acknowledged in a comment but not handled); should escape `'` per Drive's query syntax.
- [ ] **`DriveFindFolder` doesn't handle duplicate folder names** — it takes `result.Files[0]` unconditionally, but Drive allows multiple folders with the same name in the same parent, so resolution is nondeterministic once that happens.
- [x] **`DriveListFolder` has no pagination** — accepted as a bounded limit rather than fixed: `drive.ListFolder` (`backend/drive/folders.go`) now requests Drive's max page size (1000) in its single call. Folders sort before files, so this only truncates once a folder has 1000+ direct subfolders, which isn't a realistic case for this tool; a full pagination loop was rejected as disproportionate complexity/latency for that scenario.
- [ ] **No caching of the authenticated Drive client** — `driveService` re-reads and re-parses `drive_token.json` from disk on every single API call instead of caching a client in memory; will multiply once concurrent per-file uploads (Step 5) exist. Confirmed actively reachable now: every single folder-expand click in Step 3b's picker triggers one of these disk reads.
- [x] **Refreshed OAuth tokens are never written back to disk** — only the first-run flow calls `driveSaveToken`; every later call reloads the same stale on-disk token and silently re-refreshes it against Google again. Fixed as part of Step 1d: `driveClientWithConfig` now persists a refreshed access token back to disk when it changes.
- [x] **OAuth callback server has no concurrency guard** — `driveRunOAuthFlow` binds a hardcoded port (8765) with no mutex/single-flight protection; two concurrent calls into `driveService()` before a token exists will race to bind the same port, and the loser gets a raw "address already in use" error. Fixed by `driveClientMu`, which serializes `driveService` calls.
- [ ] **`driveSaveToken` discards the `Close()` error** — after encoding the token, the deferred `f.Close()` error is silently dropped (unlike the one place in the same file that explicitly acknowledges doing so with `//nolint`); a failed flush is reported as success and only surfaces later as a corrupt/unreadable token file.
- [ ] **Refresh token is stored as plaintext JSON** — readable by any local process running as the same user. Already tracked as Step 9 (Keychain storage) above, but worth flagging that the current implementation doesn't yet meet the "stored locally" bar that spec.md's Authentication section implies.

### Drive Upload Steps 2–3d (code review findings, high-effort multi-angle pass)

Correctness / robustness:

- [x] **Drive assignments and collapsed-group state survive a root-folder switch** — `useDriveAssignments` now takes `tree` and resets both maps in a `useEffect` keyed on it, matching `useInclusion`/`useSelection`'s existing reset pattern; `collapsedGroups` in `DriveUploadMode/index.tsx` gets the same treatment.
- [ ] **One unreadable subdirectory aborts the entire scan** — `filetree.go`'s `scanDirectory` propagates any single subdirectory's `os.ReadDir` error all the way up (`if err != nil { return LocalFileGroup{}, err }`), instead of skipping just that subfolder the way one corrupt file is skipped. A root with hundreds of valid PDFs plus one permission-restricted subfolder three levels deep fails the whole scan with no partial tree shown.
- [x] **`os.Stat` failure silently drops a file instead of flagging it corrupt** — `scanDirectory`'s own doc comment says unreadable files "are still included, flagged via Corrupt... rather than dropped," but that's only true for `pdfPageCount` failures; an `os.Stat` failure (permission change, broken symlink, TOCTOU race) hits `continue` and the file vanishes from the tree with no warning at all.
- [x] **No request correlation when switching root folders** — `useFileTree.ts`'s `pickRoot` still has no internal guard against concurrent invocation, but the only call site (`DriveUploadMode`'s "Choose root folder…" button) now goes through `AsyncButton`/`useAsyncAction`, which disables the button and rejects re-entrant calls until the in-flight `pickRoot()` settles. Per CLAUDE.md's guidance on proportional defensiveness, no additional guard inside `pickRoot` itself is needed since the concurrent-call scenario can't reach it.
- [ ] **`PickFolder` rejection is unhandled** — in `pickRoot`, `await PickFolder(...)` sits outside the surrounding try/catch; if the native folder dialog itself rejects, it's an unhandled promise rejection with `loading`/`error` never updated, so the user gets zero feedback.
- [ ] **Stale Drive-fetch error persists after collapsing a picker row** — `DriveFolderPickerModal.tsx`'s inline error text is gated only on `error`, not `expanded`; collapsing a folder whose fetch failed leaves the error message rendering below the now-collapsed row until it's expanded again.
- [ ] **Duplicate Drive API call on rapid collapse/re-expand** — `DriveTreeNode`'s `toggle()` only checks `children === null`, not an in-flight `loading` state, so collapsing and re-expanding a node before its first `ListDriveFolder` call resolves fires a redundant second call.
- [ ] **`groupKey` is built from editable display names, colliding with the very next planned step** — `GroupNode.tsx` keys Drive assignments by joining folder names (`` `${groupKey}/${sub.name}` ``); Step 4 (inline renaming) makes those exact names user-editable. Renaming a subfolder after that ships will silently orphan its assignment, since `LocalFileGroup` carries no stable id to key on instead.

Reuse / simplification / efficiency (lower priority, not yet actioned):

- [ ] **Truncation-detection logic duplicated** — `DriveUploadMode/TruncatedText.tsx` reimplements the same `scrollWidth`/`clientWidth` + conditional-`Tooltip` technique as `components/ClippedPath.tsx` (acknowledged in `TruncatedText`'s own comment) instead of sharing one implementation.
- [ ] **Raw glyphs instead of the app's existing icon convention** — `FileList.tsx`'s corrupt-file warning uses a bare `⚠️` emoji and `DriveAssignmentField.tsx`'s clear button uses a bare `✕`, where `MergeMode/index.tsx` and `PageThumbnail.tsx` already establish `IconAlertTriangle`/`IconX` from `@tabler/icons-react` for the same purposes.
- [ ] **"own ?? inherited" assignment resolution duplicated verbatim** — identical two-line resolution logic in both `GroupNode.tsx` and `FileList.tsx`; `useDriveAssignments.ts` deliberately leaves this to callers, but a shared helper would avoid the duplication.
- [ ] **`INDENT_PER_LEVEL = 16` defined twice** — identically in `GroupNode.tsx` and `DriveFolderPickerModal.tsx`.
- [ ] **No memoization anywhere in the Drive Upload tree** — `collapsedGroups`/`assignments` are replaced wholesale (new `Set`/`Map`) on every single toggle or assignment and passed through un-memoized `GroupNode`/`FileList`, so React re-renders the entire tree on any one change instead of just the affected node.
- [ ] **`scanDirectory` scans fully sequentially** — every file's `os.Stat` + `pdfPageCount` call happens one at a time with no concurrency, for a tool whose whole purpose is scanning batches of scanned documents.
- [ ] **Drive folder picker discards fetched state on every close** — Mantine's `Modal` (no `keepMounted`) unmounts `DriveTreeNode` on close, so reopening the picker re-fetches the whole tree from scratch, including previously-expanded paths, instead of reusing a cache.
- [ ] **`resolveEffectiveAssignments` (added for Step 6b) isn't reused by `GroupNode`/`FileList`** — those still resolve "own ?? inherited" inline during render (they also need the `isOwn` flag the walk doesn't currently expose), so the tree walk exists in two places. Step 9 (conflict detection) will want the same resolver.
