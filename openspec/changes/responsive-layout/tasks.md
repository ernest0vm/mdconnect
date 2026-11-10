# Tasks

## 1. Demo device for development

- [x] 1.1 Confirm `apps/web/index.html` has a `width=device-width` viewport meta tag. It does (`width=device-width, initial-scale=1.0`).
- [ ] 1.2 Add a dev-only demo device that replays `mz-ne410-grouped-lp4.json` when `?demo` is in the URL under `yarn dev:web`. Verify with a test that the replaying device answers the recorded read, and that `yarn workspace @mdconnect/web build` output contains no demo module.

## 2. Shell and grid

- [ ] 2.1 Add the `layout` prop to `PageShell` (`centered`, `app`) with the full-viewport grid and the footer at the bottom. Verify in the browser with the demo device that the page does not scroll at 1200 × 800 (app-layout: "Device connected", "Before connecting").
- [ ] 2.2 Switch `ConnectScreen` to the app layout once a device is open, with the header (device name, USB ID, Connect another device, Appearance) and the alerts at the top of the main area. Verify that connecting, unplugging and the replug hint still behave as in usb-device-access, using the existing controller tests and a manual unplug with the MZ-NE410.

## 3. Disc summary and track area

- [ ] 3.1 Add `GlassMeter` to `packages/ui` with `role="meter"` and `aria-valuetext`. Add a pure helper for the meter values from the disc capacity, with a test for 30:00 of 80:00 (app-layout: "Capacity bar").
- [ ] 3.2 Split `DiscPanel` rendering into `DiscSummary` and `TrackArea`, with state unchanged. Verify that all edit-disc tests still pass unchanged.
- [ ] 3.3 Render the track area as a table: a sticky header, one `tbody` per group with a group header row, the toolbar outside the scroller, and the mode under the title below `sm`. Verify with the demo device that the headings and toolbar stay visible while scrolling 60 tracks (app-layout: "Long disc").

## 4. Responsive checks

- [ ] 4.1 Manual verification in the web app with the demo device, in light and dark:
  - at 1200 × 800: two columns (app-layout: "Desktop window");
  - at 800 × 1024: one column (app-layout: "Tablet width");
  - at 375 × 812: no horizontal scroll, the toolbar wraps, and the mode shows under the title (app-layout: "Phone width").

  Record screenshots in the PR.

- [ ] 4.2 Measure contrast for the capacity bar, the table headings and the group rows in both appearances: 4.5:1 for text and 3:1 for the bar.

## 5. Desktop window

- [ ] 5.1 Set the window size from the work area, with a 480 × 560 minimum. Verify with a main-process test of the computed size for a large and a small work area (app-layout: "First open").
- [ ] 5.2 Manual verification on macOS: the window opens at 1200 × 800, stops at 480 × 560 when resized, and the layout stays usable at that size with the MZ-NE410 connected (app-layout: "Resize"). Repeat the edit-disc steps 1, 3 and 4 on the new layout.
