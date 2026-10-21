# AGENTS.md

## Project

Bun + TypeScript CLI weather app. Entry point: `src/index.ts` (main menu loop). Source is split by layer:

```
src/
├── index.ts          # entry point: loads config, registers menu options, main loop
├── actions/          # one handler per user action (menu options)
├── presentation/     # CLI interaction: menu, prompts/input, messages/spinner
├── storage/          # local persistence (config.json)
├── types/            # shared TypeScript types/contracts
├── api/              # external APIs (Open-Meteo geocoding + forecast)
└── utils/            # colors, formatters, constants
```

`test/` (sibling of `src/`) holds the whole test suite — see [Tests](#tests).

- `src/api/geocoding.ts` — `buscarCiudad()`. Open-Meteo, **no API key needed**. Two-step flow: (1) geocode city name: `https://geocoding-api.open-meteo.com/v1/search?name=<city>&count=10&language=es&format=json` → (2) forecast with returned lat/lon in `src/api/weather.ts`: `https://api.open-meteo.com/v1/forecast?...&current=temperature_2m,...` (add `temperature_unit=fahrenheit` for °F).
  - **Ambiguous names**: geocoding must return several candidates (Springfield/San José/Santiago exist in many countries). Results carry `admin1`, `country` and `population`; the selection list shows `region, país · población` (`etiquetaBusqueda` in `src/utils/format.ts`) so the user can pick the right one. Order is the API's relevance, not population — don't re-sort. The API can also emit fuzzy noise matches (e.g. a nearby unrelated town) and duplicate locations; results are deduped by `lat,lon` id.
- `src/api/weather.ts` — `obtenerClima()` (current conditions) and `obtenerPronostico7dias()` (7-day daily forecast: `daily=weather_code,temperature_2m_max,...&forecast_days=7&timezone=auto`).
- `src/storage/settingsStorage.ts` — config persistence (cities, default city, °C/°F, color palette). JSON at OS config dir: `%APPDATA%\weather-cli\config.json` on Windows, `~/.config/weather-cli/` (or `$XDG_CONFIG_HOME`) elsewhere. Load tolerates missing/corrupt file and fills defaults (`paleta: "paleta1"`).
- `src/storage/citiesStorage.ts` — city CRUD on the same config file; every mutation delegates the write to `settingsStorage.guardar()`.
- `src/actions/` — one file per menu option (getWeather, addCity, removeCity, setDefaultCity, forecast7Days, listCities, settings). Actions read/mutate the in-memory `Config` and persist via storage; they never touch ANSI codes directly.
- `src/presentation/menu.ts` — `menu()` (main menu render + validation), `seleccionar()` (numbered list), `seleccionarCiudad()` (shared city picker).
- `src/presentation/input.ts` — custom stdin line reader (`leerLinea`), `preguntar()`, `pausar()`. Singleton over one `stdin` listener.
- `src/presentation/output.ts` — messages `info`/`exito`/`aviso`/`fallo`, `msgError`, loading spinner (`iniciarCarga`) and `conCarga()` wrapper.
- `src/utils/colors.ts` — palettes and semantic color roles; `src/utils/format.ts` — climate/forecast formatting; `src/utils/constants.ts` — shared constants.
- `src/types/` — `City`, `CitySearchResult`, `Weather`, `DailyForecast`, `Config`/`Unit`/`Palette`, `MenuOption`.

## Menu structure (single source of truth)

The main menu is **data-driven**: `opciones()` in `src/index.ts` returns a `MenuOption[]` (`{ id, etiqueta, handler }`). `menu()` in `src/presentation/menu.ts` renders and validates against that array — there is no hardcoded option list anywhere else, and `src/index.ts` dispatches via `lista.find(...)` (no `switch`).

**To add a menu option:** put the handler in a file under `src/actions/` and append one entry to `opciones()` in `src/index.ts` with a new `id`, its Spanish `etiqueta`, and `handler`. Nothing else to touch — rendering, validation, and dispatch pick it up automatically. Current ids: 1 clima default, 2 clima de todas, 3 agregar, 4 eliminar, 5 default, 6 pronóstico 7 días, 7 listar ciudades, 8 ajustes, 9 salir.

## Commands

- Run: `bun src/index.ts` (scripts: `bun run start`, `bun run dev` for `--watch`)
- Typecheck: `bun run typecheck` → runs `bun check` (Bun's built-in checker, **not** `tsc`)
- Test: `bun run test` → `bun test` (Bun's built-in runner; no dependencies). `bun run test:watch` for watch mode, `bun test test/storage.test.ts` to run one file, `bun test --coverage` for coverage.
- Build: `bun run build` → **gated on tests and typecheck**: `bun run test && bun run typecheck && bun build --compile src/index.ts --outfile weather` (standalone `weather.exe`; ignored by `.gitignore`). A failing test aborts the build before anything is compiled.
  - Do **not** drop `--compile` for a plain bundling command such as `bun build src/index.ts --outdir dist` without `--target bun`: Bun then defaults to a browser target and the `node:process` polyfill lacks `stdin`/`stdout`, so `src/presentation/input.ts` fails to bundle.
- There is **no** lint, formatter, or CI. Don't guess their commands — if you add one, record it here.
- Smoke test the interactive CLI by feeding a script of inputs, e.g. a text file with one line per prompt (menu option → answers → empty line for each "Presiona Enter"):
  `cmd /c "bun src\index.ts < ""C:\path\to\inputs.txt"""`
  - Use **cmd** for redirection: PowerShell doesn't support `<`, and piping an array into the process hangs. Quote the path (user dirs contain spaces).
  - Write the inputs file as **UTF-8 without BOM** if it contains accents (e.g. `[IO.File]::WriteAllText($p, $txt, [Text.UTF8Encoding]::new($false))`); `Set-Content -Encoding ascii` mangles them ("San Andr?s" breaks geocoding) and PS 5.1 `utf8` adds a BOM.

## Tests

`test/` holds the whole suite, run with `bun test` (Bun's built-in runner, `bun:test`). One file per unit:

| File | Covers |
| --- | --- |
| `format.test.ts` | `src/utils/format.ts` (formatters, WMO codes) |
| `colors.test.ts` | `src/utils/colors.ts` palettes and ANSI roles (subprocess) |
| `storage.test.ts` | `settingsStorage.ts` / `citiesStorage.ts` against a temp `config.json` |
| `geocoding.test.ts` / `weather.test.ts` | `src/api/*` with a faked `fetch` (no network) |
| `input.test.ts` / `menu.test.ts` / `output.test.ts` | presentation layer (subprocess) |
| `actions.test.ts` | every handler in `src/actions/` end to end (stdin stub + faked `fetch` + real `config.json`) |
| `cli.test.ts` | E2E: compiles the binary and drives it with redirected input |

- `establecimiento.ts` (not `*.test.ts`, so the runner ignores it) has the shared helpers:
  - `usarConfigTemporal()` — points `APPDATA`/`XDG_CONFIG_HOME` at a temp dir. **Call it with `await` before importing storage**: `ARCHIVO` is resolved at import time, and a `beforeEach` hook does **not** run before the module's top-level `await import`, so tests would silently write the user's real `config.json`.
  - `interceptarFetch(registro, originalFetch, respuesta)` — monkey-patches `globalThis.fetch` (not `URL`: the runner's transform makes `new URL(...)` bypass a global `URL` patch). Restore the original in `afterEach`.
  - `correrEscenario(codigo, env)` — runs a snippet in a subprocess via `bun --preload test/neutralizar-stdin.ts -` (the preload calls `stdin.resume()` so EOF is immediate). Needed because `input.ts` is a module-level stdin singleton, and `colors.ts` decides on color at import. **Not** `bun run -`: in Bun 1.4.3 that just prints `bun run` help.
- Subprocess scenarios that need scripted stdin install an `EventEmitter` stub in `process.stdin` **before** importing the module under test (the import attaches its listener to the stub), emit `data` chunks **after** starting the async call, then `process.exit(0)` (the stub keeps the process alive otherwise).
- Colors: `colors.ts` currently keys off `Bun.enableANSIColors`, so `NO_COLOR` loses to `FORCE_COLOR` and redirection alone does not disable color; `colors.test.ts` documents the expected behavior with `test.todo` rather than asserting the buggy behavior. Fix `colors.ts` and turn them into real tests.
- Keep the suite offline and deterministic: no live HTTP, no writes outside the temp dir.

## Critical quirks

- **Do not use `node:readline/promises` here**: in Bun on Windows, the second `rl.question()` never resolves when stdin is redirected (first one works — bug hides easily). `src/presentation/input.ts` has a custom line reader over `stdin` 'data' chunks; keep using `leerLinea()`/`preguntar()` for any new prompts. It handles LF, CR, and CRLF (splitting on a lone `\r` must also swallow a following `\n` or every line yields a spurious empty line).
- EOF on stdin makes `menu()` return `null`, which ends the main loop, so scripted runs exit cleanly (previously it was faked as "9. Salir").
- Do **not** edit `config.json` with PowerShell (`Get-Content`/`Set-Content`/`ConvertTo-Json` in PS 5.1 assume ANSI and corrupt the Spanish accents, e.g. "Popayán" → "Popayǭn"). Use Bun (`Bun.file`/`Bun.write`) or another UTF-8 tool.

## Conventions

- Zero runtime dependencies — use `fetch` (Bun global) and Node built-ins only.
- UI/user-facing strings are **Spanish** (see target menu in `README.md`); new prompts and menu text must match. Identifiers: English type names (`City`, `Weather`, `MenuOption`), Spanish function names/fields.
- **Colors go through `src/utils/colors.ts`**, never raw ANSI codes elsewhere: use the semantic roles `menuColor`, `tempColor`, `okColor`, `errorColor` and the message helpers `info`/`exito`/`aviso`/`fallo` from `src/presentation/output.ts`. Three palettes exist (`paleta1/2/3`) selected in Ajustes; call `establecerPaleta(config.paleta)` at startup (done in `src/index.ts`) or the palette stays at the default. `FORCE_COLOR=1` forces ANSI codes (useful to verify output when piping); `FORCE_COLOR=0` disables them. See the Tests section for the known `NO_COLOR`/TTY detection gap.
- `tsconfig.json` is strict with `noUncheckedIndexedAccess`: array/record lookups return `T | undefined`; guard before use. Also `verbatimModuleSyntax` → use `import type` for type-only imports.
- Plain ESM (`"type": "module"`), `moduleResolution: bundler`, `allowImportingTsExtensions` → imports may include `.ts`.
