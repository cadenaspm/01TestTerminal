## Estructura deseada

```bash
src/
├── actions/                # Acciones principales que puede ejecutar el usuario
│   ├── getWeather.ts       # Obtener clima actual de una ciudad
│   ├── addCity.ts          # Agregar una ciudad a la lista
│   ├── removeCity.ts       # Eliminar una ciudad
│   ├── setDefaultCity.ts   # Establecer la ciudad por defecto
│   ├── listCities.ts       # Listar todas las ciudades guardadas
│   └── ...                 # Otras acciones futuras
├── presentation/           # Todo lo relacionado con la interacción de consola/CLI
│   ├── menu.ts             # Renderizado del menú y manejo de selección de opciones
│   ├── output.ts           # Funciones para mostrar mensajes al usuario
│   ├── input.ts            # Funciones para capturar y validar inputs del usuario
│   └── ...                 # Otros componentes de presentación
├── storage/                # Capa para leer, escribir y gestionar datos locales
│   ├── citiesStorage.ts    # Persistencia de ciudades guardadas
│   ├── settingsStorage.ts  # Persistencia de configuración y preferencias
│   └── ...                 # Otros mecanismos de almacenamiento
├── types/                  # Tipos y contratos TypeScript usados globalmente
│   ├── City.ts             # Definición de tipo City
│   ├── Weather.ts          # Tipos para la respuesta del clima
│   ├── MenuOption.ts       # Tipo para las opciones del menú
│   └── ...                 # Otros tipos globales
├── api/                    # Integración con APIs externas (OpenMeteo, geocoding)
│   ├── geocoding.ts        # Lógica para obtener coordenadas de una ciudad
│   ├── weather.ts          # Lógica para obtener el clima actual y pronóstico
│   └── ...                 # Otros endpoints o utilidades API
├── utils/                  # Utilidades y helpers reutilizables
│   ├── format.ts           # Formateadores de datos (fechas, temperaturas, etc)
│   ├── constants.ts        # Constantes generales de la app
│   ├── colors.ts           # Definición y utilidades de colores para la consola
│   └── ...                 # Otros utilitarios
├── index.ts                # Punto de entrada principal de la app CLI
```