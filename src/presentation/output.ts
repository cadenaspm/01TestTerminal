import { stdout } from "node:process";
import { animacionActiva, errorColor, gris, menuColor, okColor, tempColor } from "../utils/colors";
import { FRAMES } from "../utils/constants";

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

export function msgError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Indicador de carga para tareas asíncronas. En terminal interactiva muestra
 * una línea con spinner animado (\\r + frames); con la salida redirigida
 * imprime un único mensaje estático (sin \\r, así los scripts/tests no ven
 * basura). Nunca toca stdin, así que no interfiere con el lector de líneas.
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

export function iniciarCarga(mensaje: string): Carga {
  const animado = animacionActiva();
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

/** Ejecuta una tarea asíncrona con indicador de carga; el spinner se limpia siempre. */
export async function conCarga<T>(mensaje: string, fn: () => Promise<T>): Promise<T> {
  const carga = iniciarCarga(mensaje);
  try {
    return await fn();
  } finally {
    carga.terminar();
  }
}
