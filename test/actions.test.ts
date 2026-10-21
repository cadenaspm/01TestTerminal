import { beforeEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { City } from "../src/types/City";
import type { Config } from "../src/types/Config";
import { correrEscenario, interceptarFetch, respuestaJson, usarConfigTemporal } from "./establecimiento";

/**
 * Cada acción se prueba en dos capas:
 * - en proceso, con un stub de stdin (input.ts es un singleton), para el flujo
 *   completo (prompts → resultado) y que la escritura en config.json ocurra;
 * - con `importarAccion`, para comprobar la persistencia contra el archivo real.
 */
const temporal = await usarConfigTemporal();
const rutaConfig = join(temporal.dir, "weather-cli", "config.json");

async function leerConfigGuardado(): Promise<Config> {
  return JSON.parse(await readFile(rutaConfig, "utf8")) as Config;
}

async function escribirConfig(config: Config): Promise<void> {
  await Bun.write(rutaConfig, JSON.stringify(config));
}

function ciudad(id: string, nombre = "Ottawa"): City {
  return { id, nombre, detalle: `${nombre}, Canadá`, lat: 45.4, lon: -75.7 };
}

function configCon(ciudades: City[], def: string | null = null): Config {
  return { ciudades, default: def, unidad: "C", paleta: "paleta1" };
}

/**
 * Escenario en subproceso: stub de stdin + acciones importadas DESPUÉS del
 * stub. Los chunks se emiten tras lanzar la acción (que es una promesa), así
 * los consumidores ya están esperando.
 */
function escenarioAccion(preludio: string, lanzar: string, chunks: string[]): string {
  return `
import { EventEmitter } from "node:events";
const emisor = new EventEmitter();
Object.assign(process.stdin, { isTTY: undefined, setEncoding: () => {}, on: emisor.on.bind(emisor) });

${preludio}

const promesa = (${lanzar});
for (const c of ${JSON.stringify(chunks)}) emisor.emit("data", c);
emisor.emit("end");
await promesa;
process.exit(0);
`;
}

// --- clima default (opción 1) ----------------------------------------------
describe("climaDefault", () => {
  test("sin ciudad default avisa", async () => {
    const { salida, codigoSalida } = await correrEscenario(
      escenarioAccion(
        `const { climaDefault } = await import("./src/actions/getWeather");
const config = { ciudades: [], default: null, unidad: "C", paleta: "paleta1" };`,
        "climaDefault(config)",
        [],
      ),
    );
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("No hay ciudad default. Usa la opción 5 para establecer una.");
  });

  test("con default muestra el clima formateado", async () => {
    const { salida, codigoSalida } = await correrEscenario(
      escenarioAccion(
        `const { climaDefault } = await import("./src/actions/getWeather");
const { interceptarFetch } = await import("./test/establecimiento");
globalThis.fetch = interceptarFetch([], globalThis.fetch, () =>
  new Response(JSON.stringify({ current: { temperature_2m: 21.5, time: "2026-10-20T14:30" } }), { status: 200 }),
);
const config = { ciudades: [{ id: "1,2", nombre: "Ottawa", detalle: "Ottawa, Canadá", lat: 1, lon: 2 }], default: "1,2", unidad: "C", paleta: "paleta1" };`,
        "climaDefault(config)",
        [],
      ),
    );
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("Obteniendo clima de Ottawa, Canadá");
    expect(salida).toContain("Temperatura: 21.5 °C");
  });

  test("si la API falla muestra el error sin romper", async () => {
    const { salida, codigoSalida } = await correrEscenario(
      escenarioAccion(
        `const { climaDefault } = await import("./src/actions/getWeather");
const { interceptarFetch } = await import("./test/establecimiento");
globalThis.fetch = interceptarFetch([], globalThis.fetch, () => new Response("", { status: 500 }));
const config = { ciudades: [{ id: "1,2", nombre: "Ottawa", detalle: "Ottawa, Canadá", lat: 1, lon: 2 }], default: "1,2", unidad: "C", paleta: "paleta1" };`,
        "climaDefault(config)",
        [],
      ),
    );
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("No se pudo obtener el clima de Ottawa, Canadá: La API del clima respondió 500");
  });
});

// --- clima de todas (opción 2) ---------------------------------------------
describe("climaTodas", () => {
  test("sin ciudades avisa", async () => {
    const { salida } = await correrEscenario(
      escenarioAccion(
        `const { climaTodas } = await import("./src/actions/getWeather");
const config = { ciudades: [], default: null, unidad: "C", paleta: "paleta1" };`,
        "climaTodas(config)",
        [],
      ),
    );
    expect(salida).toContain("No hay ciudades guardadas. Usa la opción 3 para agregar una.");
  });

  test("recorre todas las ciudades con contador", async () => {
    const { salida, codigoSalida } = await correrEscenario(
      escenarioAccion(
        `const { climaTodas } = await import("./src/actions/getWeather");
const { interceptarFetch } = await import("./test/establecimiento");
globalThis.fetch = interceptarFetch([], globalThis.fetch, () =>
  new Response(JSON.stringify({ current: { temperature_2m: 10 } }), { status: 200 }),
);
const config = { ciudades: [
  { id: "1,2", nombre: "Ottawa", detalle: "Ottawa, Canadá", lat: 1, lon: 2 },
  { id: "3,4", nombre: "Quito", detalle: "Quito, Ecuador", lat: 3, lon: 4 },
], default: null, unidad: "C", paleta: "paleta1" };`,
        "climaTodas(config)",
        [],
      ),
    );
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("Obteniendo clima (1/2): Ottawa, Canadá");
    expect(salida).toContain("Obteniendo clima (2/2): Quito, Ecuador");
    expect(salida.match(/Temperatura: 10 °C/g)).toHaveLength(2);
  });
});

// --- buscar y agregar (opción 3) -------------------------------------------
describe("buscarAgregar", () => {
  const preludio = (estado: Config) =>
    `const { buscarAgregar } = await import("./src/actions/addCity");
const { interceptarFetch } = await import("./test/establecimiento");
globalThis.fetch = interceptarFetch([], globalThis.fetch, () => respuestaFalsa);
const respuestaFalsa = undefined as Response | undefined;
const config = ${JSON.stringify(estado)};`;

  test("guarda la ciudad elegida en config.json", async () => {
    await escribirConfig(configCon([]));
    const { salida, codigoSalida } = await correrEscenario(
      escenarioAccion(
        `const { buscarAgregar } = await import("./src/actions/addCity");
const { interceptarFetch } = await import("./test/establecimiento");
const jsonBusqueda = { results: [
  { name: "Ottawa", latitude: 45.4, longitude: -75.7, country: "Canadá", admin1: "Ontario", population: 934000 },
  { name: "Quito", latitude: -0.2, longitude: -78.5, country: "Ecuador" },
] };
globalThis.fetch = interceptarFetch([], globalThis.fetch, () =>
  new Response(JSON.stringify(jsonBusqueda), { status: 200 }),
);
const config = ${JSON.stringify(configCon([]))};`,
        "buscarAgregar(config)",
        ["Ottawa\n", "1\n"],
      ),
    );
    expect(codigoSalida).toBe(0);
    expect(salida).toContain('Buscando "Ottawa"');
    expect(salida).toContain("Ottawa, Ontario, Canadá · 934 mil hab.");
    expect(salida).toContain('"Ottawa, Ontario, Canadá" agregada a la lista.');

    const guardado = await leerConfigGuardado();
    expect(guardado.ciudades).toHaveLength(1);
    expect(guardado.ciudades[0]!.id).toBe("45.4,-75.7");
    expect(guardado.ciudades[0]!.detalle).toBe("Ottawa, Ontario, Canadá");
  });

  test("sin nombre no consulta la API", async () => {
    const { salida, codigoSalida } = await correrEscenario(
      escenarioAccion(
        preludio(configCon([])),
        "buscarAgregar(config)",
        ["\n"],
      ),
    );
    expect(codigoSalida).toBe(0);
    expect(salida).not.toContain("Buscando");
  });

  test("sin resultados avisa", async () => {
    const { salida, codigoSalida } = await correrEscenario(
      escenarioAccion(
        preludio(configCon([])).replace(
          "() => respuestaFalsa",
          "() => new Response(JSON.stringify({ results: [] }), { status: 200 })",
        ),
        "buscarAgregar(config)",
        ["xyz\n"],
      ),
    );
    expect(codigoSalida).toBe(0);
    expect(salida).toContain('No se encontró ninguna ciudad llamada "xyz".');
  });

  test("cancelar la selección no agrega nada", async () => {
    await escribirConfig(configCon([]));
    const { salida, codigoSalida } = await correrEscenario(
      escenarioAccion(
        preludio(configCon([])).replace(
          "() => respuestaFalsa",
          `() => new Response(JSON.stringify({ results: [{ name: "Ottawa", latitude: 45.4, longitude: -75.7 }] }), { status: 200 })`,
        ),
        "buscarAgregar(config)",
        ["Ottawa\n", "0\n"],
      ),
    );
    expect(codigoSalida).toBe(0);
    expect(salida).not.toContain("agregada a la lista");
    expect((await leerConfigGuardado()).ciudades).toHaveLength(0);
  });

  test("si ya existe avisa sin duplicar", async () => {
    const existente = ciudad("45.4,-75.7");
    await escribirConfig(configCon([existente]));
    const { salida, codigoSalida } = await correrEscenario(
      escenarioAccion(
        preludio(configCon([existente])).replace(
          "() => respuestaFalsa",
          `() => new Response(JSON.stringify({ results: [{ name: "Ottawa", latitude: 45.4, longitude: -75.7 }] }), { status: 200 })`,
        ),
        "buscarAgregar(config)",
        ["Ottawa\n", "1\n"],
      ),
    );
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("Esa ciudad ya está en la lista.");
    expect((await leerConfigGuardado()).ciudades).toHaveLength(1);
  });

  test("error de la API de geocoding se muestra", async () => {
    const { salida, codigoSalida } = await correrEscenario(
      escenarioAccion(
        preludio(configCon([])).replace(
          "() => respuestaFalsa",
          `() => new Response("", { status: 503 })`,
        ),
        "buscarAgregar(config)",
        ["Ottawa\n"],
      ),
    );
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("Error al buscar: La API de geocoding respondió 503");
  });
});

// --- eliminar (opción 4) ---------------------------------------------------
describe("eliminarCiudad (acción)", () => {
  test("elimina la ciudad elegida y persiste", async () => {
    const ciudades = [ciudad("1,2"), ciudad("3,4", "Quito")];
    await escribirConfig(configCon(ciudades));
    const { salida, codigoSalida } = await correrEscenario(
      escenarioAccion(
        `const { eliminarCiudad } = await import("./src/actions/removeCity");
const config = ${JSON.stringify(configCon(ciudades))};`,
        "eliminarCiudad(config)",
        ["1\n"],
      ),
    );
    expect(codigoSalida).toBe(0);
    expect(salida).toContain('"Ottawa, Canadá" eliminada.');
    expect((await leerConfigGuardado()).ciudades.map((c) => c.id)).toEqual(["3,4"]);
  });

  test("sin ciudades guardadas avisa", async () => {
    const { salida } = await correrEscenario(
      escenarioAccion(
        `const { eliminarCiudad } = await import("./src/actions/removeCity");
const config = { ciudades: [], default: null, unidad: "C", paleta: "paleta1" };`,
        "eliminarCiudad(config)",
        [],
      ),
    );
    expect(salida).toContain("No hay ciudades guardadas.");
  });

  test("cancelar no elimina", async () => {
    const ciudades = [ciudad("1,2")];
    await escribirConfig(configCon(ciudades));
    const { salida } = await correrEscenario(
      escenarioAccion(
        `const { eliminarCiudad } = await import("./src/actions/removeCity");
const config = ${JSON.stringify(configCon(ciudades))};`,
        "eliminarCiudad(config)",
        ["0\n"],
      ),
    );
    expect(salida).not.toContain("eliminada.");
    expect((await leerConfigGuardado()).ciudades).toHaveLength(1);
  });
});

// --- default (opción 5) ----------------------------------------------------
describe("establecerDefault", () => {
  test("marca la ciudad elegida como default y persiste", async () => {
    const ciudades = [ciudad("1,2"), ciudad("3,4", "Quito")];
    await escribirConfig(configCon(ciudades));
    const { salida, codigoSalida } = await correrEscenario(
      escenarioAccion(
        `const { establecerDefault } = await import("./src/actions/setDefaultCity");
const config = ${JSON.stringify(configCon(ciudades))};`,
        "establecerDefault(config)",
        ["2\n"],
      ),
    );
    expect(codigoSalida).toBe(0);
    expect(salida).toContain('"Quito, Canadá" ahora es la ciudad default.');
    expect((await leerConfigGuardado()).default).toBe("3,4");
  });

  test("sin ciudades guardadas avisa", async () => {
    const { salida } = await correrEscenario(
      escenarioAccion(
        `const { establecerDefault } = await import("./src/actions/setDefaultCity");
const config = { ciudades: [], default: null, unidad: "C", paleta: "paleta1" };`,
        "establecerDefault(config)",
        [],
      ),
    );
    expect(salida).toContain("No hay ciudades guardadas.");
  });
});

// --- pronóstico (opción 6) -------------------------------------------------
describe("pronostico7dias", () => {
  const daily = {
    time: ["2026-10-20", "2026-10-21"],
    weather_code: [0, 61],
    temperature_2m_max: [22, 18],
    temperature_2m_min: [11, 9],
    precipitation_probability_max: [5, 80],
    wind_speed_10m_max: [14, 25],
  };

  test("muestra la tabla de 7 días de la ciudad elegida", async () => {
    const ciudades = [ciudad("1,2"), ciudad("3,4", "Quito")];
    const { salida, codigoSalida } = await correrEscenario(
      escenarioAccion(
        `const { pronostico7dias } = await import("./src/actions/forecast7Days");
const { interceptarFetch } = await import("./test/establecimiento");
globalThis.fetch = interceptarFetch([], globalThis.fetch, () =>
  new Response(JSON.stringify(${JSON.stringify({ daily })}), { status: 200 }),
);
const config = ${JSON.stringify(configCon(ciudades))};`,
        "pronostico7dias(config)",
        ["2\n"],
      ),
    );
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("¿De qué ciudad quieres ver el pronóstico de 7 días?");
    expect(salida).toContain("Obteniendo pronóstico de Quito, Canadá");
    expect(salida).toContain("Pronóstico de 7 días — Quito, Canadá");
    expect(salida).toContain("22 / 11 °C");
  });

  test("sin ciudades avisa", async () => {
    const { salida } = await correrEscenario(
      escenarioAccion(
        `const { pronostico7dias } = await import("./src/actions/forecast7Days");
const config = { ciudades: [], default: null, unidad: "C", paleta: "paleta1" };`,
        "pronostico7dias(config)",
        [],
      ),
    );
    expect(salida).toContain("No hay ciudades guardadas.");
  });

  test("error de la API se muestra", async () => {
    const { salida } = await correrEscenario(
      escenarioAccion(
        `const { pronostico7dias } = await import("./src/actions/forecast7Days");
const { interceptarFetch } = await import("./test/establecimiento");
globalThis.fetch = interceptarFetch([], globalThis.fetch, () => new Response("", { status: 500 }));
const config = { ciudades: [{ id: "1,2", nombre: "Ottawa", detalle: "Ottawa, Canadá", lat: 1, lon: 2 }], default: null, unidad: "C", paleta: "paleta1" };`,
        "pronostico7dias(config)",
        ["1\n"],
      ),
    );
    expect(salida).toContain("No se pudo obtener el pronóstico de Ottawa, Canadá");
  });
});

// --- listar (opción 7) -----------------------------------------------------
describe("listar", () => {
  test("numerar las ciudades y marca la default", async () => {
    const { salida, codigoSalida } = await correrEscenario(
      escenarioAccion(
        `const { listar } = await import("./src/actions/listCities");
const config = { ciudades: [
  { id: "1,2", nombre: "Ottawa", detalle: "Ottawa, Canadá", lat: 1, lon: 2 },
  { id: "3,4", nombre: "Quito", detalle: "Quito, Ecuador", lat: 3, lon: 4 },
], default: "3,4", unidad: "C", paleta: "paleta1" };`,
        "listar(config)",
        [],
      ),
    );
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("Ciudades guardadas (2):");
    expect(salida).toContain("1. Ottawa, Canadá");
    expect(salida).toContain("⭐ default");
    expect(salida).toContain("2 ciudad(es) en la lista.");
  });

  test("sin ciudades avisa", async () => {
    const { salida } = await correrEscenario(
      escenarioAccion(
        `const { listar } = await import("./src/actions/listCities");
const config = { ciudades: [], default: null, unidad: "C", paleta: "paleta1" };`,
        "listar(config)",
        [],
      ),
    );
    expect(salida).toContain("No hay ciudades guardadas.");
  });
});

// --- ajustes (opción 8) ----------------------------------------------------
describe("ajustes", () => {
  test("cambia la unidad y la persiste", async () => {
    await escribirConfig(configCon([]));
    const { salida, codigoSalida } = await correrEscenario(
      escenarioAccion(
        `const { ajustes } = await import("./src/actions/settings");
const config = ${JSON.stringify(configCon([]))};`,
        "ajustes(config)",
        ["1\n"],
      ),
    );
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("Cambiar unidad de temperatura");
    expect(salida).toContain("Unidad de temperatura: °F");
    expect((await leerConfigGuardado()).unidad).toBe("F");

    // De vuelta a °C con la config ya en F.
    await escribirConfig({ ...configCon([]), unidad: "F" });
    const vuelta = await correrEscenario(
      escenarioAccion(
        `const { ajustes } = await import("./src/actions/settings");
const config = { ciudades: [], default: null, unidad: "F", paleta: "paleta1" };`,
        "ajustes(config)",
        ["1\n"],
      ),
    );
    expect(vuelta.salida).toContain("Unidad de temperatura: °C");
    expect((await leerConfigGuardado()).unidad).toBe("C");
  });

  test("cambia la paleta, la aplica y la persiste", async () => {
    await escribirConfig(configCon([]));
    const { salida, codigoSalida } = await correrEscenario(
      escenarioAccion(
        `const { ajustes } = await import("./src/actions/settings");
const { obtenerPaleta } = await import("./src/utils/colors");
const config = ${JSON.stringify(configCon([]))};
globalThis.PALETA_ANTES = obtenerPaleta();`,
        "ajustes(config)",
        ["2\n", "3\n"],
      ),
    );
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("Paleta de colores:");
    expect(salida).toContain("Paleta 3: verde (menú), Azul (temp), Amarillo (ok/error)");
    expect(salida).toContain("Paleta aplicada: paleta3");
    const guardado = await leerConfigGuardado();
    expect(guardado.paleta).toBe("paleta3");
  });

  test("cancelar en el primer paso no toca nada", async () => {
    await escribirConfig(configCon([]));
    const { salida } = await correrEscenario(
      escenarioAccion(
        `const { ajustes } = await import("./src/actions/settings");
const config = ${JSON.stringify(configCon([]))};`,
        "ajustes(config)",
        ["0\n"],
      ),
    );
    expect(salida).not.toContain("Unidad de temperatura");
    expect((await leerConfigGuardado()).unidad).toBe("C");
  });

  test("cancelar al elegir paleta no la cambia", async () => {
    await escribirConfig(configCon([]));
    const { salida } = await correrEscenario(
      escenarioAccion(
        `const { ajustes } = await import("./src/actions/settings");
const config = ${JSON.stringify(configCon([]))};`,
        "ajustes(config)",
        ["2\n", "0\n"],
      ),
    );
    expect(salida).not.toContain("Paleta aplicada");
    expect((await leerConfigGuardado()).paleta).toBe("paleta1");
  });
});
