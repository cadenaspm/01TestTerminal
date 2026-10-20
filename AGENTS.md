# AGENTS.md

## Project

Bun + TypeScript CLI weather app. Entry point: root `index.ts` (main menu loop). Logic split in:

- `src/api.ts` — Open-Meteo, **no API key needed**. Two-step flow: (1) geocode city name: `https://geocoding-api.open-meteo.com/v1/search?name=<city>&count=10&language=es&format=json` → (2) forecast with returned lat/lon: `https://api.open-meteo.com/v1/forecast?...&current=temperature_2m,...` (add `temperature_unit=fahrenheit` for °F).
  - **Ambiguous names**: geocoding must return several candidates (Springfield/San José/Santiago exist in many countries). Results carry `admin1`, `country` and `population`; the selection list shows `region, país · población` (`etiquetaBusqueda` in `src/ui.ts`) so the user can pick the right one. Order is the API's relevance, not population — don't re-sort. The API can also emit fuzzy noise matches (e.g. a nearby unrelated town) and duplicate locations; results are deduped by `lat,lon` id.
- `src/store.ts` — config persistence (cities, default city, °C/°F, color palette). JSON at OS config dir: `%APPDATA%\weather-cli\config.json` on Windows, `~/.config/weather-cli/` (or `$XDG_CONFIG_HOME`) elsewhere. Load tolerates missing/corrupt file and fills defaults (`paleta: "paleta1"`).
- `src/ui.ts` — input reader, menu, prompts, climate formatting, colors/palettes, loading spinner (`iniciarCarga`).
- `src/settings.ts` — the "8. Ajustes" submenu (temperature unit, color palettes).

## Menu structure (single source of truth)

The main menu is **data-driven**: `opciones()` in `index.ts` returns an array of `{ id, etiqueta, handler }`. `menu()` in `src/ui.ts` renders and validates against that array — there is no hardcoded option list anywhere else, and `index.ts` dispatches via `lista.find(...)` (no `switch`).

**To add a menu option:** append one entry to `opciones()` in `index.ts` with a new `id`, its Spanish `label`, and a `handler` function (new commands live in `index.ts`; settings-style submenus go in `src/settings.ts`). Nothing else to touch — rendering, validation, and dispatch pick it up automatically. `OPCIONES_VALIDAS` no longer exists.

## Commands

- Run: `bun index.ts` (scripts: `bun run start`, `bun run dev` for `--watch`)
- Typecheck: `bun run typecheck` → runs `bun check` (Bun's built-in checker, **not** `tsc`)
- Build: `bun run build` → `bun build --compile index.ts --outfile weather` (standalone `weather.exe`; ignored by `.gitignore`).
  - Do **not** drop `--compile` for a plain bundling command such as `bun build index.ts --outdir dist` without `--target bun`: Bun then defaults to a browser target and the `node:process` polyfill lacks `stdin`/`stdout`, so `src/ui.ts` fails to bundle.
- There is **no** lint, formatter, test runner, or CI. Don't guess their commands — if you add one, record it here.
- Smoke test the interactive CLI by feeding a script of inputs, e.g. a text file with one line per prompt (menu option → answers → empty line for each "Presiona Enter"):
  `cmd /c "bun index.ts < ""C:\path\to\inputs.txt"""`
  - Use **cmd** for redirection: PowerShell doesn't support `<`, and piping an array into the process hangs. Quote the path (user dirs contain spaces).

## Critical quirks

- **Do not use `node:readline/promises` here**: in Bun on Windows, the second `rl.question()` never resolves when stdin is redirected (first one works — bug hides easily). `src/ui.ts` has a custom line reader over `stdin` 'data' chunks; keep using `leerLinea()`/`preguntar()` for any new prompts. It handles LF, CR, and CRLF (splitting on a lone `\r` must also swallow a following `\n` or every line yields a spurious empty line).
- EOF on stdin makes `menu()` return `null`, which ends the main loop, so scripted runs exit cleanly (previously it was faked as "9. Salir").
- Do **not** edit `config.json` with PowerShell (`Get-Content`/`Set-Content`/`ConvertTo-Json` in PS 5.1 assume ANSI and corrupt the Spanish accents, e.g. "Popayán" → "Popayǭn"). Use Bun (`Bun.file`/`Bun.write`) or another UTF-8 tool.

## Conventions

- Zero runtime dependencies — use `fetch` (Bun global) and Node built-ins only.
- UI/user-facing strings are **Spanish** (see target menu in `README.md`); new prompts and menu text must match.
- **Colors go through `src/ui.ts`**, never raw ANSI codes elsewhere: use the semantic roles `menuColor`, `tempColor`, `okColor`, `errorColor` and the message helpers `info`/`exito`/`aviso`/`fallo`. Three palettes exist (`paleta1/2/3`) selected in Ajustes; call `establecerPaleta(config.paleta)` at startup (done in `index.ts`) or the palette stays at the default. Colors auto-disable when stdout isn't a TTY; `NO_COLOR` disables and `FORCE_COLOR=1` forces them (useful to verify ANSI output when piping).
- `tsconfig.json` is strict with `noUncheckedIndexedAccess`: array/record lookups return `T | undefined`; guard before use. Also `verbatimModuleSyntax` → use `import type` for type-only imports.
- Plain ESM (`"type": "module"`), `moduleResolution: bundler`, `allowImportingTsExtensions` → imports may include `.ts`.
