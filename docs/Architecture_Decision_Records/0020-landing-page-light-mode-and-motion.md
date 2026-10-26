# 0020 - A landing page, light mode, and Motion for animation

> Numbered 0020 as the next free number across every branch (0019 is the 3D hero). Status: **accepted** (2026-10-15).

## Context

On Oct 8 the redesign was scoped tightly. It covered app screens only, with no marketing pages. The
theme was dark only, and there were to be no new dependencies, so no animation library. Those calls
kept the work small while the core screens were rebuilt.

On Oct 14 Manny reversed all three. The redesign prompts he wrote the UI from describe a landing page
(glass navbar, hero, stats bar, features, testimonials, a sign-up section, a footer), a theme that
works in light and dark, and animation through GSAP or Framer Motion. With the app screens done, he
wants the public face of the product built to the same prompts.

## Decision

**A landing page at `/` for signed-out visitors.** `HomeGate` sends a live session to `/rooms`, using
the same three-state check as `RequireAuth`, and shows everyone else `LandingPage`. The landing page is
lazy-loaded, so signed-in users never download it. An error boundary turns a failed chunk load into a
"reload or sign in" message instead of a blank page.

**Light mode, following the system, with a toggle** (Auto → Light → Dark). It is one
`:root[data-theme="light"]` block of semantic aliases, set before first paint by a script in
`index.html`. `tokens.test.ts` now holds both palettes at WCAG AA. See design-system.md §5.

**Motion (`motion` ^14.2.0), the library formerly called Framer Motion,** for:
- the hero card's tilt and stretch toward the cursor
- the drifting backdrop blobs
- sections rising into view
- the navbar's sliding indicator

`MotionConfig reducedMotion="user"` turns transforms off for anyone who asked for less motion.

**What the landing page says is true.** The stats are facts about how the product is built, not usage
numbers. The two unfinished steps (scanner, relevance) are tagged "In development". The testimonial
section holds persona statements labeled "Illustrative scenarios, not customer quotes", because there
are no customers to quote.

## Alternatives rejected & why

- **GSAP instead of Motion.** Strongest for scroll-driven timelines, but imperative (refs and effects
  around every animation) and it needs `@gsap/react` as well. Motion is declarative React, matches how
  the rest of the client is written, and ships a reduced-motion switch.
- **CSS-only animation.** It already carries the app screens, and the sign-in hero tilt shows it can
  do a lot. Spring physics on the hero card and a shared-layout indicator between nav links are where
  hand-written CSS gets brittle.
- **Light mode as a second stylesheet, or a media-query copy of the light block.** Either would
  duplicate every declaration. A single `data-theme` selector set before paint keeps one source of
  truth.
- **Invented testimonials with names and photos.** Rejected: they would read as real people
  vouching for a product nobody uses yet, and they could not be defended in an interview.
- **A landing page at its own route, with `/` still going to Rooms.** Nobody would land on it.

## Consequences

- **Measured cost:**
  - Main bundle: 322.96 kB → 323.61 kB (+0.65 kB for the home gate and the sign-up hand-off).
  - New lazy chunk: **145.57 kB (47.93 kB gzipped)** for the landing page and Motion, downloaded only by
    signed-out visitors at `/`.
- **The 2026-10-08 scoping is superseded** for these three points. The HIG rule still governs the
  app, where glass stays on the floating layer. The landing page uses glass cards on purpose, as the
  prompts describe, and they use the same `.ui-glass` recipe whose contrast is tested.
- **The sign-up box has no mailing list behind it.** It hands the email to the register form through
  router state, which is where an account is actually made.
- **A dev-only gotcha:** after pulling a branch that adds a dependency, restart `npm run dev`. Vite's
  pre-bundled dependency cache goes stale and answers `504 Outdated Optimize Dep`.
- **Removal path:**
  - Landing: delete `LandingPage.*` and `HomeGate.*`, point `/` back to a redirect, and
    `npm uninstall motion`.
  - Light mode: delete the light block and `src/theme/`, and remove the pre-paint script.
