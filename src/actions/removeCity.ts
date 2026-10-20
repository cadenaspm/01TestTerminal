import { seleccionarCiudad } from "../presentation/menu";
import { exito } from "../presentation/output";
import { eliminarCiudad as quitarDeLaLista } from "../storage/citiesStorage";
import type { Config } from "../types/Config";

/** 4. Eliminar una ciudad de la lista guardada. */
export async function eliminarCiudad(config: Config): Promise<void> {
  const ciudad = await seleccionarCiudad(config.ciudades, "¿Qué ciudad quieres eliminar?");
  if (!ciudad) return;
  await quitarDeLaLista(config, ciudad.id);
  exito(`"${ciudad.detalle}" eliminada.`);
}
