#!/usr/bin/env node
// Postbuild: inject a unique CACHE_VERSION into public/sw.js so every
// deploy gets a fresh service-worker cache key.
//
// Why: the SW cache key (CACHE_VERSION) is the only thing that forces
// the activate handler to wipe stale cache buckets (see the
// `caches.keys().filter(...).map(caches.delete)` loop in sw.js's
// activate event). Without a per-deploy bump, a deploy that ships
// modified chunk hashes can leave users on a v8 SW that's still
// holding v8-keyed-but-stale entries — exactly the failure mode we
// just fixed in the cache-first refactor.
//
// Build-id source priority:
//   1. VERCEL_GIT_COMMIT_SHA (set automatically on Vercel)
//   2. NEXT_PUBLIC_BUILD_ID  (manual override)
//   3. dev-${Date.now()}     (local fallback)
//
// We truncate to 12 chars to keep cache names readable in DevTools.
//
// Failure mode: on ANY error this script logs a warning and exits 0.
// The build must not fail just because we couldn't rewrite a literal
// — the v8 fallback in sw.js still works, it just won't be unique
// per deploy.

import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SW_PATH = resolve(__dirname, "..", "public", "sw.js");
const VERSION_REGEX = /const CACHE_VERSION = '[^']+';/;

function pickBuildId() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha && sha.length > 0) return sha.slice(0, 12);

  const explicit = process.env.NEXT_PUBLIC_BUILD_ID;
  if (explicit && explicit.length > 0) return explicit.slice(0, 12);

  return `dev-${Date.now()}`.slice(0, 12);
}

async function main() {
  const buildId = pickBuildId();
  const newLine = `const CACHE_VERSION = 'build-${buildId}';`;

  const original = await readFile(SW_PATH, "utf8");
  if (!VERSION_REGEX.test(original)) {
    console.warn(
      `[inject-sw-version] CACHE_VERSION literal not found in ${SW_PATH} — skipping injection.`,
    );
    return;
  }

  const updated = original.replace(VERSION_REGEX, newLine);
  if (updated === original) {
    // No-op; literal already matches. Still log so deploy logs show what happened.
    console.log(`[inject-sw-version] CACHE_VERSION already set to build-${buildId}`);
    return;
  }

  await writeFile(SW_PATH, updated, "utf8");
  console.log(`[inject-sw-version] CACHE_VERSION → build-${buildId}`);
}

try {
  await main();
} catch (err) {
  console.warn("[inject-sw-version] failed, falling back to existing CACHE_VERSION:", err?.message ?? err);
  // EXIT 0 — never fail the build for a cache-version inject failure.
  process.exit(0);
}
