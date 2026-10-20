import type { Unit } from "../types/Config";
import type { DailyForecast, Weather } from "../types/Weather";

interface RespuestaForecast {
  current?: {
    time?: string;
    temperature_2m?: number | null;
    apparent_temperature?: number | null;
    relative_humidity_2m?: number | null;
    wind_speed_10m?: number | null;
  };
}

interface RespuestaForecastDiario {
  daily?: {
    time?: string[];
    weather_code?: (number | null)[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
    wind_speed_10m_max?: (number | null)[];
  };
}

/** Paso 2: obtiene el clima actual para unas coordenadas (Forecast API). */
export async function obtenerClima(
  lat: number,
  lon: number,
  unidad: Unit,
): Promise<Weather> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lon.toFixed(4));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m",
  );
  if (unidad === "F") url.searchParams.set("temperature_unit", "fahrenheit");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`La API del clima respondió ${res.status}`);

  const data = (await res.json()) as RespuestaForecast;
  const actual = data.current;
  if (!actual || typeof actual.temperature_2m !== "number") {
    throw new Error("Respuesta inesperada de la API del clima");
  }

  return {
    temperatura: redondear(actual.temperature_2m),
    sensacion:
      typeof actual.apparent_temperature === "number"
        ? redondear(actual.apparent_temperature)
        : null,
    humedad:
      typeof actual.relative_humidity_2m === "number"
        ? actual.relative_humidity_2m
        : null,
    viento:
      typeof actual.wind_speed_10m === "number" ? actual.wind_speed_10m : null,
    hora: typeof actual.time === "string" ? actual.time : null,
    unidad,
  };
}

/**
 * Pronóstico diario de los próximos 7 días (Forecast API, `daily` + `forecast_days=7`).
 * `timezone=auto` hace que las fechas salgan en el huso horario de la ubicación,
 * no en el de la máquina.
 */
export async function obtenerPronostico7dias(
  lat: number,
  lon: number,
  unidad: Unit,
): Promise<DailyForecast[]> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lon.toFixed(4));
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
  );
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("timezone", "auto");
  if (unidad === "F") url.searchParams.set("temperature_unit", "fahrenheit");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`La API del clima respondió ${res.status}`);

  const data = (await res.json()) as RespuestaForecastDiario;
  const daily = data.daily;
  if (!daily || !Array.isArray(daily.time) || daily.time.length === 0) {
    throw new Error("Respuesta inesperada de la API del clima");
  }

  // Los arrays del response diario son paralelos: i-ésimo día en cada uno.
  return daily.time.map((fecha, i) => ({
    fecha,
    codigo: num(daily.weather_code?.[i]),
    tempMax: enteroOpcional(numOrNull(daily.temperature_2m_max?.[i])),
    tempMin: enteroOpcional(numOrNull(daily.temperature_2m_min?.[i])),
    precipitacion: numOrNull(daily.precipitation_probability_max?.[i]),
    viento: enteroOpcional(numOrNull(daily.wind_speed_10m_max?.[i])),
    unidad,
  }));
}

function numOrNull(n: number | null | undefined): number | null {
  return typeof n === "number" ? n : null;
}

function num(n: number | null | undefined): number {
  return typeof n === "number" ? n : -1; // -1 = código desconocido
}

function redondear(n: number): number {
  return Math.round(n * 10) / 10;
}

/** En el pronóstico diario bastan grados/km/h enteros: la tabla queda más legible. */
function enteroOpcional(n: number | null): number | null {
  return n === null ? null : Math.round(n);
}
