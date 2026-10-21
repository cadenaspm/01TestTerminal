# Revisión Weather CLI

-[x] **Colores:** no hay ninguno; falta definir cyan (menú), amarillo (temp), verde/rojo (ok/error).
-[x] *Ajustes:* Deseo que dentro de ajustes me permita ajustar el panel de colores de la aplicacion, es decir que existan tres posible paletas de colores:
    - Paleta 1: cyan (menú), amarillo (temp), verde/rojo (ok/error).
    - Paleta 2: Rojo (menú), amarillo (temp), azul (ok/error).
    - Paleta 3: Verde (menú), Azul (temp), Amarillo (ok/error).
-[x] **AGENTS.md:** dice que `index.ts` es stub, pero la app ya funciona — hay que actualizarlo.
-[x] **Ciudades:** geocoding solo trae 1 resultado; nombres ambiguos pueden fallar.
-[x] **Tests:** suite completa en `test/` con `bun test` (formatters, storage, APIs con `fetch` falso, presentación, acciones y E2E del binario); `bun run build` falla si los tests fallan.
-[X] **Binario:** compila bien; revisar que `./weather` guarde datos en `~/.config/weather-cli/`.
-[X] **Escalabilidad:** ¿qué tan fácil será expandir con nuevas funcionalidades?
-[X] **Carga:** ¿hay estado de carga en las tareas asíncronas?
-[x] **7 days Forecast** Agregar las posibilidades de obtener el pronostico del clima para los proximos 7 dias.