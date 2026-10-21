import { describe, expect, test } from "bun:test";
import type { CitySearchResult } from "../src/types/City";
import type { DailyForecast, Weather } from "../src/types/Weather";

// Los formatters colorean parte del texto (etiqueta, temperatura, guiones) y
// los asserts buscan subcadenas exactas, así que los códigos ANSI los rompen:
// se meten ENTRE la etiqueta y el valor ("Temperatura: \x1b[33m21.5 °C").
//
// NO se puede confiar en "sin TTY ⇒ sin color": al ejecutar `bun test` en una
// terminal real la salida SÍ es un TTY, `colors.ts` activa el color y estos
// tests fallan (4 de ellos) de forma intermitente según dónde se ejecuten.
// Se fuerza NO_COLOR=1, que apaga el color pase lo que pase, porque
// `src/utils/colors.ts` decide al importarse.
delete Bun.env.FORCE_COLOR;
Bun.env.NO_COLOR = "1";

const { etiquetaBusqueda, etiquetaPaleta, fmtClima, fmtPoblacion, fmtPronostico } = await import(
  "../src/utils/format"
);

function ciudad(extra: Partial<CitySearchResult> = {}): CitySearchResult {
  return {
    id: "45.4,-75.7",
    nombre: "Ottawa",
    detalle: "Ottawa, Ontario, Canadá",
    lat: 45.4,
    lon: -75.7,
    poblacion: null,
    ...extra,
  };
}

function clima(extra: Partial<Weather> = {}): Weather {
  return {
    temperatura: 21.5,
    sensacion: 20.1,
    humedad: 60,
    viento: 12,
    hora: "2026-10-20T14:30",
    unidad: "C",
    ...extra,
  };
}

function dia(extra: Partial<DailyForecast> = {}): DailyForecast {
  return {
    fecha: "2026-10-20",
    codigo: 0,
    tempMax: 22,
    tempMin: 11,
    precipitacion: 5,
    viento: 14,
    unidad: "C",
    ...extra,
  };
}

describe("fmtPoblacion", () => {
  test("null, 0 o negativo no muestran nada", () => {
    expect(fmtPoblacion(null)).toBe("");
    expect(fmtPoblacion(0)).toBe("");
    expect(fmtPoblacion(-5)).toBe("");
  });

  test("millones con coma decimal", () => {
    expect(fmtPoblacion(1_000_000)).toBe("1,0 M hab.");
    expect(fmtPoblacion(8_900_000)).toBe("8,9 M hab.");
  });

  test("miles redondeados", () => {
    expect(fmtPoblacion(1_000)).toBe("1 mil hab.");
    expect(fmtPoblacion(394_000)).toBe("394 mil hab.");
  });

  test("unidades sueltas", () => {
    expect(fmtPoblacion(950)).toBe("950 hab.");
    expect(fmtPoblacion(1)).toBe("1 hab.");
  });
});

describe("etiquetaBusqueda", () => {
  test("incluye la población cuando existe", () => {
    expect(etiquetaBusqueda(ciudad({ poblacion: 934_000 }))).toBe(
      "Ottawa, Ontario, Canadá · 934 mil hab.",
    );
  });

  test("omite el separador cuando no hay población", () => {
    expect(etiquetaBusqueda(ciudad())).toBe("Ottawa, Ontario, Canadá");
  });
});

describe("etiquetaPaleta", () => {
  test("nombra cada paleta", () => {
    expect(etiquetaPaleta("paleta1")).toBe("Paleta 1");
    expect(etiquetaPaleta("paleta2")).toBe("Paleta 2");
    expect(etiquetaPaleta("paleta3")).toBe("Paleta 3");
  });
});

describe("fmtClima", () => {
  test("clima completo en °C", () => {
    const salida = fmtClima("Ottawa, Ontario, Canadá", clima());
    expect(salida).toContain("📍 Ottawa, Ontario, Canadá");
    expect(salida).toContain("Temperatura: 21.5 °C");
    expect(salida).toContain("(sensación 20.1 °C)");
    expect(salida).toContain("💧 Humedad: 60%");
    expect(salida).toContain("💨 Viento: 12 km/h");
    expect(salida).toContain("🕒 Hora local: 2026-10-20 14:30");
  });

  test("°F y datos opcionales ausentes", () => {
    const salida = fmtClima(
      "Miami, Florida, Estados Unidos",
      clima({ unidad: "F", temperatura: 70.2, sensacion: null, humedad: null, viento: null, hora: null }),
    );
    expect(salida).toContain("Temperatura: 70.2 °F");
    expect(salida).not.toContain("sensación");
    expect(salida).not.toContain("Humedad");
    expect(salida).not.toContain("Viento");
    expect(salida).not.toContain("Hora local");
  });
});

describe("fmtPronostico", () => {
  test("cabecera con nombre y una línea por día", () => {
    const salida = fmtPronostico("Ottawa, Ontario, Canadá", [dia(), dia({ fecha: "2026-10-21" })]);
    expect(salida).toContain("📅 Pronóstico de 7 días — Ottawa, Ontario, Canadá");
    const filas = salida.split("\n").filter((l) => l.includes("°C"));
    expect(filas.length).toBe(2);
    expect(salida).toContain("mar 20/10");
    expect(salida).toContain("22 / 11 °C");
    expect(salida).toContain("5%");
    expect(salida).toContain("14 km/h");
  });

  test("unidad tomada del primer día (F)", () => {
    const salida = fmtPronostico("Miami", [dia({ unidad: "F" }), dia()]);
    expect(salida).toContain("22 / 11 °F");
  });

  test("valores nulos se muestran con guiones", () => {
    const salida = fmtPronostico("X", [dia({ tempMax: null, tempMin: null, precipitacion: null, viento: null })]);
    expect(salida).toContain("– / –");
    expect(salida).toContain("💧    –");
  });

  test("fechas inválidas o desconocidas no rompen el formateo", () => {
    expect(fmtPronostico("X", [dia({ fecha: "sin-fecha" })])).toContain("sin-fecha");
    // El regex acepta "13"/"99": la fecha se reordena tal cual, sin validar rangos.
    expect(fmtPronostico("X", [dia({ fecha: "2026-13-99" })])).toContain("99/13");
  });

  test("códigos WMO se traducen a emoji + descripción", () => {
    const casos: Array<[number, string]> = [
      [0, "☀️ Despejado"],
      [1, "🌤 Mayormente despejado"],
      [2, "⛅ Parcialmente nublado"],
      [3, "☁️ Nublado"],
      [45, "🌫 Niebla"],
      [48, "🌫 Niebla"],
      [51, "🌦 Llovizna"],
      [57, "🌦 Llovizna"],
      [61, "🌧 Lluvia"],
      [67, "🌧 Lluvia"],
      [71, "❄️ Nieve"],
      [77, "❄️ Nieve"],
      [80, "🌦 Chubascos"],
      [82, "🌦 Chubascos"],
      [85, "🌨 Chubascos de nieve"],
      [86, "🌨 Chubascos de nieve"],
      [95, "⛈ Tormenta"],
      [99, "⛈ Tormenta"],
      [-1, "☁️ —"],
    ];
    for (const [codigo, texto] of casos) {
      expect(fmtPronostico("X", [dia({ codigo })])).toContain(texto);
    }
  });

  test("lista vacía solo deja la cabecera", () => {
    const salida = fmtPronostico("X", []);
    expect(salida).toContain("Pronóstico de 7 días — X");
    expect(salida.split("\n").filter((l) => l.trim() !== "")).toHaveLength(1);
  });
});
