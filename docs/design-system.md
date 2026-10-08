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

### 2.1 Color

Raw palette first, semantic aliases second. Screens use the aliases; the raw names exist so the aliases can be re-pointed in one place.

```css
:root {
  /* --- raw --- */
  --orange-500: #D97757;   /* brand. 3.1:1 on white — accent and large text only */
  --orange-600: #B4542F;   /* 4.9:1 on white — the orange that may carry body-size text */
  --orange-100: #F8E6DE;

  --ink-900: #1A1A1A;
  --ink-700: #3D3D3D;
  --ink-500: #6B6B6B;      /* 5.7:1 on white — lowest grey allowed for text */
  --ink-300: #C9C9C9;      /* borders, dividers — not for text */
  --ink-100: #F2F2F0;      /* panel background */
  --ink-50:  #FAFAF8;      /* page background, warm white */
  --white:   #FFFFFF;

  --red-600:    #B42318;
  --red-100:    #FBE9E7;
  --amber-600:  #A15C07;
  --amber-100:  #FBF1DC;
  --teal-600:   #0E7C6B;
  --teal-100:   #DDF3EF;
  --green-600:  #2E7D32;
  --green-100:  #E3F2E4;
  --slate-600:  #556070;
  --slate-100:  #E9ECF0;

  /* --- semantic --- */
  --color-bg:            var(--ink-50);
  --color-surface:       var(--white);
  --color-surface-2:     var(--ink-100);
  --color-border:        var(--ink-300);
  --color-text:          var(--ink-900);
  --color-text-2:        var(--ink-700);
  --color-text-3:        var(--ink-500);

  --color-primary:       var(--orange-500);
  --color-primary-strong:var(--orange-600);   /* links, text-on-light */
  --color-primary-soft:  var(--orange-100);
  --color-on-primary:    var(--ink-900);      /* text ON an orange button — NOT white, see §4 */

  --color-danger:        var(--red-600);
  --color-danger-soft:   var(--red-100);
  --color-focus:         var(--orange-600);
}
```

**Severity** — mirrors the `incidents.severity` CHECK (`P1`..`P4`, migration 0002). A separate hue ramp from the brand so an orange button never reads as "P2".

```css
  --sev-p1:      var(--red-600);   --sev-p1-soft:   var(--red-100);
  --sev-p2:      var(--amber-600); --sev-p2-soft:   var(--amber-100);
  --sev-p3:      var(--teal-600);  --sev-p3-soft:   var(--teal-100);
  --sev-p4:      var(--slate-600); --sev-p4-soft:   var(--slate-100);
```

**Status** — mirrors the `incidents.status` CHECK (`detected`, `investigating`, `mitigated`, `resolved`, `postmortem`). Note the server only accepts a transition to `resolved` today (`PATCH /incidents/:id` returns `400 unsupported_status` for anything else — `server/src/incidents/routes/resolve.ts`), so only two of these are reachable from the UI; the other three still render because the agent or a seed can set them.

```css
  --status-detected:      var(--red-600);
  --status-investigating: var(--amber-600);
  --status-mitigated:     var(--teal-600);
  --status-resolved:      var(--green-600);
  --status-postmortem:    var(--slate-600);
```

**Timeline entry type** — the five values in `timeline_entries.type`. Only a left-rule color, no fill:

```css
  --entry-observation: var(--slate-600);
  --entry-action:      var(--teal-600);
  --entry-finding:     var(--amber-600);
  --entry-system:      var(--ink-300);
  --entry-ai-draft:    var(--orange-500);   /* the one thing in the timeline that is brand-colored: it is asking for a human decision */
```

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

  --shadow-1: 0 1px 2px rgba(26, 26, 26, 0.06);
  --shadow-2: 0 4px 12px rgba(26, 26, 26, 0.08);
  --shadow-3: 0 16px 40px rgba(26, 26, 26, 0.16);   /* modal only */

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

**Every data-bearing screen renders all four:** loading (Spinner), empty (EmptyState), error (ErrorState), populated. The roadmap's gap table tracks which of these the current screens are missing — the answer today is all of them, everywhere.

## 4. Accessibility rules

These are checked, not aspired to.

1. **Contrast.** Body text ≥ 4.5:1, large text and UI borders ≥ 3:1 (WCAG AA). Computed for the palette above [approximate, from relative luminance]: `--orange-500` on white ≈ **3.1:1** — accent, borders, large text only. `--ink-900` on `--orange-500` ≈ **6.0:1** — this is why `--color-on-primary` is near-black, not white. `--orange-600` on white ≈ **4.9:1** — the only orange allowed for body-size text and links. `--ink-500` on white ≈ **5.7:1**. Verify with a contrast checker before shipping the tokens; the figures here are hand-computed.
2. **Focus.** `:focus-visible` on every interactive element: 2px `--color-focus` outline, 2px offset. Never `outline: none` without a replacement.
3. **Keyboard.** Every action reachable by Tab/Enter/Space. Modal traps focus and restores it. Tables with row click also expose a real link or button in the row.
4. **Not color-only.** Severity and status are always a text label plus color, never a colored dot alone.
5. **Forms.** Every input has a visible `<label>`. Errors are text, associated via `aria-describedby`, announced via `role="alert"`.
6. **Live regions.** New timeline entries arriving over the socket are announced once via a polite live region, not per-entry focus steals.
7. **Reduced motion.** Honoured globally (§2.5). The 3D hero renders a static image under it.
8. **Target size.** Interactive targets ≥ 24×24 CSS px; primary actions ≥ 40px tall on phone.
9. **Zoom.** Nothing breaks at 200% browser zoom; no `maximum-scale` in the viewport meta.

## 5. Dark mode

**Decision: none for the MVP.** One theme, light, warm-white background.

Reason: the demo runs on a projector in a lit room (schedule.md, "not embarrassed by them on a projector"), one theme halves the states to verify, and every token above is already structured as raw → semantic so a `[data-theme="dark"]` block that re-points only the semantic aliases can be added later without touching a component. That later block is the whole cost of dark mode under this system; doing it now buys nothing for Oct 9.

## 6. What this replaces

Every value in §2 replaces an ad hoc one. The inventory script's full output is reproducible from `client/src` with the one-liner in the commit that adds `tokens.css`, so the before/after is checkable: the target is **0 raw hex values in component CSS** once the roadmap is complete.
