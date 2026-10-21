import { describe, expect, test } from "bun:test";
import { correrEscenario } from "./establecimiento";

/**
 * `output.ts` importa `colors.ts` (estado de módulo + decisión de color al
 * importar), así que los casos viven en subprocesos: con FORCE_COLOR=1 para
 * comprobar los ANSI y con colores apagados para el texto plano.
 */
function escenario(env: Record<string, string> = {}) {
  return correrEscenario(
    `
const { info, exito, aviso, fallo, msgError, iniciarCarga, conCarga } = await import("./src/presentation/output");

info("mensaje");
exito("hecho");
aviso("cuidado");
fallo("roto");

console.log("ERROR_STRING=" + msgError("texto suelto"));
console.log("ERROR_ERROR=" + msgError(new Error("fallo real")));

// La carga no animada imprime un mensaje estático y no ensucia con \\r.
const carga = iniciarCarga("Buscando...");
carga.texto("Buscando 2/5...");
carga.terminar();

const valor = await conCarga("Consultando...", async () => 42);
console.log("CARGAVALOR=" + valor);
console.log("FIN");
`,
    env,
  );
}

describe("mensajes", () => {
  test("sin color: prefijos y espacios de cada helper", async () => {
    const { salida, codigoSalida } = await escenario();
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("  mensaje\n");
    expect(salida).toContain("  ✓ hecho\n");
    expect(salida).toContain("  ! cuidado\n");
    expect(salida).toContain("  ✗ roto\n");
    expect(salida).not.toContain("\u001b[");
  });

  test("con FORCE_COLOR cada rol usa su color", async () => {
    const { salida } = await escenario({ FORCE_COLOR: "1" });
    expect(salida).toContain("\u001b[36m"); // menú (info) en paleta 1
    expect(salida).toContain("\u001b[32m"); // ok (exito)
    expect(salida).toContain("\u001b[33m"); // temp (aviso)
    expect(salida).toContain("\u001b[31m"); // error (fallo)
  });

  test("msgError saca el mensaje de un Error y hace String() del resto", async () => {
    const { salida } = await escenario();
    expect(salida).toContain("ERROR_STRING=texto suelto");
    expect(salida).toContain("ERROR_ERROR=fallo real");
  });
});

describe("iniciarCarga/conCarga sin TTY", () => {
  test("imprime el mensaje estático, sin animación ni \\r", async () => {
    const { salida, codigoSalida } = await escenario();
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("⏳ Buscando...");
    expect(salida).not.toContain("\r");
  });

  test("conCarga devuelve el valor de la tarea y no deja basura", async () => {
    const { salida } = await escenario();
    expect(salida).toContain("⏳ Consultando...");
    expect(salida).toContain("CARGAVALOR=42");
    expect(salida).toContain("FIN");
  });

  test("conCarga propaga el error de la tarea", async () => {
    const { salida, codigoSalida } = await correrEscenario(`
const { conCarga } = await import("./src/presentation/output");
try {
  await conCarga("Consultando...", async () => {
    throw new Error("la tarea falló");
  });
  console.log("NO_DEBERIA_LLEGAR");
} catch (e) {
  console.log("CAPTURADO=" + e.message);
}
`);
    expect(codigoSalida).toBe(0);
    expect(salida).toContain("CAPTURADO=la tarea falló");
    expect(salida).not.toContain("NO_DEBERIA_LLEGAR");
  });
});
