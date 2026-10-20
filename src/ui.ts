import { stdin, stdout } from "node:process";
import type { Clima, DiaPronostico, ResultadoBusqueda } from "./api";
import type { Paleta } from "./store";

// Lector de líneas propio en lugar de node:readline/promises: en Bun la segunda
// llamada a question() nunca resuelve cuando stdin está redirigido (bug conocido).
type Resolver = (linea: string | null) => void;

const cola: string[] = [];
const esperando: Resolver[] = [];
let buffer = "";
let esperarLF = false; // evita que "\r\n" produzca una línea vacía extra
let finEntrada = false;

function emitir(linea: string): void {
  const resolver = esperando.shift();
  if (resolver) resolver(linea);
  else cola.push(linea);
}

function procesarChunk(chunk: string): void {
  if (esperarLF) {
    if (chunk.startsWith("\n")) chunk = chunk.slice(1);
    esperarLF = false;
  }
  buffer += chunk;
  for (;;) {
    const i = buffer.search(/[\r\n]/);
    if (i < 0) return;
    const fin = buffer.charAt(i);
    const linea = buffer.slice(0, i);
    buffer = buffer.slice(i + 1);
    if (fin === "\r") {
      // Tras un \r consumir el \n de inmediato si está; si no, esperar al
      // siguiente chunk (evita que "\r\n" genere una línea vacía extra).
      if (buffer.startsWith("\n")) buffer = buffer.slice(1);
      else if (buffer.length === 0) esperarLF = true;
    }
    emitir(linea);
  }
}

stdin.setEncoding("utf8");
stdin.on("data", procesarChunk);
stdin.on("end", () => {
  if (buffer.length > 0) {
    const resto = buffer;
    buffer = "";
    emitir(resto);
  }
  finEntrada = true;
  for (const resolver of esperando.splice(0)) resolver(null);
});

/** Devuelve la siguiente línea, o null si terminó la entrada (EOF). */
function leerLinea(): Promise<string | null> {
  const enCola = cola.shift();
  if (enCola !== undefined) return Promise.resolve(enCola);
  if (finEntrada) return Promise.resolve(null);
  return new Promise((resolver) => esperando.push(resolver));
}

// Colores ANSI solo en terminal interactiva; se desactivan al redirigir la
// salida (tests/scripts) o si el usuario define NO_COLOR. FORCE_COLOR=1 los
// fuerza y FORCE_COLOR=0 los apaga.
const COLOR =
  Bun.env.FORCE_COLOR !== undefined
    ? Bun.env.FORCE_COLOR !== "0"
    : Boolean(stdout.isTTY) && Bun.env.NO_COLOR === undefined && Bun.env.TERM !== "dumb";

function pintar(texto: string, codigo: string): string {
  return COLOR ? `\u001b[${codigo}m${texto}\u001b[0m` : texto;
}

// Paletas de colores
let paletaActual: Paleta = "paleta1";

// Colores base (ANSI)
const cyanBase = (t: string): string => pintar(t, "36");
const rojoBase = (t: string): string => pintar(t, "31");
const verdeBase = (t: string): string => pintar(t, "32");
const amarilloBase = (t: string): string => pintar(t, "33");
const azulBase = (t: string): string => pintar(t, "34");
export const gris = (t: string): string => pintar(t, "90");
const negrita = (t: string): string => pintar(t, "1");

// Colores por rol (dependen de la paleta)
function colorMenu(): (t: string) => string {
  switch (paletaActual) {
    case "paleta2":
      return rojoBase;
    case "paleta3":
      return verdeBase;
    default:
      return cyanBase;
  }
}

function colorTemp(): (t: string) => string {
  switch (paletaActual) {
    case "paleta2":
      return amarilloBase;
    case "paleta3":
      return azulBase;
    default:
      return amarilloBase;
  }
}

function colorOk(): (t: string) => string {
  switch (paletaActual) {
    case "paleta2":
      return azulBase;
    case "paleta3":
      return amarilloBase;
    default:
      return verdeBase;
  }
}

function colorError(): (t: string) => string {
  switch (paletaActual) {
    case "paleta2":
      return azulBase;
    case "paleta3":
      return amarilloBase;
    default:
      return rojoBase;
  }
}

export const menuColor = (t: string): string => colorMenu()(t);
export const tempColor = (t: string): string => colorTemp()(t);
export const okColor = (t: string): string => colorOk()(t);
export const errorColor = (t: string): string => colorError()(t);

export function establecerPaleta(p: Paleta): void {
  paletaActual = p;
}

export function obtenerPaleta(): Paleta {
  return paletaActual;
}

/** Mensajes con formato uniforme: úsalos en lugar de console.log en el flujo. */
export function info(texto: string): void {
  console.log(`  ${menuColor(texto)}`);
}
export function exito(texto: string): void {
  console.log(`  ${okColor(`✓ ${texto}`)}`);
}
export function aviso(texto: string): void {
  console.log(`  ${tempColor(`! ${texto}`)}`);
}
export function fallo(texto: string): void {
  console.log(`  ${errorColor(`✗ ${texto}`)}`);
}

/**
 * Indicador de carga para tareas asíncronas. En terminal interactiva muestra
 * una línea con spinner animado (\\r + frames); con la salida redirigida
 * imprime un único mensaje estático (sin \\r, así los scripts/tests no ven
 * basura). Nunca toca stdin, así que no interfiere con leerLinea().
 *
 * Uso:
 *   const carga = iniciarCarga("Buscando ciudades...");
 *   try { ... } finally { carga.terminar(); }
 */
export interface Carga {
  /** Actualiza el mensaje mostrado (p. ej. con un contador "2/5"). */
  texto(nuevo: string): void;
  /** Limpia la línea y detiene el spinner. Llamar siempre en finally. */
  terminar(): void;
}

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠻"];

export function iniciarCarga(mensaje: string): Carga {
  const animado = COLOR && Boolean(stdout.isTTY);
  let texto = mensaje;
  let frame = 0;
  let anchoLinea = 0;
  let vivo = true;

  if (!animado) {
    console.log(`  ${gris(`⏳ ${texto}`)}`);
    return {
      texto(nuevo) {
        texto = nuevo;
      },
      terminar() {
        vivo = false;
      },
    };
  }

  const pintarFrame = (): void => {
    const linea = `  ${gris(`${FRAMES[frame % FRAMES.length]} ${texto}`)}`;
    frame++;
    // Padding con espacios para borrar cualquier residual de la línea anterior.
    stdout.write(`\r${linea}${" ".repeat(Math.max(0, anchoLinea - linea.length))}`);
    anchoLinea = linea.length;
  };
  pintarFrame();
  const timer = setInterval(pintarFrame, 80);

  return {
    texto(nuevo) {
      texto = nuevo;
    },
    terminar() {
      if (!vivo) return;
      vivo = false;
      clearInterval(timer);
      stdout.write(`\r${" ".repeat(anchoLinea)}\r`);
    },
  };
}

/** Muestra de los colores de la paleta actual, para previsualizar antes de elegir. */
export function previewPaleta(paleta: Paleta): string {
  const anterior = paletaActual;
  paletaActual = paleta;
  const ejemplo = [
    menuColor("  Menú / textos (📍 Ottawa, Ontario, Canadá)"),
    tempColor("  Temperatura: 21.5 °C"),
    okColor("  ✓ Ciudad agregada"),
    errorColor("  ✗ No se pudo obtener el clima"),
  ].join("\n");
  paletaActual = anterior;
  return ejemplo;
}

const LINEA = "═".repeat(43);

/** Entrada del menú principal: el id es lo que se teclea, la etiqueta lo que se muestra. */
export interface OpcionMenu {
  id: string;
  etiqueta: string;
}

export function etiquetaPaleta(p: Paleta): string {
  return p === "paleta1" ? "Paleta 1" : p === "paleta2" ? "Paleta 2" : "Paleta 3";
}

export async function preguntar(texto: string): Promise<string> {
  stdout.write(`  ${menuColor(texto)}`);
  return (await leerLinea()) ?? "";
}

export async function pausar(): Promise<void> {
  stdout.write(gris("\n  Presiona Enter para continuar..."));
  await leerLinea();
}

export async function menu(opciones: ReadonlyArray<OpcionMenu>): Promise<string | null> {
  console.log(menuColor(`\n${LINEA}`));
  console.log(menuColor(negrita("         WEATHER CLI")));
  console.log(menuColor(LINEA));
  for (const op of opciones) {
    console.log(`  ${menuColor(`${op.id}.`)} ${op.etiqueta}`);
  }
  console.log(menuColor(LINEA));

  while (true) {
    stdout.write(menuColor("  Selecciona una opción: "));
    const r = (await leerLinea())?.trim() ?? null;
    if (r === null) return null; // EOF = salir limpiamente
    if (opciones.some((op) => op.id === r)) return r;
    fallo("Opción no válida, intenta de nuevo.");
  }
}

/** Lista numerada (0 = cancelar). Devuelve el índice elegido o null si se cancela. */
export async function seleccionar(items: string[], titulo: string): Promise<number | null> {
  console.log(`\n  ${menuColor(negrita(titulo))}`);
  items.forEach((item, i) => console.log(`  ${menuColor(`${i + 1}.`)} ${item}`));
  console.log(`  ${gris("0.")} ${gris("Cancelar")}`);

  while (true) {
    stdout.write(menuColor("  Selección: "));
    const r = ((await leerLinea()) ?? "").trim();
    if (r === "0" || r === "") return null;
    const n = Number(r);
    if (Number.isInteger(n) && n >= 1 && n <= items.length) return n - 1;
    fallo("Selección no válida.");
  }
}

function fmtPoblacion(n: number | null): string {
  if (n === null || n <= 0) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} M hab.`;
  if (n >= 1_000) return `${Math.round(n / 1000)} mil hab.`;
  return `${n} hab.`;
}

/**
 * Etiqueta de un resultado de geocoding. La región, el país y la población son
 * lo que permite distinguir ciudades homónimas (p. ej. los muchos Springfield).
 */
export function etiquetaBusqueda(r: ResultadoBusqueda): string {
  const poblacion = fmtPoblacion(r.poblacion);
  return poblacion ? `${r.detalle} · ${poblacion}` : r.detalle;
}

export function fmtClima(nombre: string, c: Clima): string {
  const s = c.unidad === "C" ? "°C" : "°F";
  const lineas = [`\n  ${menuColor("📍 " + negrita(nombre))}`];
  let temperatura = `  🌡  Temperatura: ${tempColor(`${c.temperatura} ${s}`)}`;
  if (c.sensacion !== null) temperatura += ` (sensación ${tempColor(`${c.sensacion} ${s}`)})`;
  lineas.push(temperatura);
  if (c.humedad !== null) lineas.push(`  💧 Humedad: ${c.humedad}%`);
  if (c.viento !== null) lineas.push(`  💨 Viento: ${c.viento} km/h`);
  if (c.hora) lineas.push(gris(`  🕒 Hora local: ${c.hora.replace("T", " ")}`));
  return lineas.join("\n");
}

// Pronóstico de 7 días ------------------------------------------------------

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** "2026-10-20" → "lun 20/10" (día de la semana en el huso de la ubicación). */
function fechaCorta(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return fecha;
  const [, a, b, c] = m;
  if (!a || !b || !c) return fecha;
  // Se parsea en UTC para que el huso de la máquina no corrija la fecha.
  const dow = new Date(Date.UTC(Number(a), Number(b) - 1, Number(c))).getUTCDay();
  return `${DIAS_CORTOS[dow]} ${c}/${b}`;
}

/**
 * Código WMO (Open-Meteo) → emoji + descripción en español.
 * -1 o desconocido = nubes genéricas por si la API agrega códigos nuevos.
 */
function condicion(codigo: number): string {
  switch (codigo) {
    case 0:
      return "☀️ Despejado";
    case 1:
      return "🌤 Mayormente despejado";
    case 2:
      return "⛅ Parcialmente nublado";
    case 3:
      return "☁️ Nublado";
    case 45:
    case 48:
      return "🌫 Niebla";
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return "🌦 Llovizna";
    case 61:
    case 63:
    case 65:
    case 66:
    case 67:
      return "🌧 Lluvia";
    case 71:
    case 73:
    case 75:
    case 77:
      return "❄️ Nieve";
    case 80:
    case 81:
    case 82:
      return "🌦 Chubascos";
    case 85:
    case 86:
      return "🌨 Chubascos de nieve";
    case 95:
    case 96:
    case 99:
      return "⛈ Tormenta";
    default:
      return "☁️ —";
  }
}

/**
 * Tabla del pronóstico de 7 días. Las columnas se alinean con padEnd/padStart
 * sobre texto plano y solo después se colorea, así los códigos ANSI no
 * desalinean la tabla.
 */
export function fmtPronostico(nombre: string, dias: DiaPronostico[]): string {
  const s = dias[0]?.unidad === "F" ? "°F" : "°C";
  const lineas = [`\n  ${menuColor("📅 " + negrita(`Pronóstico de 7 días — ${nombre}`))}`, ""];
  for (const d of dias) {
    const fecha = fechaCorta(d.fecha).padEnd(9);
    const cond = condicion(d.codigo).padEnd(23);
    const max = d.tempMax !== null ? `${d.tempMax}` : "–";
    const min = d.tempMin !== null ? `${d.tempMin} ${s}` : "–";
    const rango = `${max} / ${min}`.padStart(17);
    const precip = (d.precipitacion !== null ? `${d.precipitacion}%` : "–").padStart(4);
    const viento = (d.viento !== null ? `${d.viento} km/h` : "–").padStart(8);
    lineas.push(
      `  ${menuColor(fecha)} ${cond} ${tempColor(rango)}  💧 ${gris(precip)}  💨 ${gris(viento)}`,
    );
  }
  return lineas.join("\n");
}

export function msgError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
