import { seleccionarCiudad } from "../presentation/menu";
import { exito } from "../presentation/output";
import { establecerCiudadDefault } from "../storage/citiesStorage";
import type { Config } from "../types/Config";

/** 5. Marcar una ciudad de la lista como la ciudad default. */
export async function establecerDefault(config: Config): Promise<void> {
  const ciudad = await seleccionarCiudad(config.ciudades, "¿Qué ciudad será la default?");
  if (!ciudad) return;
  await establecerCiudadDefault(config, ciudad.id);
  exito(`"${ciudad.detalle}" ahora es la ciudad default.`);
}
