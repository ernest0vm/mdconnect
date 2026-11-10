# Design

## Context

- `PageShell` centers one column, at most `max-w-md` (28 rem) wide, on a gradient backdrop. It renders the children, then the source footer and the Appearance control.
- `ConnectScreen` renders everything in one `GlassPanel`: the title, the device, `DiscPanel`, alerts and Connect another device.
- `DiscPanel`, after edit-disc, owns the reader, the read result, the edit state, the selection and the dialogs. It renders the disc header, the capacity text, the toolbar and a track list capped at `max-h-[50vh]`.
- The desktop main window opens at 960 × 720 with no minimum size.
- The app has no fake device that renders the connected screen in a browser, so connected layouts can only be checked with hardware today.

## Goals / Non-Goals

**Goals:**

- One responsive structure, built with CSS grid and Tailwind's `sm` (640) and `lg` (1024) breakpoints. It is shared by the desktop app and the web app.
- Leave room for a local-files column (upload) and a player bar without reworking the grid.
- Keep every edit-disc behaviour and its tests untouched; this change moves markup, not logic.

**Non-Goals:**

- Visual theming (a SonicStage-like look). The structure only uses the existing GlassyUI surfaces.
- Container queries or a resizable split between the columns.

## Decisions

### 1. Two shells: centered and app

`PageShell` gets a `layout` prop:

- **`centered`** keeps today's markup. The connect screen uses it before a device opens, and so does the unsupported-browser screen.
- **`app`** is a full-viewport grid (`h-dvh`, rows `auto 1fr auto`): header, main area, footer. The page never scrolls; the main area hands its height down with `min-h-0`, so the track list can scroll inside it.

`ConnectScreen` picks the layout: `app` once `controller.openDevice()` returns a device, `centered` otherwise. Alerts (unplug hint, guidance) sit at the top of the main area in the app layout.

Alternative: one shell that only changes widths. Rejected, because the connected screen needs a fixed viewport height so the list scrolls inside it. A centered card needs the page to scroll.

### 2. Main area grid

- **Below `lg`:** a single column with rows `auto 1fr`, the disc summary above the track area.
- **At `lg` and up:** columns `minmax(18rem, 22rem) 1fr`, the summary on the left and the track area on the right.
- Named grid areas (`summary`, `tracks`). The upload change can add a `source` area to the left and a `transfer` area between the columns without touching the existing two.

### 3. Split `DiscPanel` rendering, not its state

`DiscPanel` keeps all state. It renders two siblings into the grid areas:

- **`DiscSummary`:** the title and subtitle, the write-protected badge, the capacity bar, Rename disc, Refresh, and the read and edit notices.
- **`TrackArea`:** the toolbar, the column headings and the scrolling list.

Both are presentational components in the same feature folder, fed by `DiscPanel`. The reading, notice and warning states fill the track area instead of the list.

### 4. Track area as a table

Use a `<table>`:

- a sticky `<thead>` with the headings #, Title, Duration and Mode;
- one `<tbody>` per group, starting with a group row whose `<th scope="rowgroup">` holds the group title and the Rename group and Ungroup buttons.

Rows keep the drag handlers and checkboxes from edit-disc. A table gives assistive technology real column headings, which the current `ol` lacks.

The toolbar sits above the table, outside the scrolling element, so it stays in view. Below `sm`, the Mode column is hidden and the mode is printed under the title. Titles keep `overflow-wrap: anywhere`.

Alternative: CSS grid rows with `role="row"`. Rejected: reproducing table semantics with ARIA roles is more code and easier to get wrong.

### 5. Capacity bar

Add a `GlassMeter` to `packages/ui`:

- a track with a filled part;
- `role="meter"`, with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and an `aria-valuetext` such as "30:00 used of 80:00".

The used, free and total text stays next to it. The native `<meter>` was rejected: browsers style it differently, and it ignores the theme tokens.

### 6. Desktop window size

In `createMainWindow`:

- `width` and `height` are `min(1200, workArea.width)` and `min(800, workArea.height)`, read from `screen.getPrimaryDisplay().workAreaSize`.
- `minWidth: 480` and `minHeight: 560`.

The behaviour is the same on macOS, Windows and Linux. Electron enforces the minimum on all three. Wayland compositors that ignore minimum sizes only lose the guard; the layout still handles narrower widths.

### 7. Demo device for development

To check layouts without hardware, `yarn dev:web` with `?demo` in the URL connects a fake device. It replays the anonymised MZ-NE410 recording (`mz-ne410-grouped-lp4.json`) through the existing `NetMdUsbDevice` interface:

- **Dev-only:** the module is imported only under `import.meta.env.DEV`, so production builds and the desktop app do not include it. A test checks that the production bundle contains no `demo` code path.
- **Read-only:** edits fail with the normal "device refused" message.

Alternative: screenshots only with the real device. Rejected, because every layout check would need hardware and a free USB port.

### 8. Both targets

- The desktop app and the web app share the same components.
- Only the desktop app gets a window size.
- The web app relies on the viewport meta tag that `apps/web/index.html` already has (`width=device-width, initial-scale=1.0`).

## New dependencies

None.

## Risks / Trade-offs

- [`h-dvh` and nested `min-h-0` grids are easy to break, and the list then grows the page] → A manual check at three widths in both targets, and a long fixture in the demo device.
- [Sticky table headers inside an overflow container are buggy in some browsers] → Both targets are Chromium, where sticky `<thead>` cells work. The toolbar is outside the scroller anyway.
- [Moving `DiscPanel` markup can regress edit-disc behaviour] → The logic tests stay unchanged. The edit-disc hardware steps are repeated on the new layout in the verification task.
