import { stdin, stdout } from "node:process";
import type { Clima } from "./api";
import type { Config, Paleta } from "./store";

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
const OPCIONES_VALIDAS = ["1", "2", "3", "4", "5", "8", "9"];

function etiquetaPaleta(p: Paleta): string {
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

export async function menu(config: Config): Promise<string> {
  const total = config.ciudades.length;
  const unidad = config.unidad === "C" ? "°C" : "°F";
  console.log(menuColor(`\n${LINEA}`));
  console.log(menuColor(negrita("         WEATHER CLI")));
  console.log(menuColor(LINEA));
  console.log(`  ${menuColor("1.")} Clima de ciudad default`);
  console.log(`  ${menuColor("2.")} Clima de todas las ciudades (${total})`);
  console.log(`  ${menuColor("3.")} Buscar y agregar ciudad`);
  console.log(`  ${menuColor("4.")} Eliminar ciudad`);
  console.log(`  ${menuColor("5.")} Establecer ciudad default`);
  console.log(`  ${menuColor("8.")} Ajustes (${unidad} · ${etiquetaPaleta(config.paleta)})`);
  console.log(`  ${menuColor("9.")} Salir`);
  console.log(menuColor(LINEA));

  while (true) {
    stdout.write(menuColor("  Selecciona una opción: "));
    const op = (await leerLinea())?.trim() ?? "9"; // EOF = salir limpiamente
    if (OPCIONES_VALIDAS.includes(op)) return op;
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

export function msgError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
