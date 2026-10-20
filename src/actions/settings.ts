import { guardar } from "../storage/settingsStorage";
import type { Config, Palette } from "../types/Config";
import { establecerPaleta, previewPaleta } from "../utils/colors";
import { seleccionar } from "../presentation/menu";
import { exito } from "../presentation/output";

/** Pestañas disponibles dentro de Ajustes (ids = posiciones del menú). */
export const PALETAS: Array<{ id: Palette; descripcion: string }> = [
  { id: "paleta1", descripcion: "Paleta 1: cyan (menú), amarillo (temp), verde/rojo (ok/error)" },
  { id: "paleta2", descripcion: "Paleta 2: rojo (menú), amarillo (temp), azul (ok/error)" },
  { id: "paleta3", descripcion: "Paleta 3: verde (menú), Azul (temp), Amarillo (ok/error)" },
];

/** 8. Ajustes: unidad de temperatura y paleta de colores. */
export async function ajustes(config: Config): Promise<void> {
  const opcion = await seleccionar(
    ["Cambiar unidad de temperatura (°C / °F)", "Cambiar paleta de colores"],
    "Ajustes:",
  );
  if (opcion === null) return;

  if (opcion === 0) {
    config.unidad = config.unidad === "C" ? "F" : "C";
    await guardar(config);
    exito(`Unidad de temperatura: ${config.unidad === "C" ? "°C" : "°F"}`);
    return;
  }

  const elegida = await seleccionar(
    PALETAS.map((p) => p.descripcion),
    "Paleta de colores:",
  );
  if (elegida === null) return;
  const paleta = PALETAS[elegida];
  if (!paleta) return;
  config.paleta = paleta.id;
  establecerPaleta(paleta.id);
  await guardar(config);
  console.log(previewPaleta(paleta.id));
  exito(`Paleta aplicada: ${paleta.id}`);
}
