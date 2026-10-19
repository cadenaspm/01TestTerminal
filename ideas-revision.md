# Revisión Weather CLI

-[x] **Colores:** no hay ninguno; falta definir cyan (menú), amarillo (temp), verde/rojo (ok/error).
-[x] *Ajustes:* Deseo que dentro de ajustes me permita ajustar el panel de colores de la aplicacion, es decir que existan tres posible paletas de colores:
    - Paleta 1: cyan (menú), amarillo (temp), verde/rojo (ok/error).
    - Paleta 2: Rojo (menú), amarillo (temp), azul (ok/error).
    - Paleta 3: Verde (menú), Azul (temp), Amarillo (ok/error).
-[x] **AGENTS.md:** dice que `index.ts` es stub, pero la app ya funciona — hay que actualizarlo.
-[x] **Ciudades:** geocoding solo trae 1 resultado; nombres ambiguos pueden fallar.
-[ ] **Tests:** no existen; conviene al menos probar storage y las APIs con mocks.
-[ ] **Binario:** compila bien; revisar que `./weather` guarde datos en `~/.config/weather-cli/`.
-[ ] **Escalabilidad:** ¿qué tan fácil será expandir con nuevas funcionalidades?
-[ ] **Carga:** ¿hay estado de carga en las tareas asíncronas?