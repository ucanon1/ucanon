# 사용자 가이드 화면 캡처

`docs/user-guide/images/` 의 화면 이미지를 다시 만드는 스크립트입니다. 화면이 바뀌면 다시 실행합니다.

1. 에뮬레이터 실행: `cd ../../test && npm run emulators`
2. 정적 서버: `C:/Github_Personal/ucanon` 을 http://localhost:8765 로 서빙
3. 예시 데이터: `node seed.mjs`
4. 캡처: `node capture.mjs` (PNG 저장)
5. JPEG 변환: images 폴더에서 `magick x.png -strip -quality 84 x.jpg` 후 PNG 삭제

- Playwright 번들 Chromium **헤드리스 1개**만 씁니다. Chrome·Edge 정식판 채널은 Windows 계정 잠금을
  일으킨 적이 있어 쓰지 않습니다.
- `capture.mjs` 는 `ai-knowledge-system/web/node_modules/playwright` 를 빌려 씁니다. 경로가 다르면 맨 위 import를 고칩니다.
- 관리자 화면은 에뮬레이터용 테스트 토큰으로 로그인하고, 개발용 '로컬 에뮬레이터' 표시는 캡처에서 뺍니다.
