const startTime = Date.now();

export function createServer(options: { port: number }) {
  return Bun.serve({
    port: options.port,
    fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/health") {
        if (req.method !== "GET") {
          return Response.json({ error: "method not allowed" }, { status: 405 });
        }
        return Response.json({
          status: "ok",
          uptime: Math.floor((Date.now() - startTime) / 1000),
        });
      }

      return Response.json({ error: "not found" }, { status: 404 });
    },
  });
}
