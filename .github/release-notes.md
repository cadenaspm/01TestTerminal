Binarios standalone para **Windows, Linux y macOS** (x64 y arm64).

No necesitas instalar Bun ni Node: descarga el binario de tu plataforma y ejecútalo.

| Sistema | Archivo |
| --- | --- |
| Windows x64 | `weather-<version>-windows-x64.exe` |
| Windows arm64 | `weather-<version>-windows-arm64.exe` |
| Linux x64 | `weather-<version>-linux-x64` |
| Linux arm64 | `weather-<version>-linux-arm64` |
| macOS x64 | `weather-<version>-darwin-x64` |
| macOS arm64 | `weather-<version>-darwin-arm64` |

Notas:

- En Linux y macOS hay que darle permisos de ejecución: `chmod +x weather-<version>-linux-x64`.
- El archivo `checksums.txt` contiene el SHA-256 de cada binario para que puedas verificar la descarga.
- Los binarios de macOS no están firmados con un certificado de Apple: la primera vez Gatekeeper bloqueará la apertura. Ve a **Ajustes del Sistema → Privacidad y seguridad → Abrir de todos modos** y vuelve a abrirlo.
