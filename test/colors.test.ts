import { expect, test } from "bun:test";
import { correrEscenario } from "./establecimiento";

/**
 * `colors.ts` decide si pinta al importarse (según TTY/FORCE_COLOR/NO_COLOR) y
 * guarda la paleta en estado de módulo, así que cada caso corre en un
 * subproceso limpio. Fuera de un TTY hay que forzar el color con FORCE_COLOR=1
 * para poder observar los códigos ANSI.
 */

/** Códigos esperados: [menú, temp, ok, error] por paleta. */
const CÓDIGOS = {
  paleta1: ["36", "33", "32", "31"],
  paleta2: ["31", "33", "34", "34"],
  paleta3: ["32", "34", "33", "33"],
} satisfies Record<"paleta1" | "paleta2" | "paleta3", string[]>;

async function enSubproceso(codigo: string, env: Record<string, string> = {}) {
  return correrEscenario(
    `import { previewPaleta, establecerPaleta, obtenerPaleta, menuColor, tempColor, okColor, errorColor, gris, negrita, animacionActiva } from "./src/utils/colors";
${codigo}
await new Promise((r) => setTimeout(r, 20));`,
    env,
  );
}

/** "texto" → código ANSI usado, o null si va sin color. */
function codigoDe(valor: string): string | null {
  return /\u001b\[(\d+)m/.exec(valor)?.[1] ?? null;
}

test("FORCE_COLOR=1 activa los códigos ANSI", async () => {
  const { salida, codigoSalida } = await enSubproceso(
    `console.log(JSON.stringify(menuColor("x")));`,
    { FORCE_COLOR: "1" },
  );
  expect(codigoSalida).toBe(0);
  expect(JSON.parse(salida.trim())).toBe("\u001b[36mx\u001b[0m");
});

test("FORCE_COLOR=0 apaga el color", async () => {
  const { salida, codigoSalida } = await enSubproceso(
    `console.log(JSON.stringify(negrita("x")));`,
    { FORCE_COLOR: "0" },
  );
  expect(codigoSalida).toBe(0);
  expect(JSON.parse(salida.trim())).toBe("x");
});

test("roles semánticos por paleta", async () => {
  const { salida, codigoSalida } = await enSubproceso(
    `for (const p of ["paleta1", "paleta2", "paleta3"]) {
  establecerPaleta(p);
  console.log(JSON.stringify([menuColor("m"), tempColor("t"), okColor("o"), errorColor("e")]));
}`,
    { FORCE_COLOR: "1" },
  );
  expect(codigoSalida).toBe(0);
  const lineas = salida.trim().split("\n");
  for (const [i, paleta] of (["paleta1", "paleta2", "paleta3"] as const).entries()) {
    const muestra = JSON.parse(lineas[i]!) as string[];
    expect(muestra.map(codigoDe)).toEqual(CÓDIGOS[paleta]);
  }
});

test("establecerPaleta/obtenerPaleta y default", async () => {
  const { salida, codigoSalida } = await enSubproceso(
    `console.log(obtenerPaleta());
establecerPaleta("paleta3");
console.log(obtenerPaleta());`,
  );
  expect(codigoSalida).toBe(0);
  expect(salida.trim().split("\n")).toEqual(["paleta1", "paleta3"]);
});

test("previewPaleta muestra las 4 muestras y no cambia la paleta actual", async () => {
  const { salida, codigoSalida } = await enSubproceso(
    `console.log(previewPaleta("paleta2"));
console.log("PALETA=" + obtenerPaleta());`,
  );
  expect(codigoSalida).toBe(0);
  expect(salida).toContain("Menú / textos (📍 Ottawa, Ontario, Canadá)");
  expect(salida).toContain("Temperatura: 21.5 °C");
  expect(salida).toContain("✓ Ciudad agregada");
  expect(salida).toContain("✗ No se pudo obtener el clima");
  expect(salida).toContain("PALETA=paleta1");
});

test("animacionActiva exige color y TTY (false con salida redirigida)", async () => {
  const { salida, codigoSalida } = await enSubproceso(`console.log("ANIM=" + animacionActiva());`, {
    FORCE_COLOR: "1",
  });
  expect(codigoSalida).toBe(0);
  expect(salida).toContain("ANIM=false");
});

// ---------------------------------------------------------------------------
// Comportamiento documentado que hoy NO se cumple (ver AGENTS.md): el color
// debería apagarse al redirigir la salida y NO_COLOR debería ganar sobre
// FORCE_COLOR. Bun expone el TTY real en `stdout.isTTY`, pero `src/utils/colors.ts`
// decide según el `COLOR` que Bun calcula al arrancar (`Bun.enableANSIColors`,
// que da true cuando la salida del subproceso no es un TTY).
// ---------------------------------------------------------------------------
test.todo("sin TTY y sin variables de entorno no se pinta nada");
test.todo("NO_COLOR gana sobre FORCE_COLOR");
