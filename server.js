// Zero-dependency static server: pre-compresses every file into memory at startup,
// so each request is a single in-memory write. Run: node server.js  (PORT env optional)
const http = require("http"), fs = require("fs"), path = require("path"), zlib = require("zlib");

const ROOT = __dirname, PORT = +process.env.PORT || 5173;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json", ".ico": "image/x-icon", ".png": "image/png", ".webp": "image/webp" };
const files = {};

const names = fs.readdirSync(ROOT).filter(n => TYPES[path.extname(n)] && n !== "server.js");
// Content hash per asset: HTML links to "app.js?v=<hash>", so assets can be cached forever
// and any edit still reaches visitors on their next page load.
const hash = Object.fromEntries(names.map(n =>
  [n, require("crypto").createHash("sha1").update(fs.readFileSync(path.join(ROOT, n))).digest("hex").slice(0, 10)]));

for (const name of names) {
  const ext = path.extname(name);
  let raw = fs.readFileSync(path.join(ROOT, name));
  if (ext === ".html") raw = Buffer.from(raw.toString().replace(/(src|href)="([\w.-]+\.(?:js|css))"/g,
    (m, attr, file) => hash[file] ? `${attr}="${file}?v=${hash[file]}"` : m));
  files["/" + name] = {
    type: TYPES[ext], raw,
    br: zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }),
    gz: zlib.gzipSync(raw, { level: 9 }),
    // HTML must revalidate so updates show up; hashed assets never change, so cache them for a year.
    cache: ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
  };
}

http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  const f = files[url === "/" ? "/index.html" : url] || files["/index.html"];
  const ae = req.headers["accept-encoding"] || "";
  const [body, enc] = ae.includes("br") ? [f.br, "br"] : ae.includes("gzip") ? [f.gz, "gzip"] : [f.raw, null];
  const h = { "Content-Type": f.type, "Cache-Control": f.cache, "Vary": "Accept-Encoding", "Content-Length": body.length, "X-Content-Type-Options": "nosniff" };
  if (enc) h["Content-Encoding"] = enc;
  res.writeHead(200, h);
  res.end(req.method === "HEAD" ? undefined : body);
}).listen(PORT, () => console.log(`Swift Store → http://localhost:${PORT}`));
