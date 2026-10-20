/**
 * Entrada de una opción de menú: `id` es lo que se teclea, `etiqueta` lo que
 * se muestra y `handler` la acción que se ejecuta al elegirla. El menú se
 * renderiza y valida a partir de esta lista; el bucle principal solo
 * dispatchea.
 */
export interface MenuOption {
  id: string;
  etiqueta: string;
  handler: () => Promise<void>;
}
