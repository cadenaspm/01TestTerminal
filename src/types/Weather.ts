import type { Unit } from "./Config";

/** Clima actual en un instante (Forecast API, `current`). */
export interface Weather {
  temperatura: number;
  sensacion: number | null;
  humedad: number | null;
  viento: number | null;
  hora: string | null;
  unidad: Unit;
}

/** Un día del pronóstico diario (Forecast API, `daily`). */
export interface DailyForecast {
  fecha: string; // "YYYY-MM-DD" (día local de la ubicación)
  codigo: number; // código WMO, para elegir emoji/descripción
  tempMax: number | null;
  tempMin: number | null;
  precipitacion: number | null; // % máximo del día
  viento: number | null; // km/h máxima del día
  unidad: Unit;
}
