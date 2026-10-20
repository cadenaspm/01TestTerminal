import type { City } from "./City";

/** Unidad de temperatura: Celsius o Fahrenheit. */
export type Unit = "C" | "F";

/** Paleta de colores de la CLI (ver utils/colors.ts para los valores de cada una). */
export type Palette = "paleta1" | "paleta2" | "paleta3";

/** Configuración persistida de la app (config.json del SO). */
export interface Config {
  ciudades: City[];
  default: string | null; // id de la ciudad default
  unidad: Unit;
  paleta: Palette;
}
