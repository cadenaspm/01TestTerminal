import type { CitySearchResult } from "../types/City";
import type { Palette } from "../types/Config";
import type { DailyForecast, Weather } from "../types/Weather";
import { gris, menuColor, negrita, tempColor } from "./colors";
import { DIAS_CORTOS } from "./constants";

export function fmtPoblacion(n: number | null): string {
  if (n === null || n <= 0) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} M hab.`;
  if (n >= 1_000) return `${Math.round(n / 1000)} mil hab.`;
  return `${n} hab.`;
}

/**
 * Etiqueta de un resultado de geocoding. La región, el país y la población son
 * lo que permite distinguir ciudades homónimas (p. ej. los muchos Springfield).
 */
export function etiquetaBusqueda(r: CitySearchResult): string {
  const poblacion = fmtPoblacion(r.poblacion);
  return poblacion ? `${r.detalle} · ${poblacion}` : r.detalle;
}

export function etiquetaPaleta(p: Palette): string {
  return p === "paleta1" ? "Paleta 1" : p === "paleta2" ? "Paleta 2" : "Paleta 3";
}

export function fmtClima(nombre: string, c: Weather): string {
  const s = c.unidad === "C" ? "°C" : "°F";
  const lineas = [`\n  ${menuColor("📍 " + negrita(nombre))}`];
  let temperatura = `  🌡  Temperatura: ${tempColor(`${c.temperatura} ${s}`)}`;
  if (c.sensacion !== null) temperatura += ` (sensación ${tempColor(`${c.sensacion} ${s}`)})`;
  lineas.push(temperatura);
  if (c.humedad !== null) lineas.push(`  💧 Humedad: ${c.humedad}%`);
  if (c.viento !== null) lineas.push(`  💨 Viento: ${c.viento} km/h`);
  if (c.hora) lineas.push(gris(`  🕒 Hora local: ${c.hora.replace("T", " ")}`));
  return lineas.join("\n");
}

/** "2026-10-20" → "lun 20/10" (día de la semana en el huso de la ubicación). */
function fechaCorta(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return fecha;
  const [, a, b, c] = m;
  if (!a || !b || !c) return fecha;
  // Se parsea en UTC para que el huso de la máquina no corrija la fecha.
  const dow = new Date(Date.UTC(Number(a), Number(b) - 1, Number(c))).getUTCDay();
  return `${DIAS_CORTOS[dow]} ${c}/${b}`;
}

/**
 * Código WMO (Open-Meteo) → emoji + descripción en español.
 * -1 o desconocido = nubes genéricas por si la API agrega códigos nuevos.
 */
function condicion(codigo: number): string {
  switch (codigo) {
    case 0:
      return "☀️ Despejado";
    case 1:
      return "🌤 Mayormente despejado";
    case 2:
      return "⛅ Parcialmente nublado";
    case 3:
      return "☁️ Nublado";
    case 45:
    case 48:
      return "🌫 Niebla";
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return "🌦 Llovizna";
    case 61:
    case 63:
    case 65:
    case 66:
    case 67:
      return "🌧 Lluvia";
    case 71:
    case 73:
    case 75:
    case 77:
      return "❄️ Nieve";
    case 80:
    case 81:
    case 82:
      return "🌦 Chubascos";
    case 85:
    case 86:
      return "🌨 Chubascos de nieve";
    case 95:
    case 96:
    case 99:
      return "⛈ Tormenta";
    default:
      return "☁️ —";
  }
}

/**
 * Tabla del pronóstico de 7 días. Las columnas se alinean con padEnd/padStart
 * sobre texto plano y solo después se colorea, así los códigos ANSI no
 * desalinean la tabla.
 */
export function fmtPronostico(nombre: string, dias: DailyForecast[]): string {
  const s = dias[0]?.unidad === "F" ? "°F" : "°C";
  const lineas = [`\n  ${menuColor("📅 " + negrita(`Pronóstico de 7 días — ${nombre}`))}`, ""];
  for (const d of dias) {
    const fecha = fechaCorta(d.fecha).padEnd(9);
    const cond = condicion(d.codigo).padEnd(23);
    const max = d.tempMax !== null ? `${d.tempMax}` : "–";
    const min = d.tempMin !== null ? `${d.tempMin} ${s}` : "–";
    const rango = `${max} / ${min}`.padStart(17);
    const precip = (d.precipitacion !== null ? `${d.precipitacion}%` : "–").padStart(4);
    const viento = (d.viento !== null ? `${d.viento} km/h` : "–").padStart(8);
    lineas.push(
      `  ${menuColor(fecha)} ${cond} ${tempColor(rango)}  💧 ${gris(precip)}  💨 ${gris(viento)}`,
    );
  }
  return lineas.join("\n");
}
