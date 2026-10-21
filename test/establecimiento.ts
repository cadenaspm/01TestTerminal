// Helpers compartidos por la suite de tests. OJO: no debe llamarse *.test.ts
// para que `bun test` no lo trate como archivo de tests.

import { afterEach, beforeEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Raíz del proyecto (este archivo vive en test/, un nivel bajo la raíz). */
export const RAIZ = join(import.meta.dir, "..");
export const ENTRADA = join(RAIZ, "src", "index.ts");

/**
 * Interceptor de `globalThis.fetch` para src/api sin tocar el código de
 * producción: guarda la URL real y responde con lo que devuelva `respuesta()`.
 * Si `respuesta()` no devuelve nada, deja pasar la petición real.
 *
 * Se intercepta `fetch` y no `URL` a propósito: con el runner de `bun test`,
 * `new URL(...)` dentro de un test usa la clase global real (el parche no
 * aplica a los módulos ya transformados), mientras que `fetch` se lee de
 * `globalThis` en el momento de la llamada.
 */
export function interceptarFetch(
  registro: URL[],
  originalFetch: typeof fetch,
  respuesta?: () => Response | undefined,
): typeof fetch {
  const falso = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    registro.push(url);
    const res = respuesta?.();
    if (!res) return originalFetch(input, init);
    return res;
  };
  return falso as typeof fetch;
}

/** Respuesta de `fetch` simulada. */
export function respuestaJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Ejecuta un escenario en un subproceso con `bun -` (script por stdin) y un
 * `--preload` que neutraliza `process.stdin`. Necesario para los tests de
 * input/menu/output: esos módulos son singletons (un listener de stdin a nivel
 * de módulo) y `colors.ts` decide si colorea al importarse, así que no se
 * pueden reimportar con estado limpio dentro del mismo proceso.
 *
 * OJO: usar `bun -`, NO `bun run -` (en Bun 1.4.3 `bun run -` imprime su ayuda).
 */
export async function correrEscenario(
  codigo: string,
  env: Record<string, string | null> = {},
): Promise<{ salida: string; codigoSalida: number }> {
  const preload = join(import.meta.dir, "neutralizar-stdin.ts");
  // Por defecto se fuerza NO_COLOR=1 para que la salida sea texto plano y
  // determinista. Un valor `null` en `env` ELIMINA la variable del entorno
  // (necesario en colors.test.ts para poder probar la precedencia entre
  // NO_COLOR y FORCE_COLOR).
  const entorno: Record<string, string> = { ...Bun.env, NO_COLOR: "1" };
  for (const [clave, valor] of Object.entries(env)) {
    if (valor === null) delete entorno[clave];
    else entorno[clave] = valor;
  }
  const proc = Bun.spawn(["bun", "--preload", preload, "-"], {
    cwd: RAIZ,
    stdin: new TextEncoder().encode(codigo),
    stdout: "pipe",
    stderr: "pipe",
    env: entorno,
  });
  const [salida, err, codigoSalida] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { salida: salida + err, codigoSalida };
}

/**
 * Aísla el archivo de config del usuario: apunta `APPDATA`/`XDG_CONFIG_HOME` a
 * una carpeta temporal antes de que storage lo resuelva. Los módulos que
 * dependen de esa ruta se importan dinámicamente tras llamar a esto.
 */
export async function usarConfigTemporal(): Promise<{ dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), "weather-cli-test-"));
  process.env.APPDATA = dir;
  process.env.XDG_CONFIG_HOME = dir;
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  return { dir };
}
