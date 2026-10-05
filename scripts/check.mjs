#!/usr/bin/env node
/*
 * 새 판을 내기 전에 돌리는 점검(설치할 것 없음). `npm run check`
 *  1. 묶음 규칙: 도름스가 판을 받을 때 보는 규칙과 같다(파일 200개 · 하나 2MB · 전체 5MB · 쓸 수 있는 확장자 · 필수 파일).
 *  2. 자료 표 선언: dorms-book.json 의 data 와 화면이 실제로 쓰는 모음이 맞는지.
 *  3. 깨끗함: 열쇠 · 비밀번호 같은 값, 내부 주소, 전자우편, 이모지, 긴 줄표가 없는지.
 * 하나라도 걸리면 끝에 '고칠 것'을 적고 실패로 끝난다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMITS = { files: 200, totalBytes: 5 * 1024 * 1024, fileBytes: 2 * 1024 * 1024 };
const TYPES = new Set(["html", "css", "js", "mjs", "json", "txt", "svg", "png", "jpg", "jpeg", "webp", "gif", "avif", "ico", "woff", "woff2"]);
const TEXT = new Set(["html", "css", "js", "mjs", "json", "txt", "svg", "md"]);
const ROLES = new Set(["anyone", "login", "teacher", "member", "operator"]);
const COLLECTION_RE = /^[a-z][a-z0-9_-]{1,40}$/;
const PRIVATE_NAME_RE = /(phone|tel|mobile|resident|ssn|address|birth|전화|휴대|주민|주소|생년)/i;

const problems = [];
const notes = [];
const fail = (message) => problems.push(message);
const note = (message) => notes.push(message);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) { fail(`심볼릭 링크는 두지 마세요: ${path.relative(root, full)}`); continue; }
    if (entry.isDirectory()) walk(full, out); else out.push(full);
  }
  return out;
}
const rel = (file) => path.relative(root, file).split(path.sep).join("/");
const ext = (file) => path.extname(file).slice(1).toLowerCase();

/* 1. 묶음 규칙 */
const distDir = path.join(root, "dist");
if (!fs.existsSync(distDir)) fail("dist 폴더가 없어요. 화면 파일은 dist 안에 둡니다.");
const distFiles = fs.existsSync(distDir) ? walk(distDir) : [];
let total = 0;
for (const file of distFiles) {
  const inside = path.relative(distDir, file).split(path.sep).join("/");
  const size = fs.statSync(file).size;
  total += size;
  if (inside.length > 180 || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(inside) || inside.split("/").some((part) => !part || part.startsWith("."))) {
    fail(`dist 안 파일 이름은 영문 · 숫자 · . _ - / 만 쓸 수 있어요: ${inside}`);
  }
  if (!TYPES.has(ext(file))) fail(`도름스가 받지 않는 파일 종류예요: ${inside}`);
  if (size > LIMITS.fileBytes) fail(`파일 하나가 2MB를 넘어요: ${inside}`);
}
if (distFiles.length > LIMITS.files) fail(`dist 파일이 ${distFiles.length}개예요(200개까지).`);
if (total > LIMITS.totalBytes) fail(`dist 전체가 ${(total / 1024 / 1024).toFixed(2)}MB 예요(5MB까지).`);
if (!fs.existsSync(path.join(distDir, "index.html"))) fail("dist 맨 위에 index.html 이 있어야 해요.");
const manifestPath = path.join(distDir, "book.manifest.json");
if (!fs.existsSync(manifestPath)) fail("dist 맨 위에 book.manifest.json 이 있어야 해요.");
else {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) fail("book.manifest.json 은 { } 모양이어야 해요.");
    if (JSON.stringify(manifest).length > 4000) fail("book.manifest.json 이 너무 커요(4000자까지).");
  } catch { fail("book.manifest.json 을 읽지 못했어요(쉼표 · 따옴표를 확인해 주세요)."); }
}
note(`묶음: 파일 ${distFiles.length}개 · ${(total / 1024).toFixed(1)}KB`);

/* 2. 자료 표 선언 */
let declared = [];
try {
  const repo = JSON.parse(fs.readFileSync(path.join(root, "dorms-book.json"), "utf8"));
  if (typeof repo.verifyCode !== "string" || !/^dorms-book-[0-9a-f]{16}$/.test(repo.verifyCode)) {
    note("확인 코드: 아직 도름스에서 받은 코드를 넣지 않았어요(처음 레포를 연결할 때 넣으면 돼요).");
  } else note("확인 코드: 들어 있어요.");
  declared = Array.isArray(repo.data) ? repo.data : [];
  if (!Array.isArray(repo.data)) fail("dorms-book.json 에 data 목록이 없어요. 쓰는 모음이 없으면 [] 로 두세요.");
  for (const item of declared) {
    const where = `${item && item.index}/${item && item.collection}`;
    if (!item || typeof item.index !== "string" || !item.index) fail(`data 선언에 index(색인 이름표)가 없어요: ${where}`);
    if (!item || !COLLECTION_RE.test(String(item.collection))) fail(`모음 이름은 영문 소문자로 시작하고 a-z 0-9 _ - 만, 2~41자예요: ${where}`);
    // 모음 이름과 칸 이름(설명 말고 이름표)만 본다. 도름스도 이름표에 이런 낱말이 있으면 받지 않는다.
    const fieldNames = item && item.fields && typeof item.fields === "object" ? Object.keys(item.fields).join(" ") : "";
    if (item && PRIVATE_NAME_RE.test(`${item.collection} ${fieldNames}`)) fail(`개인정보로 보이는 이름은 도름스가 받지 않아요(전화 · 주소 · 생년 등): ${where}`);
    if (item && !ROLES.has(item.write)) fail(`write 는 anyone · login · teacher · member · operator 가운데 하나예요: ${where}`);
    if (item && item.read !== undefined && !ROLES.has(item.read)) fail(`read 는 anyone · login · teacher · member · operator 가운데 하나예요: ${where}`);
  }
} catch { fail("dorms-book.json 을 읽지 못했어요(레포 맨 위에 있어야 하고, 쉼표 · 따옴표를 확인해 주세요)."); }

const used = new Set();
for (const file of distFiles.filter((f) => ["js", "mjs"].includes(ext(f)) && !f.endsWith("dorms-book-sdk.js"))) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/collection\s*:\s*["']([a-z][a-z0-9_-]{1,40})["']/g)) used.add(match[1]);
  for (const match of source.matchAll(/data\.(?:list|get|set|remove)\([^,()]+,\s*["']([a-z][a-z0-9_-]{1,40})["']/g)) used.add(match[1]);
}
for (const name of used) {
  if (!declared.some((item) => item && item.collection === name)) fail(`화면이 '${name}' 모음을 쓰는데 dorms-book.json 의 data 에 선언이 없어요.`);
}
note(`자료 표: 선언 ${declared.length}개 · 화면이 쓰는 모음 ${[...used].join(", ") || "없음"}`);

/* 3. 깨끗함 */
const SECRET_RES = [
  [/sbp_[A-Za-z0-9]{20,}/, "Supabase 열쇠"], [/eyJhbGciOi[A-Za-z0-9_-]{10,}/, "로그인 토큰(JWT)"], [/gh[pousr]_[A-Za-z0-9]{20,}/, "깃허브 토큰"],
  [/github_pat_[A-Za-z0-9_]{20,}/, "깃허브 토큰"], [/sk-[A-Za-z0-9_-]{20,}/, "AI 서비스 열쇠"], [/AKIA[0-9A-Z]{16}/, "AWS 열쇠"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "비밀 열쇠 파일"], [/service_role/i, "관리자 열쇠 이름"], [/(api[_-]?key|secret|password|passwd)\s*[:=]\s*["'][^"']{6,}["']/i, "비밀번호 · 열쇠 값"],
];
// 연습용 주소(127.0.0.1 · localhost)는 안내 문서에 적어도 되지만, 화면(dist)에는 두지 않는다.
const INTERNAL_RES = [/supabase\.co/i, /vercel\.app/i, /\b10\.\d+\.\d+\.\d+\b/, /\b192\.168\.\d+\.\d+\b/];
const LOCAL_RES = [/\b127\.0\.0\.1\b/, /\blocalhost\b/i];
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const EMOJI_RE = /\p{Extended_Pictographic}/u;
const SYMBOL_RE = /[▶▷◀◁▲▼△▽✓✔✕✖✗✘★☆♥♡←→↑↓↗↘◉○●◎■□◆◇]/;
// 액자 안 화면을 다른 주소로 옮기는 코드. 도름스도 판을 받을 때 같은 것을 거절해요.
const SCOPE = String.raw`(?:^|[^\w$.])(?:(?:window|self|document|globalThis|this)\s*\.\s*)*`;
const MOVE_RES = [
  [new RegExp(`${SCOPE}location\\s*(?:\\.\\s*(?:href|host|hostname|protocol|port|search|pathname|hash)\\s*)?(?:\\+)?=(?![=>])`), "location 바꾸기"],
  [new RegExp(`${SCOPE}location\\s*\\.\\s*(?:assign|replace)\\s*\\(`), "location.assign · replace"],
  [/\blocation\s*\[/, "location 바꾸기"],
  [/\bnavigation\s*\.\s*navigate\s*\(/, "navigation.navigate"],
  [/\b(?:window|self|globalThis)\s*\.\s*open\s*\(/, "새 창 열기"],
  [/http-?equiv/i, "자동 이동(refresh)"],
  [/<(?:a|area|form|base)\b[^>]*\b(?:href|action)\s*=\s*["']?\s*(?:https?:)?\/\//i, "바깥 주소로 가는 링크"],
];

const allFiles = walk(root);
for (const file of allFiles) {
  const name = rel(file);
  if (/(^|\/)\.env/.test(name) || /\.(pem|key|p8|p12)$/.test(name)) fail(`열쇠 · 환경 파일은 레포에 두지 마세요: ${name}`);
  if (!TEXT.has(ext(file))) continue;
  const text = fs.readFileSync(file, "utf8");
  const isDist = name.startsWith("dist/");
  const isServeScript = name === "scripts/serve.mjs" || name === "scripts/check.mjs";
  for (const [re, label] of SECRET_RES) if (re.test(text) && name !== "scripts/check.mjs") fail(`${label}처럼 보이는 값이 있어요: ${name}`);
  if (!isServeScript) for (const re of INTERNAL_RES) if (re.test(text)) fail(`내부 주소처럼 보이는 값이 있어요(${re.source}): ${name}`);
  if (isDist) for (const re of LOCAL_RES) if (re.test(text)) fail(`화면(dist)에 연습용 주소가 남아 있어요(${re.source}): ${name}`);
  const emails = (text.match(EMAIL_RE) || []).filter((value) => !/@example\.(org|com)$/i.test(value));
  if (emails.length && name !== "scripts/check.mjs") fail(`전자우편 주소가 있어요(${emails[0]}): ${name}`);
  // 도름스가 주는 SDK 파일은 원본 그대로 둔다(주석까지 고치지 않는다).
  if (name !== "scripts/check.mjs" && name !== "LICENSE" && name !== "dist/dorms-book-sdk.js") {
    if (EMOJI_RE.test(text)) fail(`이모지가 있어요(화면 기호는 SVG 로): ${name}`);
    if (text.includes("—")) fail(`긴 줄표(—)가 있어요(쉼표 · 마침표로 풀어 써 주세요): ${name}`);
  }
  if (isDist) {
    if (SYMBOL_RE.test(text) && !name.endsWith("dorms-book-sdk.js")) fail(`문자 기호가 있어요(화면 기호는 SVG 로): ${name}`);
    for (const [re, label] of MOVE_RES) if (re.test(text) && !name.endsWith("dorms-book-sdk.js")) fail(`화면을 다른 주소로 옮기는 코드(${label})가 있어요. 도름스가 이 판을 받지 않아요: ${name}`);
    { const raw = fs.readFileSync(file); if ((raw[0] === 0xfe && raw[1] === 0xff) || (raw[0] === 0xff && raw[1] === 0xfe) || raw.includes(0)) fail(`글 파일은 UTF-8 로 저장해 주세요. 도름스가 이 판을 받지 않아요: ${name}`); }
    if (/overflow-wrap\s*:\s*anywhere/.test(text)) fail(`overflow-wrap: anywhere 는 글자를 한 글자씩 세로로 쌓이게 해요. break-word 로: ${name}`);
    const urls = (text.match(/https?:\/\/[A-Za-z0-9.-]+/g) || []).filter((url) => url !== "http://www.w3.org");
    if (urls.length) fail(`dist 안에서 바깥 주소를 부르면 도름스가 막아요(${urls[0]}): ${name}`);
  }
}

for (const line of notes) console.log(`  ${line}`);
if (problems.length) {
  console.log(`\n고칠 것 ${problems.length}개`);
  for (const line of problems) console.log(`  - ${line}`);
  process.exit(1);
}
console.log("\n점검 통과: 새 판을 내도 돼요.");
