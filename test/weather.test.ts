import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { interceptarFetch, respuestaJson } from "./establecimiento";

// Sin red: se intercepta `globalThis.fetch` y se responde JSON falso. Así se
// cubren mapeo, redondeos y respuestas inesperadas de forma determinista.
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

function responderHttp(data: unknown, status = 200): void {
  respuesta = respuestaJson(data, status);
}

const { obtenerClima, obtenerPronostico7dias } = await import("../src/api/weather");

describe("obtenerClima", () => {
  test("construye la URL del forecast con coordenadas y variables actuales", async () => {
    responderHttp({ current: { temperature_2m: 20 } });
    await obtenerClima(45.41117, -75.69812, "C");

    const url = peticiones.at(-1)!;
    expect(url.origin + url.pathname).toBe("https://api.open-meteo.com/v1/forecast");
    expect(url.searchParams.get("latitude")).toBe("45.4112");
    expect(url.searchParams.get("longitude")).toBe("-75.6981");
    expect(url.searchParams.get("current")).toBe(
      "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m",
    );
    expect(url.searchParams.has("temperature_unit")).toBe(false);
  });

  test("con °F pide fahrenheit", async () => {
    responderHttp({ current: { temperature_2m: 68 } });
    await obtenerClima(0, 0, "F");
    expect(peticiones.at(-1)!.searchParams.get("temperature_unit")).toBe("fahrenheit");
  });

  test("mapea y redondea los valores actuales", async () => {
    responderHttp({
      current: {
        time: "2026-10-20T14:30",
        temperature_2m: 21.46,
        apparent_temperature: 20.05,
        relative_humidity_2m: 61,
        wind_speed_10m: 12.3,
      },
    });

    expect(await obtenerClima(45.4, -75.7, "C")).toEqual({
      temperatura: 21.5,
      sensacion: 20.1,
      humedad: 61,
      viento: 12.3,
      hora: "2026-10-20T14:30",
      unidad: "C",
    });
  });

  test("campos opcionales ausentes o nulables quedan en null", async () => {
    responderHttp({ current: { temperature_2m: 10 } });
    expect(await obtenerClima(0, 0, "C")).toEqual({
      temperatura: 10,
      sensacion: null,
      humedad: null,
      viento: null,
      hora: null,
      unidad: "C",
    });

    responderHttp({
      current: { temperature_2m: 10, apparent_temperature: null, relative_humidity_2m: null },
    });
    const clima = await obtenerClima(0, 0, "C");
    expect(clima.sensacion).toBeNull();
    expect(clima.humedad).toBeNull();
  });

  test("respuesta sin temperatura lanza error", async () => {
    responderHttp({});
    await expect(obtenerClima(0, 0, "C")).rejects.toThrow("Respuesta inesperada de la API del clima");

    responderHttp({ current: { temperature_2m: null } });
    await expect(obtenerClima(0, 0, "C")).rejects.toThrow("Respuesta inesperada de la API del clima");
  });

  test("error HTTP lanza con el status", async () => {
    responderHttp({}, 500);
    await expect(obtenerClima(0, 0, "C")).rejects.toThrow("La API del clima respondió 500");
  });
});

describe("obtenerPronostico7dias", () => {
  const daily = {
    time: ["2026-10-20", "2026-10-21"],
    weather_code: [0, 61],
    temperature_2m_max: [22.4, 18.6],
    temperature_2m_min: [11.2, 9.5],
    precipitation_probability_max: [5, 80],
    wind_speed_10m_max: [14.3, 25.9],
  };

  test("pide daily, 7 días y el huso de la ubicación", async () => {
    responderHttp({ daily });
    await obtenerPronostico7dias(45.41117, -75.69812, "C");

    const url = peticiones.at(-1)!;
    expect(url.searchParams.get("daily")).toBe(
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
    );
    expect(url.searchParams.get("forecast_days")).toBe("7");
    expect(url.searchParams.get("timezone")).toBe("auto");
    expect(url.searchParams.has("temperature_unit")).toBe(false);

    responderHttp({ daily });
    await obtenerPronostico7dias(0, 0, "F");
    expect(peticiones.at(-1)!.searchParams.get("temperature_unit")).toBe("fahrenheit");
  });

  test("arregla los arrays paralelos en un día por índice", async () => {
    responderHttp({ daily });
    expect(await obtenerPronostico7dias(45.4, -75.7, "C")).toEqual([
      {
        fecha: "2026-10-20",
        codigo: 0,
        tempMax: 22,
        tempMin: 11,
        precipitacion: 5,
        viento: 14,
        unidad: "C",
      },
      {
        fecha: "2026-10-21",
        codigo: 61,
        tempMax: 19,
        tempMin: 10,
        precipitacion: 80,
        viento: 26,
        unidad: "C",
      },
    ]);
  });

  test("huecos en los arrays diarios quedan en null y código desconocido en -1", async () => {
    responderHttp({
      daily: { time: ["2026-10-20", "2026-10-21"], temperature_2m_max: [20] },
    });
    expect(await obtenerPronostico7dias(0, 0, "C")).toEqual([
      {
        fecha: "2026-10-20",
        codigo: -1,
        tempMax: 20,
        tempMin: null,
        precipitacion: null,
        viento: null,
        unidad: "C",
      },
      {
        fecha: "2026-10-21",
        codigo: -1,
        tempMax: null,
        tempMin: null,
        precipitacion: null,
        viento: null,
        unidad: "C",
      },
    ]);
  });

  test("valores null explícitos se respetan", async () => {
    responderHttp({
      daily: {
        time: ["2026-10-20"],
        weather_code: [null],
        temperature_2m_max: [null],
        temperature_2m_min: [null],
        precipitation_probability_max: [null],
        wind_speed_10m_max: [null],
      },
    });
    expect(await obtenerPronostico7dias(0, 0, "C")).toEqual([
      {
        fecha: "2026-10-20",
        codigo: -1,
        tempMax: null,
        tempMin: null,
        precipitacion: null,
        viento: null,
        unidad: "C",
      },
    ]);
  });

  test("sin daily o con time vacío lanza error", async () => {
    responderHttp({});
    await expect(obtenerPronostico7dias(0, 0, "C")).rejects.toThrow(
      "Respuesta inesperada de la API del clima",
    );

    responderHttp({ daily: { time: [] } });
    await expect(obtenerPronostico7dias(0, 0, "C")).rejects.toThrow(
      "Respuesta inesperada de la API del clima",
    );
  });

  test("error HTTP lanza con el status", async () => {
    responderHttp({}, 503);
    await expect(obtenerPronostico7dias(0, 0, "C")).rejects.toThrow(
      "La API del clima respondió 503",
    );
  });
});
