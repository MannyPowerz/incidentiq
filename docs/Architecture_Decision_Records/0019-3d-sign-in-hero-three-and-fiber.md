# 0019 - A 3D sign-in hero on three and @react-three/fiber, lazy-loaded

> Numbered 0019 as the next free number across every branch. Status: **accepted** (Manny, Oct 14).

## Context

The sign-in page's brand panel has had a hero shape since the dark redesign: an orange rounded box
drawn in CSS, tilting toward the pointer. UI roadmap Item 10 planned to replace it with a real 3D
shape, and Manny chose on Oct 14 to build it as planned.

Two earlier positions pull against this. On Oct 8 the redesign was scoped as "plain CSS, no new
dependencies". `CLAUDE.md` also treats a new dependency as a decision that needs a record. Item 10 is
the one place the roadmap planned an exception, and this ADR is that record.

The hero is decorative. It carries no information, and sign-in must work the same without it.

## Decision

**Use `three` (^0.186.1) and `@react-three/fiber` (^9.8.1), plus `@types/three` (^0.186.0) as a
dev dependency**, because `three` ships no TypeScript types. The roadmap counted two dependencies; the
types package is a third, type-only one with no runtime cost.

**The shape is `RoundedBoxGeometry` from `three` itself** (`examples/jsm`), so `@react-three/drei` is
not added. Its only use would have been `RoundedBox`.

**Everything 3D is lazy-loaded behind `HeroGate`.** The 3D chunk is requested only when all three
hold: a screen at least 1024px wide (below that the hero is hidden anyway), no reduced-motion
preference, and a working WebGL context. In every other case, and when the 3D component throws
(caught by an error boundary), the existing CSS shape renders instead. Sign-in never depends on WebGL.

**Rendering stops while the tab is hidden** (`frameloop` switches to `never` on `visibilitychange`),
so a background tab does not keep the GPU busy.

**The color is read from `--color-primary` at runtime**, so the 3D and CSS shapes cannot drift apart
and no raw hex enters component code.

## Alternatives rejected & why

- **Keep the CSS hero only.** It costs nothing and was the recommended option. Not chosen: Manny chose
  the 3D version, which the roadmap had planned since Oct 8.
- **Add `@react-three/drei`.** Its only use would have been `RoundedBox`, which `three` already
  provides as `RoundedBoxGeometry`. One fewer package to keep current.
- **`three` without `@react-three/fiber`.** Imperative scene setup in an effect, with no React
  reconciler. This is likely smaller, because fiber pulls in all of `three` rather than the named
  pieces a hand-written scene would import, but it was not measured. Rejected for now because fiber
  keeps the scene declarative and consistent with the rest of the React code. If the chunk size
  becomes a problem, this is the first thing to measure.
- **A model file or a hosted scene (Spline and similar).** These add a network-loaded asset and a
  third party to sign-in. Rejected; the shape is simple enough to build in code.

## Consequences

- **Measured bundle cost** (`npm run build`):
  - Before: one JS bundle of 304.89 kB (96.06 kB gzipped).
  - After: the main bundle is 305.94 kB (96.47 kB gzipped), +1.05 kB for the gate.
  - The new lazy chunk is **918.94 kB (244.42 kB gzipped)**, about 2.5 times the rest of the app. It is
    downloaded only on desktop sign-in with motion allowed and WebGL available. Vite prints its
    over-500 kB chunk warning on every build because of it.
- **React version ceiling.** `@react-three/fiber` 9 declares a peer range of `react >=19 <19.4`. A React
  upgrade past 19.3 waits until fiber supports it.
- **Upstream warning.** Fiber uses `THREE.Clock`, which `three` r186 marks deprecated, so the console
  shows that warning on desktop sign-in. It comes from the library, not this code.
- **Testing.** jsdom has no WebGL, so the tests cover the gate (each condition and the error fallback,
  each verified by mutation). The scene is checked in a real browser.
- **Removal path.** Delete `client/src/components/hero/`, put
  `<span className="sign-in-brand__shape" />` back in `SignInPage.tsx`, and run
  `npm uninstall three @react-three/fiber @types/three`. Then `npm run build` should show a single JS
  bundle again. Nothing else imports these packages.
