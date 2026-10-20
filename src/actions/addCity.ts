import { buscarCiudad } from "../api/geocoding";
import { seleccionar } from "../presentation/menu";
import { aviso, conCarga, exito, fallo, msgError } from "../presentation/output";
import { preguntar } from "../presentation/input";
import { agregarCiudad, existeCiudad } from "../storage/citiesStorage";
import type { Config } from "../types/Config";
import { etiquetaBusqueda } from "../utils/format";

/** 3. Buscar una ciudad por nombre (geocoding) y agregarla a la lista. */
export async function buscarAgregar(config: Config): Promise<void> {
  const nombre = await preguntar("Nombre de la ciudad: ");
  if (!nombre) return;

  let resultados;
  try {
    resultados = await conCarga(`Buscando "${nombre}"...`, () => buscarCiudad(nombre));
  } catch (e) {
    fallo(`Error al buscar: ${msgError(e)}`);
    return;
  }
  if (resultados.length === 0) {
    aviso(`No se encontró ninguna ciudad llamada "${nombre}".`);
    return;
  }

  const idx = await seleccionar(
    resultados.map((r) => etiquetaBusqueda(r)),
    `Resultados para "${nombre}":`,
  );
  if (idx === null) return;
  const elegido = resultados[idx];
  if (!elegido) return;

  if (existeCiudad(config, elegido.id)) {
    aviso("Esa ciudad ya está en la lista.");
    return;
  }
  await agregarCiudad(config, {
    id: elegido.id,
    nombre: elegido.nombre,
    detalle: elegido.detalle,
    lat: elegido.lat,
    lon: elegido.lon,
  });
  exito(`"${elegido.detalle}" agregada a la lista.`);
}
