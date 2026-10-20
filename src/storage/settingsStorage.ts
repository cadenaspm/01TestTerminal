import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { City } from "../types/City";
import type { Config, Palette } from "../types/Config";

/** Directorio de configuración del SO: %APPDATA% en Windows, ~/.config o $XDG_CONFIG_HOME en Unix. */
function dirConfig(): string {
  const env = Bun.env;
  if (env.APPDATA) return join(env.APPDATA, "weather-cli");
  const base = env.XDG_CONFIG_HOME ?? join(env.HOME ?? env.USERPROFILE ?? ".", ".config");
  return join(base, "weather-cli");
}

const ARCHIVO = join(dirConfig(), "config.json");

function inicial(): Config {
  return { ciudades: [], default: null, unidad: "C", paleta: "paleta1" };
}

export async function cargar(): Promise<Config> {
  try {
    const file = Bun.file(ARCHIVO);
    if (!(await file.exists())) return inicial();
    const data = JSON.parse(await file.text()) as Partial<Config>;
    return {
      ciudades: Array.isArray(data.ciudades)
        ? data.ciudades.filter(
            (c): c is City =>
              typeof c?.id === "string" &&
              typeof c.nombre === "string" &&
              typeof c.detalle === "string" &&
              typeof c.lat === "number" &&
              typeof c.lon === "number",
          )
        : [],
      default: typeof data.default === "string" ? data.default : null,
      unidad: data.unidad === "F" ? "F" : "C",
      paleta:
        data.paleta === "paleta2" || data.paleta === "paleta3"
          ? (data.paleta as Palette)
          : "paleta1",
    };
  } catch {
    // Archivo ausente o corrupto: empezamos de cero.
    return inicial();
  }
}

export async function guardar(config: Config): Promise<void> {
  await mkdir(dirname(ARCHIVO), { recursive: true });
  await Bun.write(ARCHIVO, JSON.stringify(config, null, 2));
}
