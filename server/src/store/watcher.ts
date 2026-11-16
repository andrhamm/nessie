import { watch } from "node:fs";
import { stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Surreal } from "surrealdb";
import { deleteOne, indexOne } from "./indexer";

export interface WatcherOptions {
  db: Surreal;
  mdDir: string;
  /** Coalesce rapid successive events on the same path. Default 400 ms. */
  debounceMs?: number;
  /** Optional callback fired after each successful upsert/delete, for tests. */
  onChange?: (change: { path: string; kind: "upsert" | "delete" }) => void;
}

export interface MdWatcher {
  close(): void;
}

/**
 * Watch an md root directory recursively. Debounces per-path events so a
 * flurry of save/rename events settles before we re-index.
 *
 * Uses `fs.watch` with `recursive: true`. On macOS the underlying FSEvents
 * watcher sometimes fires with `filename === null`; in that case we re-index
 * nothing (the next targeted edit will catch up).
 */
export function startWatcher(options: WatcherOptions): MdWatcher {
  const debounceMs = options.debounceMs ?? 400;
  const pending = new Map<string, ReturnType<typeof setTimeout>>();

  const handle = async (relPath: string) => {
    try {
      const abs = join(options.mdDir, relPath);
      let exists = true;
      try {
        await stat(abs);
      } catch {
        exists = false;
      }
      if (exists) {
        await indexOne(options.db, options.mdDir, relPath);
        options.onChange?.({ path: relPath, kind: "upsert" });
      } else {
        await deleteOne(options.db, relPath);
        options.onChange?.({ path: relPath, kind: "delete" });
      }
    } catch {
      // Swallow: the watcher's contract is "eventually consistent with disk".
      // Callers that need strict error propagation should use indexOne directly.
    }
  };

  const schedule = (relPath: string) => {
    const existing = pending.get(relPath);
    if (existing) clearTimeout(existing);
    pending.set(
      relPath,
      setTimeout(() => {
        pending.delete(relPath);
        void handle(relPath);
      }, debounceMs),
    );
  };

  const watcher = watch(options.mdDir, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    if (!filename.endsWith(".md")) return;
    // `filename` is already relative to the watched dir on macOS/Linux.
    schedule(filename.startsWith(options.mdDir) ? relative(options.mdDir, filename) : filename);
  });

  return {
    close() {
      for (const t of pending.values()) clearTimeout(t);
      pending.clear();
      watcher.close();
    },
  };
}
