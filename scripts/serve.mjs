#!/usr/bin/env node
/*
 * 연습용 화면 띄우기(설치할 것 없음). `npm run dev` 로 띄우고 주소창에 아래 주소를 엽니다.
 *   http://127.0.0.1:4410/mock-host/
 * dist 파일은 진짜 도름스와 같은 보안 규칙(바깥 주소 금지 · 격리)으로 내보내서,
 * 여기서 잘 되면 도름스에서도 같은 이유로 막히지 않아요.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT) || 4410;
const host = "127.0.0.1";
const TYPES = {
  html: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8", txt: "text/plain; charset=utf-8", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg",
  jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif", ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2",
};

function bundlePolicy(origin) {
  return [
    "sandbox allow-scripts", "default-src 'none'", `script-src ${origin}`, `style-src ${origin} 'unsafe-inline'`,
    `img-src ${origin} data: blob:`, `font-src ${origin} data:`, `media-src ${origin} data: blob:`,
    "connect-src 'none'", "form-action 'none'", "base-uri 'none'", "frame-ancestors 'self'",
  ].join("; ");
}

const server = http.createServer((request, response) => {
  // 이 컴퓨터의 주소로 온 요청만 받는다(다른 사이트가 주소 이름을 바꿔 연습 서버를 읽지 못하게).
  if (![`${host}:${port}`, `localhost:${port}`].includes(String(request.headers.host || ""))) { response.writeHead(403).end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url || "/", `http://${host}:${port}`).pathname); }
  catch { response.writeHead(400).end(); return; }
  if (pathname.endsWith("/")) pathname += "index.html";
  const file = path.resolve(root, `.${pathname}`);
  // 레포 밖 파일 · 숨김 파일은 내보내지 않는다.
  if (!file.startsWith(root + path.sep) || path.relative(root, file).split(path.sep).some((part) => part.startsWith("."))) { response.writeHead(404).end(); return; }
  fs.readFile(file, (error, bytes) => {
    if (error) { response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("없는 파일이에요."); return; }
    const ext = path.extname(file).slice(1).toLowerCase();
    const headers = { "Content-Type": TYPES[ext] || "application/octet-stream", "Cache-Control": "no-store" };
    if (pathname.startsWith("/dist/")) headers["Content-Security-Policy"] = bundlePolicy(`http://${host}:${port}`);
    response.writeHead(200, headers).end(bytes);
  });
});

server.listen(port, host, () => {
  console.log(`연습용 도름스: http://${host}:${port}/mock-host/`);
  console.log("끄려면 Ctrl+C 를 누르세요.");
});
