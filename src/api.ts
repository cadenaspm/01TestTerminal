import type { Unidad } from "./store";

export interface ResultadoBusqueda {
  id: string;
  nombre: string;
  detalle: string;
  lat: number;
  lon: number;
}

interface ResultadoGeocoding {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

interface RespuestaForecast {
  current?: {
    time?: string;
    temperature_2m?: number | null;
    apparent_temperature?: number | null;
    relative_humidity_2m?: number | null;
    wind_speed_10m?: number | null;
  };
}

export interface Clima {
  temperatura: number;
  sensacion: number | null;
  humedad: number | null;
  viento: number | null;
  hora: string | null;
  unidad: Unidad;
}

/** Paso 1: resuelve el nombre de una ciudad a coordenadas (Geocoding API). */
export async function buscarCiudad(nombre: string): Promise<ResultadoBusqueda[]> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", nombre);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "es");
  url.searchParams.set("format", "json");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`La API de geocoding respondió ${res.status}`);

  const data = (await res.json()) as { results?: ResultadoGeocoding[] };
  return (data.results ?? []).map((r) => {
    const partes = [r.name, r.admin1, r.country].filter(
      (p): p is string => typeof p === "string" && p.length > 0,
    );
    return {
      id: `${r.latitude},${r.longitude}`,
      nombre: r.name,
      detalle: partes.join(", "),
      lat: r.latitude,
      lon: r.longitude,
    };
  });
}

/** Paso 2: obtiene el clima actual para unas coordenadas (Forecast API). */
export async function obtenerClima(
  lat: number,
  lon: number,
  unidad: Unidad,
): Promise<Clima> {
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
      typeof actual.wind_speed_10m === "number"
        ? actual.wind_speed_10m
        : null,
    hora: typeof actual.time === "string" ? actual.time : null,
    unidad,
  };
}

function redondear(n: number): number {
  return Math.round(n * 10) / 10;
}
