const http = require("http");
const fs = require("fs");
const path = require("path");

// WORDFLASH_SITE=preview serves the preview copy (../preview) instead of the live site files.
const root = path.resolve(__dirname, "..", process.env.WORDFLASH_SITE || "");
const port = Number(process.env.WORDFLASH_PORT || 4173);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png"
};

http.createServer((request, response) => {
  const urlPath = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const requestedFile = urlPath === "/" ? "canvas_words.html" : urlPath.replace(/^\/+/, "");
  const filePath = path.resolve(root, requestedFile);

  if (!filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
    });
    response.end(content);
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`WordFlash test server: http://127.0.0.1:${port} (${root})`);
});
