#!/usr/bin/env bun
/**
 * Publica una release de GitHub desde tu máquina, sin depender de GitHub Actions.
 *
 * Es el camino manual equivalente al workflow `.github/workflows/release.yml`:
 * misma versión (la del package.json), mismos 6 binarios, mismo tag `v<versión>`
 * y los mismos assets (binarios + `checksums.txt`).
 *
 * Uso (PowerShell):
 *   $env:GITHUB_TOKEN = "ghp_xxx"     # PAT classic con scope "repo"
 *                                      # (o fine-grained con permiso "Contents: write")
 *   bun run release:local
 *
 * Flags:
 *   --dry-run      Compila los binarios y muestra lo que haría, sin tocar GitHub.
 *   --skip-build   Reutiliza los binarios que ya están en `dist/`.
 *
 * Variables de entorno:
 *   GITHUB_TOKEN      Obligatorio (salvo con --dry-run). Token de GitHub.
 *   GITHUB_REPOSITORY Opcional. Formato "owner/repo". Si no se indica, se deduce
 *                     del remoto `origin` de git.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const RAIZ = join(import.meta.dir, "..");
const DIST = join(RAIZ, "dist");
const ENTRADA = join(RAIZ, "src", "index.ts");
const NOTAS = join(RAIZ, ".github", "release-notes.md");

/** Plataformas que se publican. El orden es el que aparece en las notas. */
const OBJETIVOS: { target: string; sufijo: string }[] = [
  { target: "bun-windows-x64", sufijo: "windows-x64.exe" },
  { target: "bun-windows-arm64", sufijo: "windows-arm64.exe" },
  { target: "bun-linux-x64", sufijo: "linux-x64" },
  { target: "bun-linux-arm64", sufijo: "linux-arm64" },
  { target: "bun-darwin-x64", sufijo: "darwin-x64" },
  { target: "bun-darwin-arm64", sufijo: "darwin-arm64" },
];

const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$/;

const args = new Set(Bun.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const SKIP_BUILD = args.has("--skip-build");

/** Imprime un mensaje con el prefijo del script. */
function info(mensaje: string): void {
  console.log(`[release] ${mensaje}`);
}

/** Lanza un error con el contexto de lo que falló. */
function fallo(mensaje: string, detalle?: unknown): never {
  console.error(`[release] ERROR: ${mensaje}`);
  if (detalle !== undefined) console.error(String(detalle));
  process.exit(1);
}

/** Lee la versión del package.json y la valida como semver. */
async function leerVersion(): Promise<string> {
  const bruto = await readFile(join(RAIZ, "package.json"), "utf8");
  const pkg = JSON.parse(bruto) as { version?: unknown };
  const version = typeof pkg.version === "string" ? pkg.version : "";
  if (!SEMVER.test(version)) {
    fallo(`La versión '${version}' del package.json no es un semver válido.`);
  }
  return version;
}

/** Deduce "owner/repo" del remoto origin de git. */
async function detectarRepo(): Promise<string> {
  const desdeEnv = process.env.GITHUB_REPOSITORY;
  if (desdeEnv && desdeEnv.includes("/")) return desdeEnv.trim();

  const proc = Bun.spawn(["git", "remote", "get-url", "origin"], { cwd: RAIZ });
  const [salida, codigo] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  if (codigo !== 0) {
    fallo("No se pudo leer el remoto 'origin' de git. Define GITHUB_REPOSITORY=owner/repo.");
  }
  const limpio = salida.trim().replace(/\.git$/, "");
  const partes = limpio.split(/[:/]/).filter(Boolean);
  if (partes.length < 2) {
    fallo(`No se pudo deducir owner/repo del remoto '${limpio}'. Define GITHUB_REPOSITORY=owner/repo.`);
  }
  return `${partes[partes.length - 2]}/${partes[partes.length - 1]}`;
}

/** Compila un binario standalone para el target indicado. */
async function compilar(target: string, salida: string): Promise<void> {
  const resultado = await Bun.build({
    entrypoints: [ENTRADA],
    compile: { target: target as Bun.Build.CompileTarget, outfile: salida },
  });
  if (!resultado.success) {
    fallo(`Falló la compilación para ${target}.`, resultado.logs);
  }
}

/** Devuelve el SHA-256 de un archivo, en hexadecimal. */
async function sha256(ruta: string): Promise<string> {
  const bytes = await Bun.file(ruta).arrayBuffer();
  return createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
}

/** Notas de la release: el archivo del repo con `<version>` sustituido. */
async function leerNotas(version: string): Promise<string> {
  try {
    const texto = await readFile(NOTAS, "utf8");
    return texto.replaceAll("<version>", version);
  } catch {
    return `Weather CLI v${version}`;
  }
}

/** Crea el tag anotado y lo sube al remoto (si no existe ya). */
async function publicarTag(tag: string, version: string): Promise<void> {
  const remoto = Bun.spawn(["git", "ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tag}`], {
    cwd: RAIZ,
    stdout: "ignore",
    stderr: "ignore",
  });
  if ((await remoto.exited) === 0) {
    info(`El tag ${tag} ya existe en el remoto: se reutiliza.`);
    return;
  }

  // Si git no tiene identidad configurada, el tag anotado falla.
  const correo = Bun.spawn(["git", "config", "user.email"], { cwd: RAIZ, stdout: "pipe" });
  const identidad = await new Response(correo.stdout).text();
  if (!identidad.trim()) {
    await Bun.spawn(["git", "config", "user.name", "Weather CLI Release"], { cwd: RAIZ }).exited;
    await Bun.spawn(
      ["git", "config", "user.email", "release@weather-cli.local"],
      { cwd: RAIZ },
    ).exited;
  }

  const tagProc = Bun.spawn(["git", "tag", "-a", tag, "-m", `Weather CLI v${version}`], { cwd: RAIZ });
  if ((await tagProc.exited) !== 0) {
    fallo(`No se pudo crear el tag ${tag}.`);
  }
  const pushProc = Bun.spawn(["git", "push", "origin", tag], { cwd: RAIZ, stdout: "ignore" });
  if ((await pushProc.exited) !== 0) {
    fallo(`No se pudo subir el tag ${tag} al remoto.`);
  }
  info(`Tag ${tag} creado y subido.`);
}

/** Cabeceras common para la API de GitHub. */
function cabecerasApi(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "weather-cli-release",
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Consulta si la release ya existe. Se llama ANTES de tocar git para no subir
 * un tag si el token no sirve o la release ya está publicada.
 */
async function verificarRelease(repo: string, token: string, tag: string): Promise<void> {
  const [owner, nombre] = repo.split("/");
  if (!owner || !nombre) fallo(`Repo inválido: '${repo}'.`);

  const respuesta = await fetch(`https://api.github.com/repos/${owner}/${nombre}/releases/tags/${tag}`, {
    headers: cabecerasApi(token),
  });

  if (respuesta.status === 200) {
    fallo(`La release ${tag} ya existe: no se vuelve a publicar.`);
  }
  if (respuesta.status === 404) return;

  if (respuesta.status === 401 || respuesta.status === 403) {
    fallo(
      `GitHub rechazó el token (HTTP ${respuesta.status}). Revisa GITHUB_TOKEN: debe tener escritura sobre el repo.`,
      await respuesta.text(),
    );
  }
  fallo(`No se pudo consultar la release ${tag} (HTTP ${respuesta.status}).`, await respuesta.text());
}

/**
 * Publica la release con la API de GitHub: crea el release y sube los assets.
 */
async function publicarRelease(
  repo: string,
  token: string,
  tag: string,
  version: string,
  notas: string,
  assets: { nombre: string; ruta: string }[],
): Promise<void> {
  const [owner, nombre] = repo.split("/");
  if (!owner || !nombre) fallo(`Repo inválido: '${repo}'.`);

  const base = `https://api.github.com/repos/${owner}/${nombre}`;
  const cabeceras = cabecerasApi(token);

  const existente = await fetch(`${base}/releases/tags/${tag}`, { headers: cabeceras });
  if (existente.status === 200) {
    info(`La release ${tag} ya existe: no se vuelve a publicar.`);
    return;
  }
  if (existente.status !== 404) {
    fallo(`No se pudo consultar si la release ${tag} existe (HTTP ${existente.status}).`, await existente.text());
  }

  const creado = await fetch(`${base}/releases`, {
    method: "POST",
    headers: { ...cabeceras, "Content-Type": "application/json" },
    body: JSON.stringify({
      tag_name: tag,
      name: `Weather CLI v${version}`,
      body: notas,
      prerelease: version.includes("-"),
      draft: false,
    }),
  });
  if (creado.status !== 201) {
    fallo(`No se pudo crear la release ${tag} (HTTP ${creado.status}).`, await creado.text());
  }
  const release = (await creado.json()) as { id: number; upload_url: string };
  info(`Release ${tag} creada.`);

  const urlSubida = release.upload_url.replace(/\{.*\}$/, "");
  for (const asset of assets) {
    const bytes = new Uint8Array(await Bun.file(asset.ruta).arrayBuffer());
    const url = `${urlSubida}?name=${encodeURIComponent(asset.nombre)}`;
    const subido = await fetch(url, {
      method: "POST",
      headers: { ...cabeceras, "Content-Type": "application/octet-stream" },
      body: bytes,
    });
    if (subido.status !== 201) {
      fallo(`No se pudo subir '${asset.nombre}' (HTTP ${subido.status}).`, await subido.text());
    }
    info(`Asset subido: ${asset.nombre}`);
  }
}

// ── flujo principal ─────────────────────────────────────────────────────────

const version = await leerVersion();
const tag = `v${version}`;
info(`Versión ${version} → tag ${tag}`);

await mkdir(DIST, { recursive: true });

const binarios: { nombre: string; ruta: string }[] = [];
if (SKIP_BUILD) {
  info("Usando los binarios que ya están en dist/ (--skip-build).");
  for (const objetivo of OBJETIVOS) {
    const nombre = `weather-${version}-${objetivo.sufijo}`;
    const ruta = join(DIST, nombre);
    if (await Bun.file(ruta).exists()) binarios.push({ nombre, ruta });
  }
  if (binarios.length !== OBJETIVOS.length) {
    fallo(
      `--skip-build espera ${OBJETIVOS.length} binarios en dist/ y solo hay ${binarios.length}.`,
    );
  }
} else {
  for (const objetivo of OBJETIVOS) {
    const nombre = `weather-${version}-${objetivo.sufijo}`;
    const ruta = join(DIST, nombre);
    info(`Compilando ${objetivo.target} → dist/${nombre}`);
    await compilar(objetivo.target, ruta);
    binarios.push({ nombre, ruta });
  }
}

// checksums.txt
const lineas = await Promise.all(
  binarios.map(async (b) => `${await sha256(b.ruta)}  ${b.nombre}`),
);
const rutaChecksums = join(DIST, "checksums.txt");
await writeFile(rutaChecksums, `${lineas.join("\n")}\n`, "utf8");
info(`checksums.txt escrito (${binarios.length} binarios).`);

if (DRY_RUN) {
  info("--dry-run: no se toca GitHub. Assets que se publicarían:");
  for (const b of binarios) info(`  ${b.nombre}`);
  info("  checksums.txt");
  process.exit(0);
}

const token = process.env.GITHUB_TOKEN;
if (!token) {
  fallo("Falta GITHUB_TOKEN. Define un PAT con permiso de escritura sobre el repo.");
}

const repo = await detectarRepo();
info(`Repo: ${repo}`);

// Primero se verifica la release (solo lectura): si el token no sirve o la
// release ya existe, se aborta sin subir ningún tag.
await verificarRelease(repo, token, tag);

await publicarTag(tag, version);
await publicarRelease(repo, token, tag, version, await leerNotas(version), [
  ...binarios,
  { nombre: "checksums.txt", ruta: rutaChecksums },
]);

info(`Listo: https://github.com/${repo}/releases/tag/${tag}`);
