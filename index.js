/* ==========================================================================
   UCANON.COM — index.js
   메뉴(menu.json) 로딩 · 사이드바 트리 · 검색(초성 지원) · 명령 팔레트 · 해시 라우팅 ·
   Markdown 뷰어(Toast UI) · 문서 목차 · 테마 전환 · 모바일 드로어
   의존성: toastui-editor-viewer, code-syntax-highlight 플러그인 (jQuery 없음)
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     0. 유틸
     ------------------------------------------------------------------------ */

  const $ = (id) => document.getElementById(id);

  const STORAGE = {
    theme: "ucanon.theme",
    expanded: "ucanon.tree.expanded",
    recent: "ucanon.recent",
  };

  function readStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      /* 사생활 보호 모드 등 — 저장 실패는 무시 */
    }
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function icon(name, size) {
    const s = size || 16;
    return `<svg width="${s}" height="${s}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  }

  function debounce(fn, wait) {
    let timer = null;
    return function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(null, args), wait);
    };
  }

  /** 문서 경로("blog/Book/담론") → 해시 링크("#blog/Book/담론") */
  function hrefFor(path) {
    return "#" + path;
  }

  /** 해시에서 현재 경로를 읽는다. 과거 링크(/#blog/…)와 호환. */
  function currentPath() {
    const raw = location.hash.replace(/^#\/?/, "");
    try {
      return decodeURIComponent(raw);
    } catch (_) {
      return raw;
    }
  }

  function navigate(path) {
    const target = hrefFor(path || "");
    if (location.hash === target || (!path && !location.hash)) {
      route();
    } else {
      location.hash = target;
    }
  }

  /* -- 한글 초성 --------------------------------------------------------------- */

  const CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

  /** 한 글자마다 한 글자가 대응되도록 초성 문자열을 만든다(하이라이트 위치 계산용). */
  function toChosung(text) {
    let out = "";
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      if (code >= 0xac00 && code <= 0xd7a3) {
        out += CHO[Math.floor((code - 0xac00) / 588)];
      } else {
        out += ch.toLowerCase();
      }
    }
    return out;
  }

  function isChosungQuery(token) {
    return /^[ㄱ-ㅎ]+$/.test(token);
  }

  /* ------------------------------------------------------------------------
     1. 상태 · DOM 참조
     ------------------------------------------------------------------------ */

  const state = {
    menu: null,
    docs: [], // 트리 순서의 평탄화 목록
    byPath: new Map(), // path → doc
    folders: new Map(), // path → folder (parent 포함)
    expanded: new Set(readStore(STORAGE.expanded, [])),
    current: null, // 열린 문서 path
    viewer: null,
    homeViewer: null,
    outlineObserver: null,
    palette: { open: false, index: 0, items: [] },
    sidebarSearch: { index: -1, items: [] },
    homeSearch: { index: -1, items: [] },
  };

  const els = {
    app: $("app"),
    sidebar: $("sidebar"),
    sidebarClose: $("sidebarClose"),
    scrim: $("scrim"),
    menuButton: $("menuButton"),
    treeSearchBox: $("treeSearchBox"),
    treeSearch: $("treeSearch"),
    treeSearchClear: $("treeSearchClear"),
    treeScroll: $("treeScroll"),
    treeLabelRow: $("treeLabelRow"),
    tree: $("tree"),
    treeResults: $("treeResults"),
    treeExpandAll: $("treeExpandAll"),
    treeCollapseAll: $("treeCollapseAll"),
    treeFootCount: $("treeFootCount"),
    treeFootUpdated: $("treeFootUpdated"),
    breadcrumb: $("breadcrumb"),
    commandTrigger: $("commandTrigger"),
    themeToggle: $("themeToggle"),
    workspaceBody: $("workspaceBody"),
    reader: $("reader"),
    home: $("home"),
    folder: $("folder"),
    document: $("document"),
    docKicker: $("docKicker"),
    docMeta: $("docMeta"),
    copyLink: $("copyLink"),
    rawLink: $("rawLink"),
    viewer: $("viewer"),
    pager: $("pager"),
    readerState: $("readerState"),
    outline: $("outline"),
    outlineList: $("outlineList"),
    commandScrim: $("commandScrim"),
    commandInput: $("commandInput"),
    commandOptions: $("commandOptions"),
    footerYear: $("footerYear"),
  };

  const hasSidebar = Boolean(els.tree);

  /* ------------------------------------------------------------------------
     2. 테마
     ------------------------------------------------------------------------ */

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    // index.html 의 부트 스크립트가 따옴표 없는 원문을 읽으므로 JSON 으로 감싸지 않는다.
    try { localStorage.setItem(STORAGE.theme, theme); } catch (_) { /* 저장 실패 무시 */ }
    if (els.themeToggle) {
      const label = theme === "dark" ? "밝은 테마로 전환" : "어두운 테마로 전환";
      els.themeToggle.setAttribute("aria-label", label);
      els.themeToggle.title = label;
    }
  }

  if (els.themeToggle) {
    applyTheme(currentTheme());
    els.themeToggle.addEventListener("click", () => {
      applyTheme(currentTheme() === "dark" ? "light" : "dark");
    });
  }

  /* ------------------------------------------------------------------------
     3. 메뉴 색인
     ------------------------------------------------------------------------ */

  function indexMenu(menu) {
    state.docs = [];
    state.byPath.clear();
    state.folders.clear();

    const walk = (nodes, crumbs, parent) => {
      for (const node of nodes) {
        if (node.type === "folder") {
          const folder = Object.assign({}, node, { crumbs, parent: parent ? parent.path : null, depth: crumbs.length });
          state.folders.set(node.path, folder);
          walk(node.children, crumbs.concat([{ name: node.name, path: node.path }]), folder);
        } else {
          const doc = Object.assign({}, node, {
            crumbs,
            folderPath: parent ? parent.path : "",
            folderName: parent ? parent.name : "",
            titleLower: node.title.toLowerCase(),
            titleCho: toChosung(node.title),
            titleCompact: node.title.toLowerCase().replace(/[\s_\-.,()]/g, ""),
            pathLower: node.path.toLowerCase(),
            pathCho: toChosung(node.path),
          });
          state.docs.push(doc);
          state.byPath.set(node.path, doc);
        }
      }
    };
    walk(menu.categories, [], null);
  }

  /* ------------------------------------------------------------------------
     4. 검색 (제목 · 경로 · 초성)
     ------------------------------------------------------------------------ */

  /**
   * 토큰 하나를 제목에 맞춰 본다. 매치되면 { score, start, len } 를 돌려 준다.
   * 우선순위: 제목 접두 > 제목 포함 > 초성 접두 > 초성 포함 > 공백·기호 무시 포함
   */
  function matchTitle(doc, token) {
    const plain = doc.titleLower.indexOf(token);
    if (plain === 0) return { score: 40, start: 0, len: token.length };
    if (plain > 0) {
      const wordStart = /[\s_\-(]/.test(doc.titleLower[plain - 1]);
      return { score: wordStart ? 30 : 22, start: plain, len: token.length };
    }
    if (isChosungQuery(token)) {
      const cho = doc.titleCho.indexOf(token);
      if (cho === 0) return { score: 26, start: 0, len: token.length };
      if (cho > 0) return { score: 16, start: cho, len: token.length };
    }
    const compactToken = token.replace(/[\s_\-.,()]/g, "");
    if (compactToken && doc.titleCompact.indexOf(compactToken) >= 0) {
      return { score: 12, start: -1, len: 0 };
    }
    return null;
  }

  function matchPath(doc, token) {
    if (doc.pathLower.indexOf(token) >= 0) return 6;
    if (isChosungQuery(token) && doc.pathCho.indexOf(token) >= 0) return 4;
    return 0;
  }

  /**
   * 문서 검색. 공백으로 나눈 토큰이 모두 제목 또는 경로에 맞아야 한다.
   * 반환: [{ doc, score, ranges:[{start,len}] }] (점수 내림차순)
   */
  function searchDocs(query, limit) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    const results = [];

    for (const doc of state.docs) {
      let score = 0;
      const ranges = [];
      let ok = true;
      for (const token of tokens) {
        const t = matchTitle(doc, token);
        if (t) {
          score += t.score;
          if (t.start >= 0) ranges.push({ start: t.start, len: t.len });
          continue;
        }
        const p = matchPath(doc, token);
        if (p) {
          score += p;
          continue;
        }
        ok = false;
        break;
      }
      if (!ok) continue;
      // 짧은 제목 · 최근 문서에 소폭 가산
      score += Math.max(0, 8 - doc.title.length / 6);
      if (doc.updated >= "2025-01-01") score += 1;
      results.push({ doc, score, ranges });
    }

    results.sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title, "ko"));
    return typeof limit === "number" ? results.slice(0, limit) : results;
  }

  /** 폴더 이름 검색(경로 탐색 보조). */
  function searchFolders(query, limit) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    const out = [];
    for (const folder of state.folders.values()) {
      const nameLower = folder.name.toLowerCase();
      const nameCho = toChosung(folder.name);
      const ok = tokens.every((t) => nameLower.indexOf(t) >= 0 || (isChosungQuery(t) && nameCho.indexOf(t) >= 0));
      if (ok) out.push(folder);
    }
    return out.slice(0, limit || 5);
  }

  function highlight(text, ranges) {
    if (!ranges || !ranges.length) return escapeHtml(text);
    const marks = new Array(text.length).fill(false);
    for (const r of ranges) {
      for (let i = r.start; i < Math.min(text.length, r.start + r.len); i++) marks[i] = true;
    }
    let html = "";
    let open = false;
    for (let i = 0; i < text.length; i++) {
      if (marks[i] && !open) {
        html += "<mark>";
        open = true;
      } else if (!marks[i] && open) {
        html += "</mark>";
        open = false;
      }
      html += escapeHtml(text[i]);
    }
    if (open) html += "</mark>";
    return html;
  }

  function breakableName(name) {
    return escapeHtml(name)
      .replace(/([_-])/g, "$1<wbr>")
      .replace(/([a-z])([A-Z])/g, "$1<wbr>$2");
  }

  function crumbsLabel(doc) {
    return doc.crumbs.map((c) => c.name).join(" › ");
  }

  /** 검색 결과 목록 HTML (사이드바 · 홈 공용) */
  function renderResultList(results, folders, selectedIndex) {
    let html = '<ul class="search-list" role="listbox">';
    let i = 0;
    for (const folder of folders || []) {
      const sel = i === selectedIndex ? " selected" : "";
      html += `<li role="option" aria-selected="${i === selectedIndex}"><a class="result${sel}" href="${escapeHtml(hrefFor(folder.path))}" data-index="${i}">${icon("folder", 15)}<span><strong>${escapeHtml(folder.name)}</strong><small>폴더 · 문서 ${folder.count}개${folder.crumbs.length ? " · " + escapeHtml(folder.crumbs.map((c) => c.name).join(" › ")) : ""}</small></span></a></li>`;
      i++;
    }
    for (const r of results) {
      const sel = i === selectedIndex ? " selected" : "";
      html += `<li role="option" aria-selected="${i === selectedIndex}"><a class="result${sel}" href="${escapeHtml(hrefFor(r.doc.path))}" data-index="${i}">${icon("file", 15)}<span><strong>${highlight(r.doc.title, r.ranges)}</strong><small>${escapeHtml(crumbsLabel(r.doc))} · ${escapeHtml(r.doc.updated)}</small></span></a></li>`;
      i++;
    }
    html += "</ul>";
    return html;
  }

  function renderEmptyResults(query) {
    return `<div class="search-empty">${icon("search", 22)}<div>"<strong>${escapeHtml(query)}</strong>" 에 맞는 문서가 없습니다.<br />제목·경로 일부나 초성(예: ㄷㄹ)으로 다시 찾아보세요.</div></div>`;
  }

  /* ------------------------------------------------------------------------
     5. 사이드바 트리
     ------------------------------------------------------------------------ */

  function renderTree() {
    if (!hasSidebar) return;
    const build = (nodes, depth) => {
      let html = "";
      for (const node of nodes) {
        if (node.type === "folder") {
          const expanded = state.expanded.has(node.path);
          html += `<li role="treeitem" aria-expanded="${expanded}" data-path="${escapeHtml(node.path)}" data-type="folder">`;
          html += `<a class="tree-row folder" href="${escapeHtml(hrefFor(node.path))}" tabindex="-1" data-path="${escapeHtml(node.path)}">`;
          html += `<span class="tree-caret" data-toggle="1" aria-hidden="true">${icon("chevron", 14)}</span>`;
          html += `${icon("folder", 16)}<span>${breakableName(node.name)}</span><span class="tree-count">${node.count}</span></a>`;
          html += `<ul role="group">${build(node.children, depth + 1)}</ul></li>`;
        } else {
          html += `<li role="treeitem" aria-selected="false" data-path="${escapeHtml(node.path)}" data-type="doc">`;
          html += `<a class="tree-row doc" href="${escapeHtml(hrefFor(node.path))}" tabindex="-1" data-path="${escapeHtml(node.path)}">${icon("file", 15)}<span>${escapeHtml(node.title)}</span></a></li>`;
        }
      }
      return html;
    };
    els.tree.innerHTML = build(state.menu.categories, 0);
    const first = els.tree.querySelector(".tree-row");
    if (first) first.tabIndex = 0;

    els.treeFootCount.textContent = `문서 ${state.menu.docCount}개`;
    els.treeFootUpdated.textContent = state.menu.latestUpdated ? `updated ${state.menu.latestUpdated}` : "";
  }

  function saveExpanded() {
    writeStore(STORAGE.expanded, Array.from(state.expanded));
  }

  function setExpanded(path, expanded) {
    if (!hasSidebar) return;
    const li = els.tree.querySelector(`li[data-type="folder"][data-path="${cssEscape(path)}"]`);
    if (!li) return;
    li.setAttribute("aria-expanded", String(expanded));
    if (expanded) state.expanded.add(path);
    else state.expanded.delete(path);
  }

  function toggleFolder(path) {
    setExpanded(path, !state.expanded.has(path));
    saveExpanded();
  }

  function expandAncestors(path) {
    const node = state.byPath.get(path) || state.folders.get(path);
    if (!node) return;
    for (const crumb of node.crumbs) setExpanded(crumb.path, true);
    if (node.type === "folder") setExpanded(node.path, true);
    saveExpanded();
  }

  function cssEscape(value) {
    return window.CSS && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
  }

  function markActive(path) {
    if (!hasSidebar) return;
    els.tree.querySelectorAll(".tree-row.active").forEach((el) => el.classList.remove("active"));
    els.tree.querySelectorAll('li[aria-selected="true"]').forEach((el) => el.setAttribute("aria-selected", "false"));
    if (!path) return;
    const row = els.tree.querySelector(`.tree-row[data-path="${cssEscape(path)}"]`);
    if (!row) return;
    row.classList.add("active");
    const li = row.parentElement;
    if (li.dataset.type === "doc") li.setAttribute("aria-selected", "true");
    setRovingFocus(row, false);
    // 검색 중이 아닐 때만 트리에서 위치를 맞춘다.
    if (els.treeResults.hidden) {
      requestAnimationFrame(() => row.scrollIntoView({ block: "nearest" }));
    }
  }

  function visibleRows() {
    return Array.from(els.tree.querySelectorAll(".tree-row")).filter((row) => row.offsetParent !== null);
  }

  function setRovingFocus(row, focus) {
    els.tree.querySelectorAll('.tree-row[tabindex="0"]').forEach((el) => (el.tabIndex = -1));
    row.tabIndex = 0;
    if (focus) row.focus();
  }

  function onTreeClick(event) {
    const caret = event.target.closest("[data-toggle]");
    const row = event.target.closest(".tree-row");
    if (!row) return;
    const path = row.dataset.path;
    if (caret) {
      event.preventDefault();
      toggleFolder(path);
      setRovingFocus(row, true);
      return;
    }
    if (row.classList.contains("folder")) {
      // 이름을 누르면 폴더 화면으로 가고, 접혀 있던 폴더는 펼친다.
      if (!state.expanded.has(path)) {
        setExpanded(path, true);
        saveExpanded();
      }
    }
    // 문서/폴더 이동은 해시 링크가 처리한다. 모바일에서는 드로어를 닫는다.
    closeDrawer();
  }

  function onTreeKeydown(event) {
    const row = event.target.closest(".tree-row");
    if (!row) return;
    const rows = visibleRows();
    const index = rows.indexOf(row);
    const isFolder = row.classList.contains("folder");
    const path = row.dataset.path;
    let next = null;

    switch (event.key) {
      case "ArrowDown":
        next = rows[Math.min(rows.length - 1, index + 1)];
        break;
      case "ArrowUp":
        next = rows[Math.max(0, index - 1)];
        break;
      case "Home":
        next = rows[0];
        break;
      case "End":
        next = rows[rows.length - 1];
        break;
      case "ArrowRight":
        if (isFolder) {
          if (!state.expanded.has(path)) {
            setExpanded(path, true);
            saveExpanded();
          } else {
            next = rows[index + 1];
          }
        }
        break;
      case "ArrowLeft":
        if (isFolder && state.expanded.has(path)) {
          setExpanded(path, false);
          saveExpanded();
        } else {
          const parentLi = row.parentElement.parentElement.closest("li[data-type='folder']");
          if (parentLi) next = parentLi.querySelector(".tree-row");
        }
        break;
      case "Enter":
      case " ":
        if (isFolder && event.key === " ") {
          toggleFolder(path);
        } else {
          navigate(path);
          closeDrawer();
        }
        break;
      case "*":
        els.tree.querySelectorAll("li[data-type='folder']").forEach((li) => setExpanded(li.dataset.path, true));
        saveExpanded();
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next) setRovingFocus(next, true);
  }

  function expandAll(expanded) {
    els.tree.querySelectorAll("li[data-type='folder']").forEach((li) => setExpanded(li.dataset.path, expanded));
    saveExpanded();
  }

  /* -- 사이드바 검색 ----------------------------------------------------------- */

  function runSidebarSearch() {
    const query = els.treeSearch.value;
    els.treeSearchBox.classList.toggle("has-value", query.length > 0);

    if (!query.trim()) {
      els.treeResults.hidden = true;
      els.treeResults.innerHTML = "";
      els.tree.hidden = false;
      els.treeLabelRow.hidden = false;
      state.sidebarSearch = { index: -1, items: [] };
      return;
    }

    const folders = searchFolders(query, 3);
    const results = searchDocs(query, 60);
    state.sidebarSearch = { index: results.length + folders.length ? 0 : -1, items: folders.map((f) => f.path).concat(results.map((r) => r.doc.path)) };

    let html = `<div class="search-summary"><span>검색 결과 <strong>${results.length + folders.length}</strong>개</span><span>Enter 로 열기</span></div>`;
    html += results.length || folders.length ? renderResultList(results, folders, state.sidebarSearch.index) : renderEmptyResults(query);
    els.treeResults.innerHTML = html;
    els.treeResults.hidden = false;
    els.tree.hidden = true;
    els.treeLabelRow.hidden = true;
    els.treeScroll.scrollTop = 0;
  }

  function moveSidebarSelection(delta) {
    const s = state.sidebarSearch;
    if (!s.items.length) return;
    s.index = (s.index + delta + s.items.length) % s.items.length;
    const links = els.treeResults.querySelectorAll("a.result");
    links.forEach((a, i) => {
      a.classList.toggle("selected", i === s.index);
      a.parentElement.setAttribute("aria-selected", String(i === s.index));
    });
    const sel = links[s.index];
    if (sel) sel.scrollIntoView({ block: "nearest" });
  }

  function clearSidebarSearch(focusInput) {
    els.treeSearch.value = "";
    runSidebarSearch();
    if (focusInput) els.treeSearch.focus();
  }

  function onSidebarSearchKeydown(event) {
    const s = state.sidebarSearch;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSidebarSelection(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSidebarSelection(-1);
    } else if (event.key === "Enter") {
      if (s.index >= 0 && s.items[s.index]) {
        event.preventDefault();
        navigate(s.items[s.index]);
        clearSidebarSearch(false);
        closeDrawer();
      }
    } else if (event.key === "Escape") {
      if (els.treeSearch.value) {
        event.preventDefault();
        event.stopPropagation();
        clearSidebarSearch(true);
      } else {
        els.treeSearch.blur();
      }
    }
  }

  /* ------------------------------------------------------------------------
     6. 명령 팔레트 (Ctrl+K)
     ------------------------------------------------------------------------ */

  function recentDocs() {
    const paths = readStore(STORAGE.recent, []);
    return paths.map((p) => state.byPath.get(p)).filter(Boolean);
  }

  function pushRecent(path) {
    const list = readStore(STORAGE.recent, []).filter((p) => p !== path);
    list.unshift(path);
    writeStore(STORAGE.recent, list.slice(0, 8));
  }

  function openPalette(initialQuery) {
    if (!els.commandScrim) return;
    state.palette.open = true;
    els.commandScrim.hidden = false;
    els.commandInput.value = initialQuery || "";
    renderPalette();
    requestAnimationFrame(() => {
      els.commandInput.focus();
      els.commandInput.select();
    });
    closeDrawer();
  }

  function closePalette() {
    if (!els.commandScrim || !state.palette.open) return;
    state.palette.open = false;
    els.commandScrim.hidden = true;
    els.commandInput.value = "";
  }

  function renderPalette() {
    const query = els.commandInput.value;
    const sections = [];

    if (!query.trim()) {
      const recent = recentDocs();
      if (recent.length) {
        sections.push({ label: "최근 본 문서", items: recent.map((d) => ({ doc: d, ranges: [] })) });
      }
      sections.push({
        label: "카테고리",
        items: state.menu.categories.filter((c) => c.type === "folder").map((c) => ({ folder: state.folders.get(c.path) })),
      });
    } else {
      const results = searchDocs(query, 40);
      const folders = searchFolders(query, 3);
      if (folders.length) sections.push({ label: "폴더", items: folders.map((f) => ({ folder: f })) });
      sections.push({ label: `문서 ${results.length}개`, items: results });
    }

    const flat = [];
    let html = "";
    for (const section of sections) {
      if (!section.items.length) continue;
      html += `<div class="command-section"><span>${escapeHtml(section.label)}</span>`;
      for (const item of section.items) {
        const i = flat.length;
        flat.push(item);
        if (item.folder) {
          html += `<a href="${escapeHtml(hrefFor(item.folder.path))}" role="option" data-index="${i}" aria-selected="false">${icon("folder", 18)}<div><strong>${escapeHtml(item.folder.name)}</strong><small>폴더 · 문서 ${item.folder.count}개</small></div><span class="command-date"></span></a>`;
        } else {
          html += `<a href="${escapeHtml(hrefFor(item.doc.path))}" role="option" data-index="${i}" aria-selected="false">${icon("file", 18)}<div><strong>${highlight(item.doc.title, item.ranges)}</strong><small>${escapeHtml(crumbsLabel(item.doc))}</small></div><span class="command-date">${escapeHtml(item.doc.updated)}</span></a>`;
        }
      }
      html += "</div>";
    }
    if (!flat.length) {
      html = `<div class="command-empty">"${escapeHtml(query)}" 에 맞는 문서가 없습니다.<br />제목·경로 일부나 초성(예: ㅈㅅ)으로 찾아보세요.</div>`;
    }

    state.palette.items = flat;
    state.palette.index = 0;
    els.commandOptions.innerHTML = html;
    setPaletteSelection(0);
  }

  function setPaletteSelection(index) {
    const options = els.commandOptions.querySelectorAll("[role='option']");
    if (!options.length) return;
    state.palette.index = (index + options.length) % options.length;
    options.forEach((el, i) => el.setAttribute("aria-selected", String(i === state.palette.index)));
    options[state.palette.index].scrollIntoView({ block: "nearest" });
  }

  function onPaletteKeydown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setPaletteSelection(state.palette.index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setPaletteSelection(state.palette.index - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = state.palette.items[state.palette.index];
      if (!item) return;
      navigate(item.folder ? item.folder.path : item.doc.path);
      closePalette();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closePalette();
    }
  }

  /* ------------------------------------------------------------------------
     7. 모바일 드로어
     ------------------------------------------------------------------------ */

  function openDrawer() {
    if (!hasSidebar) return;
    els.sidebar.classList.add("mobile-open");
    els.scrim.hidden = false;
    els.menuButton.setAttribute("aria-expanded", "true");
  }

  function closeDrawer() {
    if (!hasSidebar || !els.sidebar.classList.contains("mobile-open")) return;
    els.sidebar.classList.remove("mobile-open");
    els.scrim.hidden = true;
    els.menuButton.setAttribute("aria-expanded", "false");
  }

  /* ------------------------------------------------------------------------
     8. 토스트
     ------------------------------------------------------------------------ */

  let toastTimer = null;
  function toast(message) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.innerHTML = `<span>${icon("check", 14)}</span>${escapeHtml(message)}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2200);
  }

  /* ------------------------------------------------------------------------
     9. Markdown 뷰어
     ------------------------------------------------------------------------ */

  function imageRenderer(node, context) {
    const { getChildrenText, skipChildren } = context;
    skipChildren();
    let src = node.destination || "";
    if (!/^(?:[a-z]+:|\/|#)/i.test(src) && state.current) {
      const dir = state.current.slice(0, state.current.lastIndexOf("/") + 1);
      src = "/" + encodeURI(dir) + src;
    }
    const attributes = { src, alt: getChildrenText(node), loading: "lazy" };
    if (node.title) attributes.title = node.title;
    return { type: "openTag", tagName: "img", selfClose: true, attributes };
  }

  function createViewer(el) {
    const Viewer = window.toastui && window.toastui.Editor;
    if (!Viewer) return null;
    const plugins = Viewer.plugin && Viewer.plugin.codeSyntaxHighlight ? [Viewer.plugin.codeSyntaxHighlight] : [];
    return new Viewer({
      el,
      initialValue: "",
      plugins,
      linkAttribute: { target: "_blank", rel: "noopener" },
      customHTMLRenderer: { image: imageRenderer },
    });
  }

  function getViewer() {
    if (!state.viewer) state.viewer = createViewer(els.viewer);
    return state.viewer;
  }

  async function fetchMarkdown(path) {
    const response = await fetch("/" + encodeURI(path) + ".md", { cache: "no-cache" });
    if (!response.ok) {
      const error = new Error("HTTP " + response.status);
      error.status = response.status;
      throw error;
    }
    return response.text();
  }

  /* ------------------------------------------------------------------------
     10. 화면 전환 · 라우터
     ------------------------------------------------------------------------ */

  function showOnly(view) {
    for (const name of ["home", "folder", "document", "readerState"]) {
      if (els[name]) els[name].hidden = name !== view;
    }
    if (view !== "document") clearOutline();
  }

  function setTitle(text) {
    document.title = text ? `${text} · UCANON.COM` : "UCANON.COM";
  }

  function renderBreadcrumb(crumbs, current) {
    if (!els.breadcrumb) return;
    let html = `<a href="#" data-route="" aria-label="홈">${icon("home", 15)}</a>`;
    for (const crumb of crumbs) {
      html += `<span class="crumb-sep" aria-hidden="true">${icon("chevron", 12)}</span><a href="${escapeHtml(hrefFor(crumb.path))}">${escapeHtml(crumb.name)}</a>`;
    }
    if (current) {
      html += `<span class="crumb-sep" aria-hidden="true">${icon("chevron", 12)}</span><span class="crumb-current" aria-current="page">${escapeHtml(current)}</span>`;
    }
    els.breadcrumb.innerHTML = html;
  }

  function renderState(kind, path) {
    if (kind === "loading") {
      els.readerState.innerHTML = `<div class="spinner" aria-hidden="true"></div><p>문서를 불러오는 중…</p>`;
    } else if (kind === "notfound") {
      els.readerState.innerHTML = `${icon("alert", 34)}<h2>문서를 찾을 수 없습니다</h2><p><code>${escapeHtml(path)}</code> 에 해당하는 문서가 없습니다. 이름이 바뀌었거나 옮겨졌을 수 있습니다.</p><div class="actions"><a class="pill-button primary" href="#">${icon("home", 14)}홈으로</a><button class="pill-button" type="button" data-open-palette>${icon("search", 14)}문서 검색</button></div>`;
    } else {
      els.readerState.innerHTML = `${icon("alert", 34)}<h2>불러오지 못했습니다</h2><p>네트워크 상태를 확인한 뒤 다시 시도해 주세요.</p><div class="actions"><button class="pill-button primary" type="button" data-retry>다시 시도</button></div>`;
    }
    showOnly("readerState");
  }

  let routeToken = 0;

  async function route() {
    const path = currentPath();
    closePalette();
    const token = ++routeToken;

    if (!path) {
      await showHome(token);
      return;
    }
    if (state.folders.has(path)) {
      showFolder(path);
      return;
    }
    await showDoc(path, token);
  }

  /* -- 홈 ---------------------------------------------------------------------- */

  const CATEGORY_TONES = ["", "tone-violet", "tone-mint", "tone-amber"];
  const DRAWER_TONES = ["sage", "coral", "lavender", "sky", "butter"];
  const CATEGORY_META = {
    Book: { label: "마음에 오래 남은 책들", tone: "coral", icon: "book" },
    IT: { label: "개발과 기술을 공부한 노트", tone: "sky", icon: "layers" },
    MyProject: { label: "직접 만들어 본 것들", tone: "butter", icon: "folder" },
    Study: { label: "배움과 성장의 기록", tone: "lavender", icon: "clock" },
  };

  function timeGreeting() {
    const h = new Date().getHours();
    if (h < 5) return { text: "고요한 새벽, 반가워요", icon: "moon" };
    if (h < 11) return { text: "좋은 아침이에요", icon: "sun" };
    if (h < 17) return { text: "따스한 오후예요", icon: "sun" };
    if (h < 21) return { text: "포근한 저녁이에요", icon: "moon" };
    return { text: "조용한 밤이에요", icon: "moon" };
  }

  /** 오늘 날짜로 정해지는 "오늘의 한 페이지". shuffle 이면 무작위로 다른 글을 고른다. */
  let todayIndex = -1;
  function pickToday(shuffle) {
    const pool = state.docs;
    if (!pool.length) return null;
    if (shuffle) {
      let next = Math.floor(Math.random() * pool.length);
      if (pool.length > 1 && next === todayIndex) next = (next + 1) % pool.length;
      todayIndex = next;
    } else if (todayIndex < 0) {
      const key = new Date().toISOString().slice(0, 10);
      let hash = 0;
      for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
      todayIndex = hash % pool.length;
    }
    return pool[todayIndex];
  }

  /** Markdown 에서 첫 문단 몇 줄을 평문으로 뽑는다. */
  function excerptFrom(markdown, max) {
    const text = markdown
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/<[^>]+>/g, " ")
      .split(/\n\s*\n/)
      .map((block) =>
        block
          .split("\n")
          .filter((line) => !/^\s*(#|!\[|\||---|\* \*|>?\s*$)/.test(line))
          .map((line) => line.replace(/^\s*(?:[-*+]|\d+\.|>)\s+/, ""))
          .join(" ")
          .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
          .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
          .replace(/[*_`~]+/g, "")
          .replace(/\s+/g, " ")
          .trim()
      )
      .find((block) => block.length >= 40);
    if (!text) return "";
    return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, "") + "…" : text;
  }

  async function renderToday(shuffle) {
    const body = $("todayBody");
    if (!body) return;
    const doc = pickToday(shuffle);
    if (!doc) {
      body.innerHTML = `<p class="fresh-today-empty">아직 기록이 없습니다.</p>`;
      return;
    }
    body.classList.add("is-changing");
    let excerpt = "";
    try {
      excerpt = excerptFrom(await fetchMarkdown(doc.path), 180);
    } catch (_) {
      /* 미리보기 없이 제목만 보여 준다 */
    }
    if (!$("todayBody")) return;
    body.innerHTML = `
      <a class="fresh-today-link" href="${escapeHtml(hrefFor(doc.path))}">
        <small>${escapeHtml(crumbsLabel(doc))} · ${escapeHtml(doc.updated)}</small>
        <strong>${escapeHtml(doc.title)}</strong>
        ${excerpt ? `<p>${escapeHtml(excerpt)}</p>` : ""}
        <span class="fresh-today-more">이어서 읽기${icon("arrow-right", 14)}</span>
      </a>`;
    // 프레임 콜백은 백그라운드 탭에서 멈출 수 있으므로 강제 리플로 뒤 바로 해제한다.
    void body.offsetWidth;
    body.classList.remove("is-changing");
  }

  function formatSize(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
    return Math.round(bytes / 1024) + " KB";
  }

  function docRow(doc, extraClass) {
    return `<li><a class="home-document-row ${extraClass || ""}" href="${escapeHtml(hrefFor(doc.path))}"><span class="home-file-icon">${icon("file", 18)}</span><span class="home-document-copy"><strong>${escapeHtml(doc.title)}</strong><small>${escapeHtml(crumbsLabel(doc))}</small></span><span class="home-document-date">${escapeHtml(doc.updated)}</span><span class="home-row-arrow">${icon("arrow-right", 15)}</span></a></li>`;
  }

  function renderHome() {
    const menu = state.menu;
    const site = menu.site || {};
    const recentUpdated = state.docs.slice().sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 7);
    const latest = recentUpdated[0];
    const totalBytes = state.docs.reduce((sum, d) => sum + (d.size || 0), 0);
    const folderCount = state.folders.size;
    const categories = menu.categories.filter((c) => c.type === "folder");
    const recentSeen = recentDocs();

    const greeting = timeGreeting();

    let html = `
      <section class="fresh-hero" aria-label="소개와 검색">
        <span class="fresh-blob blob-a" aria-hidden="true"></span>
        <span class="fresh-blob blob-b" aria-hidden="true"></span>
        <span class="fresh-blob blob-c" aria-hidden="true"></span>
        <div class="fresh-hero-copy">
          <span class="fresh-greeting">${icon(greeting.icon, 15)}${escapeHtml(greeting.text)}</span>
          <h1>읽고, 배우고,<br />천천히 기록합니다.</h1>
          <p>${escapeHtml(site.description || "")}</p>
        </div>
        <form class="home-search fresh-search" id="homeSearchForm" role="search">
          ${icon("search", 20)}
          <input id="homeSearch" type="search" placeholder="어떤 기록을 찾고 있나요? 예: 담론, ㄷㄹ, javascript" autocomplete="off" spellcheck="false" aria-label="문서 검색" />
          <button class="home-search-submit" type="submit">찾기</button>
        </form>
        <div class="home-search-results" id="homeSearchResults" hidden></div>
        <ul class="fresh-facts" aria-label="기록 현황">
          <li><strong>${menu.docCount}</strong>편의 기록</li>
          <li><strong>${categories.length}</strong>개의 서랍 · 폴더 ${folderCount}개</li>
          <li>마지막 기록 <strong>${escapeHtml(latest ? latest.updated : "-")}</strong></li>
          <li><strong>${formatSize(totalBytes)}</strong>의 글</li>
        </ul>
      </section>

      <section class="fresh-today" id="todayCard" aria-label="오늘의 한 페이지">
        <div class="fresh-today-head">
          <span class="fresh-eyebrow">${icon("book", 14)}오늘의 한 페이지</span>
          <button class="pill-button" type="button" id="todayShuffle">${icon("history", 13)}다른 글 보기</button>
        </div>
        <div id="todayBody"><div class="fresh-today-skeleton"></div></div>
      </section>

      <div class="fresh-section-head"><h2>기록의 서랍</h2><span>관심 있는 주제부터 천천히 둘러보세요</span></div>
      <ul class="fresh-drawers">${categories
        .map((c, i) => {
          const sub = c.children.filter((n) => n.type === "folder").length;
          const meta = CATEGORY_META[c.name] || { label: "모아 둔 기록", tone: DRAWER_TONES[i % DRAWER_TONES.length] };
          return `<li><a class="fresh-drawer tone-${meta.tone}" href="${escapeHtml(hrefFor(c.path))}"><span class="fresh-drawer-icon">${icon(meta.icon || "folder", 20)}</span><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(meta.label)}</small><span class="fresh-drawer-count">${c.count}편${sub ? ` · 폴더 ${sub}` : ""}${icon("arrow-right", 14)}</span></a></li>`;
        })
        .join("")}</ul>

      <div class="fresh-columns">
        <section class="fresh-card" aria-label="최근에 쓴 글">
          <div class="fresh-section-head small"><h2>최근에 다듬은 글</h2><span>수정일 기준</span></div>
          <ol class="fresh-timeline">${recentUpdated
            .map(
              (d) =>
                `<li><a href="${escapeHtml(hrefFor(d.path))}"><time datetime="${escapeHtml(d.updated)}">${escapeHtml(d.updated.slice(2).replace(/-/g, "."))}</time><span><strong>${escapeHtml(d.title)}</strong><small>${escapeHtml(crumbsLabel(d))}</small></span></a></li>`
            )
            .join("")}</ol>
        </section>
        <div class="fresh-side">`;

    if (recentSeen.length) {
      html += `
          <section class="fresh-card" aria-label="최근 본 문서">
            <div class="fresh-section-head small"><h2>다시 펼쳐 보기</h2><span>최근 본 글</span></div>
            <div class="fresh-chips">${recentSeen
              .slice(0, 6)
              .map((d) => `<a href="${escapeHtml(hrefFor(d.path))}">${icon("file", 13)}${escapeHtml(d.title)}</a>`)
              .join("")}</div>
          </section>`;
    }

    html += `
          <section class="fresh-card fresh-about" aria-label="소개">
            <div class="fresh-section-head small"><h2>이 공간에 대하여</h2></div>
            <div id="homeReadme"><div class="home-empty">소개를 불러오는 중…</div></div>
            <p class="fresh-tip">${icon("search", 13)}<span><kbd>Ctrl</kbd> <kbd>K</kbd> 로 어디서나, <kbd>/</kbd> 로 사이드바에서 찾을 수 있어요. 초성만 입력해도 됩니다.</span></p>
          </section>
        </div>
      </div>`;

    els.home.innerHTML = html;
    renderToday(false);
    $("todayShuffle").addEventListener("click", () => renderToday(true));

    const form = $("homeSearchForm");
    const input = $("homeSearch");
    const resultsEl = $("homeSearchResults");

    const run = () => {
      const query = input.value;
      if (!query.trim()) {
        resultsEl.hidden = true;
        resultsEl.innerHTML = "";
        state.homeSearch = { index: -1, items: [] };
        return;
      }
      const folders = searchFolders(query, 3);
      const results = searchDocs(query, 12);
      state.homeSearch = { index: results.length + folders.length ? 0 : -1, items: folders.map((f) => f.path).concat(results.map((r) => r.doc.path)) };
      resultsEl.innerHTML = results.length || folders.length ? renderResultList(results, folders, 0) : renderEmptyResults(query);
      resultsEl.hidden = false;
    };
    input.addEventListener("input", debounce(run, 60));
    input.addEventListener("keydown", (event) => {
      const s = state.homeSearch;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (!s.items.length) return;
        event.preventDefault();
        s.index = (s.index + (event.key === "ArrowDown" ? 1 : -1) + s.items.length) % s.items.length;
        resultsEl.querySelectorAll("a.result").forEach((a, i) => a.classList.toggle("selected", i === s.index));
      } else if (event.key === "Escape" && input.value) {
        input.value = "";
        run();
      }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const s = state.homeSearch;
      if (s.index >= 0 && s.items[s.index]) navigate(s.items[s.index]);
      else if (input.value.trim()) openPalette(input.value);
    });
  }

  async function showHome(token) {
    state.current = null;
    renderHome();
    showOnly("home");
    renderBreadcrumb([], "");
    setTitle("");
    markActive(null);
    els.reader.scrollTop = 0;

    const home = (state.menu.site && state.menu.site.home) || "README";
    try {
      const md = await fetchMarkdown(home);
      if (token !== routeToken) return;
      const host = $("homeReadme");
      if (!host) return;
      host.innerHTML = "";
      // 홈은 매번 새로 그리므로 이전 뷰어 인스턴스는 정리하고 새로 만든다.
      if (state.homeViewer && typeof state.homeViewer.remove === "function") {
        try { state.homeViewer.remove(); } catch (_) { /* 이미 제거됨 */ }
      }
      state.homeViewer = createViewer(host);
      if (state.homeViewer) state.homeViewer.setMarkdown(md);
    } catch (_) {
      const host = $("homeReadme");
      if (host) host.innerHTML = `<div class="home-empty">소개 문서를 불러오지 못했습니다.</div>`;
    }
  }

  /* -- 폴더 ------------------------------------------------------------------- */

  function showFolder(path) {
    const folder = state.folders.get(path);
    state.current = null;
    const subfolders = folder.children.filter((n) => n.type === "folder");
    const docs = folder.children.filter((n) => n.type === "doc").map((n) => state.byPath.get(n.path));

    let html = `<header class="folder-head"><span class="document-kicker">${escapeHtml(folder.crumbs.length ? folder.crumbs.map((c) => c.name).join(" / ") : "category")}</span><h1>${escapeHtml(folder.name)}</h1><p>문서 ${folder.count}개${subfolders.length ? ` · 하위 폴더 ${subfolders.length}개` : ""}</p></header>`;
    if (subfolders.length) {
      html += `<ul class="folder-grid">${subfolders
        .map((s, i) => `<li><a href="${escapeHtml(hrefFor(s.path))}"><span class="home-library-icon ${CATEGORY_TONES[(i + 1) % CATEGORY_TONES.length]}">${icon("folder", 18)}</span><strong>${escapeHtml(s.name)}</strong><small>문서 ${s.count}개</small></a></li>`)
        .join("")}</ul>`;
    }
    if (docs.length) {
      html += `<ul class="folder-list">${docs.map((d) => docRow(d)).join("")}</ul>`;
    } else if (!subfolders.length) {
      html += `<div class="home-empty">이 폴더에는 문서가 없습니다.</div>`;
    }
    els.folder.innerHTML = html;
    showOnly("folder");
    renderBreadcrumb(folder.crumbs, folder.name);
    setTitle(folder.name);
    expandAncestors(path);
    markActive(path);
    els.reader.scrollTop = 0;
  }

  /* -- 문서 ------------------------------------------------------------------- */

  function renderPager(doc) {
    if (!els.pager) return;
    const index = state.docs.indexOf(doc);
    const prev = index > 0 ? state.docs[index - 1] : null;
    const next = index >= 0 && index < state.docs.length - 1 ? state.docs[index + 1] : null;
    const card = (d, kind) =>
      d
        ? `<a class="${kind}" href="${escapeHtml(hrefFor(d.path))}" rel="${kind}"><small>${kind === "prev" ? icon("arrow-left", 11) + "이전" : "다음" + icon("arrow-right", 11)}</small><strong>${escapeHtml(d.title)}</strong></a>`
        : `<a class="${kind} placeholder" aria-hidden="true" tabindex="-1"></a>`;
    els.pager.innerHTML = card(prev, "prev") + card(next, "next");
  }

  async function showDoc(path, token) {
    const doc = state.byPath.get(path);
    const title = doc ? doc.title : path.slice(path.lastIndexOf("/") + 1);
    const crumbs = doc ? doc.crumbs : [];

    renderBreadcrumb(crumbs, title);
    setTitle(title);
    if (doc) expandAncestors(path);
    markActive(doc ? path : null);
    renderState("loading", path);

    let markdown;
    try {
      markdown = await fetchMarkdown(path);
    } catch (error) {
      if (token !== routeToken) return;
      renderState(error.status === 404 ? "notfound" : "error", path);
      return;
    }
    if (token !== routeToken) return;

    state.current = path;
    const viewer = getViewer();
    if (viewer) viewer.setMarkdown(markdown);
    else els.viewer.textContent = markdown;

    if (els.docKicker) {
      els.docKicker.innerHTML = crumbs.length
        ? crumbs.map((c) => `<a href="${escapeHtml(hrefFor(c.path))}">${escapeHtml(c.name)}</a>`).join(" / ")
        : "document";
    }
    if (els.docMeta) {
      els.docMeta.innerHTML = doc
        ? `<span>${icon("clock", 13)}<time datetime="${escapeHtml(doc.updated)}">${escapeHtml(doc.updated)}</time></span><span>${escapeHtml(formatSize(doc.size || 0))}</span>`
        : "";
    }
    if (els.rawLink) els.rawLink.href = "/" + encodeURI(path) + ".md";
    if (doc) renderPager(doc);
    else if (els.pager) els.pager.innerHTML = "";

    showOnly("document");
    els.reader.scrollTop = 0;
    buildOutline();
    if (doc) pushRecent(path);
    closeDrawer();
  }

  /* ------------------------------------------------------------------------
     11. 문서 목차 (outline)
     ------------------------------------------------------------------------ */

  function clearOutline() {
    if (!els.outline) return;
    if (state.outlineObserver) {
      state.outlineObserver.disconnect();
      state.outlineObserver = null;
    }
    els.outlineList.innerHTML = "";
    els.workspaceBody.classList.remove("has-outline");
  }

  function slugify(text, index) {
    const base = text
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "");
    return (base || "section") + "-" + index;
  }

  function buildOutline() {
    clearOutline();
    if (!els.outline) return;
    const headings = Array.from(els.viewer.querySelectorAll("h2, h3"));
    if (headings.length < 2) return;

    let html = "";
    headings.forEach((h, i) => {
      if (!h.id) h.id = slugify(h.textContent, i + 1);
      html += `<li class="depth-${h.tagName === "H3" ? 3 : 2}" data-target="${escapeHtml(h.id)}"><a href="#${escapeHtml(currentPath())}" data-heading="${escapeHtml(h.id)}">${escapeHtml(h.textContent)}</a></li>`;
    });
    els.outlineList.innerHTML = html;
    els.workspaceBody.classList.add("has-outline");

    const items = Array.from(els.outlineList.querySelectorAll("li"));
    const setActive = (id) => items.forEach((li) => li.classList.toggle("active", li.dataset.target === id));
    setActive(headings[0].id);

    const visible = new Map();
    state.outlineObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
        const firstVisible = headings.find((h) => visible.get(h.id));
        if (firstVisible) {
          setActive(firstVisible.id);
        } else {
          // 보이는 제목이 없으면 스크롤 위치 위의 마지막 제목을 고른다.
          const top = els.reader.scrollTop + 40;
          let last = headings[0];
          for (const h of headings) if (h.offsetTop <= top) last = h;
          setActive(last.id);
        }
      },
      { root: els.reader, rootMargin: "-10% 0px -70% 0px", threshold: 0 }
    );
    headings.forEach((h) => state.outlineObserver.observe(h));
  }

  /* ------------------------------------------------------------------------
     12. 이벤트 연결
     ------------------------------------------------------------------------ */

  function isTypingTarget(target) {
    return target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
  }

  function bindEvents() {
    window.addEventListener("hashchange", route);

    if (els.footerYear) els.footerYear.textContent = String(new Date().getFullYear());

    if (hasSidebar) {
      els.tree.addEventListener("click", onTreeClick);
      els.tree.addEventListener("keydown", onTreeKeydown);
      els.treeExpandAll.addEventListener("click", () => expandAll(true));
      els.treeCollapseAll.addEventListener("click", () => expandAll(false));

      els.treeSearch.addEventListener("input", debounce(runSidebarSearch, 60));
      els.treeSearch.addEventListener("keydown", onSidebarSearchKeydown);
      els.treeSearchClear.addEventListener("click", () => clearSidebarSearch(true));
      els.treeResults.addEventListener("click", (event) => {
        if (event.target.closest("a.result")) {
          clearSidebarSearch(false);
          closeDrawer();
        }
      });

      els.menuButton.addEventListener("click", () => {
        if (els.sidebar.classList.contains("mobile-open")) closeDrawer();
        else openDrawer();
      });
      els.sidebarClose.addEventListener("click", closeDrawer);
      els.scrim.addEventListener("click", closeDrawer);
    }

    if (els.commandTrigger) {
      els.commandTrigger.addEventListener("click", () => openPalette(""));
      els.commandInput.addEventListener("input", debounce(renderPalette, 50));
      els.commandInput.addEventListener("keydown", onPaletteKeydown);
      els.commandScrim.addEventListener("click", (event) => {
        if (event.target === els.commandScrim) closePalette();
      });
      els.commandOptions.addEventListener("click", (event) => {
        if (event.target.closest("[role='option']")) closePalette();
      });
      els.commandOptions.addEventListener("mousemove", (event) => {
        const option = event.target.closest("[role='option']");
        if (option && Number(option.dataset.index) !== state.palette.index) setPaletteSelection(Number(option.dataset.index));
      });
    }

    if (els.copyLink) {
      els.copyLink.addEventListener("click", async () => {
        const url = location.origin + "/" + hrefFor(state.current || "");
        try {
          await navigator.clipboard.writeText(url);
          toast("링크를 복사했습니다");
        } catch (_) {
          window.prompt("링크를 복사하세요", url);
        }
      });
    }

    if (els.outline) {
      els.outlineList.addEventListener("click", (event) => {
        const link = event.target.closest("a[data-heading]");
        if (!link) return;
        event.preventDefault();
        const heading = document.getElementById(link.dataset.heading);
        if (heading) heading.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    }

    if (els.readerState) {
      els.readerState.addEventListener("click", (event) => {
        if (event.target.closest("[data-open-palette]")) openPalette("");
        else if (event.target.closest("[data-retry]")) route();
      });
    }

    document.addEventListener("keydown", (event) => {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && (event.key === "k" || event.key === "K")) {
        if (!els.commandScrim) return;
        event.preventDefault();
        if (state.palette.open) closePalette();
        else openPalette("");
        return;
      }
      if (state.palette.open) return;
      if (event.key === "/" && !isTypingTarget(event.target) && hasSidebar) {
        event.preventDefault();
        if (window.matchMedia("(max-width: 820px)").matches) openDrawer();
        els.treeSearch.focus();
        els.treeSearch.select();
        return;
      }
      if (event.key === "Escape" && hasSidebar && els.sidebar.classList.contains("mobile-open")) {
        closeDrawer();
      }
    });

    // 데스크톱 폭으로 돌아오면 드로어 상태를 정리한다.
    window.matchMedia("(min-width: 821px)").addEventListener("change", (event) => {
      if (event.matches) closeDrawer();
    });
  }

  /* ------------------------------------------------------------------------
     13. 시작
     ------------------------------------------------------------------------ */

  async function loadMenu() {
    const response = await fetch("/menu.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("menu.json " + response.status);
    return response.json();
  }

  async function boot() {
    bindEvents();
    try {
      state.menu = await loadMenu();
    } catch (error) {
      state.menu = { site: {}, docCount: 0, latestUpdated: "", categories: [] };
      if (els.treeFootCount) els.treeFootCount.textContent = "메뉴를 불러오지 못했습니다";
      console.error("[ucanon] menu.json 로딩 실패:", error);
    }
    indexMenu(state.menu);
    renderTree();
    await route();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
