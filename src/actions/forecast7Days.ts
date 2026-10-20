import { obtenerPronostico7dias } from "../api/weather";
import { seleccionarCiudad } from "../presentation/menu";
import { conCarga, fallo, msgError } from "../presentation/output";
import type { Config } from "../types/Config";
import { fmtPronostico } from "../utils/format";

/** 6. Pronóstico de los próximos 7 días de una ciudad de la lista. */
export async function pronostico7dias(config: Config): Promise<void> {
  const ciudad = await seleccionarCiudad(
    config.ciudades,
    "¿De qué ciudad quieres ver el pronóstico de 7 días?",
  );
  if (!ciudad) return;
  try {
    const dias = await conCarga(
      `Obteniendo pronóstico de ${ciudad.detalle}`,
      () => obtenerPronostico7dias(ciudad.lat, ciudad.lon, config.unidad),
    );
    console.log(fmtPronostico(ciudad.detalle, dias));
  } catch (e) {
    fallo(`No se pudo obtener el pronóstico de ${ciudad.detalle}: ${msgError(e)}`);
  }
}
