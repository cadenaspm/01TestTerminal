import { stdout } from "node:process";
import type { Palette } from "../types/Config";

// Colores ANSI solo en terminal interactiva; se desactivan al redirigir la
// salida (tests/scripts) o si el usuario define NO_COLOR. FORCE_COLOR=1 los
// fuerza y FORCE_COLOR=0 los apaga.
//
// Prioridad: NO_COLOR > FORCE_COLOR > detección de TTY. NO_COLOR gana siempre
// (convención no-color.org): si el usuario lo define, no se pinta nada aunque
// también haya FORCE_COLOR.
const COLOR =
  Bun.env.NO_COLOR !== undefined
    ? false
    : Bun.env.FORCE_COLOR !== undefined
      ? Bun.env.FORCE_COLOR !== "0"
      : Boolean(stdout.isTTY) && Bun.env.TERM !== "dumb";

function pintar(texto: string, codigo: string): string {
  return COLOR ? `\u001b[${codigo}m${texto}\u001b[0m` : texto;
}

// Paletas de colores
let paletaActual: Palette = "paleta1";

// Colores base (ANSI)
const cyanBase = (t: string): string => pintar(t, "36");
const rojoBase = (t: string): string => pintar(t, "31");
const verdeBase = (t: string): string => pintar(t, "32");
const amarilloBase = (t: string): string => pintar(t, "33");
const azulBase = (t: string): string => pintar(t, "34");
export const gris = (t: string): string => pintar(t, "90");
export const negrita = (t: string): string => pintar(t, "1");

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

export function establecerPaleta(p: Palette): void {
  paletaActual = p;
}

export function obtenerPaleta(): Palette {
  return paletaActual;
}

/** true si los colores están activos y la salida es TTY: permite animar spinners. */
export function animacionActiva(): boolean {
  return COLOR && Boolean(stdout.isTTY);
}

/** Muestra de los colores de la paleta actual, para previsualizar antes de elegir. */
export function previewPaleta(paleta: Palette): string {
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
