# Focal Control — prototypes

Two linked HTML/CSS/JS prototypes for a restaurant patio-heater control system, plus a
standalone, unrelated map-authoring tool. No build step — every page is a single static
HTML file you can open directly or serve with any static file server.

## Files

| File | What it is |
|---|---|
| `focal-control-dashboard-prototype.html` | Main dashboard: system status, quick heat controls, restaurant map, per-zone heater rails, quick-set and per-heater action modals. **Entry point.** |
| `focal-scheduling-prototype.html` | Schedule editor, reached from the dashboard's "Edit Schedule" link. Master on/off switch + per-day weekly hours. |
| `focal-shared.css` | Design tokens (color/spacing/radius/typography) and every reusable component style (`.btn`, `.text-btn`, `.section-header`, `.shelf-card`, `.status-item`, etc). Loaded by both pages above — **never duplicate a rule that belongs here**. |
| `focal-shared.js` | `window.FocalSchedule` — the schedule's localStorage key, default state, and date-math helpers (`isActiveNow`, `nextResume`, `to12Hour`, ...). Loaded by both pages above. |
| `focal-logo.svg` | Standalone copy of the Focal wordmark. Not currently referenced by any page (the dashboard inlines its own copy of the same paths so it renders with zero extra requests) — kept for reference/export. |
| `map-generator/index.html` | A separate, self-contained "Restaurant Map Generator" tool for authoring the kind of street/zone/entrance site-plan SVG the dashboard's Restaurant Map section shows. **Not linked to or from the two prototypes above** — no shared code, no shared state, different (light) visual theme. Lives in its own folder so its `.btn`/`.toast` class names can't collide with `focal-shared.css`. |

### Running locally

Any static file server works, e.g.:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/focal-control-dashboard-prototype.html
```

Opening the HTML files directly via `file://` also works for everything except the modal
focus trap's `inert` behavior in very old browsers (see [Accessibility](#accessibility) below)
and is otherwise fully supported.

## Design tokens (`focal-shared.css`)

All colors, spacing, radii, and font stacks are CSS custom properties on `:root`. Use these
instead of hardcoding a pixel or hex value — if a value you need isn't on the scale, that's
a signal to ask whether the design should change, not to reach for a raw number.

**Spacing** (4px base): `--space-1` (4px) through `--space-8` (32px).

**Radius**: `--radius-sm` (8px, inputs/small icon-buttons) · `--radius-md` (12px, buttons/toasts/callouts)
· `--radius-lg` (16px, shelf cards) · `--radius-xl` (20px, modal sheet) · `--radius-full` (pills/dots).

**Color**: surfaces (`--page`, `--panel`, `--card`, `--shelf-bg`, `--sheet-bg`), text (`--title`,
`--title-dim`, `--sub`, `--muted-dark`), semantic (`--danger`, `--accent`), heater identity
(`--purple` = Spot 1, `--orange` = Spot 2), and the button system (`--btn-fill`, `--btn-stroke`,
`--btn-fill-hover`, `--btn-stroke-hover`).

A few values are *intentionally* off the scale, with a comment at each site explaining why:
- `.text-btn:focus-visible`'s `border-radius: 2px` (a focus-ring shape, not a container radius)
- The scheduling page's `@media (max-width: 560px)` block (hand-tuned to keep a day row's
  name/times/switch on one line on phone-width screens — see git history for the wrapping bug
  this fixed)

### Component classes

- **`.btn`** — the base filled/bordered button (fill, stroke, shadow, hover/press/disabled states).
  Two size modifiers layer on top: **`.btn-full`** (44px, for primary standalone actions like
  "Zone 1", modal action rows) and **`.btn-section-action`** (36px, for the one action tied to a
  `.section-header`, e.g. "Set Zone 1 Heat", "Save Hours").
- **`.text-btn`** — underlined uppercase text link, for page-level nav and per-row actions that
  shouldn't compete visually with `.btn`.
- **`.section-label`** / **`.section-header`** — page-section headings. `.section-header` pairs an
  uppercase mono label with one right-aligned `.btn` action.
- **`.status-item`** / **`.status-pair`** — a status dot + label, never a button itself.
- **`.shelf-card`** / **`.shelf-strip`** — the borderless, near-black "shelf" background used for
  content groupings that aren't clickable cards (heater rail groups, map landmarks, the
  scheduling page's description/weekly-hours containers).

## Schedule state contract (`focal-shared.js`)

Both prototypes read/write one `localStorage` key, `focal-schedule-state`, exposed as
`window.FocalSchedule.STORAGE_KEY`.

**Shape:**
```json
{
  "on": true,
  "days": [
    { "closed": false, "start": "11:30", "end": "18:00" }
  ]
}
```
`days` is always exactly 7 entries, Monday-first (`FocalSchedule.DAYS`).

**Who reads/writes what:**

| | Dashboard | Scheduling page |
|---|---|---|
| Reads | Every 30s + on `storage` event + on bfcache restore (`pageshow`) | On load + on `storage` event + on bfcache restore |
| Writes | Never | On every toggle (instant) and on "Save Hours" |

The dashboard is **read-only** on this key — it derives "Active until 10:30 PM" / heater-lock
state from whatever the scheduling page last saved (or the shared default, before the
scheduling page has ever been visited).

`FocalSchedule.load()` never throws and never returns `null` — on a missing key, corrupt JSON,
or wrong day count, it returns a fresh copy of `FocalSchedule.DEFAULT_STATE`. Callers don't
need their own try/catch or fallback for this key.

**Known gap:** the loader validates day *count* but not each day's field types — a payload with
the right shape but malformed values (e.g. a non-`"HH:MM"` time string) will throw inside
`isActiveNow`/`nextResume` rather than falling back gracefully. Not expected to occur from the
UI itself (both pages only ever write values the UI itself produced), but a payload edited by
hand or written by a future integration wouldn't be caught.

## Accessibility

Addressed in this pass:
- Both pages now have a real heading hierarchy (`<h1>` restaurant name, `<h2>` section titles)
  instead of an all-`<div>` document with no outline.
- Toasts and the "Weekly hours saved" confirmation use `role="status" aria-live="polite"` so
  screen readers announce them.
- The invalid-hours warning uses `role="alert"`.
- Both modals trap focus via the `inert` attribute on everything outside the modal, move focus
  into the sheet on open, and restore focus to whatever triggered them on close. `inert` is
  supported in current Chrome/Edge/Safari/Firefox; in a browser old enough to lack it, the
  trap/restore behavior silently does nothing (the modal still opens/closes correctly) rather
  than erroring.
- Offline heaters are removed from the tab order (`tabindex="-1"`) — previously they stayed
  focusable via keyboard while their tap handler silently no-op'd, so a keyboard user could land
  on a control that appeared to do nothing.
- The dashboard's heater accessible labels use the customer-facing serial number, never the
  internal `HT-01`-style id, and correctly distinguish "set this spot's level" from "this spot's
  current level" controls (previously the second LED-row control for Spot 1 was mislabeled
  "Spot 2", which was a real bug, not just a naming inconsistency).
- `<i class="swatch" style="...">` inline styles replaced with `.swatch.purple`/`.swatch.orange`
  modifier classes, matching the pattern the other two swatch variants already used.

**Known gaps, not addressed in this pass:**
- The heater level LEDs (0–3 dots lit) have no `aria-valuenow`/slider semantics beyond the text
  label added above — a screen reader hears the current level as prose, not as a live value.
- No roving-tabindex/arrow-key navigation across the 60 heater sub-controls on the dashboard;
  Tab visits every one individually.
- `.status-item .dot` carries an `active`/`inactive`/`offline` class for state, but the visual
  distinction is color/glow only — the adjacent text always states the same thing in words, so
  this is mitigated but not ideal for color-only perception.
- `.status-item .dot.active` and `.day.closed` are written by JS with no dedicated CSS rule for
  the exact class name (`.dot.active` — the *base* `.dot` style already is the active look;
  `.day.closed` — nothing currently keys off it). Harmless today, but if you're looking for what
  `.dot.active` or `.day.closed` visually *do* and find nothing, that's why — they're
  self-documenting DOM state, not dead code to delete without checking intent first.

## Known non-goals / prototype limitations

- No backend: all state lives in `localStorage`, scoped to one browser. "Save Hours" and the
  toggle switch have no server round-trip to fail.
- The heater grid, zone counts, and rail layout (`HEATERS` array in the dashboard's script) are
  hardcoded for one fictional restaurant ("Little Shucker"), not data-driven.
- `focal-shared.js` validates the schedule's day *count* but not per-field types — see
  [Schedule state contract](#schedule-state-contract-focal-sharedjs) above.
