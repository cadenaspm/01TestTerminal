import type { CitySearchResult } from "../types/City";

interface ResultadoGeocoding {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  population?: number;
}

/**
 * Paso 1: resuelve el nombre de una ciudad a coordenadas (Geocoding API).
 * Trae hasta 10 coincidencias: los nombres ambiguos (Springfield, San José,
 * Santiago…) existen en varias regiones/países y hay que ofrecer alternativas
 * con país, región y población para elegir la correcta. El orden es por
 * relevancia de la API, no por población.
 */
export async function buscarCiudad(nombre: string): Promise<CitySearchResult[]> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", nombre);
  url.searchParams.set("count", "10");
  url.searchParams.set("language", "es");
  url.searchParams.set("format", "json");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`La API de geocoding respondió ${res.status}`);

  const data = (await res.json()) as { results?: ResultadoGeocoding[] };
  const vistos = new Set<string>();
  const resultados: CitySearchResult[] = [];
  for (const r of data.results ?? []) {
    const id = `${r.latitude},${r.longitude}`;
    if (vistos.has(id)) continue; // la API puede repetir ubicaciones
    vistos.add(id);
    const partes = [r.name, r.admin1, r.country].filter(
      (p): p is string => typeof p === "string" && p.length > 0,
    );
    resultados.push({
      id,
      nombre: r.name,
      detalle: partes.join(", "),
      lat: r.latitude,
      lon: r.longitude,
      poblacion: typeof r.population === "number" ? r.population : null,
    });
  }
  return resultados;
}
