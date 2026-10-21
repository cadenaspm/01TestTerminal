import { describe, expect, test } from "bun:test";
import { correrEscenario } from "./establecimiento";

/**
 * `menu`/`seleccionar` dependen del singleton de stdin de input.ts, así que se
 * ejecutan en subprocesos con un stub de stdin. Orden obligatorio: instalar el
 * stub en `process.stdin` y DESPUÉS importar el módulo (al importar se cuelga
 * el listener del stub).
 *
 * OJO: dentro de estos procesos hay que llamar a process.exit(0) al final
 * (en vez de dejar que el script termine solo): con el stub de stdin activo el
 * proceso no termina por sí mismo al acabar el script.
 */
function conStub(codigo: string, chunks: string[], trasEmitir = ""): string {
  return `
import { EventEmitter } from "node:events";
const emisor = new EventEmitter();
Object.assign(process.stdin, { isTTY: undefined, setEncoding: () => {}, on: emisor.on.bind(emisor) });

${codigo}

for (const c of ${JSON.stringify(chunks)}) emisor.emit("data", c);
emisor.emit("end");

${trasEmitir}
`;
}

function escenarioMenu(chunks: string[]): string {
  return conStub(
    `const { menu } = await import("./src/presentation/menu");
const opciones = [
  { id: "1", etiqueta: "Clima de ciudad default", handler: async () => {} },
  { id: "2", etiqueta: "Salir", handler: async () => {} },
];
const promesa = menu(opciones);`,
    chunks,
    `console.log("SALIDA=" + JSON.stringify(await promesa));
process.exit(0);`,
  );
}

describe("menu", () => {
  test("renderiza ids y etiquetas de las opciones", async () => {
    const { salida, codigoSalida } = await correrEscenario(escenarioMenu(["1\n"]));
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("WEATHER CLI");
    expect(salida).toContain("1. Clima de ciudad default");
    expect(salida).toContain("2. Salir");
    expect(salida).toContain("Selecciona una opción:");
    expect(salida).toContain('SALIDA="1"');
  });

  test("rechaza opciones fuera de la lista y vuelve a preguntar", async () => {
    const { salida } = await correrEscenario(escenarioMenu(["9\n99\n\n2\n"]));
    expect(salida.match(/Opción no válida, intenta de nuevo\./g)).toHaveLength(3);
    expect(salida).toContain('SALIDA="2"');
  });

  test("EOF devuelve null (salida limpia)", async () => {
    const { salida } = await correrEscenario(escenarioMenu([]));
    expect(salida).toContain("SALIDA=null");
  });
});

describe("seleccionar", () => {
  const items = ["Ottawa", "Quito", "San José"];

  function escenarioSeleccionar(chunks: string[]): string {
    return conStub(
      `const { seleccionar } = await import("./src/presentation/menu");
const promesa = seleccionar(${JSON.stringify(items)}, "Elige:");`,
      chunks,
      `console.log("IDX=" + JSON.stringify(await promesa));
process.exit(0);`,
    );
  }

  test("devuelve el índice elegido", async () => {
    const { salida, codigoSalida } = await correrEscenario(escenarioSeleccionar(["2\n"]));
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("1. Ottawa");
    expect(salida).toContain("3. San José");
    expect(salida).toContain("0. Cancelar");
    expect(salida).toContain("IDX=1");
  });

  test("0 cancela (null)", async () => {
    const { salida } = await correrEscenario(escenarioSeleccionar(["0\n"]));
    expect(salida).toContain("IDX=null");
  });

  test("una línea vacía también cancela", async () => {
    const { salida } = await correrEscenario(escenarioSeleccionar(["\n"]));
    expect(salida).toContain("IDX=null");
  });

  test("índices inválidos se rechazan", async () => {
    const { salida } = await correrEscenario(escenarioSeleccionar(["4\n-1\n1.5\nabc\n3\n"]));
    expect(salida.match(/Selección no válida\./g)).toHaveLength(4);
    expect(salida).toContain("IDX=2");
  });

  test("EOF durante la selección devuelve null", async () => {
    const { salida } = await correrEscenario(escenarioSeleccionar([]));
    expect(salida).toContain("IDX=null");
  });
});

describe("seleccionarCiudad", () => {
  test("sin ciudades avisa y no pregunta", async () => {
    const { salida } = await correrEscenario(
      conStub(
        `const { seleccionarCiudad } = await import("./src/presentation/menu");
const promesa = seleccionarCiudad([], "¿Cuál?");`,
        [],
        `console.log("CIUDAD=" + JSON.stringify(await promesa));
process.exit(0);`,
      ),
    );
    expect(salida).toContain("No hay ciudades guardadas. Usa la opción 3 para agregar una.");
    expect(salida).toContain("CIUDAD=null");
  });

  test("devuelve la ciudad elegida", async () => {
    const { salida } = await correrEscenario(
      conStub(
        `const { seleccionarCiudad } = await import("./src/presentation/menu");
const ciudades = [
  { id: "1,2", nombre: "Ottawa", detalle: "Ottawa, Ontario, Canadá", lat: 1, lon: 2 },
  { id: "3,4", nombre: "Quito", detalle: "Quito, Pichincha, Ecuador", lat: 3, lon: 4 },
];
const promesa = seleccionarCiudad(ciudades, "¿Cuál?");`,
        ["2\n"],
        `console.log("CIUDAD=" + JSON.stringify(await promesa));
process.exit(0);`,
      ),
    );
    expect(salida).toContain("Quito, Pichincha, Ecuador");
    expect(salida).toContain('CIUDAD={"id":"3,4"');
  });

  test("cancelar devuelve null", async () => {
    const { salida } = await correrEscenario(
      conStub(
        `const { seleccionarCiudad } = await import("./src/presentation/menu");
const ciudades = [{ id: "1,2", nombre: "Ottawa", detalle: "Ottawa", lat: 1, lon: 2 }];
const promesa = seleccionarCiudad(ciudades, "¿Cuál?");`,
        ["0\n"],
        `console.log("CIUDAD=" + JSON.stringify(await promesa));
process.exit(0);`,
      ),
    );
    expect(salida).toContain("CIUDAD=null");
  });
});
