import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "vite";
import { context } from "esbuild";

delete process.env.ELECTRON_RUN_AS_NODE;

const server = await createServer();
await server.listen();
const url = server.resolvedUrls?.local?.[0] ?? "http://localhost:5199/";

let electron = null;
const launch = () => {
  if (electron) electron.kill();
  electron = spawn(createRequire(import.meta.url)("electron"), ["."], {
    stdio: "inherit",
    env: { ...process.env, VITE_DEV_SERVER_URL: url, SORVIA_DEV: "1" },
  });
  electron.on("exit", (code, signal) => {
    if (signal !== "SIGTERM" && code !== null) {
      server.close();
      process.exit(code);
    }
  });
};

const ctx = await context({
  entryPoints: { main: "electron/main.ts", preload: "electron/preload.ts" },
  outdir: "dist-electron",
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  sourcemap: "inline",
  external: ["electron"],
  plugins: [{ name: "relaunch", setup(build) { build.onEnd((result) => { if (!result.errors.length) launch(); }); } }],
});
await ctx.watch();
