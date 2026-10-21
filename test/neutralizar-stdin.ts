// Preload de los escenarios en subproceso: sin TTY no hay stdin interactivo,
// así que `stdin.resume()` termina en EOF y `leerLinea()` devuelve null.
// Los escenarios que necesitan entradas inyectan su propio stub de stdin.
(process.stdin as unknown as { isTTY?: boolean }).isTTY = undefined;
process.stdin.resume();
