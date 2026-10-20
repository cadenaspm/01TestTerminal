import { buscarAgregar } from "./actions/addCity";
import { pronostico7dias } from "./actions/forecast7Days";
import { climaDefault, climaTodas } from "./actions/getWeather";
import { listar } from "./actions/listCities";
import { eliminarCiudad } from "./actions/removeCity";
import { establecerDefault } from "./actions/setDefaultCity";
import { ajustes } from "./actions/settings";
import { menu } from "./presentation/menu";
import { fallo, info, msgError } from "./presentation/output";
import { pausar } from "./presentation/input";
import { cargar } from "./storage/settingsStorage";
import type { MenuOption } from "./types/MenuOption";
import { establecerPaleta } from "./utils/colors";
import { etiquetaPaleta } from "./utils/format";

const config = await cargar();
establecerPaleta(config.paleta);

// Opciones del menú: fuente única (id + etiqueta + handler). El menú se
// renderiza y valida a partir de esta lista; el bucle principal solo
// dispatchea. Para añadir una opción basta con agregar una entrada aquí.
function opciones(): MenuOption[] {
  const unidad = config.unidad === "C" ? "°C" : "°F";
  return [
    { id: "1", etiqueta: "Clima de ciudad default", handler: () => climaDefault(config) },
    {
      id: "2",
      etiqueta: `Clima de todas las ciudades (${config.ciudades.length})`,
      handler: () => climaTodas(config),
    },
    { id: "3", etiqueta: "Buscar y agregar ciudad", handler: () => buscarAgregar(config) },
    { id: "4", etiqueta: "Eliminar ciudad", handler: () => eliminarCiudad(config) },
    { id: "5", etiqueta: "Establecer ciudad default", handler: () => establecerDefault(config) },
    { id: "6", etiqueta: "Pronóstico 7 días", handler: () => pronostico7dias(config) },
    { id: "7", etiqueta: "Listar ciudades", handler: () => listar(config) },
    {
      id: "8",
      etiqueta: `Ajustes (${unidad} · ${etiquetaPaleta(config.paleta)})`,
      handler: () => ajustes(config),
    },
    {
      id: "9",
      etiqueta: "Salir",
      handler: async () => {
        salir = true;
      },
    },
  ];
}

let salir = false;
while (!salir) {
  const lista = opciones();
  const op = await menu(lista);
  if (op === null) break; // EOF = salir limpiamente
  const opcion = lista.find((o) => o.id === op);
  if (!opcion) continue;
  try {
    await opcion.handler();
  } catch (e) {
    fallo(`Error: ${msgError(e)}`);
  }
  if (!salir) await pausar();
}

console.log();
info("¡Hasta luego!");
