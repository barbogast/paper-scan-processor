# Drive Upload — Step 6: Upload queue (UI/UX plan)

Scope: UI/UX only. Backend wiring (an App RPC around the existing `drive.UploadFile`,
any progress plumbing) is a separate, later concern.

## Per-file state model

New hook, `useUploadQueue`, lifted in `DriveUploadMode` alongside `useFileTree` /
`useDriveAssignments`. Tracks a status per `LocalFile.path`:

- `idle` — no run has touched this file yet
- `queued` — a run has started; waiting its turn
- `uploading` — actively transferring
- `done` — succeeded
- `error` — failed, carries an error message

A group's status is never stored directly — it's derived by rolling up its files'
statuses (recursively through subgroups), the same way effective Drive-folder
assignment is already resolved by walking down from the group.

## Concurrency

Sequential worker (concurrency = 1) for the first version: one file `uploading` at a
time, others sit `queued` in tree order. The status model above is concurrency-agnostic
— bumping to an N-way pool later is a scheduler change only, not a UI redesign.

## Prerequisite: toolbar layout

`DriveUploadMode` doesn't have a toolbar today — `ResizableLeftPanel` is the whole
body, and the root-folder picker (`ClippedPath`) lives inline at the top of the left
panel. Before step 6, add a toolbar strip spanning the full width above the
three-column layout, structurally matching the `Box` + `Group` toolbar already used in
`SplitMode`/`MergeMode`, and move the root-folder picker into it (left-aligned).
`Upload All` will land in this same toolbar (right-aligned) once step 6 builds it.
This is a pure layout move — no behavior change to `pickRoot`/`useFileTree`.

## Upload All button

Location: the toolbar from the prerequisite step above, right-aligned — matching
where Merge & Save (`MergeMode`) and Export (`SplitMode`) already sit, rather than the
bottom of the left panel as sketched in spec.md's current mockup.

There's no "run in progress" state for the button itself: the moment a run starts,
the modal opens and its overlay sits on top of the toolbar, blocking and dimming it
(same as everything else behind it). Whatever the button displayed right before the
click is inert and hidden under the overlay for the duration of the run. The button
only needs two states:

- **Nothing uploaded yet (or nothing left to retry)** — label "Upload All". Disabled
  (with a tooltip explaining why) until every file in the tree resolves to an
  effective Drive assignment (own or inherited from a group). Clicking starts a run
  over every file and opens the upload modal.
- **Run finished, some files failed** — label "Retry Failed (2)", enabled. Clicking
  reopens the modal and re-queues only the `error` files — it does not re-touch files
  that are already `done`.
-- **Run finished, everything succeeded**: nothing left to upload, so re-running
would create duplicates on Drive — disabled, label "All Uploaded".

## Left panel becomes read-only

Once "Upload All" is clicked for the first time, the entire file tree becomes
read-only for the rest of that tree's session — not just while the modal is open, but
after it closes too, regardless of whether a given file ended up `done`, `error`, or
was never attempted. This covers every `DriveAssignmentField` badge (group-level and
file-level), and, once inline renaming (step 4) exists, the filename inputs as well.
Retry always re-sends to the same locked-in destination and name. The only way out of
read-only is picking a new root folder, which discards the whole tree and upload-queue
state and starts fresh.

This avoids having to reconcile "the user changed the destination or name of a file
that already uploaded" — it simply can't happen.

## Upload modal

Rather than showing live progress inline in the main tree — which would require
individually disabling the root-folder picker, every assignment badge, inline rename
inputs, and the mode tab bar in `App.tsx` — the upload run owns a dedicated modal
(same `Modal` component/pattern as the Split-mode success modal).

Mantine's `Modal` renders a full-viewport overlay and traps focus by default, so it
blocks interaction with everything behind it (tree, root picker, tab bar) with no
extra plumbing into those components. While a run is active:

- `closeOnClickOutside={false}`, `closeOnEscape={false}`, no close button.
- A **"Cancel remaining"** action in the footer: stops starting new files (does not
  abort an in-flight request), letting the user close once the current file resolves.

Content: a read-only rendering of the group/file tree (no collapsing, no assignment
badges, no click-to-preview — simpler than reusing `GroupNode`/`FileList` as-is, so
this is a small dedicated component built for the modal).

- **File row**: name + status —
  - `queued` — dimmed "Queued"
  - `uploading` — `Loader size="xs"` + "Uploading…"
  - `done` — green ✓ + "Uploaded"
  - `error` — red ⚠ + error message + inline **Retry** button (re-queues just that
    file, doesn't affect others or restart the batch)
- **Group header**: rollup count while in progress (e.g. "3/5").

Progress is indeterminate (spinner, not a percentage bar) since Drive's simple upload
doesn't give byte-level progress without resumable upload.

"Close" is disabled while anything is `queued`/`uploading`; becomes available once the
run reaches a terminal rest state (success or with failures still showing Retry).

## After the modal closes

Upload-queue state persists past the close (it's lifted in `DriveUploadMode`, not
modal-local), so the main tree reflects the last run:

- `GroupNode` header shows an **"Open in Drive"** link (opens the group's assigned
  Drive folder) in place of the assignment badge/rollup, once every file in that group
  is `done`.
- `FileList` rows get a small terminal ✓/⚠ badge next to the size/page-count line for
  files that were part of the last run.
- "Upload All" reflects the state machine above ("Retry Failed (N)" / "All Uploaded").

## Implementation notes

- **Shared tree-traversal utility.** Three consumers need to walk the same
  `LocalFileGroup` recursion: the sequential worker (needs a flat, ordered file list
  to know what to upload next), the modal's per-group rollup counts, and the
  "every file in this group is `done`" check driving the Open-in-Drive link. Write one
  function (e.g. `flattenFiles(group): LocalFile[]`) that all three consume, rather
  than three independent recursive walks over `subgroups` that could drift out of sync
  with each other's handling of nesting.
- **Backend RPC.** `drive.UploadFile(ctx, localPath, folderID)` exists as a Go function
  but has no Wails App-level RPC wrapper yet — 6a needs to add one (bindings will
  regenerate via Wails, don't hand-edit `frontend/wailsjs/`). Give it a `name`
  parameter (defaulting to `filepath.Base(localPath)`, unused until step 4 wires up
  inline renaming) so the signature doesn't need to change again once renaming lands.

## Explicitly out of scope for this step

- Conflict-check UI before upload — step 9.
- Post-upload delete/archive prompt — step 8.
- Recently-used folders list, batch (multi-select) assignment, inline renaming — steps
  3c, 3e, 4, tracked separately.
- Byte-level upload progress.

## Suggested checklist breakdown (for spec.md)

- **Prerequisite**: add the toolbar strip; move the root-folder picker into it.
- **6a**: `useUploadQueue` state model + sequential worker (no UI yet).
- **6b**: Upload modal — tree rendering, per-file/per-group status, Retry, Cancel
  remaining, blocking close behavior.
- **6c**: Post-run residual state in the main tree — terminal badges, "Open in Drive"
  links, Upload All button state machine, read-only lock on the file tree.
