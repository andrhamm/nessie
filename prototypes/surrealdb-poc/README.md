# SurrealDB PoC — Integration test suite

Validates SurrealDB embedded (`@surrealdb/node` + `surrealkv://`) as the
backing index for the Nessie project's planned `MdStore`. Canonical
source of truth is real `.md` files on disk; SurrealDB is the derived
index regenerated via the `indexer` module.

See `~/.claude/plans/stateful-swinging-harbor.md` for the full plan
and `~/.claude/plans/ness-parent-agent.md` for the larger context.

## Stack

- Engine: SurrealDB **3.0.2** bundled in `@surrealdb/node@3.0.3`
- SDK: `surrealdb@2.0.3` (v2.x is the current SDK line that speaks to v3 engines)
- Embeddings: `@huggingface/transformers` v4, `Xenova/all-MiniLM-L6-v2` (384-dim)
- Persistence: `surrealkv://` key-value store
- Runtime: Bun 1.2.10 on macOS 15.6.1, Apple M1 Max (64 GB)

## Run

```bash
bun install
bun test
```

All data, model caches, and SurrealDB files land under this directory
(`data/`, `models/`) — nothing is written outside
`prototypes/surrealdb-poc/`.

## Results

Full suite: **42 tests pass across 13 files**, ~117 s wall clock (dominated
by the 37 s cold-rebuild + 41 s × 1000-run hybrid-query bench + 16 s
reconnect hang + model-warmup time).

| Test | Status | Notes |
|------|--------|-------|
| 01-docs | ✅ pass | MD round-trip (fm + body), edit, delete, tree walk |
| 02-persons | ✅ pass | list, who_is (name + alias, ambiguous), delete, add_alias |
| 03-memories | ✅ pass | vector + subject filter |
| 04-events | ✅ pass | range, status filter, nested participants |
| 05-journal | ✅ pass | semantic recall + date-range narrowing |
| 06-graph | ✅ pass | 1-hop + 2-hop + edge metadata + typed traversal |
| 07-contact-tracking | ✅ pass | last_contacted edges with date filter |
| 08-hybrid-search | ✅ pass | FTS + vector + `search::rrf` fusion |
| 09-update-delete | ✅ pass | external .md edits propagate via re-index |
| 10-reconnect (#592) | ✅ pass (documentary) | hang confirmed — see below |
| 11-persistence | ✅ pass | subprocess writes, parent reads back |
| 12-crash-safety | ✅ pass (documentary) | see below |
| 13-perf | ✅ pass | latency targets met — see below |

### Observed issue #592 behaviour (test 10)

**Same-process reconnect to a `surrealkv://` path HANGS on Bun 1.2.10 +
macOS arm64 (Darwin 25.6.0).** Confirmed 2026-04-18 — issue
[surrealdb.js#592](https://github.com/surrealdb/surrealdb.js/issues/592)
reproduces exactly.

After `db.close()`, a subsequent `connect()` to the same surrealkv path
in the same process never resolves. We time-box the attempt at 15 s.

**Mitigation**: use a single long-lived SurrealDB connection per process.
This matches a server's natural shape (one server process owns one DB
handle for its lifetime), so the bug does not block the bigger plan's
`MdStore` design. Cross-process access works cleanly — test 11 shows a
separate Bun subprocess can connect, write, and exit, and the parent
process then connects (fresh handle) and reads the data.

### Crash safety observation (test 12)

SIGKILL-ing a writer subprocess mid-stream results in **0 committed
records** visible after reopen. The store opens cleanly (no corruption),
but SurrealKV does not fsync each write synchronously. In practice the
WAL flushes on `db.close()`, which a killed process never reaches.

Implication for Nessie: writes that matter should be followed by a
lightweight sync barrier (or the in-flight work should be tolerant of
recent loss). Not a blocker for a home toy where the worst case is
losing the last handful of minutes of state.

### Measured latencies (test 13)

Corpus: 2000 real `.md` files across 4 entity kinds (50 persons +
500 memories + 500 events + 500 journal + 450 filler), plus 200
`friend_of` edges.

| Metric | Target | Measured (M1 Max) |
|--------|--------|-------------------|
| Cold rebuild | < 2 min | **37 s** |
| Hybrid RRF query p50 | — | 41.2 ms |
| Hybrid RRF query p95 | < 100 ms | **42.3 ms** |
| 2-hop graph traversal p50 | — | 0.5 ms |
| 2-hop graph traversal p95 | < 20 ms | **0.7 ms** |

All three targets met with significant headroom. Embedding (transformers.js
ONNX CPU) is the dominant cost of cold rebuild at ~18 ms per doc average.

## Layout

See `~/.claude/plans/stateful-swinging-harbor.md` for the planned layout;
this repo follows it: `src/{db,schemas,frontmatter,embed,indexer,seed}.ts`,
`scripts/subprocess-writer.ts`, `test/NN-name.test.ts`. Per-test isolation
via `data/test-<slug>/` subdirs.
