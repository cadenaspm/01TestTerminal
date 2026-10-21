## Weather CLI APP

El objetivo de esta aplicación es que creemos una aplicación de consola que pida que ingresemos la ciudad, Al final, generaremos un binario ejecutable.

### Opciones:

- Ingresar el nombre de una ciudad.
- Guardar la ciudad por defecto.
- Registrar varias otras ciudades para buscar el clima en esas otras ciudades.
- Ver el pronóstico del clima de los próximos 7 días por ciudad.

## Stack

- Bun.js
- OpenMeteo

## Ejemplo de petición http:

1. Paso 1: Geocoding API.
2. Paso 2: OpenMeteo API.

```
https://geocoding-api.open-meteo.com/v1/search?name=Ottawa&count=1&language=es&format=json
https://api.open-meteo.com/v1/forecast?latitude=45.41117&longitude=-75.69812&current=temperature_2m
```

## Inicializar proyecto

```bash
bun init
```

### Ejemplo del menú
Esta es la apariencia que deseamos crear

```bash
════════════════════════════════════════
         WEATHER CLI
════════════════════════════════════════
  1. Clima de ciudad default
  2. Clima de todas las ciudades (1)
  3. Buscar y agregar ciudad
  4. Eliminar ciudad
  5. Establecer ciudad default
  6. Pronóstico 7 días
  7. Listar ciudades
  8. Ajustes (°C)
  9. Salir
════════════════════════════════════════
  Selecciona una opción: 5
```

## Releases (GitHub Actions)

La versión del `package.json` es la fuente de verdad. El workflow `.github/workflows/release.yml`
crea el tag `v<versión>` y publica la release de GitHub con los 6 binarios adjuntos.

El workflow corre **un solo job** (no una matriz): la suite de tests se ejecuta una única vez
y de ahí salen los 6 binarios, así que gasta la mitad de minutos de runner que la versión
anterior con matriz.

### Cómo publicar una versión

1. Actualiza la versión en `package.json`:

   ```json
   "version": "1.1.0"
   ```

2. Sube el cambio a `master`. El workflow se dispara solo (solo cuando cambia `package.json`),
   compila los 6 binarios y crea la release `v1.1.0`.

   ```bash
   git add package.json
   git commit -m "chore: release v1.1.0"
   git push origin master
   ```

3. Descarga el binario de tu plataforma desde la pestaña **Releases** de GitHub.
   No necesitas Bun ni Node: es un ejecutable standalone.

> Si el workflow no llega a ejecutarse porque GitHub Actions está bloqueado en tu cuenta
> (p. ej. *"your account is locked due to a billing issue"*), usa la publicación local
> que se explica más abajo.

### Binarios adjuntos

| Sistema | Archivo |
| --- | --- |
| Windows x64 | `weather-<version>-windows-x64.exe` |
| Windows arm64 | `weather-<version>-windows-arm64.exe` |
| Linux x64 | `weather-<version>-linux-x64` |
| Linux arm64 | `weather-<version>-linux-arm64` |
| macOS x64 | `weather-<version>-darwin-x64` |
| macOS arm64 | `weather-<version>-darwin-arm64` |

En Linux/macOS: `chmod +x weather-<version>-linux-x64`. En macOS los binarios no están firmados,
así que Gatekeeper pedirá que los abras desde *Ajustes → Privacidad y seguridad*.

El workflow también adjunta `checksums.txt` con el SHA-256 de cada binario.

### Publicar la release localmente (sin GitHub Actions)

`scripts/publicar-release.ts` hace lo mismo que el workflow, pero desde tu máquina y sin
consumir minutos de Actions. Necesitas un token de GitHub con escritura sobre el repo:

- **PAT classic** con el scope `repo`, o
- **PAT fine-grained** con el permiso *Contents: write* sobre este repositorio.

```powershell
$env:GITHUB_TOKEN = "ghp_xxx"
bun run release:local
```

Qué hace, en orden:

1. Lee la versión del `package.json` y valida el semver.
2. Consulta si la release ya existe → si existe, **aborta sin tocar nada** (y sin subir el tag).
3. Compila los 6 binarios en `dist/` y genera `dist/checksums.txt`.
4. Crea el tag anotado `v<versión>` y lo sube al remoto.
5. Crea la release y sube los 6 binarios + `checksums.txt` como assets.

Flags útiles:

```bash
bun run release:local --dry-run      # compila y muestra qué se publicaría, sin tocar GitHub
bun run release:local --skip-build   # reutiliza los binarios que ya están en dist/
```

Si no defines `GITHUB_REPOSITORY=owner/repo`, el repo se deduce del remoto `origin` de git.

### Compilar localmente para otra plataforma

```bash
# Linux x64, con el gate completo (tests + typecheck)
$env:BUN_TARGET="bun-linux-x64"
$env:BUN_OUTFILE="dist/weather-linux-x64"
bun run build:release

# Solo compilar (sin repetir tests ni typecheck)
bun run compile:target
```

Objetivos disponibles: `bun-linux-x64`, `bun-linux-arm64`, `bun-darwin-x64`, `bun-darwin-arm64`,
`bun-windows-x64`, `bun-windows-arm64`.

