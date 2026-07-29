# Paper Scan Processor

A desktop application for post-processing PDF files containing batches of scanned documents. The app has three modes: **Merge**, **Split**, and **Drive Upload**.

## Tech stack

- **Desktop framework**: Wails
- **Backend**: Go
- **Frontend**: TypeScript + React
- **UI components**: Mantine
- **Virtualization**: TanStack Virtual
- **Drag-and-drop**: dnd-kit
- **PDF manipulation**: pdfcpu
- **PDF rendering** (thumbnails): `pdftoppm` (Poppler, system install, called as subprocess)

## Common elements

Both modes include a thumbnail panel and a page detail panel, and support the same per-page editing operations.

### Thumbnail panel

A vertically scrolling strip of page thumbnails. Width is user-adjustable via a drag handle; thumbnails scale to fill the panel width. Rendering is on-demand and virtualized — only visible thumbnails (plus a small overscan buffer) are rendered at any given time.

The Go backend exposes a per-page render method returning a base64-encoded PNG; the frontend requests thumbnails as they scroll into view (`pdftoppm` subprocess).

#### Keyboard shortcuts

| Key                    | Action                                     |
| ---------------------- | ------------------------------------------ |
| `R`                    | Rotate selected page clockwise 90°         |
| `Shift+R`              | Rotate selected page counter-clockwise 90° |
| `Delete` / `Backspace` | Toggle skip on the selected page           |
| `←` / `→`              | Select previous / next page                |

### Page detail panel

Shows the currently selected page at reading resolution. Selecting a thumbnail updates it.

Supports:

- **Pan**: drag to pan.
- **Zoom**: scroll wheel or trackpad pinch to zoom in/out.
- **Navigate**: `←` / `→` to move to the previous/next page.

Implemented with `react-zoom-pan-pinch`.

### Page editing

Individual pages can be edited in both modes before export or merge:

- **Rotation**: pages can be rotated in 90° increments (clockwise or counter-clockwise).
- **Skip**: pages can be marked as skipped — excluded from the output but remaining visible in the thumbnail view (greyed out). A page is skipped by clicking a skip icon that appears on hover, or via keyboard shortcut.
- **Reorder**: pages can be reordered by dragging thumbnails to a new position.

## Mode: Merge

For scanners that can only scan one side at a time. The user scans all front pages as one PDF and all back pages as another, then uses Merge mode to interleave them into a single PDF.

### Workflow

1. The user loads two PDF files, labelled **File A** and **File B**.
2. The user selects which file contains the first page (**First page in: File A / File B**).
3. A **Reverse File B** checkbox controls whether File B is reversed before interleaving. This should be checked when the paper stack was flipped between scans (the typical case, when scanning one side at a time), causing the second-scanned pages to be in reverse order.
4. The app interleaves the pages: A1, B1, A2, B2, etc.
5. The user saves the merged result as a new PDF file on disk.

The merged PDF can then be opened in Split mode for further processing.

### Unequal page counts

If File A and File B have different page counts, the app shows a warning before proceeding: "File A has X pages, File B has Y pages. The extra Z page(s) will be appended at the end." The user can cancel or continue. The extra pages from the longer file are appended in order after the interleaved section.

### Layout

Merge mode uses a two-column layout:

- **Left panel** — two side-by-side thumbnail strips, one per input file.
- **Right panel** (fills remaining space) — the page detail view, showing whichever page was most recently selected in either thumbnail strip.

The thumbnail strip for the file containing the second output page is offset downward by half a thumbnail height. This makes the interleaving order visually apparent: the two files' pages appear to slot between each other.

```
  A               B
  ┌──────────┐
  │   A1     │
  └──────────┘  ┌──────────┐
                │   B1     │
  ┌──────────┐  └──────────┘
  │   A2     │
  └──────────┘  ┌──────────┐
                │   B2     │
  ┌──────────┐  └──────────┘
  │   A3     │
  └──────────┘
```

The offset makes the interleaving order visually apparent without needing labels.

### Error handling

TBD.

## Mode: Split

### Workflow

1. The user loads an input PDF via a file picker dialog or by dragging and dropping a file onto the app window.
2. The app displays all pages as thumbnails in the left panel. Clicking a thumbnail selects it and updates the detail panel on the right.
3. The user defines split points by clicking in the gaps between page thumbnails. A visual divider appears at each split point; clicking again removes it. Dividers can also be repositioned by dragging them to a different gap. Each divider marks where a new output file begins.
4. The user sets a global filename template using `{date}` (today's date as `YYYY-MM-DD`) and `{name}` (a per-file label). Example: `{date} {name}` → `2026-06-12 invoice.pdf`. The app prefills the filename for each output file using this template. The user can then edit any individual file's name before exporting.
5. The user sets a global output folder (an existing folder on the local filesystem). For each output file, the user can adjust:
   - The prefilled filename (editable)
   - The destination folder (overridable per file)
6. The user clicks Export. Before splitting, the app checks for filename conflicts at each destination. If any conflict is found, the export is aborted and an error message identifies the conflicting files. Once resolved, the app splits the input PDF and writes each output file. Afterwards, the app prompts the user to keep, move, or delete the input file. The success modal includes an **"Open in Drive Upload"** button that switches to Drive Upload mode with the output folder pre-set as the root.

### Layout

Split mode uses a two-column layout:

- **Left panel** (adjustable width, drag handle on right edge) — a single vertically scrolling area that combines the thumbnail strip and output file controls.
- **Right panel** (fills remaining space) — the page detail view.

#### Left panel structure

The left panel is a continuous scroll area. Pages are grouped by output file. Each group is preceded by a compact **output file header** containing the editable filename field and (when applicable) destination folder. Split-point dividers between groups are the visual boundary between one output file and the next.

```
┌─ invoice.pdf ──────────────────────┐
│ folder: /Documents                 │
└────────────────────────────────────┘
  [page 1 thumbnail]
  [page 2 thumbnail]
  [page 3 thumbnail]
  ──────── [gap / split point] ───────
┌─ receipt.pdf ──────────────────────┐
│ folder: /Documents                 │
└────────────────────────────────────┘
  [page 4 thumbnail]
  [page 5 thumbnail]
```

Clicking a gap toggles a split point there and creates a new output file section. The filename and folder fields for each section appear immediately above its pages.

### Keyboard shortcuts

| Key     | Action                                                  |
| ------- | ------------------------------------------------------- |
| `Space` | Toggle a split point after the selected page            |
| `Tab`   | Move focus to the next filename input in the left panel |

### Local subfolder (optional)

Each output file can be assigned a subfolder name. The file is then saved to `[output folder] / [subfolder] / filename.pdf` rather than directly into the output folder. The user enters the subfolder name manually in the section header. No automatic disambiguation is applied — the user is responsible for avoiding conflicts.

### Persisted settings

The following settings are saved across sessions:

- Last-used output folder
- Filename template

### Error handling

TBD.

## Mode: Drive Upload

For filing batches of local files (PDFs and other scans, e.g. images) to Google Drive. Intended as the step after Split mode: once PDFs are exported to a local folder, the user switches to Drive Upload to route each file (or subfolder of files) to the correct place in Drive.

### Workflow

1. The user enters Drive Upload mode. If arriving via the Split mode export success modal, the root local folder is pre-set to the Split output folder; otherwise the user picks a root folder.
2. The app scans the root folder recursively and displays all files grouped by subfolder. Files in the root folder itself appear as a top-level group. Everything starts selected for upload.
3. The user can deselect files or subfolders to exclude them from the upload. Excluded items don't need a Drive destination and are skipped by the conflict check and the upload itself.
4. The user assigns a Google Drive destination folder to each subfolder group. The assignment propagates to all files within the group. Individual files can override the group's assignment.
5. The user can select any PDF file to preview it — the thumbnail strip and detail panel update to show that file's pages. Non-PDF files (e.g. images) can still be assigned and uploaded, just without a preview.
6. The user clicks Upload. Before uploading, the app checks each Drive destination for filename conflicts among the selected files. If any are found, conflicting files are flagged and the upload is aborted until resolved.
7. Uploads proceed with per-file progress. If a file fails, it shows an inline error and a Retry button; other uploads continue unaffected.
8. After all uploads complete, each subfolder group shows an "Open in Drive" link to its destination folder.
9. The user is prompted to delete or move to a local archive folder the source files that uploaded successfully.

### Layout

Drive Upload mode uses a three-column layout:

- **Left panel** (fixed width) — the file tree: root folder → subfolders (nested to match the local folder structure) → files. Each subfolder header is collapsible (starting expanded), shows a selection checkbox, an editable name, and its Drive destination folder. Each file shows a selection checkbox, an editable filename, inherits the parent subfolder's Drive destination (with an option to override), and — space permitting — displays file size and page count as secondary metadata. Edited names are the names used on Drive; the local files are not renamed on disk.
- **Middle panel** (adjustable width, drag handle on right edge) — thumbnail strip of the currently selected PDF.
- **Right panel** (fills remaining space) — the page detail view.

```
┌──────────────────────────────┐  ┌────────────┐  ┌───────────────────┐
│ Root: /output/batch  [Change] │  │            │  │                   │
│                               │  │  [page 1]  │  │                   │
│ 📁 invoices/                  │  │  [page 2]  │  │   Detail view     │
│    Drive: Finance/Invoices ▼  │  │  [page 3]  │  │   (selected page) │
│    📄 2026-07-01 invoice.pdf  │  │            │  │                   │
│       3 pages · 1.2 MB        │  │            │  │                   │
│    📄 2026-07-02 invoice.pdf  │  │            │  │                   │
│       2 pages · 0.8 MB        │  │            │  │                   │
│                               │  │            │  │                   │
│ 📁 receipts/                  │  │            │  │                   │
│    Drive: [not assigned] ▼    │  │            │  │                   │
│    📄 2026-07-01 receipt.pdf  │  │            │  │                   │
│       1 page · 0.4 MB         │  │            │  │                   │
│                               │  │            │  │                   │
│ 📄 misc.pdf                   │  │            │  │                   │
│    Drive: [not assigned] ▼    │  │            │  │                   │
│    4 pages · 2.1 MB           │  │            │  │                   │
│                               │  │            │  │                   │
│ [Upload All]                  │  │            │  │                   │
└──────────────────────────────┘  └────────────┘  └───────────────────┘
```

Clicking a subfolder header selects all files in that group. Clicking a file selects it and loads its pages into the thumbnail strip and detail panel.

### Drive folder assignment

- Clicking a Drive folder field (on a subfolder header or an individual file) opens a **folder browser modal** displaying the user's Drive folder tree, fetched lazily on first open. A **recently used folders** list appears at the top for quick access.
- Selecting multiple items (files and/or subfolders) and assigning a Drive folder applies it to all selected items at once.
- A subfolder's Drive folder assignment propagates to all files within it. A file-level assignment overrides the parent subfolder's.

### Inclusion selection

- Every subfolder and file has a checkbox controlling whether it's included in the upload. Everything starts selected on a fresh scan; this always resets to fully selected (it is not remembered across scans, unlike Drive folder mappings).
- Checking or unchecking a subfolder recursively sets all of its descendants (nested subfolders and files) to the same state.
- Unchecking a single file or subfolder underneath an otherwise fully-selected subfolder puts that subfolder into an indeterminate state; this propagates upward through ancestors as needed. Unchecking the last remaining selected descendant of a subfolder leaves it fully unselected rather than indeterminate — and that resolution is itself recursive: if that was also the last selected descendant of its own parent, the parent becomes fully unselected too, and so on up to the root. The same recursive collapse applies symmetrically in the other direction: checking the last remaining unselected descendant leaves a subfolder fully selected rather than indeterminate, propagating upward the same way.
- Clicking an indeterminate subfolder's checkbox selects all of its descendants (an indeterminate checkbox click always selects, never clears).
- A toolbar-level "Select All" / "Select None" shortcut applies to the whole tree.
- Excluded files and subfolders don't need a Drive destination assignment and are skipped by the pre-upload conflict check and the upload itself. They remain visible, and PDFs can still be selected for preview.
- Selection checkboxes are disabled once the tree is locked (same `locked` state that freezes Drive folder assignment and renaming after "Upload All" is clicked).

### Remembered folder mappings

The app remembers Drive folder assignments keyed on local subfolder name. When a subfolder with a previously seen name is loaded, the app auto-fills its Drive destination. The user can change it before uploading. Mappings persist across sessions.

### Post-upload cleanup

After a successful upload batch, the user is prompted to either delete the source files or move them to a local archive folder. The archive folder destination can be configured and is remembered across sessions.

### Persisted settings

- Drive folder mappings (local subfolder name → Drive folder)
- Recently used Drive folders
- Last-used root local folder
- Local archive folder path

### Authentication

Google OAuth via a browser window, triggered the first time Drive Upload mode is used. Credentials are stored locally and reused in future sessions.

### Error handling

If a file upload fails, the error is shown inline next to that file in the left panel. Other uploads in the batch continue unaffected. The user can retry failed uploads individually without restarting the batch.

## Global error handling

The mode-specific "Error handling" sections above cover *expected* error conditions the app already knows how to name and react to (unequal page counts, filename conflicts, a failed upload). This section covers the remaining case: *unexpected* errors — bugs, panics, a call site that forgot to catch a rejected promise. Today those can fail silently (a swallowed exception, a stuck spinner) with no signal that anything went wrong. The goal is a fallback net that guarantees the user is notified, without trying to name or recover from the specific failure.

- **Frontend uncaught errors**: a top-level React error boundary around the app catches render-time exceptions, replacing the crashed subtree with a generic notice instead of a blank/frozen screen.
- **Frontend unhandled rejections**: a single `window.addEventListener('unhandledrejection', ...)` (plus `'error'` for non-promise exceptions) installed at startup shows a Mantine notification whenever an error reaches the top without having been caught by feature-specific handling. This is the backstop for the async call sites tracked in the "Various" checklist below — as those are migrated to explicit per-action error handling, this listener increasingly only fires for genuine bugs.
- **Backend panics**: each Wails-exposed RPC method recovers from panics and converts them into a returned error, so a bug in one RPC surfaces as a rejected JS promise (and thus hits the frontend backstop above) rather than crashing the whole process.
- **Presentation**: unexpected errors show a persistent (not auto-dismissing) notification — "An unexpected error occurred" plus the underlying error text. No retry/recovery is attempted automatically, since the cause is by definition unhandled and unclassified.

## Implementation checklist

### Primitives

- [x] **Go: PDF merge/split** — interleave and split PDFs with pdfcpu; hardcoded paths; `_test.go` harness, no UI
- [x] **Frontend: Thumbnail panel** — virtualized vertical scroll, on-demand per-page render via Go/mutool, resizable width with drag handle
- [x] **Frontend: Detail panel** — pan and zoom with `react-zoom-pan-pinch`, driven by selected page

### Merge mode

- [x] **Step 1: End-to-end merge pipeline** — Go `OpenFileDialog` / `SaveFileDialog` RPCs; `MergePDFs` Wails RPC; minimal UI with two file-picker buttons and a Merge & Save button; no thumbnails
- [x] **Step 2: Thumbnail strips** — two-column layout using existing `ThumbnailPanel` primitive, one per file, side by side; Merge & Save moves to toolbar
- [x] **Step 3: A/B selector + visual offset** — "First page in" toggle (File A / File B); second strip offset down by half a thumbnail height
- [x] **Step 4: Reverse checkbox + page-count warning** — "Reverse File B" checkbox wired into merge call; detect unequal counts and show info in toolbar
- [x] **Step 5: Detail panel** — existing `DetailPanel` primitive on the right; selection in either strip updates it; `←` / `→` keyboard navigation
- [x] **Step 6: Page editing** — rotate and skip within the merge view, applied before the merge call

### Split mode

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

### Drive Upload mode

- [x] **Step 1a: OAuth authentication** — Go backend only, no UI; OAuth via system default browser with localhost callback; credentials stored locally and reused across sessions
- [x] **Step 1b: Folder listing** — list contents of a hardcoded root folder and a hardcoded subfolder via Drive API
- [x] **Step 1c: File upload** — upload a hardcoded local file to a hardcoded Drive folder
- [x] **Step 1d: OAuth token refresh** — debug and fix `oauth2: "invalid_grant" "Token has been expired or revoked."` seen when querying Drive after the app has been left open for a day or two; the stored refresh token is now used to eagerly renew the access token (persisting the renewed token to disk), and Drive Upload falls back to re-prompting for auth if the refresh token itself is invalid
- [x] **Step 2a: Filesystem scan backend** — `scanLocalRoot` + `ScanLocalRoot` RPC; scans root folder recursively, returning files grouped by subfolder (nested to match the folder structure) with size and page count; symlinked directories are not followed; files whose page count can't be read are included and flagged via `Corrupt` rather than dropped
- [x] **Step 2b: File tree UI** — new Drive Upload tab; root folder picker; three-column layout shell; recursive, collapsible (default expanded) file tree wired to the scan, indented per nesting level, with file size and page count as secondary metadata; corrupt files shown with a warning icon
- [x] **Step 2c: Non-PDF file support** — non-PDF files (e.g. image scans) are scanned and shown too, not just PDFs, since the local root folder may hold mixed scan output; `LocalFile.IsPDF` distinguishes them, `Corrupt` only applies to PDFs; non-PDF files show file size only (no page count) and can't be previewed but can still be assigned and uploaded
- [x] **Step 3a: Drive folder browser backend** — `ListDriveFolder` App RPC, thin wrapper over the existing `DriveListFolder`
- [x] **Step 3b: Folder browser modal UI** — lazy-loaded Drive tree browsing and folder selection; no recently-used list yet
- [ ] **Step 3c: Recently used folders list** — persisted MRU list, shown in the modal
- [x] **Step 3d: Drive folder assignment UI** — assignment at subfolder and file level; a subfolder's assignment propagates to all files and nested subfolders beneath it unless overridden closer to the leaf; a clear (✕) control resets an explicit assignment back to inherited/not-assigned
- [ ] **Step 3e: Drive folder assignment UI** — batch assignment for multi-select
- [ ] **Step 3f: Create new Drive folder** — from within the folder browser modal, allow creating a new folder inside the currently browsed location and selecting it as the destination
- [ ] **Step 4: Inline renaming** — inline editable name for each subfolder and file (controls the Drive upload name, not the local filename); once Step 6 exists, renaming must also become disabled once an upload run has been triggered, alongside Drive folder assignment (see [`spec-drive-upload-step6.md`](spec-drive-upload-step6.md))
- [x] **Step 5: PDF preview** — selecting a file loads it into the middle thumbnail strip and right detail panel (reuses existing primitives)
- [x] **Step 6 prerequisite: Toolbar layout** — full-width toolbar strip above the three-column layout, matching the `Box` + `Group` toolbar pattern in `SplitMode`/`MergeMode`; root-folder picker moved into it (left-aligned); pure layout move, no behavior change
- [x] **Step 6a: Upload queue state model** — `uploadQueue` module-level singleton (matching `lib/pageCache`'s pattern) tracking per-file status (idle/queued/uploading/done/error); sequential (concurrency=1) worker; shared `flattenFiles(group)` tree-traversal utility; `UploadFile` App RPC wrapper around `drive.UploadFile`; no UI yet
- [x] **Step 6b: Upload modal** — dedicated modal with read-only tree rendering, per-file/per-group status, inline Retry, "Cancel remaining", blocking close behavior; see [`spec-drive-upload-step6.md`](spec-drive-upload-step6.md) for the UI/UX plan
- [x] **Step 6c-i: "Open in Drive" links** — `DriveAssignmentField` (used by both `GroupNode` headers and `FileList` rows, so this covers root-level files too) switches from the folder-picker badge to a Drive-opening link, keeping the same folder-path label, once every file it covers has finished uploading; the clear (✕) control disappears at the same point since the destination is locked in. Each file row in the upload modal also gets an "open destination folder" icon link, shown throughout the run since the destination is fixed before upload starts. Backed by a new `OpenDriveFolder` App RPC (`runtime.BrowserOpenURL`)
- [x] **Step 6c-ii: Read-only lock** — once "Upload All" is clicked, the file tree locks for the rest of that tree's session (every `DriveAssignmentField` badge becomes a Drive-opening link, same as a finished upload, since the destination is already fixed) and "Upload All" stays disabled; picking a new root is the only way back to an editable tree. Retrying failed files happens inside the upload modal, not via a separate control in the main tree
- [x] **Step 6d: Cancel in-flight upload** — a "Cancel" button aborts the currently uploading file (not just queued-but-not-started ones); backed by a per-job `context.WithCancel` passed through `UploadFile` down to the Drive API call; the aborted file is flagged "Cancelled" rather than left in an ambiguous "Uploading" state, since Drive may or may not have completed the upload before cancellation landed
- [ ] **Step 7: Remembered folder mappings** — auto-fill Drive destination from saved subfolder-name→Drive-folder mapping; persisted across sessions
- [ ] **Step 8: Post-upload cleanup** — prompt to delete or archive source files; archive moves files to a user-specified local archive folder
- [ ] **Step 9: Conflict detection** — check Drive for filename conflicts before uploading; flag conflicting files
- [ ] **Step 10: Keychain storage** — store the Drive refresh token in the macOS Keychain instead of a plain JSON file, so it is encrypted at rest and not readable by other user-level processes
- [x] **Step 11: Inclusion selection** — a checkbox per subfolder/file controlling whether it's included in the upload, tri-state (checked/unchecked/indeterminate) with the same recursive-propagation hierarchy as folder selection elsewhere in the tree: (un)checking a subfolder cascades to all descendants, and a partially-selected subfolder shows indeterminate and propagates that up through ancestors; clicking an indeterminate checkbox selects all descendants. Toolbar-level "Select All" / "Select None". Excluded items are skipped by the assignment gate, conflict check, and the upload queue, but remain visible and previewable. Checkboxes disabled once the tree is locked (same `locked` state as Step 6c-ii). Resets to fully-selected on every scan; not persisted. Visual treatment of excluded rows TBD.

### Global error handling

- [x] **Step 1a: Backend panic recovery** — a shared helper wraps each Wails-exposed RPC method with `recover()`, converting a panic into a returned error instead of crashing the process; verify with a deliberately panicking RPC
- [x] **Step 1b: Frontend unhandled-error listener** — `window.addEventListener` for `'unhandledrejection'` and `'error'`, installed once at startup, shows a persistent Mantine notification ("An unexpected error occurred" + the underlying error text) for anything not already caught by feature-specific handling
- [x] **Step 1c: React error boundary** — a top-level boundary around the app catches render-time exceptions and replaces the crashed subtree with a generic fallback notice instead of a blank/frozen screen

### Code cleanup

- [x] **Move `pageCache.ts` to `src/lib/`** — it's a module-level singleton, not a hook; only `usePageCacheRender` is a hook
- [x] **Move `usePDFFile.ts` into `MergeMode/`** — only used by MergeMode; SplitMode re-implements `rotate`/`toggleSkip` independently, so the hook is not truly shared
- [x] **Fix duplicate global keydown handlers** — both `SplitMode/ThumbnailPanel` and `DetailPanel` listen to `ArrowLeft`/`ArrowRight`/`Delete` on `window`; after page reordering, the panel navigates by visual order while DetailPanel navigates by numeric order — the last-registered handler wins, producing wrong navigation; remove the overlapping keys from `DetailPanel` and handle them only in the mode-level panel
- [x] **Remove unused packages** — `@mantine/dropzone` (CSS imported in `main.tsx` but component never used) and `zustand` (in `package.json` but never imported) can both be removed
- [ ] ~~**Wrap `toggle` in `useCallback` in `useOutputFiles.ts:25`** — the only exported function not memoized; causes `handleToggleSplitPoint` (which depends on it) to recreate every render despite its own `useCallback`~~
- [ ] ~~**Memoize `getSplitPoints` in `useOutputFiles.ts:79`** — creates a new `Set` on every call; make it a `useMemo` like `duplicateFirstPages`~~
- [x] **Name the magic pixel offsets in `MergeMode/index.tsx`** — `totalWidth - 22` and `colWidth + 26` are two different values for what comments describe as "scrollbar + gap"; name them as constants and reconcile
- [x] **Add `out.Sync()` in `pdf.go:copyFile`** — without a sync before close, a crash between write completion and OS flush can silently corrupt the output PDF
- [x] **Wrap `ThumbColumn` return in a Fragment** — currently returns a raw `JSX.Element[]` array; wrapping in `<>...</>` is more conventional and clarifies intent

### Styling cleanup

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
- [ ] Prevent buttons that trigger an async action (Merge & Save, Split & Export, Drive folder assignment/browsing, Drive upload, root folder pickers, etc.) from being pressed again while the previous invocation from that same button is still in flight; also generalize error handling for those async actions instead of each call site catching (or failing to catch) errors ad hoc — see "Global error handling" checklist above for the unexpected-error backstop
- [ ] `lib/pageCache.ts`'s render failures are silently swallowed — a failed thumbnail render is tracked internally (`isFailed()`) but never surfaced anywhere in the UI, so a systemic failure (e.g. `pdftoppm` missing) looks like thumbnails just never load, with no explanation. Needs a real UX design (e.g. a per-thumbnail broken-image indicator) rather than routing it through the generic unexpected-error notification, since a batch of concurrent failures across visible thumbnails would otherwise pop many persistent notifications at once.


## Code review findings

Findings from a source review of the current codebase (non-Drive code). Drive Upload findings are tracked separately below since that mode is still under construction.

- [x] **Split mode leaks page-cache memory** — `SplitMode` never calls `pageCache.evict()`, on file change or unmount, unlike `MergeMode` which does both. Every PDF opened in Split mode leaves its rendered thumbnails and full-res detail images in memory permanently.
- [x] **`Shift+R` (rotate counter-clockwise) is not implemented** — documented in the keyboard shortcuts table, but only clockwise rotation exists anywhere (thumbnail button and the `r` key both just do `+90°`); there is no CCW code path at all.
- [x] **`DetailPanel`'s rotate shortcut breaks under Shift/Caps Lock** — its keydown handler checks `e.key === 'r'` only, so with Shift held (or Caps Lock on) `e.key` is `'R'` and nothing happens, not even a clockwise rotate.
- [x] **Thumbnail controls are keyboard/screen-reader unreachable** — rotate/skip/move buttons on thumbnails, split-point gap zones, and the folder-path click target are all unlabeled `<div onClick>`s: not focusable, no `role`/`aria-label`.
- [x] **Unthrottled page-cache effect causes re-renders on every mouse move** — `SplitMode/ThumbnailPanel` and `MergeMode/ThumbnailPanel` both run a page-cache-loading `useEffect` with no dependency array, so hovering a thumbnail (`hoveredPage`/`hoveredGap` state) re-runs the load loop over the whole visible virtual window on every render.
- [x] **Spec says `mutool`, code uses `pdftoppm`** — `app.go`'s `RenderPage` shells out to `pdftoppm` (poppler), not `mutool draw` as documented in the tech stack section above; system dependency claim is stale.
- [x] **Spec still lists Zustand as the state library** — it was removed as an unused dependency (see Code cleanup); state is plain React hooks throughout. Tech stack section needs updating.
- [x] **`.gitignore` is incomplete** — doesn't cover `.DS_Store` or the compiled `paper-scan-processor` binary at repo root; both currently show as untracked.
- [x] **`pdfFromPage` silently falls back to page `0` on parse failure** — `pdf.go`'s `fmt.Sscanf` result is never checked; if pdfcpu's split-filename convention ever changes, a page would silently sort to the front instead of raising an error.
- [x] **No frontend tests at all** — Go has solid coverage but there isn't a single frontend test file. The pure-logic hooks (`useOutputFiles`, especially `duplicateFirstPages`/`getSplitPoints`) are exactly the kind of thing that's easy to get subtly wrong and hard to verify by eye in the running app; worth unit-testing even if UI itself stays manually tested.

### Drive Upload (code not finished)

- [ ] **Drive API queries are built with unescaped string interpolation** — `DriveFindFolder`/`DriveListFolder` use `fmt.Sprintf` to embed `name`/`parentID` into the query string. A folder name containing a single quote breaks the query (acknowledged in a comment but not handled); should escape `'` per Drive's query syntax.
- [ ] **`DriveFindFolder` doesn't handle duplicate folder names** — it takes `result.Files[0]` unconditionally, but Drive allows multiple folders with the same name in the same parent, so resolution is nondeterministic once that happens.
- [ ] **`DriveListFolder` has no pagination** — `Files.List()` is called once; results are silently capped at Drive's default page size (~100 items) with no error or indication that the list is incomplete. Confirmed actively reachable now: it's the RPC directly behind Step 3b's interactive folder picker (`ListDriveFolder` in `app.go`), so browsing into any real Drive folder with 100+ children silently truncates the list with no indication.
- [ ] **No caching of the authenticated Drive client** — `driveService` re-reads and re-parses `drive_token.json` from disk on every single API call instead of caching a client in memory; will multiply once concurrent per-file uploads (Step 5) exist. Confirmed actively reachable now: every single folder-expand click in Step 3b's picker triggers one of these disk reads.
- [x] **Refreshed OAuth tokens are never written back to disk** — only the first-run flow calls `driveSaveToken`; every later call reloads the same stale on-disk token and silently re-refreshes it against Google again. Fixed as part of Step 1d: `driveClientWithConfig` now persists a refreshed access token back to disk when it changes.
- [x] **OAuth callback server has no concurrency guard** — `driveRunOAuthFlow` binds a hardcoded port (8765) with no mutex/single-flight protection; two concurrent calls into `driveService()` before a token exists will race to bind the same port, and the loser gets a raw "address already in use" error. Fixed by `driveClientMu`, which serializes `driveService` calls.
- [ ] **`driveSaveToken` discards the `Close()` error** — after encoding the token, the deferred `f.Close()` error is silently dropped (unlike the one place in the same file that explicitly acknowledges doing so with `//nolint`); a failed flush is reported as success and only surfaces later as a corrupt/unreadable token file.
- [ ] **Refresh token is stored as plaintext JSON** — readable by any local process running as the same user. Already tracked as Step 9 (Keychain storage) below, but worth flagging that the current implementation doesn't yet meet the "stored locally" bar the spec's Authentication section implies.

### Drive Upload Steps 2–3d (code review findings, high-effort multi-angle pass)

Correctness / robustness:

- [ ] **Drive assignments and collapsed-group state survive a root-folder switch** — `useDriveAssignments()`/`collapsedGroups` in `DriveUploadMode/index.tsx` are never reset when `useFileTree`'s `root`/`tree` changes. Assigning root A's "invoices" subfolder to a Drive folder, then switching to a different root B that also has a top-level "invoices" subfolder, makes B's subfolder immediately show A's assignment even though nothing was set for B.
- [ ] **One unreadable subdirectory aborts the entire scan** — `filetree.go`'s `scanDirectory` propagates any single subdirectory's `os.ReadDir` error all the way up (`if err != nil { return LocalFileGroup{}, err }`), instead of skipping just that subfolder the way one corrupt file is skipped. A root with hundreds of valid PDFs plus one permission-restricted subfolder three levels deep fails the whole scan with no partial tree shown.
- [ ] **`os.Stat` failure silently drops a file instead of flagging it corrupt** — `scanDirectory`'s own doc comment says unreadable files "are still included, flagged via Corrupt... rather than dropped," but that's only true for `pdfPageCount` failures; an `os.Stat` failure (permission change, broken symlink, TOCTOU race) hits `continue` and the file vanishes from the tree with no warning at all.
- [ ] **No request correlation when switching root folders** — `useFileTree.ts`'s `pickRoot` has no guard against concurrent invocation, and the root picker stays clickable mid-scan. Picking folder A then quickly picking folder B before A's (slower) scan resolves can leave the tree showing A's contents while the displayed root path says B.
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
- [ ] **`PickerTarget`/`onSelect` only support one target at a time** — sized for the current single-field-click flow; Step 3e (batch assignment for multi-select) will need this reworked to apply one picked folder to many targets at once.

## Future / out of scope for v1

- **Insert pages from another PDF**: allow the user to pull pages from a second PDF into the current document before splitting. Planned for v2.
- **Scanning integration**: trigger a scan from within the app using OS or device APIs. Not currently planned but under consideration.
- **Page reordering**: drag thumbnails to reorder pages before export or merge. No clear use case identified for the current workflow; omitted from v1.
- **Pre-upload duplicate-scan review**: a review screen before upload, grouping queued files by Drive destination folder and showing them alongside files already present there, so the user could visually catch the same document scanned twice under different names/bytes. Descoped — accidental duplicate uploads are expected to be rare enough that the UI isn't worth building. If revisited, the design work landed on: gate the upload action until every file has an effective (own-or-inherited) Drive destination assignment; present the review as a modal, consistent with the existing Drive folder picker; group by *resolved* Drive destination folder id (merging local subfolders that resolve to the same Drive folder); and, since a destination folder can hold hundreds of existing files, avoid a full side-by-side dump by merging queued (highlighted) and existing files into one alphabetically-sorted list, showing only existing entries within ±1 position of a queued entry (likely-duplicate names sort near each other) and collapsing the rest into an expandable "⋯ N more files ⋯".
