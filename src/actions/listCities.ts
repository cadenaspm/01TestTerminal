import { aviso, exito } from "../presentation/output";
import type { Config } from "../types/Config";
import { menuColor, negrita, tempColor } from "../utils/colors";

/** 7. Listar las ciudades guardadas, marcando la default con ⭐. */
export async function listar(config: Config): Promise<void> {
  const total = config.ciudades.length;
  if (total === 0) {
    aviso("No hay ciudades guardadas. Usa la opción 3 para agregar una.");
    return;
  }
  console.log(`\n  ${menuColor(negrita(`Ciudades guardadas (${total}):`))}`);
  for (let i = 0; i < total; i++) {
    const ciudad = config.ciudades[i];
    if (!ciudad) continue;
    const marca = ciudad.id === config.default ? ` ${tempColor("⭐ default")}` : "";
    console.log(`  ${menuColor(`${i + 1}.`)} ${ciudad.detalle}${marca}`);
  }
  exito(`${total} ciudad(es) en la lista.`);
}
