#!/usr/bin/env node
/* eslint-disable no-console -- its output is the point: this script reports what it measured. */
/**
 * First-load JS per route, from a finished production build (`npm run build` first).
 *
 * Next 16 with Turbopack no longer prints sizes, so this reads the build's own manifests: the
 * root main files (`.next/build-manifest.json`) plus every chunk the route's client reference
 * manifest lists for its segments (layouts, page, loading, error, not-found). Code loaded later
 * on demand (charts, PDF export, the offline queue) isn't counted. Each chunk is counted once per
 * route. Sizes are uncompressed and gzip (zlib default level), in KB of 1,024 bytes.
 *
 * The method used for the Phase 1 baseline in doc/V2_SPEC.md §9. Read-only.
 *
 *   node scripts/route-js.mjs          a table
 *   node scripts/route-js.mjs --json   the same as JSON
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";

const NEXT = ".next";
const APP = join(NEXT, "server", "app");
if (!existsSync(join(NEXT, "build-manifest.json")) || !existsSync(APP)) {
  console.error("No production build found. Run `npm run build` first.");
  process.exit(1);
}

const rootMain = JSON.parse(readFileSync(join(NEXT, "build-manifest.json"), "utf8")).rootMainFiles;

function* manifests(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* manifests(path);
    else if (name === "page_client-reference-manifest.js") yield path;
  }
}

/** "(app)/(main)/goals/[id]" → "/goals/[id]"; route groups don't appear in URLs. */
function routeOf(path) {
  const parts = relative(APP, path).split(sep).slice(0, -1);
  const url = parts.filter((p) => !(p.startsWith("(") && p.endsWith(")"))).join("/");
  return `/${url}`;
}

const sizes = new Map();
function sizeOf(chunk) {
  if (!sizes.has(chunk)) {
    const bytes = readFileSync(join(NEXT, chunk));
    sizes.set(chunk, { raw: bytes.length, gzip: gzipSync(bytes).length });
  }
  return sizes.get(chunk);
}

const rows = [];
for (const file of manifests(APP)) {
  globalThis.__RSC_MANIFEST = {};
  // The manifest is a script that assigns to globalThis.__RSC_MANIFEST; it holds only data.
  new Function(readFileSync(file, "utf8"))();
  const manifest = Object.values(globalThis.__RSC_MANIFEST)[0];
  const chunks = new Set(rootMain);
  for (const list of Object.values(manifest.entryJSFiles ?? {}))
    for (const c of list) chunks.add(c);
  let raw = 0;
  let gzip = 0;
  for (const chunk of chunks) {
    const s = sizeOf(chunk);
    raw += s.raw;
    gzip += s.gzip;
  }
  rows.push({
    route: routeOf(file),
    chunks: chunks.size,
    rawKB: Math.round(raw / 1024),
    gzipKB: Math.round(gzip / 1024),
  });
}
rows.sort((a, b) => (a.route < b.route ? -1 : 1));

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log("| Route | Chunks | Raw KB | Gzip KB |\n| --- | --- | --- | --- |");
  for (const r of rows) console.log(`| \`${r.route}\` | ${r.chunks} | ${r.rawKB} | ${r.gzipKB} |`);
}
