import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { config } from '../config.js';

mkdirSync(config.firmwareStorageDir, { recursive: true });

export interface StoredFile {
  sha256: string;
  size: number;
  /** 相对存储根目录的路径，例如 "ab/abcdef.../bin" */
  relativePath: string;
  absolutePath: string;
  deduped: boolean;
}

function pathForSha(sha: string): { rel: string; abs: string } {
  const rel = join(sha.slice(0, 2), sha);
  return { rel: rel.replace(/\\/g, '/'), abs: join(config.firmwareStorageDir, rel) };
}

export async function storeUpload(stream: NodeJS.ReadableStream): Promise<StoredFile> {
  const tmpName = `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}.part`;
  const tmpPath = join(config.firmwareStorageDir, tmpName);
  const hash = createHash('sha256');
  let size = 0;
  const ws = createWriteStream(tmpPath);
  await pipeline(
    stream,
    async function* (source) {
      for await (const chunk of source as AsyncIterable<Buffer>) {
        hash.update(chunk);
        size += chunk.length;
        yield chunk;
      }
    },
    ws,
  );
  const sha256 = hash.digest('hex');
  const { rel, abs } = pathForSha(sha256);
  if (existsSync(abs)) {
    unlinkSync(tmpPath);
    return { sha256, size, relativePath: rel, absolutePath: abs, deduped: true };
  }
  mkdirSync(join(config.firmwareStorageDir, sha256.slice(0, 2)), { recursive: true });
  await rename(tmpPath, abs);
  return { sha256, size, relativePath: rel, absolutePath: abs, deduped: false };
}

export function resolveStoredPath(sha256: string): { rel: string; abs: string; exists: boolean } {
  const { rel, abs } = pathForSha(sha256);
  return { rel, abs, exists: existsSync(abs) };
}

export function readStoredStream(sha256: string): NodeJS.ReadableStream | null {
  const { abs, exists } = resolveStoredPath(sha256);
  if (!exists) return null;
  return createReadStream(abs);
}
