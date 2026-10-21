import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ENTRADA, RAIZ } from "./establecimiento";

/**
 * Test de extremo a extremo: compila el binario (bun build --compile) y lo
 * ejecuta con la entrada redirigida, comprobando el flujo real del menú y la
 * salida limpia por EOF.
 *
 * OJO — timeout propio para el hook: `bun build --compile` tarda entre 3 y 6 s
 * (más si la caché de transpilación está fría, típico del primer arranque tras
 * clonar). Con el timeout por defecto de Bun (5 s) el hook se cancelaba y
 * caían los 4 tests de este archivo de forma intermitente.
 */
const TIMEOUT_COMPILACION = 120_000;

let binario = "";
let dirTemporal = "";
let compilado = false;
let errorCompilacion = "";
/** Configs temporales creados por cada test, para limpiarlos al final. */
const dirsConfig: string[] = [];

beforeAll(async () => {
  dirTemporal = await mkdtemp(join(tmpdir(), "weather-cli-e2e-"));
  binario = join(dirTemporal, process.platform === "win32" ? "weather.exe" : "weather");
  try {
    const proc = Bun.spawn(["bun", "build", "--compile", ENTRADA, "--outfile", binario], {
      cwd: RAIZ,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [err, codigo] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
    compilado = codigo === 0;
    if (!compilado) errorCompilacion = err.slice(0, 800);
  } catch (e) {
    compilado = false;
    errorCompilacion = String(e);
  }
}, TIMEOUT_COMPILACION);

afterAll(async () => {
  await rm(dirTemporal, { recursive: true, force: true });
  for (const dir of dirsConfig) {
    await rm(dir, { recursive: true, force: true });
  }
});

/**
 * Si el binario no se pudo compilar, el test debe fallar con un mensaje claro.
 * Antes se resolvía con un `return` temprano, que convertía el fallo de la
 * compilación en un test verde sin haber comprobado nada.
 */
function exigirBinario(): void {
  if (!compilado) {
    throw new Error(
      `No se pudo compilar el binario para los tests E2E (bun build --compile).\n${errorCompilacion}`,
    );
  }
}

/** Directorio de config aislado por test: evita estado compartido entre casos. */
async function configAislada(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "weather-cli-e2e-config-"));
  dirsConfig.push(dir);
  return dir;
}

/** Ejecuta el binario con la entrada dada y un APPDATA temporal. */
async function correrCli(entrada: string, dirConfig: string) {
  const proc = Bun.spawn([binario], {
    cwd: RAIZ,
    stdin: new TextEncoder().encode(entrada),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...Bun.env, APPDATA: dirConfig, XDG_CONFIG_HOME: dirConfig, NO_COLOR: "1" },
  });
  const [salida, err, codigoSalida] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { salida: salida + err, codigoSalida };
}

describe("CLI compilada", () => {
  test("EOF termina el bucle con salida limpia", async () => {
    exigirBinario();
    const { salida, codigoSalida } = await correrCli("", await configAislada());
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("WEATHER CLI");
    expect(salida).toContain("9. Salir");
    expect(salida).toContain("¡Hasta luego!");
  });

  test("recorre el menú y sale con la opción 9", async () => {
    exigirBinario();
    // 3 (buscar/agregar) → nombre vacío (cancela) → Enter (pausa) → 7 (listar)
    // → Enter (pausa) → 9 (salir).
    const entrada = ["3", "", "", "7", "", "9", ""].join("\n") + "\n";
    const { salida, codigoSalida } = await correrCli(entrada, await configAislada());
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("Buscar y agregar ciudad");
    expect(salida).toContain("Nombre de la ciudad:");
    expect(salida).toContain("No hay ciudades guardadas.");
    expect(salida).toContain("¡Hasta luego!");
  });

  test("opciones inválidas no rompen el menú", async () => {
    exigirBinario();
    const entrada = ["abc", "0", "42", "9", ""].join("\n") + "\n";
    const { salida, codigoSalida } = await correrCli(entrada, await configAislada());
    expect(codigoSalida).toBe(0);
    expect(salida.match(/Opción no válida/g)?.length).toBe(3);
    expect(salida).toContain("¡Hasta luego!");
  });

  test("ajustes cambia la unidad y queda persistida en el config", async () => {
    exigirBinario();
    // 8 (ajustes) → 1 (cambiar unidad) → Enter (pausa) → 9 (salir).
    const entrada = ["8", "1", "", "9", ""].join("\n") + "\n";
    const dirConfig = await configAislada();
    const { salida, codigoSalida } = await correrCli(entrada, dirConfig);
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("Unidad de temperatura: °F");

    const config = JSON.parse(
      await Bun.file(join(dirConfig, "weather-cli", "config.json")).text(),
    ) as { unidad: string };
    expect(config.unidad).toBe("F");
  });
});
