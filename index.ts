import { buscarCiudad, obtenerClima } from "./src/api";
import { cargar, guardar, type Ciudad, type Paleta } from "./src/store";
import {
  aviso,
  establecerPaleta,
  exito,
  fallo,
  fmtClima,
  info,
  menu,
  msgError,
  pausar,
  preguntar,
  previewPaleta,
  seleccionar,
} from "./src/ui";

const config = await cargar();
establecerPaleta(config.paleta);

async function climaDe(ciudad: Ciudad): Promise<void> {
  try {
    const clima = await obtenerClima(ciudad.lat, ciudad.lon, config.unidad);
    console.log(fmtClima(ciudad.detalle, clima));
  } catch (e) {
    fallo(`No se pudo obtener el clima de ${ciudad.detalle}: ${msgError(e)}`);
  }
}

// 1. Clima de ciudad default
async function climaDefault(): Promise<void> {
  const def = config.ciudades.find((c) => c.id === config.default);
  if (!def) {
    aviso("No hay ciudad default. Usa la opción 5 para establecer una.");
    return;
  }
  await climaDe(def);
}

// 2. Clima de todas las ciudades
async function climaTodas(): Promise<void> {
  if (config.ciudades.length === 0) {
    aviso("No hay ciudades guardadas. Usa la opción 3 para agregar una.");
    return;
  }
  for (const ciudad of config.ciudades) await climaDe(ciudad);
}

// 3. Buscar y agregar ciudad
async function buscarAgregar(): Promise<void> {
  const nombre = await preguntar("Nombre de la ciudad: ");
  if (!nombre) return;

  let resultados;
  try {
    resultados = await buscarCiudad(nombre);
  } catch (e) {
    fallo(`Error al buscar: ${msgError(e)}`);
    return;
  }
  if (resultados.length === 0) {
    aviso(`No se encontró ninguna ciudad llamada "${nombre}".`);
    return;
  }

  const idx = await seleccionar(
    resultados.map((r) => r.detalle),
    `Resultados para "${nombre}":`,
  );
  if (idx === null) return;
  const elegido = resultados[idx];
  if (!elegido) return;

  if (config.ciudades.some((c) => c.id === elegido.id)) {
    aviso("Esa ciudad ya está en la lista.");
    return;
  }
  config.ciudades.push({
    id: elegido.id,
    nombre: elegido.nombre,
    detalle: elegido.detalle,
    lat: elegido.lat,
    lon: elegido.lon,
  });
  await guardar(config);
  exito(`"${elegido.detalle}" agregada a la lista.`);
}

async function elegirDeLaLista(titulo: string): Promise<Ciudad | null> {
  if (config.ciudades.length === 0) {
    aviso("No hay ciudades guardadas. Usa la opción 3 para agregar una.");
    return null;
  }
  const idx = await seleccionar(
    config.ciudades.map((c) => c.detalle),
    titulo,
  );
  if (idx === null) return null;
  return config.ciudades[idx] ?? null;
}

// 4. Eliminar ciudad
async function eliminarCiudad(): Promise<void> {
  const ciudad = await elegirDeLaLista("¿Qué ciudad quieres eliminar?");
  if (!ciudad) return;
  config.ciudades = config.ciudades.filter((c) => c.id !== ciudad.id);
  if (config.default === ciudad.id) config.default = null;
  await guardar(config);
  exito(`"${ciudad.detalle}" eliminada.`);
}

// 5. Establecer ciudad default
async function establecerDefault(): Promise<void> {
  const ciudad = await elegirDeLaLista("¿Qué ciudad será la default?");
  if (!ciudad) return;
  config.default = ciudad.id;
  await guardar(config);
  exito(`"${ciudad.detalle}" ahora es la ciudad default.`);
}

// 8. Ajustes: unidad de temperatura y paleta de colores
const PALETAS: Array<{ id: Paleta; descripcion: string }> = [
  { id: "paleta1", descripcion: "Paleta 1: cyan (menú), amarillo (temp), verde/rojo (ok/error)" },
  { id: "paleta2", descripcion: "Paleta 2: rojo (menú), amarillo (temp), azul (ok/error)" },
  { id: "paleta3", descripcion: "Paleta 3: verde (menú), azul (temp), amarillo (ok/error)" },
];

async function ajustes(): Promise<void> {
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

let salir = false;
while (!salir) {
  const op = await menu(config);
  try {
    switch (op) {
      case "1":
        await climaDefault();
        break;
      case "2":
        await climaTodas();
        break;
      case "3":
        await buscarAgregar();
        break;
      case "4":
        await eliminarCiudad();
        break;
      case "5":
        await establecerDefault();
        break;
      case "8":
        await ajustes();
        break;
      case "9":
        salir = true;
        break;
    }
  } catch (e) {
    fallo(`Error: ${msgError(e)}`);
  }
  if (!salir) await pausar();
}

console.log();
info("¡Hasta luego!");
