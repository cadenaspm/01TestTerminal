import { stdin, stdout } from "node:process";
import { gris, menuColor } from "../utils/colors";

// Lector de líneas propio en lugar de node:readline/promises: en Bun la segunda
// llamada a question() nunca resuelve cuando stdin está redirigido (bug conocido).
// Es un singleton a nivel de módulo: un único listener de stdin, la app entera
// comparte la cola de entradas.
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
export function leerLinea(): Promise<string | null> {
  const enCola = cola.shift();
  if (enCola !== undefined) return Promise.resolve(enCola);
  if (finEntrada) return Promise.resolve(null);
  return new Promise((resolver) => esperando.push(resolver));
}

export async function preguntar(texto: string): Promise<string> {
  stdout.write(`  ${menuColor(texto)}`);
  return (await leerLinea()) ?? "";
}

export async function pausar(): Promise<void> {
  stdout.write(gris("\n  Presiona Enter para continuar..."));
  await leerLinea();
}
