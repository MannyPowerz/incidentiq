# IncidentIOQ — Design System

**Status:** proposed, 2026-10-08. Nothing in `client/src` uses this yet.
**Scope:** the client only. Server and agent are untouched.

## 0. What the inventory found

Measured across all 29 `.css` files in `client/src` (script run 2026-10-08, counts are occurrences):

| Dimension | Today | Target |
|---|---|---|
| CSS custom properties | **0** | every color, size, radius, shadow, duration is a token |
| Distinct hex colors | **66** (+25 rgba) | 24 named tokens |
| Primary color | blue `#2563eb` ×20 | brand orange `#D97757` |
| Font family | `Arial, Helvetica, sans-serif` ×2, `inherit` ×2 | one system stack + one mono stack |
| Distinct font sizes | **36** (mix of `px` and `rem`) | 8-step scale, `rem` only |
| Font weights | 600 ×28, 700 ×21, 500 ×4, 400 ×1 | 400 / 500 / 600 |
| Distinct border radii | **20** | 4 |
| Distinct box shadows | **24** | 3 |
| Distinct spacing values | **47** | 8-step scale on a 4px base |
| Transition durations | 0.15s / 0.2s, ad hoc | 3 named durations + reduced-motion rule |

The 66 colors are not 66 decisions. They are the same ~10 ideas (page bg, card bg, border, three text greys, primary, danger, warning, purple accent) written slightly differently in each file. The purple `#6d4aff` / `#4f46e5` / `#7c3aed` family (12 uses) has no stated role and is dropped.

## 1. Where the system lives

```
client/src/styles/
  tokens.css      — every custom property below, on :root. Imported once in main.tsx.
  reset.css       — box-sizing, margin reset, font inheritance on form controls.
client/src/components/ui/
  Button.tsx + Button.css
  Input.tsx  + Input.css
  ...one folder per primitive in §3
```

Rules:
- Component CSS stays one file per component (the existing convention) but **may only reference `var(--…)` for color, size, radius, shadow, and duration**. A raw hex or `px` in a component stylesheet is a review failure.
- Tokens are the only place a value is written twice at most: once as a raw value, once as a semantic alias.
- No UI library. The primitives in §3 are the library.

## 2. Tokens

### 2.1 Color — dark premium, single theme

`client/src/styles/tokens.css` is the source of truth; this section records the roles, not the hex values, so it cannot drift. Raw palette first (`--navy-*`, `--cloud-*`, `--orange-*`, state hues), semantic aliases second. Screens use the aliases only.

| Alias | Role |
|---|---|
| `--color-bg` / `--color-surface` / `--color-surface-2` / `--color-field-bg` | page, card, raised row/hover, input well — four navy steps |
| `--color-border` / `--color-border-strong` | card edge (visible) / control edge (3:1, WCAG non-text) |
| `--color-text` / `--color-text-2` / `--color-text-3` | body / secondary / muted — all ≥ 4.5:1 on every surface |
| `--color-data` | pure white, reserved for live numbers and metrics so data is the brightest thing on screen |
| `--color-primary` / `-strong` / `-soft` | brand orange `#D97757`; hover brightens on dark; 16% tint for focus halos |
| `--color-on-primary` | near-black text on orange and danger fills — white on `#D97757` is ~3.1:1 |
| `--sev-p1..p4`, `--status-*`, `--entry-*` | mirror the `incidents.severity`, `incidents.status`, `timeline_entries.type` CHECKs; each has a `-soft` 16% tint for badge fills. Deliberately not the brand hue, so an orange button never reads as "P2" |
| `--live-idle/on/syncing/failing` | LiveDot states |
| `--glass-*` | the floating-layer recipe (§2.7) |
| `--mesh-1..3` | indigo / blue / orange, the sign-in backdrop only |

Only `ai_draft` is brand-colored in the timeline: it is the one entry waiting on a human decision.

**Contrast is tested, not asserted.** `src/styles/tokens.test.ts` resolves every alias to its hex and checks WCAG AA for each text/background pair, including text on glass composited over the brightest mesh color. Change a color freely; the test says whether it still reads.

### 2.2 Type

```css
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;

  --text-xs:   0.75rem;   /* 12 — badges, timestamps */
  --text-sm:   0.8125rem; /* 13 — table cells, meta */
  --text-base: 0.875rem;  /* 14 — body. Matches the most common sizes today (0.9rem, 13px, 14px) */
  --text-md:   1rem;      /* 16 — inputs, buttons */
  --text-lg:   1.125rem;  /* 18 — card titles */
  --text-xl:   1.375rem;  /* 22 — page titles */
  --text-2xl:  1.75rem;   /* 28 — sign-in heading */
  --text-3xl:  2.25rem;   /* 36 — hero only */

  --leading-tight: 1.25;
  --leading-body:  1.5;

  --weight-regular: 400;
  --weight-medium:  500;
  --weight-semibold:600;
```

No webfont. The system stack costs zero bytes and zero layout shift; the brand moment is the 3D hero, not a typeface. `--font-mono` is mandatory for: incident ids, lockfile hashes, node versions, migration filenames, pasted log context — anything a person might need to compare character by character.

### 2.3 Spacing — 4px base

```css
  --space-1: 0.25rem;  /* 4 */
  --space-2: 0.5rem;   /* 8 */
  --space-3: 0.75rem;  /* 12 */
  --space-4: 1rem;     /* 16 */
  --space-6: 1.5rem;   /* 24 */
  --space-8: 2rem;     /* 32 */
  --space-12: 3rem;    /* 48 */
  --space-16: 4rem;    /* 64 */

  --page-gutter: var(--space-4);       /* 16 at phone width */
  --content-max: 72rem;                /* 1152 */
```

### 2.4 Radius, shadow, border

```css
  --radius-sm: 0.25rem;   /* 4  — inputs, badges */
  --radius-md: 0.5rem;    /* 8  — buttons, cards */
  --radius-lg: 0.75rem;   /* 12 — modals, panels */
  --radius-pill: 999px;   /* status/severity badges */

  --shadow-1: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-2: 0 6px 20px rgba(0, 0, 0, 0.45);
  --shadow-3: 0 24px 60px rgba(0, 0, 0, 0.6);       /* modal, hero */
  --shadow-glow: /* orange ring + bloom — primary hover and the hero shape only */

  --border: 1px solid var(--color-border);
```

### 2.5 Motion

```css
  --dur-fast: 120ms;   /* hover, focus ring */
  --dur-base: 200ms;   /* toggles, badge changes */
  --dur-slow: 320ms;   /* modal, toast, drawer */
  --ease: cubic-bezier(0.2, 0, 0, 1);

@media (prefers-reduced-motion: reduce) {
  :root { --dur-fast: 0ms; --dur-base: 0ms; --dur-slow: 0ms; }
}
```

The reduced-motion rule zeroes the durations rather than per-component overrides, so one line covers every transition. The 3D hero checks the same media query and renders its static fallback.

### 2.6 Breakpoints

Phone-first. Four widths, checked on every screen before it is called done:

| Name | Min width | Used for |
|---|---|---|
| phone | 0 | single column, tables become stacked cards |
| tablet | 768px | two-column room details |
| desktop | 1024px | sidebar + content |
| wide | 1440px | content max-width kicks in |

### 2.7 Glass — the floating layer only

From Apple's HIG on Liquid Glass: glass is for controls and navigation that float above content (top bar, sheets, toasts), never for the content itself. Cards, tables, and timeline rows stay solid.

- One class, `.ui-glass` in `utilities.css`: translucent navy, 16px backdrop blur, hairline border, top highlight. Used today by `TopBar`, the `Modal` panel, and `Toast`.
- At most two glass layers stacked (top bar + one sheet).
- Contrast is checked against the busiest background glass can land on (`--mesh-2`), not a convenient one. Inside glass, muted text is promoted to `--color-text-2`, because the muted tone falls under 4.5:1 there.
- Goes solid under `prefers-reduced-transparency: reduce` and in browsers without `backdrop-filter`.

## 3. Primitives

Each lives in `client/src/components/ui/<Name>/`. Props are the public contract; a screen never reaches into a primitive's CSS.

| Primitive | Props | States | Notes |
|---|---|---|---|
| **Button** | `variant: 'primary' \| 'secondary' \| 'ghost' \| 'danger'`, `size: 'sm' \| 'md'`, `loading?`, `disabled?`, `type` | default, hover, focus-visible, active, loading (spinner replaces label, width held), disabled | Primary = orange bg + `--color-on-primary` text. Never white-on-orange (§4). |
| **Input** | `label` (required), `error?`, `hint?`, `type`, standard input props | default, focus, invalid (`aria-invalid`), disabled | Label is always rendered; `placeholder` is never the label. Error text has `role="alert"` — the existing `AuthForm` already does this and is the reference. |
| **Select** | `label`, `options: {value,label}[]`, `error?` | as Input | Needed by Create Room for `affected_system` (schedule: "free text is what makes relevance score nobody"). Native `<select>`, styled. |
| **Textarea** | as Input + `rows` | as Input | Timeline entry body, AI-draft context paste. Monospace when `mono` prop set. |
| **Badge** | `tone: 'severity' \| 'status' \| 'entry' \| 'neutral'`, `value` | — | Picks its color from the token family by `value` (e.g. `tone="severity" value="P1"` → `--sev-p1`). Pill radius. Text ≥ 12px, never color-only — the label text IS the value. |
| **Card** | `title?`, `actions?`, `padding: 'sm' \| 'md'` | — | Surface + border + `--shadow-1`. |
| **Modal** | `open`, `onClose`, `title`, `size: 'sm' \| 'md'` | open, closing | Focus trapped, `Esc` closes, returns focus to the opener, `aria-modal`, scroll lock. |
| **Table** | `columns`, `rows`, `rowKey`, `onRowClick?`, `empty: ReactNode` | — | Below `tablet` it renders each row as a stacked card using the same column defs. `<th scope="col">`. |
| **Toast** | `tone: 'success' \| 'error' \| 'info'`, `message`, `duration?` | enter, visible, exit | One region, `aria-live="polite"`, max 3 stacked, dismissible. Error tone uses `aria-live="assertive"`. |
| **Spinner** | `size: 'sm' \| 'md'`, `label` | — | `role="status"`, label visually hidden. Used inside Button and for page-level loading. |
| **EmptyState** | `title`, `body?`, `action?: ReactNode` | — | The "no rooms yet" / "no entries yet" / "nobody has published a fingerprint for this project" screen. |
| **ErrorState** | `title`, `body`, `retry?: () => void` | — | Renders an `ApiError`'s `message`. Never renders a raw object (the `validateBody` 400 puts a ZodError object in `message`; `client/src/auth/api.ts` already normalises that to a string — reuse it). |

Added with the dark redesign, for the real-time screens (tests: `cockpit.test.tsx`):

| Primitive | Props | Notes |
|---|---|---|
| **TopBar** | `links: {to,label}[]`, `right?`, `brandTo?` | Sticky glass header. One indicator element slides under the active `NavLink`, measured in a layout effect, so a route change reads as motion. |
| **LiveDot** | `state: 'idle' \| 'live' \| 'syncing' \| 'failing'`, `label`, `hideLabel?` | `role="status"`. Pulse ring while live/syncing, static under reduced motion. The label is always in the accessibility tree; the dot is never the only signal. |
| **Presence** | `users: {id,label}[]`, `max?`, `size?` | Overlapping initial chips, stable hue per user id, `+N` overflow, full name list in `aria-label`. |
| **Metric** | `label`, `value`, `detail?`, `tone?` | Stat tile. Value in mono `--color-data`; tone sets the left accent rule. |

**Every data-bearing screen renders all four:** loading (Spinner), empty (EmptyState), error (ErrorState), populated. The roadmap's gap table tracks which of these the current screens are missing — the answer today is all of them, everywhere.

## 4. Accessibility rules

These are checked, not aspired to.

1. **Contrast.** Body text ≥ 4.5:1, large text and UI borders ≥ 3:1 (WCAG AA), enforced by `tokens.test.ts` (§2.1). On the dark palette the brand orange itself clears 4.5:1 as link text, and near-black on orange stays the button pairing because white on `#D97757` is ~3.1:1.
2. **Focus.** `:focus-visible` on every interactive element: 2px `--color-focus` outline, 2px offset. Never `outline: none` without a replacement.
3. **Keyboard.** Every action reachable by Tab/Enter/Space. Modal traps focus and restores it. Tables with row click also expose a real link or button in the row.
4. **Not color-only.** Severity and status are always a text label plus color, never a colored dot alone.
5. **Forms.** Every input has a visible `<label>`. Errors are text, associated via `aria-describedby`, announced via `role="alert"`.
6. **Live regions.** New timeline entries arriving over the socket are announced once via a polite live region, not per-entry focus steals.
7. **Reduced motion and transparency.** Motion honoured globally (§2.5): the sign-in mesh stops drifting and the hero stops tilting. Transparency honoured by `.ui-glass` (§2.7).
8. **Target size.** Interactive targets ≥ 24×24 CSS px; primary actions ≥ 40px tall on phone.
9. **Zoom.** Nothing breaks at 200% browser zoom; no `maximum-scale` in the viewport meta.

## 5. Dark mode

**Decision (2026-10-08): dark premium is the only theme.** This reverses the original "light only for the MVP" call.

Why it changed: the product is a real-time war room, the screen people keep open while something is broken, and the reference set the redesign was built from (a premium dark cockpit, HIG glass for the floating layer) only works on dark. Shipping one theme keeps the original reason intact: half the states to verify. The raw → semantic split did what it was built for. The switch was a re-point of the aliases in `tokens.css` plus one `color-scheme: dark` line, and no component logic changed.

Cost accepted: the projector risk from the original decision. Mitigated by the contrast test, which holds every text pair at AA. A light theme later is the same move in reverse: a `[data-theme="light"]` block re-pointing the aliases.

## 6. What this replaces

Every value in §2 replaces an ad hoc one. The inventory script's full output is reproducible from `client/src` with the one-liner in the commit that adds `tokens.css`, so the before/after is checkable: the target is **0 raw hex values in component CSS** once the roadmap is complete.
