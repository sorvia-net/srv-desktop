import { build } from "esbuild";

const watch = process.argv.includes("--watch");
const options = {
  entryPoints: { main: "electron/main.ts", preload: "electron/preload.ts", "webapp-preload": "electron/webapp-preload.ts" },
  outdir: "dist-electron",
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  sourcemap: watch ? "inline" : false,
  minify: !watch,
  legalComments: "none",
  external: ["electron"],
  logLevel: "info",
};

if (watch) {
  const { context } = await import("esbuild");
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
