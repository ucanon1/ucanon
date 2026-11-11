/**
 * 공유·검색용 문서별 정적 페이지를 만든다. (createCategory.js 가 호출)
 *
 *   p/{key}/index.html   문서마다 하나. 제목·요약·OG 태그·본문 HTML 을 담는다.
 *   sitemap.xml          홈 + 모든 /p/{key}/ 주소
 *   robots.txt           모든 크롤러 허용 + 사이트맵 위치
 *
 * 사이트 자체는 계속 #/{key} 주소로 움직인다. /p/{key}/ 는
 *   - 사람이 열면 곧바로 /#/{key} 로 넘어가 지금과 같은 화면을 보고,
 *   - 검색엔진·링크 미리보기 봇은 넘어가지 않고 이 페이지의 제목·요약·본문을 읽는다.
 * 두 쪽이 보는 내용은 같은 문서다(클로킹 아님).
 */

const fs = require("fs");
const path = require("path");

const SHARE_DIR = "p";
const BOT_PATTERN =
  "bot|crawl|spider|slurp|preview|scrap|facebookexternalhit|embedly|whatsapp|telegram|discord|skype|line\\/|lighthouse|headless";

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function encodePath(p) {
  return p.split("/").map(encodeURIComponent).join("/");
}

/** 문서 기준 상대 경로 → 사이트 절대 URL. 이미 절대 주소면 그대로. */
function resolveUrl(raw, docDir, siteUrl) {
  const url = raw.trim().replace(/^<|>$/g, "").split(/\s+/)[0];
  if (/^(https?:)?\/\//i.test(url) || /^(mailto|tel|data):/i.test(url)) return url;
  if (url.startsWith("#")) return url;
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch (_) {
    /* 그대로 */
  }
  const joined = decoded.startsWith("/") ? decoded.slice(1) : path.posix.normalize(path.posix.join(docDir, decoded));
  return siteUrl + "/" + encodePath(joined);
}

/* ---------------------------------------------------------------- Markdown → HTML
   검색엔진이 읽을 본문용 간단 변환기. 화면 표시는 사이트(Toast UI)가 맡으므로
   제목·문단·목록·인용·코드·표·링크·이미지·강조 정도만 처리한다. 원문 HTML 은 이스케이프한다. */

function renderInline(text, ctx) {
  const codes = [];
  let out = text.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code);
    return "\u0000" + (codes.length - 1) + "\u0000";
  });
  // 백슬래시 이스케이프(\- \* 등)는 문자 그대로 보이게 하고 서식 처리에서 뺀다.
  const escapes = [];
  out = out.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, (_, ch) => {
    escapes.push(ch);
    return "\u0001" + (escapes.length - 1) + "\u0001";
  });
  out = escapeHtml(out);
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    const url = resolveUrl(src.replace(/&amp;/g, "&").replace(/&quot;/g, '"'), ctx.docDir, ctx.siteUrl);
    return `<img src="${escapeHtml(url)}" alt="${alt}" loading="lazy" />`;
  });
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const url = resolveUrl(href.replace(/&amp;/g, "&").replace(/&quot;/g, '"'), ctx.docDir, ctx.siteUrl);
    return `<a href="${escapeHtml(url)}">${label}</a>`;
  });
  out = out.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2">$2</a>');
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_]+)__/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  out = out.replace(/\u0001(\d+)\u0001/g, (_, i) => escapeHtml(escapes[Number(i)]));
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(codes[Number(i)])}</code>`);
}

function renderMarkdown(markdown, ctx) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  let i = 0;
  let para = [];

  const flush = () => {
    if (para.length) html.push(`<p>${para.map((l) => renderInline(l.trim(), ctx)).join("<br />")}</p>`);
    para = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const fence = /^\s*(```|~~~)\s*([\w+-]*)/.exec(line);
    if (fence) {
      flush();
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) code.push(lines[i++]);
      i++;
      html.push(`<pre><code${fence[2] ? ` class="language-${escapeHtml(fence[2])}"` : ""}>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      flush();
      const level = Math.min(heading[1].length + 1, 6); // 문서 제목(h1)은 페이지가 따로 둔다
      html.push(`<h${level}>${renderInline(heading[2], ctx)}</h${level}>`);
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      html.push("<hr />");
      i++;
      continue;
    }
    if (/^\s*>/.test(line)) {
      flush();
      const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ""));
      html.push(`<blockquote>${renderMarkdown(quote.join("\n"), ctx)}</blockquote>`);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      flush();
      const cells = (row) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => renderInline(c.trim(), ctx));
      const head = cells(line);
      i += 2;
      const body = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) body.push(cells(lines[i++]));
      html.push(
        `<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${body
          .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`
      );
      continue;
    }
    const item = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) {
      flush();
      const ordered = /\d/.test(item[1]);
      const items = [];
      while (i < lines.length) {
        const m = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (m) items.push(m[2].replace(/^\[( |x|X)\]\s+/, (_, c) => (c === " " ? "☐ " : "☑ ")));
        else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) items[items.length - 1] += " " + lines[i].trim();
        else break;
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      html.push(`<${tag}>${items.map((t) => `<li>${renderInline(t, ctx)}</li>`).join("")}</${tag}>`);
      continue;
    }
    if (!line.trim() || /^\s*(&nbsp;|\u00a0)\s*$/.test(line)) {
      flush();
      i++;
      continue;
    }
    para.push(line);
    i++;
  }
  flush();
  return html.join("\n");
}

/** 미리보기·검색 결과용 요약. 제목·코드·이미지·표를 빼고 본문 문장만 이어 붙인다. */
function excerptFrom(markdown, max = 150) {
  const text = markdown
    .replace(/\r\n?/g, "\n")
    .replace(/(```|~~~)[\s\S]*?\1/g, " ")
    .split("\n")
    .filter((l) => !/^\s*(#|\||>?\s*$)/.test(l))
    .join(" ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, (_, ch) => "\u0001" + ch.charCodeAt(0) + "\u0002")
    .replace(/[`*_~]|&nbsp;/g, "")
    .replace(/\u0001(\d+)\u0002/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/^\s*([-+]|\d+[.)])\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + "…";
}

function firstImage(markdown, ctx) {
  const m = /!\[[^\]]*\]\(([^)]+)\)/.exec(markdown);
  if (!m) return null;
  const url = resolveUrl(m[1], ctx.docDir, ctx.siteUrl);
  return /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url) ? url : null;
}

function sharePage(doc, markdown, site) {
  const siteUrl = site.url;
  const docDir = doc.path.slice(0, doc.path.lastIndexOf("/"));
  const ctx = { docDir, siteUrl };
  const shareUrl = `${siteUrl}/${SHARE_DIR}/${doc.key}/`;
  const appUrl = `/#/${doc.key}`;
  const description = excerptFrom(markdown) || site.description;
  const image = firstImage(markdown, ctx) || `${siteUrl}/${site.ogImage}`;
  const crumbs = docDir.split("/").slice(1); // "blog" 제외
  let body = renderMarkdown(markdown, ctx);
  // 본문 첫 제목이 문서 제목과 같으면 중복이므로 뺀다.
  const norm = (s) => s.replace(/<[^>]+>/g, "").replace(/[\s_]/g, "").toLowerCase();
  body = body.replace(/^<h2>(.*?)<\/h2>\n?/, (all, h) => (norm(h) === norm(doc.title) ? "" : all));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: doc.title,
    description,
    image,
    dateModified: doc.updated,
    inLanguage: "ko",
    mainEntityOfPage: shareUrl,
    publisher: { "@type": "Organization", name: site.title, url: siteUrl + "/" },
  };

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(doc.title)} · ${escapeHtml(site.title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${escapeHtml(shareUrl)}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="${escapeHtml(site.title)}" />
<meta property="og:locale" content="ko_KR" />
<meta property="og:title" content="${escapeHtml(doc.title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(shareUrl)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="article:modified_time" content="${escapeHtml(doc.updated)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(doc.title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
<link rel="icon" href="/favicon.ico" />
<script>
/* 사람은 사이트 화면(#/${doc.key})으로 보내고, 검색엔진·미리보기 봇은 이 페이지를 그대로 읽게 한다. */
(function () {
  if (!/${BOT_PATTERN}/i.test(navigator.userAgent)) location.replace(${JSON.stringify(appUrl)});
})();
</script>
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
<style>
body{margin:0;background:#faf8f4;color:#2b2722;font:16px/1.75 -apple-system,"Segoe UI","Apple SD Gothic Neo","Malgun Gothic",sans-serif}
main{max-width:760px;margin:0 auto;padding:40px 20px 80px}
a{color:#3f7a5e}nav{font-size:14px;color:#7a7268}h1{font-size:32px;line-height:1.3;margin:12px 0 4px}
.meta{font-size:13px;color:#7a7268;margin-bottom:32px}img{max-width:100%;height:auto}
pre{background:#f1ede6;padding:14px;overflow:auto;border-radius:8px}code{font-family:Consolas,monospace;font-size:.92em}
blockquote{margin:0;padding-left:16px;border-left:3px solid #c9d9cf;color:#5a534a}
table{border-collapse:collapse}th,td{border:1px solid #ddd6cc;padding:6px 10px}
.go{display:inline-block;margin-top:40px;padding:10px 16px;border-radius:8px;background:#4f8a6e;color:#fff;text-decoration:none}
</style>
</head>
<body>
<main>
<nav><a href="/">${escapeHtml(site.title)}</a>${crumbs.map((c) => " › " + escapeHtml(c)).join("")}</nav>
<article>
<h1>${escapeHtml(doc.title)}</h1>
<p class="meta">수정 <time datetime="${escapeHtml(doc.updated)}">${escapeHtml(doc.updated)}</time></p>
${body}
</article>
<a class="go" href="${escapeHtml(appUrl)}">서재에서 보기 →</a>
</main>
</body>
</html>
`;
}

function writeIfChanged(file, content) {
  try {
    if (fs.readFileSync(file, "utf8") === content) return false;
  } catch (_) {
    /* 새 파일 */
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
  return true;
}

/** 모든 문서의 공유 페이지·sitemap.xml·robots.txt 를 만든다. 반환: { written, removed } */
function buildSharePages(root, docs, site) {
  const shareRoot = path.join(root, SHARE_DIR);
  const keys = new Set();
  let written = 0;
  for (const doc of docs) {
    if (!doc.key) continue;
    keys.add(doc.key);
    const markdown = fs.readFileSync(path.join(root, doc.path + ".md"), "utf8").replace(/^\uFEFF/, "");
    if (writeIfChanged(path.join(shareRoot, doc.key, "index.html"), sharePage(doc, markdown, site))) written++;
  }

  // 지워진 문서의 공유 페이지 정리
  let removed = 0;
  if (fs.existsSync(shareRoot)) {
    for (const entry of fs.readdirSync(shareRoot, { withFileTypes: true })) {
      if (entry.isDirectory() && !keys.has(entry.name)) {
        fs.rmSync(path.join(shareRoot, entry.name), { recursive: true, force: true });
        removed++;
      }
    }
  }

  const latest = docs.reduce((max, d) => (d.updated > max ? d.updated : max), "");
  const urls = [`  <url><loc>${site.url}/</loc><lastmod>${latest}</lastmod></url>`].concat(
    docs
      .filter((d) => d.key)
      .map((d) => `  <url><loc>${site.url}/${SHARE_DIR}/${d.key}/</loc><lastmod>${d.updated}</lastmod></url>`)
  );
  writeIfChanged(
    path.join(root, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`
  );
  writeIfChanged(path.join(root, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);
  return { written, removed };
}

module.exports = { buildSharePages, excerptFrom, renderMarkdown };
