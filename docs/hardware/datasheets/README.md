# Datasheets

Vendor datasheets and schematics are copyrighted by their publishers, so they are not stored in this repo. The hardware docs in `docs/hardware/` link to them by local path and by source URL.

To download them here (git-ignored) and generate the `*-parsed.txt` copies:

```bash
scripts/fetch-datasheets.sh
```

Parsing needs the `lit` CLI from [`@llamaindex/liteparse`](https://www.npmjs.com/package/@llamaindex/liteparse).
