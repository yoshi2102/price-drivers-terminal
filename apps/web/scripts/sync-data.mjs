// Before dev/build: make sure apps/web/data holds the published snapshot.
//  - Local: the worker copies it there (python -m pdt.run).
//  - Vercel: set PDT_SNAPSHOT_URL to the bucket prefix (R2/S3, ap-south-1);
//    this reads <url>/PUBLISHED, then every file in <url>/<id>/files.json.
// Then copy scenario caches into public/data for the browser.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
const root = new URL("..", import.meta.url).pathname;
const src = path.join(root, "data");
const base = process.env.PDT_SNAPSHOT_URL;
if (base) {
  const id = (await (await fetch(`${base}/PUBLISHED`)).text()).trim();
  const files = await (await fetch(`${base}/${id}/files.json`)).json();
  rmSync(src, { recursive: true, force: true });
  for (const f of files) {
    const r = await fetch(`${base}/${id}/${f}`);
    if (!r.ok) throw new Error(`snapshot fetch failed: ${f} ${r.status}`);
    mkdirSync(path.dirname(path.join(src, f)), { recursive: true });
    writeFileSync(path.join(src, f), Buffer.from(await r.arrayBuffer()));
  }
  console.log(`pulled snapshot ${id} (${files.length} files)`);
}
if (!existsSync(src)) { console.error("No published snapshot in apps/web/data. Run the worker: python -m pdt.run"); process.exit(1); }
const dst = path.join(root, "public", "data");
rmSync(dst, { recursive: true, force: true });
cpSync(path.join(src, "scenarios"), path.join(dst, "scenarios"), { recursive: true });
console.log("synced scenarios ->", dst);
