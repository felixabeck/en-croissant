#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { arch as hostArch, platform as hostPlatform } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SHELLCHECK_VERSION = "v0.11.0";
export const SHELLCHECK_SHA256 = Object.freeze({
  "linux-x64": "8c3be12b05d5c177a04c29e3c78ce89ac86f1595681cab149b65b97c4e227198",
});
export const RELEASE_BASE_URL = "https://github.com/koalaman/shellcheck/releases/download";
export const DOWNLOAD_TIMEOUT_MS = 120_000;

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STALE_CACHE_ENTRY_MAX_AGE_MS = 60 * 60 * 1000;
const PLATFORM_ASSETS = Object.freeze({
  "linux-x64": "linux.x86_64",
});

export const PRODUCTION_OPTIONS = Object.freeze({
  version: SHELLCHECK_VERSION,
  sha256: SHELLCHECK_SHA256,
  baseUrl: RELEASE_BASE_URL,
  cacheDir: join(projectRoot, "node_modules", ".cache", "shellcheck"),
  platform: hostPlatform(),
  arch: hostArch(),
  fetchImpl: globalThis.fetch,
  timeoutMs: DOWNLOAD_TIMEOUT_MS,
});

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

async function sha256File(path) {
  return sha256(await readFile(path));
}

async function cachedBinary(generationDirectory) {
  const binaryPath = join(generationDirectory, "shellcheck");
  const hashPath = join(generationDirectory, "shellcheck.sha256");
  try {
    const [recordedHash, actualHash] = await Promise.all([
      readFile(hashPath, "utf8"),
      sha256File(binaryPath),
    ]);
    return recordedHash.trim() === actualHash ? binaryPath : undefined;
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw new Error(`ShellCheck cache verification failed: ${error.message}`, { cause: error });
  }
}

async function currentGeneration(versionDirectory) {
  let generationName;
  try {
    generationName = await readlink(join(versionDirectory, "current"));
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "EINVAL") return undefined;
    throw new Error(`ShellCheck cache pointer could not be read: ${error.message}`, {
      cause: error,
    });
  }
  if (generationName !== basename(generationName) || !generationName.startsWith("gen-")) {
    return undefined;
  }
  return { generationName, directory: join(versionDirectory, generationName) };
}

async function cachedCurrentBinary(versionDirectory) {
  const current = await currentGeneration(versionDirectory);
  return current ? cachedBinary(current.directory) : undefined;
}

async function reclaimStaleGenerations(versionDirectory) {
  const now = Date.now();
  const current = await currentGeneration(versionDirectory);
  const entries = await readdir(versionDirectory, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => {
        const reclaimableDirectory =
          entry.isDirectory() && (entry.name.startsWith(".tmp-") || entry.name.startsWith("gen-"));
        const reclaimablePointer = entry.isSymbolicLink() && entry.name.startsWith(".tmp-current-");
        return (
          (reclaimableDirectory || reclaimablePointer) && entry.name !== current?.generationName
        );
      })
      .map(async (entry) => {
        const path = join(versionDirectory, entry.name);
        let metadata;
        try {
          metadata = await lstat(path);
        } catch (error) {
          if (error?.code === "ENOENT") return;
          throw error;
        }
        if (now - metadata.mtimeMs > STALE_CACHE_ENTRY_MAX_AGE_MS) {
          await rm(path, { recursive: true, force: true });
        }
      }),
  );
}

async function downloadArchive({ url, archivePath, expectedHash, fetchImpl, timeoutMs }) {
  let response;
  try {
    response = await fetchImpl(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new Error(`ShellCheck download failed: ${error.message}`, { cause: error });
  }
  if (!response.ok) {
    throw new Error(`ShellCheck download failed: HTTP ${response.status} ${response.statusText}`);
  }

  let archive;
  try {
    archive = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    throw new Error(`ShellCheck download failed while reading the response: ${error.message}`, {
      cause: error,
    });
  }
  const actualHash = sha256(archive);
  if (actualHash !== expectedHash) {
    throw new Error(
      `ShellCheck archive hash mismatch: expected ${expectedHash}, received ${actualHash}`,
    );
  }
  await writeFile(archivePath, archive);
}

function extractArchive({ archivePath, temporaryDirectory, version }) {
  const member = `shellcheck-${version}/shellcheck`;
  const result = spawnSync(
    "tar",
    ["-xJf", archivePath, "-C", temporaryDirectory, "--strip-components=1", member],
    { encoding: "utf8" },
  );
  if (result.error) {
    throw new Error(`ShellCheck extraction could not start: ${result.error.message}`, {
      cause: result.error,
    });
  }
  if (result.status !== 0) {
    const detail = result.stderr.trim();
    throw new Error(
      `ShellCheck extraction failed with exit ${result.status ?? 1}${detail ? `: ${detail}` : ""}`,
    );
  }
}

export async function ensureShellcheck({
  version,
  sha256: hashes,
  baseUrl,
  cacheDir,
  platform,
  arch,
  fetchImpl = globalThis.fetch,
  timeoutMs = DOWNLOAD_TIMEOUT_MS,
}) {
  const platformKey = `${platform}-${arch}`;
  const expectedHash = hashes[platformKey];
  const assetPlatform = PLATFORM_ASSETS[platformKey];
  if (!expectedHash || !assetPlatform) {
    throw new Error(
      `Unsupported ShellCheck platform ${platformKey}; pinned platforms: ${Object.keys(hashes).join(", ")}`,
    );
  }

  await mkdir(cacheDir, { recursive: true });
  const versionDirectory = join(cacheDir, version);
  await mkdir(versionDirectory, { recursive: true });
  await reclaimStaleGenerations(versionDirectory);
  const hit = await cachedCurrentBinary(versionDirectory);
  if (hit) return hit;

  const temporaryDirectory = await mkdtemp(join(versionDirectory, ".tmp-"));
  const archiveName = `shellcheck-${version}.${assetPlatform}.tar.xz`;
  const archivePath = join(temporaryDirectory, archiveName);
  const url = `${baseUrl}/${version}/${archiveName}`;
  let ownsTemporaryDirectory = true;
  try {
    await downloadArchive({ url, archivePath, expectedHash, fetchImpl, timeoutMs });
    extractArchive({ archivePath, temporaryDirectory, version });
    const binaryPath = join(temporaryDirectory, "shellcheck");
    await chmod(binaryPath, 0o755);
    await writeFile(
      join(temporaryDirectory, "shellcheck.sha256"),
      `${await sha256File(binaryPath)}\n`,
    );
    await rm(archivePath, { force: true });

    const generationName = `gen-${randomUUID()}`;
    const generationDirectory = join(versionDirectory, generationName);
    await rename(temporaryDirectory, generationDirectory);
    ownsTemporaryDirectory = false;

    const pointerPath = join(versionDirectory, `.tmp-current-${randomUUID()}`);
    try {
      await symlink(generationName, pointerPath);
      await rename(pointerPath, join(versionDirectory, "current"));
    } finally {
      try {
        await rm(pointerPath, { force: true });
      } catch (error) {
        console.error(
          `Secondary failure while cleaning ShellCheck publication pointer ${pointerPath}: ${error.message}`,
        );
      }
    }

    const installed = await cachedCurrentBinary(versionDirectory);
    if (!installed) {
      throw new Error(
        "ShellCheck installation disappeared or failed verification after publication",
      );
    }
    return installed;
  } finally {
    if (ownsTemporaryDirectory) {
      try {
        await rm(temporaryDirectory, { recursive: true, force: true });
      } catch (error) {
        console.error(
          `Secondary failure while cleaning ShellCheck temporary directory ${temporaryDirectory}: ${error.message}`,
        );
      }
    }
  }
}

export function runShellcheck(binaryPath, args) {
  const result = spawnSync(binaryPath, args, { stdio: "inherit" });
  if (result.error) {
    console.error(`ShellCheck could not start: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

export async function cliMain(argv, options = PRODUCTION_OPTIONS) {
  try {
    const binaryPath = await ensureShellcheck(options);
    return runShellcheck(binaryPath, argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(await cliMain(process.argv.slice(2)));
}
