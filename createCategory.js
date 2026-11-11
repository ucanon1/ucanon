/**
 * blog 하위 디렉터리의 Markdown 문서를 모두 찾아 메뉴 트리를 menu.json 으로 저장한다.
 *
 *   node createCategory.js            → ./menu.json 생성, doc-ids.json(문서 key·ID, 폴더 ID) 갱신,
 *                                       HTML 의 CSS/JS 주소에 버전(?v=해시) 갱신
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
const crypto = require("crypto");
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
      tagline: "a small study library",
      description: "마음에 남은 책, 공부한 기술, 직접 만든 것들을 한 장씩 모아 두는 작은 서재입니다.",
      home: "README",
    },
    generatedAt: new Date().toISOString(),
    docCount: all.length,
    latestUpdated: latest,
    categories,
  };
}

/**
 * index.css · index.js 내용 해시를 HTML 의 자원 주소에 ?v= 로 붙인다.
 * 배포 직후 브라우저·CDN 캐시에 남은 예전 CSS/JS 가 새 HTML 과 섞여 화면이 깨지는 것을 막는다.
 */
function stampAssets() {
  const assets = ["index.css", "index.js"];
  const pages = ["index.html", "content.html", "view.html"];
  const versions = {};
  for (const asset of assets) {
    const data = fs.readFileSync(path.join(ROOT, asset));
    versions[asset] = crypto.createHash("sha1").update(data).digest("hex").slice(0, 10);
  }
  for (const page of pages) {
    const file = path.join(ROOT, page);
    if (!fs.existsSync(file)) continue;
    const before = fs.readFileSync(file, "utf8");
    let after = before;
    for (const asset of assets) {
      const re = new RegExp('((?:href|src)="' + asset.replace(".", "\\.") + ')(?:\\?v=[^"]*)?"', "g");
      after = after.replace(re, '$1?v=' + versions[asset] + '"');
    }
    if (after !== before) fs.writeFileSync(file, after, "utf8");
  }
  return versions;
}

/* --------------------------------------------------------------------------
   문서·폴더 ID 레지스트리 (doc-ids.json)
   - 문서 주소는 #/{key}, 폴더 주소는 #/folder/{id} 로 만든다.
   - key 는 문서가 처음 등록될 때의 내용 해시(16자리)로 정하고 이후 내용이 바뀌어도 고정한다.
     같은 key 가 이미 있으면(빈 파일·복사본) 경로를 섞어 다시 만들어 항상 유일하게 한다.
   - hash 는 현재 내용 해시로, 문서를 고칠 때마다 갱신된다(이름 변경 추적용).
   - 한 번 준 ID·key 는 바꾸거나 재사용하지 않는다.
   - 문서를 옮기거나 이름을 바꿔도 다음 중 하나가 같으면 기존 ID 를 이어받는다.
       1) 내용 해시가 같다(이름만 바꾼 경우)   2) 파일 이름이 같다(폴더만 옮긴 경우)
     둘 다 바뀌면 새 문서로 보고 새 ID 를 준다.
   - 지운 문서의 ID 는 retired 에 해시와 함께 남겨, 같은 내용이 돌아오면 되살린다.
   -------------------------------------------------------------------------- */

const REGISTRY_FILE = path.join(ROOT, "doc-ids.json");

function loadRegistry() {
  try {
    const reg = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
    return {
      nextDocId: reg.nextDocId || 1,
      nextFolderId: reg.nextFolderId || 1,
      docs: reg.docs || {},
      folders: reg.folders || {},
      retired: reg.retired || {},
    };
  } catch (_) {
    return { nextDocId: 1, nextFolderId: 1, docs: {}, folders: {}, retired: {} };
  }
}

function saveRegistry(reg) {
  const sortObj = (obj, key) =>
    Object.fromEntries(Object.entries(obj).sort((a, b) => (key ? key(a[1]) - key(b[1]) : 0) || collator.compare(a[0], b[0])));
  const out = {
    _comment: "createCategory.js 가 관리하는 문서·폴더 ID 목록입니다. 한 번 부여한 ID 는 바뀌지 않도록 직접 수정하지 마세요.",
    nextDocId: reg.nextDocId,
    nextFolderId: reg.nextFolderId,
    docs: Object.fromEntries(Object.entries(sortObj(reg.docs, (v) => v.id)).map(([p, v]) => [p, { id: v.id, key: v.key, hash: v.hash }])),
    folders: sortObj(reg.folders, (v) => v),
    retired: reg.retired,
  };
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(out, null, 2) + "\n", "utf8");
}

function contentHash(docPath) {
  const data = fs.readFileSync(path.join(ROOT, docPath + ".md"));
  return crypto.createHash("sha1").update(data).digest("hex").slice(0, 16);
}

function flattenFolders(nodes, out = []) {
  for (const node of nodes) {
    if (node.type === "folder") {
      out.push(node);
      flattenFolders(node.children, out);
    }
  }
  return out;
}

function sha16(text) {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 16);
}

/** 문서 주소용 고정 key. 처음 본 내용 해시를 쓰되, 이미 쓰인 값이면 경로를 섞어 다시 만든다. */
function newKey(hash, docPath, taken) {
  let key = hash;
  for (let n = 1; taken.has(key); n++) key = sha16(hash + "|" + docPath + "|" + n);
  return key;
}

/** menu 의 모든 문서·폴더에 id 를 붙이고 레지스트리를 갱신한다. 반환값: 새로 만든 ID 수 */
function assignIds(menu, reg) {
  const docs = flattenDocs(menu.categories);
  const livePaths = new Set(docs.map((d) => d.path));
  // 사라진 경로(옮겨졌거나 지워진 문서) — 이어받기 후보
  const orphans = Object.entries(reg.docs)
    .filter(([p]) => !livePaths.has(p))
    .map(([p, v]) => ({ path: p, id: v.id, hash: v.hash, name: p.slice(p.lastIndexOf("/") + 1) }));
  const used = new Set(Object.entries(reg.docs).filter(([p]) => livePaths.has(p)).map(([, v]) => v.id));
  // 예전 레지스트리(key 없음)는 현재 내용 해시를 key 로 고정한다.
  const takenKeys = new Set();
  for (const v of Object.values(reg.docs)) if (v.key) takenKeys.add(v.key);
  for (const v of Object.values(reg.retired)) if (v && v.key) takenKeys.add(v.key);
  for (const [p, v] of Object.entries(reg.docs)) {
    if (!v.key && v.hash) {
      v.key = newKey(v.hash, p, takenKeys);
      takenKeys.add(v.key);
    }
  }
  let created = 0;

  for (const doc of docs) {
    const hash = contentHash(doc.path);
    let entry = reg.docs[doc.path];
    if (!entry) {
      const name = doc.path.slice(doc.path.lastIndexOf("/") + 1);
      const match =
        orphans.find((o) => !used.has(o.id) && o.hash === hash) ||
        orphans.find((o) => !used.has(o.id) && o.name === name);
      const retired = reg.retired[hash];
      const retiredId = retired && typeof retired === "object" ? retired.id : retired;
      if (match) {
        entry = { id: match.id, key: reg.docs[match.path].key };
        delete reg.docs[match.path];
      } else if (retiredId && !used.has(retiredId)) {
        entry = { id: retiredId, key: retired.key };
        delete reg.retired[hash];
      } else {
        entry = { id: reg.nextDocId++ };
        created++;
      }
      if (!entry.key) {
        entry.key = newKey(hash, doc.path, takenKeys);
        takenKeys.add(entry.key);
      }
    }
    entry.hash = hash;
    reg.docs[doc.path] = entry;
    used.add(entry.id);
    doc.id = String(entry.id);
    doc.key = entry.key;
  }

  // 남은 고아 문서는 지워진 것으로 보고 retired 로 옮긴다.
  for (const [p, v] of Object.entries(reg.docs)) {
    if (!livePaths.has(p)) {
      if (v.hash) reg.retired[v.hash] = { id: v.id, key: v.key };
      delete reg.docs[p];
    }
  }

  // 폴더: 경로 기준. 지워진 폴더 ID 는 재사용하지 않는다.
  const folders = flattenFolders(menu.categories);
  const liveFolders = new Set(folders.map((f) => f.path));
  for (const folder of folders) {
    if (!reg.folders[folder.path]) {
      reg.folders[folder.path] = reg.nextFolderId++;
      created++;
    }
    folder.id = String(reg.folders[folder.path]);
  }
  for (const p of Object.keys(reg.folders)) if (!liveFolders.has(p)) delete reg.folders[p];

  return created;
}

function main() {
  const menu = buildMenu();
  const registry = loadRegistry();
  const createdIds = assignIds(menu, registry);
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
  saveRegistry(registry);
  if (createdIds) console.log(`새 ID ${createdIds}개 부여 — doc-ids.json 갱신`);
  const v = stampAssets();
  console.log("자원 버전 갱신 — index.css?v=" + v["index.css"] + ", index.js?v=" + v["index.js"]);
  console.log(`menu.json 저장 완료 — 문서 ${menu.docCount}개, 카테고리 ${menu.categories.length}개`);
}

main();
