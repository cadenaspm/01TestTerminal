import { obtenerClima } from "../api/weather";
import { aviso, conCarga, fallo, msgError } from "../presentation/output";
import { ciudadDefault } from "../storage/citiesStorage";
import type { City } from "../types/City";
import type { Config } from "../types/Config";
import { fmtClima } from "../utils/format";

async function climaDe(config: Config, ciudad: City, mensaje?: string): Promise<void> {
  try {
    const clima = await conCarga(
      mensaje ?? `Obteniendo clima de ${ciudad.detalle}`,
      () => obtenerClima(ciudad.lat, ciudad.lon, config.unidad),
    );
    console.log(fmtClima(ciudad.detalle, clima));
  } catch (e) {
    fallo(`No se pudo obtener el clima de ${ciudad.detalle}: ${msgError(e)}`);
  }
}

/** 1. Clima de la ciudad default. */
export async function climaDefault(config: Config): Promise<void> {
  const def = ciudadDefault(config);
  if (!def) {
    aviso("No hay ciudad default. Usa la opción 5 para establecer una.");
    return;
  }
  await climaDe(config, def);
}

/** 2. Clima de todas las ciudades guardadas. */
export async function climaTodas(config: Config): Promise<void> {
  const total = config.ciudades.length;
  if (total === 0) {
    aviso("No hay ciudades guardadas. Usa la opción 3 para agregar una.");
    return;
  }
  for (let i = 0; i < total; i++) {
    const ciudad = config.ciudades[i];
    if (!ciudad) continue;
    await climaDe(config, ciudad, `Obteniendo clima (${i + 1}/${total}): ${ciudad.detalle}`);
  }
}
