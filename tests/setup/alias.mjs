// Permite importar el código de src/ con node --test: resuelve "@/..." y las rutas sin extensión.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(
  "data:text/javascript," +
    encodeURIComponent(`
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
const SRC = ${JSON.stringify(pathToFileURL(process.cwd() + "/src/").href)};
export async function resolve(spec, ctx, next) {
  if (spec.startsWith("@/")) spec = SRC + spec.slice(2);
  if (spec.startsWith("file:") || ((spec.startsWith(".") || spec.startsWith("/")) && ctx.parentURL?.startsWith("file:"))) {
    const url = new URL(spec, ctx.parentURL);
    const p = fileURLToPath(url);
    if (!existsSync(p) || !/\\.[cm]?js$/.test(p)) {
      for (const ext of [".js", "/index.js"]) if (existsSync(p + ext)) return next(url.href + ext, ctx);
    }
    return next(url.href, ctx);
  }
  return next(spec, ctx);
}`),
  pathToFileURL("./"),
);
