import type { City } from "../types/City";
import type { Config } from "../types/Config";
import { guardar } from "./settingsStorage";

/**
 * Persistencia de la lista de ciudades. Todo vive en el mismo config.json que
 * settingsStorage, así que cada mutación delega la escritura en `guardar()`.
 */

/** La ciudad default según la config, o undefined si no hay o fue eliminada. */
export function ciudadDefault(config: Config): City | undefined {
  return config.ciudades.find((c) => c.id === config.default);
}

export function existeCiudad(config: Config, id: string): boolean {
  return config.ciudades.some((c) => c.id === id);
}

export async function agregarCiudad(config: Config, ciudad: City): Promise<void> {
  config.ciudades.push(ciudad);
  await guardar(config);
}

/** Elimina la ciudad; si era la default, limpia también el puntero default. */
export async function eliminarCiudad(config: Config, id: string): Promise<void> {
  config.ciudades = config.ciudades.filter((c) => c.id !== id);
  if (config.default === id) config.default = null;
  await guardar(config);
}

export async function establecerCiudadDefault(config: Config, id: string): Promise<void> {
  config.default = id;
  await guardar(config);
}
