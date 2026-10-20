import { stdout } from "node:process";
import type { City } from "../types/City";
import type { MenuOption } from "../types/MenuOption";
import { gris, menuColor, negrita } from "../utils/colors";
import { LINEA } from "../utils/constants";
import { leerLinea } from "./input";
import { aviso, fallo } from "./output";

export async function menu(opciones: ReadonlyArray<MenuOption>): Promise<string | null> {
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

/**
 * Selección de una ciudad de la lista guardada. Compartida por las acciones
 * que operan sobre una ciudad (eliminar, default, pronóstico…).
 */
export async function seleccionarCiudad(ciudades: City[], titulo: string): Promise<City | null> {
  if (ciudades.length === 0) {
    aviso("No hay ciudades guardadas. Usa la opción 3 para agregar una.");
    return null;
  }
  const idx = await seleccionar(
    ciudades.map((c) => c.detalle),
    titulo,
  );
  if (idx === null) return null;
  return ciudades[idx] ?? null;
}
