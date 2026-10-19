# AGENTS.md

## Project

Single-package Bun CLI app (root `index.ts`, currently a stub). Goal (see `README.md`, written in Spanish): interactive weather console app — pick a city, save a default city, manage a list of saved cities, show °C/°F.

- Stack: **Bun** (runtime + package manager, `bun.lock`), TypeScript, [Open-Meteo](https://open-meteo.com) — **no API key needed**.
- Two-step API flow (both documented in `README.md`):
  1. Geocode the city name: `https://geocoding-api.open-meteo.com/v1/search?name=<city>&count=1&language=es&format=json`
  2. Forecast with the returned lat/lon: `https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&current=temperature_2m`

## Commands

- Run: `bun index.ts` (or `bun run index.ts`)
- Typecheck: `bun run typecheck` → runs `bun check` (Bun's built-in checker, **not** `tsc`)
- There is **no** lint, formatter, test runner, or CI configured. Don't guess their commands — if you add one, record it here.

## Conventions

- Use `fetch` (Bun global); no HTTP client dependency exists yet.
- UI/user-facing strings are **Spanish**, including the target menu in `README.md` — new prompts and menu text should match.
- `tsconfig.json` is strict with `noUncheckedIndexedAccess`: array/record lookups return `T | undefined`; guard before use. Also `verbatimModuleSyntax` → use `import type` for type-only imports.
- Plain ESM (`"type": "module"`), `moduleResolution: bundler`, `allowImportingTsExtensions` → imports may include `.ts`.
