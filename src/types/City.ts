/** Ciudad guardada en la lista local. `id` es "lat,lon": único por ubicación. */
export interface City {
  id: string;
  nombre: string;
  detalle: string;
  lat: number;
  lon: number;
}

/**
 * Coincidencia del geocoding: una ciudad candidata con su contexto (región,
 * país, población) para poder distinguir los homónimos (Springfield, Santiago…).
 */
export interface CitySearchResult extends City {
  poblacion: number | null;
}
