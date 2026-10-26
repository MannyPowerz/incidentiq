# 0021 - The sign-in hero is the scanner lens in CSS 3D (supersedes 0019)

> Numbered 0021 as the next free number across every branch. Status: **accepted** (Manny, Oct 15).
> Supersedes [0019](0019-3d-sign-in-hero-three-and-fiber.md).

## Context

ADR 0019 added `three` and `@react-three/fiber` to draw the sign-in hero as a lit 3D rounded cube,
lazy-loaded, with a flat CSS square as its fallback. It lives in PR #51, which has not merged.

Since then the logo changed. On Oct 14 the cube mark became a scanner lens (PR #58): a glass ring, a
sweep and a caught blip, built in CSS 3D. The cube hero now draws the retired logo, and its fallback
(the flat square) was what most visitors saw, because the 3D path only runs on wide screens with WebGL
and motion allowed. On Oct 15 Manny asked for the square to be replaced and chose the lens at hero size
over a three.js lens or the landing page's I/O stage.

## Decision

**The sign-in hero is the scanner lens at a new `xl` size**, the same `BrandMark` component as the top
bar and the landing hero, in CSS 3D. It tilts toward the cursor, aims its sweep at it, and reacts to
the form beside it: the caught blip turns green while you type, the sweep speeds up while signing in,
and the blip turns red after a refusal (all through CSS `:has()`).

**`three`, `@react-three/fiber`, `@types/three`, `Hero3D` and `HeroGate` are not adopted.** PR #51 is
closed unmerged rather than merged and then removed.

## Alternatives rejected & why

- **Merge #51 as is.** Rejected: it renders the retired cube logo, and its fallback is the square that
  prompted this change.
- **Model the lens in three.js.** Real lighting and refraction would look richer, but it keeps a
  918.94 kB (244.42 kB gzipped) lazy chunk, the React `<19.4` ceiling from fiber, and a second
  implementation of a mark that already exists in CSS and can drift from it.
- **Reuse the landing's I/O stage on sign-in.** It tells the product story, but next to a form it is
  busy, and the landing already uses it.

## Consequences

- **No WebGL anywhere in the app.** The 918.94 kB chunk and Vite's over-500 kB build warning never
  arrive, and the React version ceiling from fiber goes away.
- **One logo implementation.** The top bar, sign-in, landing and hero all render `BrandMark`, so a
  change to the mark changes every one of them.
- **Every visitor sees the same hero.** Phones, reduced motion and machines without WebGL get the
  same lens; reduced motion holds it still. There is no fallback path left to maintain.
- **Lost:** real lighting. CSS 3D gives depth through stacked layers and gradients, not shading. If a
  lit 3D moment is wanted later, it can come back as its own decision, with 0019's measurements as the
  starting point.
- 0019 should be marked "superseded by 0021" if its PR is ever revived for reference.
