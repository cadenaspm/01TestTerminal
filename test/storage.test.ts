import { beforeEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { City } from "../src/types/City";
import type { Config } from "../src/types/Config";
import { usarConfigTemporal } from "./establecimiento";

// Aísla el config.json real del usuario: APPDATA/XDG_CONFIG_HOME apuntan a una
// carpeta temporal ANTES de importar el storage (la ruta se resuelve al importar).
const temporal = await usarConfigTemporal();

const { cargar, guardar } = await import("../src/storage/settingsStorage");
const { agregarCiudad, ciudadDefault, eliminarCiudad, establecerCiudadDefault, existeCiudad } =
  await import("../src/storage/citiesStorage");

let rutaConfig = "";

function ciudad(id: string, nombre = "Ottawa"): City {
  return { id, nombre, detalle: `${nombre}, Canadá`, lat: 45.4, lon: -75.7 };
}

function configBase(): Config {
  return { ciudades: [], default: null, unidad: "C", paleta: "paleta1" };
}

beforeEach(() => {
  rutaConfig = join(temporal.dir, "weather-cli", "config.json");
});

/** Escribe un config.json con contenido arbitrario (crudo, sin validar). */
async function escribirConfigCrudo(contenido: string): Promise<void> {
  await Bun.write(rutaConfig, contenido);
}

describe("cargar", () => {
  test("sin archivo devuelve la config inicial", async () => {
    expect(await cargar()).toEqual({
      ciudades: [],
      default: null,
      unidad: "C",
      paleta: "paleta1",
    });
  });

  test("archivo corrupto no rompe: arranca de cero", async () => {
    await escribirConfigCrudo("{ esto no es json ");
    expect(await cargar()).toEqual(configBase());
  });

  test("config completa se conserva", async () => {
    const config: Config = {
      ciudades: [ciudad("1,2", "Ottawa")],
      default: "1,2",
      unidad: "F",
      paleta: "paleta3",
    };
    await escribirConfigCrudo(JSON.stringify(config));
    expect(await cargar()).toEqual(config);
  });

  test("valores desconocidos caen a los defaults", async () => {
    await escribirConfigCrudo(
      JSON.stringify({ ciudades: "no es un array", default: 7, unidad: "K", paleta: "neón" }),
    );
    expect(await cargar()).toEqual(configBase());
  });

  test("ciudades inválidas se filtran sin descartar las válidas", async () => {
    await escribirConfigCrudo(
      JSON.stringify({
        ciudades: [
          ciudad("1,2"),
          { id: 1, nombre: "sin tipos", detalle: "", lat: "no", lon: 0 },
          { id: "3,4", nombre: "Solo parcial" },
          null,
          ciudad("5,6", "Quito"),
        ],
      }),
    );
    const config = await cargar();
    expect(config.ciudades.map((c) => c.id)).toEqual(["1,2", "5,6"]);
  });

  test("unidad solo acepta F; cualquier otra cosa es C", async () => {
    await escribirConfigCrudo(JSON.stringify({ unidad: "f" }));
    expect((await cargar()).unidad).toBe("C");
    await escribirConfigCrudo(JSON.stringify({ unidad: "F" }));
    expect((await cargar()).unidad).toBe("F");
  });

  test("paleta solo acepta paleta2/paleta3", async () => {
    await escribirConfigCrudo(JSON.stringify({ paleta: "paleta2" }));
    expect((await cargar()).paleta).toBe("paleta2");
    await escribirConfigCrudo(JSON.stringify({ paleta: "paleta1" }));
    expect((await cargar()).paleta).toBe("paleta1");
  });
});

describe("guardar", () => {
  test("crea el directorio y escribe JSON legible con UTF-8", async () => {
    const config: Config = {
      ciudades: [ciudad("1,2", "Popayán")],
      default: "1,2",
      unidad: "C",
      paleta: "paleta1",
    };
    await guardar(config);

    const crudo = await readFile(rutaConfig, "utf8");
    expect(crudo).toContain("\n  "); // indentación de 2 espacios
    expect(crudo).toContain("Popayán"); // acentos intactos
    expect(JSON.parse(crudo)).toEqual(config);
  });

  test("ida y vuelta: guardar y cargar conserva todo", async () => {
    const config: Config = {
      ciudades: [ciudad("1,2"), ciudad("3,4", "San José")],
      default: "3,4",
      unidad: "F",
      paleta: "paleta2",
    };
    await guardar(config);
    expect(await cargar()).toEqual(config);
  });
});

describe("ciudades", () => {
  test("agregarCiudad persiste la nueva ciudad", async () => {
    const config = configBase();
    await agregarCiudad(config, ciudad("1,2"));

    expect((await cargar()).ciudades).toHaveLength(1);
    expect(config.ciudades).toHaveLength(1);
  });

  test("ciudadDefault devuelve la marcada o undefined", async () => {
    const config = configBase();
    expect(ciudadDefault(config)).toBeUndefined();

    config.ciudades = [ciudad("1,2"), ciudad("3,4", "Quito")];
    expect(ciudadDefault(config)).toBeUndefined();

    config.default = "3,4";
    expect(ciudadDefault(config)?.nombre).toBe("Quito");

    config.default = "9,9"; // puntero huérfano
    expect(ciudadDefault(config)).toBeUndefined();
  });

  test("existeCiudad distingue ids presentes y ausentes", () => {
    const config = configBase();
    config.ciudades = [ciudad("1,2")];
    expect(existeCiudad(config, "1,2")).toBe(true);
    expect(existeCiudad(config, "9,9")).toBe(false);
  });

  test("eliminarCiudad quita la ciudad y persiste", async () => {
    const config = configBase();
    await agregarCiudad(config, ciudad("1,2"));
    await agregarCiudad(config, ciudad("3,4", "Quito"));
    await eliminarCiudad(config, "1,2");

    const guardado = await cargar();
    expect(guardado.ciudades.map((c) => c.id)).toEqual(["3,4"]);
  });

  test("eliminar la ciudad default limpia el puntero", async () => {
    const config = configBase();
    await agregarCiudad(config, ciudad("1,2"));
    await establecerCiudadDefault(config, "1,2");
    await eliminarCiudad(config, "1,2");

    const guardado = await cargar();
    expect(guardado.default).toBeNull();
    expect(guardado.ciudades).toEqual([]);
  });

  test("establecerCiudadDefault persiste el id", async () => {
    const config = configBase();
    await agregarCiudad(config, ciudad("1,2"));
    await establecerCiudadDefault(config, "1,2");
    expect((await cargar()).default).toBe("1,2");
  });
});
