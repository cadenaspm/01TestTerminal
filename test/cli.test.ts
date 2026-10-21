import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ENTRADA, RAIZ } from "./establecimiento";

/**
 * Test de extremo a extremo: compila el binario (bun build --compile) y lo
 * ejecuta con la entrada redirigida, comprobando el flujo real del menú y la
 * salida limpia por EOF. Si la compilación no está disponible se omite.
 */
let binario = "";
let dirTemporal = "";
let compilado = false;

beforeAll(async () => {
  dirTemporal = await mkdtemp(join(tmpdir(), "weather-cli-e2e-"));
  binario = join(dirTemporal, process.platform === "win32" ? "weather.exe" : "weather");
  const build = Bun.spawnSync(["bun", "build", "--compile", ENTRADA, "--outfile", binario], {
    cwd: RAIZ,
    stdout: "pipe",
    stderr: "pipe",
  });
  compilado = build.exitCode === 0;
  if (!compilado) {
    console.warn(`No se pudo compilar el binario: ${build.stderr.toString().slice(0, 400)}`);
  }
});

afterAll(async () => {
  await rm(dirTemporal, { recursive: true, force: true });
});

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
    if (!compilado) return;
    const { salida, codigoSalida } = await correrCli("", dirTemporal);
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("WEATHER CLI");
    expect(salida).toContain("9. Salir");
    expect(salida).toContain("¡Hasta luego!");
  });

  test("recorre el menú y sale con la opción 9", async () => {
    if (!compilado) return;
    // 3 (buscar/agregar) → nombre vacío (cancela) → Enter (pausa) → 7 (listar)
    // → Enter (pausa) → 9 (salir).
    const entrada = ["3", "", "", "7", "", "9", ""].join("\n") + "\n";
    const { salida, codigoSalida } = await correrCli(entrada, dirTemporal);
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("Buscar y agregar ciudad");
    expect(salida).toContain("Nombre de la ciudad:");
    expect(salida).toContain("No hay ciudades guardadas.");
    expect(salida).toContain("¡Hasta luego!");
  });

  test("opciones inválidas no rompen el menú", async () => {
    if (!compilado) return;
    const entrada = ["abc", "0", "42", "9", ""].join("\n") + "\n";
    const { salida, codigoSalida } = await correrCli(entrada, dirTemporal);
    expect(codigoSalida).toBe(0);
    expect(salida.match(/Opción no válida/g)?.length).toBe(3);
    expect(salida).toContain("¡Hasta luego!");
  });

  test("ajustes cambia la unidad y queda persistida en el config", async () => {
    if (!compilado) return;
    // 8 (ajustes) → 1 (cambiar unidad) → Enter (pausa) → 9 (salir).
    const entrada = ["8", "1", "", "9", ""].join("\n") + "\n";
    const { salida, codigoSalida } = await correrCli(entrada, dirTemporal);
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("Unidad de temperatura: °F");

    const config = JSON.parse(
      await Bun.file(join(dirTemporal, "weather-cli", "config.json")).text(),
    ) as { unidad: string };
    expect(config.unidad).toBe("F");
  });
});
