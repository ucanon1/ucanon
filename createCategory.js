/**
 * blog 하위 디렉터리의 Markdown 문서를 모두 찾아 메뉴 트리를 menu.json 으로 저장한다.
 *
 *   node createCategory.js            → ./menu.json 생성
 *   node createCategory.js --check    → 변경 여부만 확인(종료 코드 1 이면 갱신 필요)
 *
 * 규칙
 *   - 폴더 구조가 그대로 트리가 된다. (blog/IT/Web/… → IT › Web › …)
 *   - 이름이 "_" 로 시작하는 문서(초안)와 "." 로 시작하는 폴더는 제외한다.
 *   - 문서가 하나도 없는 폴더는 메뉴에 넣지 않는다.
 *   - 폴더 먼저, 그다음 문서를 한국어 로캘 순으로 정렬한다.
 *   - 문서의 updated 는 파일 수정 시각(YYYY-MM-DD)이다. 홈의 "최근 수정" 목록에 쓴다.
 *
 * index.html 은 이 파일을 fetch 해서 사이드바 트리·검색·홈 화면을 만든다.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname);
const BLOG_DIR = path.join(ROOT, "blog");
const OUT_FILE = path.join(ROOT, "menu.json");

const collator = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function isoDate(stat) {
  return stat.mtime.toISOString().slice(0, 10);
}

/** 폴더 하나를 읽어 { folders, docs } 로 나눈다. */
function readFolder(absDir) {
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  const folders = [];
  const docs = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const abs = path.join(absDir, entry.name);

    if (entry.isDirectory()) {
      const child = buildFolder(abs);
      if (child) folders.push(child);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      const title = entry.name.slice(0, -3);
      if (title.startsWith("_")) continue; // 초안
      const stat = fs.statSync(abs);
      docs.push({
        type: "doc",
        title,
        path: toPosix(path.relative(ROOT, abs)).replace(/\.md$/i, ""),
        updated: isoDate(stat),
        size: stat.size,
      });
    }
  }

  folders.sort((a, b) => collator.compare(a.name, b.name));
  docs.sort((a, b) => collator.compare(a.title, b.title));
  return { folders, docs };
}

function countDocs(node) {
  if (node.type === "doc") return 1;
  return node.children.reduce((sum, child) => sum + countDocs(child), 0);
}

function buildFolder(absDir) {
  const { folders, docs } = readFolder(absDir);
  const children = [...folders, ...docs];
  if (children.length === 0) return null;
  const node = {
    type: "folder",
    name: path.basename(absDir),
    path: toPosix(path.relative(ROOT, absDir)),
    children,
  };
  node.count = countDocs(node);
  return node;
}

function flattenDocs(nodes, out = []) {
  for (const node of nodes) {
    if (node.type === "doc") out.push(node);
    else flattenDocs(node.children, out);
  }
  return out;
}

function buildMenu() {
  const { folders, docs } = readFolder(BLOG_DIR);
  const categories = [...folders, ...docs];
  const all = flattenDocs(categories);
  const latest = all.reduce((max, d) => (d.updated > max ? d.updated : max), "");

  return {
    site: {
      title: "UCANON.COM",
      tagline: "personal study notes",
      description: "개인 공부 기록을 나누는 공간입니다. 책, IT, 프로젝트, 공부 노트를 모아 둡니다.",
      home: "README",
    },
    generatedAt: new Date().toISOString(),
    docCount: all.length,
    latestUpdated: latest,
    categories,
  };
}

function main() {
  const menu = buildMenu();
  const json = JSON.stringify(menu, null, 2) + "\n";

  if (process.argv.includes("--check")) {
    let current = "";
    try { current = fs.readFileSync(OUT_FILE, "utf8"); } catch (_) { /* 없음 */ }
    const strip = (s) => s.replace(/"generatedAt": "[^"]*"/, "");
    if (strip(current) === strip(json)) {
      console.log("menu.json 은 최신입니다.");
      process.exit(0);
    }
    console.log("menu.json 갱신이 필요합니다. `node createCategory.js` 를 실행하세요.");
    process.exit(1);
  }

  fs.writeFileSync(OUT_FILE, json, "utf8");
  console.log(`menu.json 저장 완료 — 문서 ${menu.docCount}개, 카테고리 ${menu.categories.length}개`);
}

main();
