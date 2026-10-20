import { buscarCiudad, obtenerClima, obtenerPronostico7dias } from "./src/api";
import { ajustes } from "./src/settings";
import { cargar, guardar, type Ciudad } from "./src/store";
import {
  aviso,
  establecerPaleta,
  etiquetaBusqueda,
  etiquetaPaleta,
  exito,
  fallo,
  fmtClima,
  fmtPronostico,
  info,
  iniciarCarga,
  menu,
  msgError,
  pausar,
  preguntar,
  seleccionar,
} from "./src/ui";

const config = await cargar();
establecerPaleta(config.paleta);

/** Ejecuta una tarea asíncrona con indicador de carga; el spinner se limpia siempre. */
async function conCarga<T>(mensaje: string, fn: () => Promise<T>): Promise<T> {
  const carga = iniciarCarga(mensaje);
  try {
    return await fn();
  } finally {
    carga.terminar();
  }
}

async function climaDe(ciudad: Ciudad, mensaje?: string): Promise<void> {
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
  const total = config.ciudades.length;
  if (total === 0) {
    aviso("No hay ciudades guardadas. Usa la opción 3 para agregar una.");
    return;
  }
  for (let i = 0; i < total; i++) {
    const ciudad = config.ciudades[i];
    if (!ciudad) continue;
    await climaDe(ciudad, `Obteniendo clima (${i + 1}/${total}): ${ciudad.detalle}`);
  }
}

// 3. Buscar y agregar ciudad
async function buscarAgregar(): Promise<void> {
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

// 6. Pronóstico 7 días
async function pronostico7dias(): Promise<void> {
  const ciudad = await elegirDeLaLista("¿De qué ciudad quieres ver el pronóstico de 7 días?");
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

// Opciones del menú: fuente única (id + etiqueta + handler). El menú se
// renderiza y valida a partir de esta lista; el bucle principal solo
// dispatchea. Para añadir una opción basta con agregar una entrada aquí.
interface Opcion {
  id: string;
  etiqueta: string;
  handler: () => Promise<void>;
}

function opciones(): Opcion[] {
  const unidad = config.unidad === "C" ? "°C" : "°F";
  return [
    { id: "1", etiqueta: "Clima de ciudad default", handler: climaDefault },
    {
      id: "2",
      etiqueta: `Clima de todas las ciudades (${config.ciudades.length})`,
      handler: climaTodas,
    },
    { id: "3", etiqueta: "Buscar y agregar ciudad", handler: buscarAgregar },
    { id: "4", etiqueta: "Eliminar ciudad", handler: eliminarCiudad },
    { id: "5", etiqueta: "Establecer ciudad default", handler: establecerDefault },
    { id: "6", etiqueta: "Pronóstico 7 días", handler: pronostico7dias },
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
