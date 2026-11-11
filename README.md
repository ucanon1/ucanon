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
| 문서 | `https://ucanon.com/#/{key}` | 사이트 안에서 쓰는 주소 |
| 문서 공유 | `https://ucanon.com/p/{key}/` | 검색엔진·링크 미리보기용. 사람이 열면 `#/{key}`로 넘어갑니다. |
| 폴더 | `https://ucanon.com/#/folder/{id}` | |

- `{key}`는 문서가 처음 등록될 때의 내용 해시(16자리)입니다. 문서를 고치거나 옮기거나 이름을 바꿔도 바뀌지 않습니다.
- 문서 화면의 **링크 복사** 버튼은 공유 주소(`/p/{key}/`)를 복사합니다. 카카오톡·슬랙 등에 붙이면 제목과 요약이 미리보기로 나옵니다.
- 예전 주소(`#blog/…`, `#/doc/{id}`)로 들어와도 새 주소로 자동으로 넘어갑니다.

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

`menu.json`, `doc-ids.json`, `p/`, `sitemap.xml`, `robots.txt`는 직접 고치지 말고 `node createCategory.js`로 다시 만드세요.

## 로컬에서 보기

사이트가 `/`로 시작하는 절대 경로를 쓰므로 파일을 직접 열면(`file://`) 동작하지 않습니다.

```bash
node serve.js
```

브라우저에서 `http://localhost:8765`를 엽니다.

## 검색엔진 등록

[Google Search Console](https://search.google.com/search-console)에 `https://ucanon.com`을 등록하고 사이트맵 `https://ucanon.com/sitemap.xml`을 제출하면 문서별 공유 페이지가 검색에 잡힙니다.
