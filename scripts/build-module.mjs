import { createHash, createPrivateKey, sign } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { build } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [id, version, ...noteParts] = process.argv.slice(2);
if (!id || !/^\d{1,4}(\.\d{1,4}){1,3}$/.test(version ?? "")) {
  console.error("Kullanım: node scripts/build-module.mjs <modül> <sürüm> [notlar]");
  process.exit(1);
}
const modules = JSON.parse(readFileSync(join(root, "modules.json"), "utf8"));
const spec = modules[id];
if (!spec) {
  console.error(`Bilinmeyen modül: ${id}`);
  process.exit(1);
}

const sharedSource = readFileSync(join(root, "src/modules/shared.ts"), "utf8");
const block = sharedSource.slice(sharedSource.indexOf("export const SHARED"));
const shared = [...block.matchAll(/^\s+"?([@\w/.-]+)"?:\s/gm)].map((match) => match[1]);
const isShared = (source) => shared.includes(source);

const work = join(root, ".module-build", id);
const out = join(root, "release", "modules", id, version);
rmSync(work, { recursive: true, force: true });
rmSync(out, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
mkdirSync(out, { recursive: true });

const styles = readFileSync(join(root, "src/styles.css"), "utf8");
const theme = styles.slice(styles.indexOf("@theme {"), styles.indexOf("}\n", styles.indexOf("@theme {")) + 2);
const screens = join(root, "src/screens").replace(/\\/g, "/");
writeFileSync(
  join(work, "module.css"),
  `@import "tailwindcss/theme.css" layer(theme);\n@import "tailwindcss/utilities.css" layer(utilities) source(none);\n@source "${screens}";\n@source "${join(root, "src/shell").replace(/\\/g, "/")}";\n${theme}\n`,
);
writeFileSync(join(work, "entry.tsx"), `import "./module.css";\nexport { ${spec.export} as default } from "${join(root, spec.file).replace(/\\/g, "/").replace(/\.tsx$/, "")}";\n`);

await build({
  configFile: false,
  root,
  logLevel: "warn",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": join(root, "src"), "@shared": join(root, "shared") } },
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: work,
    emptyOutDir: false,
    target: "chrome140",
    minify: true,
    cssCodeSplit: false,
    lib: { entry: join(work, "entry.tsx"), formats: ["cjs"], fileName: () => "raw.js", cssFileName: "bundle" },
    rollupOptions: { external: isShared, output: { exports: "named" } },
  },
});

const raw = readFileSync(join(work, "raw.js"), "utf8");
const js = `(function(){var module={exports:{}};var exports=module.exports;var require=function(n){return window.__sorviaHost.require(n)};\n${raw}\nwindow.__sorviaRegister(${JSON.stringify(id)},${JSON.stringify(version)},module.exports);})();\n`;
writeFileSync(join(out, "bundle.js"), js);
const cssPath = existsSync(join(work, "bundle.css")) ? join(work, "bundle.css") : null;
writeFileSync(join(out, "bundle.css"), cssPath ? readFileSync(cssPath) : "");

const files = Object.fromEntries(["bundle.js", "bundle.css"].map((file) => [file, createHash("sha256").update(readFileSync(join(out, file))).digest("hex")]));
const message = [id, version, ...["bundle.js", "bundle.css"].map((file) => `${file}:${files[file]}`)].join("\n");
const key = process.env.MODULE_SIGNING_KEY;
const signature = key ? sign(null, Buffer.from(message), createPrivateKey(key)).toString("base64") : "";
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const manifest = { id, version, minApp: process.env.MODULE_MIN_APP || pkg.version, notes: noteParts.join(" ").trim() || null, files, signature };
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
rmSync(join(root, ".module-build"), { recursive: true, force: true });
console.log(`${spec.title} ${version} hazır: ${out}${signature ? "" : " (imzasız)"}`);
console.log(`  bundle.js ${(readFileSync(join(out, "bundle.js")).length / 1024).toFixed(0)} KB, bundle.css ${(readFileSync(join(out, "bundle.css")).length / 1024).toFixed(0)} KB`);
