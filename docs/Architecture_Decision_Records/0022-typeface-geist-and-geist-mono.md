# 0022 - Geist and Geist Mono as the app's typefaces, bundled from Fontsource

> Numbered 0022 as the next free number across every branch. Status: **accepted** (Manny, Oct 15).

## Context

Since the Oct 8 redesign the app has used the platform's system font: SF Pro on a Mac, Segoe UI on
Windows, Roboto on Android. It cost nothing, but it looked different on every machine and carried no
identity. The Liquid Glass prompt asked for "clean and minimalist (Inter or SF Pro style)" type. The
three design skills used on Oct 15 all advise against Inter and the system default for a premium
developer tool, and name Geist with Geist Mono as a pairing. On Oct 15 Manny chose to switch.

A web font is a new dependency and a network cost on first load, which is why this is recorded.

## Decision

**Geist for text and Geist Mono for code, hashes, ids and numbers**, the pair designed together.

**From Fontsource**: `@fontsource-variable/geist` and `@fontsource-variable/geist-mono`, both 5.3.0,
licensed OFL-1.1. They are imported once in `main.tsx`, and Vite bundles the font files with the app.
Nothing loads from Google Fonts or any other third-party service.

**Variable fonts**: one file per script covers every weight the tokens use, instead of one file per
weight.

**Only `--font-sans` and `--font-mono` change.** Every stylesheet already reads those tokens. Both keep
the old system stack behind Geist, so text renders immediately and swaps when the font arrives.

## Alternatives rejected & why

- **Keep the system font.** Free and instant, but it looks different on every machine and gives the
  product no voice of its own. It was the option Manny moved away from.
- **Inter.** The most common UI font and the one the skills single out as the generic default.
- **Load from Google Fonts with a `<link>`.** Simpler setup, but every visitor's browser then calls a
  third party, and it cannot be cached with our own assets.
- **The `geist` package from Vercel.** It is aimed at Next.js (`next/font`); Fontsource gives plain CSS
  imports that suit a Vite app.

## Consequences

- **Measured cost** (`npm run build`, Oct 15):
  - JavaScript is unchanged (345.16 kB main bundle).
  - CSS grows from 65.80 kB to 69.15 kB (12.82 to 13.58 kB gzipped) for the `@font-face` rules.
  - 11 font files ship, about 144 kB in all, but a browser fetches only the subsets a page uses. For
    this app that is the two Latin files, 28.7 kB for Geist and 22.6 kB for Geist Mono, confirmed in a
    real browser on the landing and sign-in pages. They are cached after the first visit.
- **A brief font swap on first load**, while the files download. The system fallback in the tokens
  keeps text readable meanwhile.
- **Two packages to keep current.** They are font files only, with no runtime code.
- **Reversal is two token values and two imports.** Removing the packages returns the app to the
  system stack with no other change.
