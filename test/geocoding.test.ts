import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { interceptarFetch, respuestaJson } from "./establecimiento";

// Sin red: se intercepta `globalThis.fetch` (guardando la petición real) y se
// responde con JSON falso. Importante registrar las URLs apuntando a los tipos
// reales (URL del ámbito global), porque el TSC transform puede reescribir las
// clases globales al compilar los tests.
const originalFetch = globalThis.fetch;

let peticiones: URL[] = [];
let respuesta: Response | undefined;

beforeEach(() => {
  peticiones = [];
  respuesta = undefined;
  globalThis.fetch = interceptarFetch(peticiones, originalFetch, () => respuesta);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/** Prepara la respuesta de la siguiente petición HTTP. */
function responderHttp(data: unknown, status = 200): void {
  respuesta = respuestaJson(data, status);
}

const { buscarCiudad } = await import("../src/api/geocoding");

describe("buscarCiudad", () => {
  test("construye la URL con los parámetros del geocoding", async () => {
    responderHttp({ results: [] });
    await buscarCiudad("Ottawa");

    const url = peticiones.at(-1)!;
    expect(url.origin + url.pathname).toBe("https://geocoding-api.open-meteo.com/v1/search");
    expect(url.searchParams.get("name")).toBe("Ottawa");
    expect(url.searchParams.get("count")).toBe("10");
    expect(url.searchParams.get("language")).toBe("es");
    expect(url.searchParams.get("format")).toBe("json");
  });

  test("mapea los resultados con detalle, población y id lat,lon", async () => {
    responderHttp({
      results: [
        {
          name: "Ottawa",
          latitude: 45.41117,
          longitude: -75.69812,
          country: "Canadá",
          admin1: "Ontario",
          population: 1017449,
        },
        { name: "San José", latitude: 9.93, longitude: -84.08, population: 335007 },
      ],
    });

    expect(await buscarCiudad("Ottawa")).toEqual([
      {
        id: "45.41117,-75.69812",
        nombre: "Ottawa",
        detalle: "Ottawa, Ontario, Canadá",
        lat: 45.41117,
        lon: -75.69812,
        poblacion: 1017449,
      },
      {
        id: "9.93,-84.08",
        nombre: "San José",
        detalle: "San José",
        lat: 9.93,
        lon: -84.08,
        poblacion: 335007,
      },
    ]);
  });

  test("deduplica ubicaciones repetidas por lat,lon", async () => {
    responderHttp({
      results: [
        { name: "Springfield", latitude: 39.8, longitude: -89.6, country: "Estados Unidos" },
        { name: "Springfield", latitude: 39.8, longitude: -89.6, country: "Estados Unidos" },
        { name: "Springfield", latitude: 37.2, longitude: -93.3, country: "Estados Unidos" },
      ],
    });
    expect((await buscarCiudad("Springfield")).map((r) => r.id)).toEqual([
      "39.8,-89.6",
      "37.2,-93.3",
    ]);
  });

  test("población ausente o no numérica queda en null y omite partes vacías", async () => {
    responderHttp({
      results: [{ name: "Aldea", latitude: 1, longitude: 2, admin1: "", population: "muchos" }],
    });
    expect(await buscarCiudad("Aldea")).toEqual([
      {
        id: "1,2",
        nombre: "Aldea",
        detalle: "Aldea",
        lat: 1,
        lon: 2,
        poblacion: null,
      },
    ]);
  });

  test("sin results devuelve lista vacía", async () => {
    responderHttp({});
    expect(await buscarCiudad("xyz")).toEqual([]);
    responderHttp({ results: [] });
    expect(await buscarCiudad("xyz")).toEqual([]);
  });

  test("error HTTP lanza con el status", async () => {
    responderHttp({}, 503);
    await expect(buscarCiudad("Ottawa")).rejects.toThrow("La API de geocoding respondió 503");
  });

  test("el nombre viajando como parametro conserva acentos y espacios", async () => {
    responderHttp({ results: [] });
    await buscarCiudad("San Andrés");
    expect(peticiones.at(-1)!.searchParams.get("name")).toBe("San Andrés");
  });
});
