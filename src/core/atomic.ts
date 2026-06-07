import { closeSync, mkdirSync, openSync, renameSync, writeFileSync, writeSync } from "node:fs";
import { dirname } from "node:path";

/** Append a single chunk with O_APPEND, atomic across processes for writes under ~4 KB. */
export function appendAtomic(filePath: string, chunk: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const fd = openSync(filePath, "a");
  try {
    writeSync(fd, chunk);
  } finally {
    closeSync(fd);
  }
}

/** Write a full file via temp + rename so readers never observe a partial write. */
export function writeAtomic(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, content);
  renameSync(tmp, filePath);
}
