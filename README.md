# UCANON.COM

마음에 남은 책, 공부한 기술, 직접 만든 것들을 한 장씩 모아 두는 작은 서재입니다.

* E-Mail : pskpassion@gmail.com
* Github : [https://github.com/ucanon1](https://github.com/ucanon1)
* Homepage : [https://ucanon.com](https://ucanon.com)
* Blog : [https://blog.naver.com/pskpassion](https://blog.naver.com/pskpassion)

## 문서 추가·수정하기

1. `blog/` 아래 원하는 폴더에 Markdown(`.md`) 파일을 추가하거나 고칩니다.
   - 폴더 구조가 그대로 메뉴 트리가 됩니다. (`blog/IT/Web/…` → IT › Web › …)
   - 이름이 `_`로 시작하는 문서는 초안으로 보고 메뉴에서 뺍니다.
2. 메뉴와 공유 페이지를 다시 만듭니다.

   ```bash
   node createCategory.js
   ```

   Windows에서는 `createCategory.bat`을 실행해도 됩니다.
3. 바뀐 파일을 모두 커밋하고 push 하면 GitHub Pages에 배포됩니다.

> CSS·JS만 고쳤을 때도 `node createCategory.js`를 실행해야 합니다. HTML의 자원 주소에 `?v=해시`를 갱신해 배포 직후 예전 캐시와 섞여 화면이 깨지는 것을 막습니다.

## 주소 체계

| 대상 | 주소 | 설명 |
|---|---|---|
| 홈 | `https://ucanon.com/` | |
| 문서 | `https://ucanon.com/p/{key}/` | 주소창에 보이는 주소. 그대로 복사해 공유하면 제목·요약이 미리보기로 나옵니다. |
| 폴더 | `https://ucanon.com/#/folder/{id}` | |

- `{key}`는 문서가 처음 등록될 때의 내용 해시(16자리)입니다. 문서를 고치거나 옮기거나 이름을 바꿔도 바뀌지 않습니다.
- `/p/{key}/`는 문서마다 만든 정적 페이지입니다. 검색엔진·링크 미리보기 봇은 이 페이지의 제목·요약·본문을 읽고, 사람은 사이트 화면으로 이어집니다. 새로고침하거나 다시 들어와도 같은 문서가 열립니다.
- 예전 주소(`#/{key}`, `#/doc/{id}`, `#blog/…`)로 들어와도 새 주소로 자동으로 바뀝니다.
- `content.html`, `view.html`은 지금처럼 `#/{key}` 주소를 씁니다.

## 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html`, `index.css`, `index.js` | 사이트 화면(사이드바 트리, 검색, 명령 팔레트, 문서 뷰어) |
| `content.html`, `view.html` | 사이드바 없는 문서 전용 화면 |
| `createCategory.js` | `menu.json`, `doc-ids.json`, 공유 페이지, `sitemap.xml`, `robots.txt` 생성 |
| `share-pages.js` | 문서별 공유 페이지(`p/{key}/index.html`) 생성기 |
| `menu.json` | 메뉴 트리 데이터 (자동 생성) |
| `doc-ids.json` | 문서 key·ID, 폴더 ID 목록 (자동 관리, 직접 수정하지 마세요) |
| `p/` | 문서별 공유·검색용 정적 페이지 (자동 생성) |
| `sitemap.xml`, `robots.txt` | 검색엔진용 (자동 생성) |
| `og-image.png` | 이미지 없는 문서의 링크 미리보기 이미지 |
| `serve.js` | 로컬 미리보기 서버 |
| `google32880678e3710664.html` | Google Search Console 소유권 확인 파일 (삭제 금지, 아래 "검색엔진 등록" 참고) |

`menu.json`, `doc-ids.json`, `p/`, `sitemap.xml`, `robots.txt`는 직접 고치지 말고 `node createCategory.js`로 다시 만드세요.

## 로컬에서 보기

사이트가 `/`로 시작하는 절대 경로를 쓰므로 파일을 직접 열면(`file://`) 동작하지 않습니다.

```bash
node serve.js
```

브라우저에서 `http://localhost:8765`를 엽니다.

## 검색엔진 등록

### Google Search Console (2026-11-12 등록)

| 항목 | 내용 |
|---|---|
| 콘솔 | [Google Search Console](https://search.google.com/search-console?resource_id=https%3A%2F%2Fucanon.com%2F) |
| 속성 | `https://ucanon.com/` (URL 접두어) |
| 소유권 확인 방법 | HTML 파일 — 저장소 루트의 `google32880678e3710664.html` |
| 사이트맵 | `https://ucanon.com/sitemap.xml` (2026-11-12 제출, 상태 성공, 발견된 페이지 54개) |

- **`google32880678e3710664.html`은 지우지 마세요.** 지우면 소유권 확인이 풀립니다. 파일 내용은 `google-site-verification: google32880678e3710664.html` 한 줄입니다.
- 사이트맵은 `node createCategory.js`를 실행할 때마다 새로 만들어집니다. Google이 주기적으로 다시 읽으므로 다시 제출할 필요는 없습니다.
- 색인 상태는 콘솔의 **페이지** 메뉴에서, 문서 하나의 색인 여부는 **URL 검사**에 `https://ucanon.com/p/{key}/`를 넣어 확인합니다. 새 문서를 빨리 색인시키고 싶으면 URL 검사에서 **색인 생성 요청**을 누릅니다.
- 검색에 잡히는 주소는 문서별 공유 페이지(`/p/{key}/`)입니다. 각 페이지는 자기 주소를 canonical로 지정하고, 홈은 `https://ucanon.com/`을 지정합니다.

### 검색·공유 관련 파일

| 파일 | 역할 |
|---|---|
| `sitemap.xml` | 홈 + 모든 `/p/{key}/` 주소와 수정일 (자동 생성) |
| `robots.txt` | 모든 크롤러 허용, 사이트맵 위치 안내 (자동 생성) |
| `p/{key}/index.html` | 제목·요약·OG 태그·본문 HTML. 봇은 그대로 읽고 사람은 사이트 화면으로 이동 (자동 생성) |
| `og-image.png` | 이미지 없는 문서의 링크 미리보기 이미지 |
| `google32880678e3710664.html` | Search Console 소유권 확인 파일 (삭제 금지) |

### 링크 미리보기 캐시

카카오톡 등은 처음 본 주소의 미리보기를 한동안 저장해 둡니다. 문서 제목·요약을 바꾼 뒤 예전 미리보기가 계속 나오면 [카카오 공유 디버거](https://developers.kakao.com/tool/debugger/sharing)에서 해당 주소의 캐시를 지웁니다.
