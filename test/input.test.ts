import { describe, expect, test } from "bun:test";
import { correrEscenario } from "./establecimiento";

/**
 * El lector de líneas de input.ts es un singleton a nivel de módulo (un único
 * listener de stdin que se registra al importar), y no se puede reimportar con
 * estado limpio, así que cada caso se ejecuta en un subproceso con un stub de
 * stdin propio.
 *
 * Orden obligatorio: primero se instala el stub en `process.stdin` y DESPUÉS se
 * importa input.ts; el import dinámico es el que cuelga su listener del stub.
 */

/** Escenario que lee líneas de un stub alimentado con `chunks`. */
function escenario(chunks: string[], saltos = 10): string {
  return `
import { EventEmitter } from "node:events";
const emisor = new EventEmitter();
Object.assign(process.stdin, { isTTY: undefined, setEncoding: () => {}, on: emisor.on.bind(emisor) });

const { leerLinea } = await import("./src/presentation/input");

for (const c of ${JSON.stringify(chunks)}) emisor.emit("data", c);
emisor.emit("end");

const leidas = [];
for (let i = 0; i < ${saltos}; i++) {
  const l = await leerLinea();
  leidas.push(l);
  if (l === null) break;
}
console.log("LECTURA=" + JSON.stringify(leidas));
`;
}

describe("leerLinea", () => {
  test("separa por LF", async () => {
    const { salida, codigoSalida } = await correrEscenario(escenario(["uno\ndos\ntres\n"]));
    expect(codigoSalida).toBe(0);
    expect(salida).toContain('LECTURA=["uno","dos","tres",null]');
  });

  test("separa por CR sin generar líneas vacías espurias", async () => {
    const { salida } = await correrEscenario(escenario(["uno\rdos\r"]));
    expect(salida).toContain('LECTURA=["uno","dos",null]');
  });

  test("CRLF no produce líneas vacías extra", async () => {
    const { salida } = await correrEscenario(escenario(["uno\r\ndos\r\n"]));
    expect(salida).toContain('LECTURA=["uno","dos",null]');
  });

  test("CRLF partido entre chunks tampoco", async () => {
    const { salida } = await correrEscenario(escenario(["uno\r", "\ndos\n"]));
    expect(salida).toContain('LECTURA=["uno","dos",null]');
  });

  test("un resto final sin salto de línea se entrega en EOF", async () => {
    const { salida } = await correrEscenario(escenario(["uno\nsin-salto"]));
    expect(salida).toContain('LECTURA=["uno","sin-salto",null]');
  });

  test("líneas vacías se conservan (sirven para 'Presiona Enter')", async () => {
    const { salida } = await correrEscenario(escenario(["\n\nfin\n"]));
    expect(salida).toContain('LECTURA=["","","fin",null]');
  });

  test("tras EOF todas las lecturas siguientes son null", async () => {
    const { salida } = await correrEscenario(escenario([], 3));
    expect(salida).toContain("LECTURA=[null]");
  });

  test("los chunks llegan antes que los consumidores (cola de líneas)", async () => {
    const { salida } = await correrEscenario(`
import { EventEmitter } from "node:events";
const emisor = new EventEmitter();
Object.assign(process.stdin, { isTTY: undefined, setEncoding: () => {}, on: emisor.on.bind(emisor) });

// A diferencia de los demás escenarios, aquí se importa input primero y se
// emiten los datos DESPUÉS: los consumidores esperan y las líneas se encolan.
const { leerLinea } = await import("./src/presentation/input");
const promesa1 = leerLinea();
const promesa2 = leerLinea();
emisor.emit("data", "uno\\ndos\\n");
console.log("LECTURA=" + JSON.stringify([await promesa1, await promesa2]));
`);
    expect(salida).toContain('LECTURA=["uno","dos"]');
  });
});

describe("preguntar", () => {
  test("muestra el texto y devuelve la línea leída", async () => {
    const { salida, codigoSalida } = await correrEscenario(`
import { EventEmitter } from "node:events";
const emisor = new EventEmitter();
Object.assign(process.stdin, { isTTY: undefined, setEncoding: () => {}, on: emisor.on.bind(emisor) });

const { preguntar } = await import("./src/presentation/input");
const promesa = preguntar("Nombre de la ciudad: ");
emisor.emit("data", "Ottawa\\n");
console.log("RESPUESTA=" + JSON.stringify(await promesa));
`);
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("Nombre de la ciudad:");
    expect(salida).toContain('RESPUESTA="Ottawa"');
  });

  test("en EOF devuelve cadena vacía", async () => {
    const { salida } = await correrEscenario(`
import { EventEmitter } from "node:events";
const emisor = new EventEmitter();
Object.assign(process.stdin, { isTTY: undefined, setEncoding: () => {}, on: emisor.on.bind(emisor) });

const { preguntar } = await import("./src/presentation/input");
emisor.emit("end");
console.log("RESPUESTA=" + JSON.stringify(await preguntar("¿Ciudad? ")));
`);
    expect(salida).toContain('RESPUESTA=""');
  });
});

describe("pausar", () => {
  test("espera una línea y muestra el aviso", async () => {
    const { salida, codigoSalida } = await correrEscenario(`
import { EventEmitter } from "node:events";
const emisor = new EventEmitter();
Object.assign(process.stdin, { isTTY: undefined, setEncoding: () => {}, on: emisor.on.bind(emisor) });

const { pausar } = await import("./src/presentation/input");
emisor.emit("data", "\\n");
await pausar();
console.log("PAUSA=ok");
`);
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("Presiona Enter para continuar...");
    expect(salida).toContain("PAUSA=ok");
  });
});
