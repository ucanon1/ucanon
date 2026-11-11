# 호그와트 기숙사 컵 구축 안내

작성일: 2026-11-11 · 설계 근거: [firebase-survey-architecture.md](firebase-survey-architecture.md)

## 구성

| 항목 | 값 |
|---|---|
| 페이지 주소 | https://ucanon.com/jmp/hogwarts/ (관리자: `?admin=1`) |
| 프론트 | GitHub Pages, 저장소 `pskword/ucanon` 의 `jmp/hogwarts/` |
| DB | Cloud Firestore (Spark 무료 요금제) |
| Firebase 소유 계정 | pskword@gmail.com |
| Firebase 프로젝트 | `ucanon-hogwarts` (콘솔: https://console.firebase.google.com/project/ucanon-hogwarts) |
| Firestore 위치 | `asia-northeast3` (서울), 생성 후 변경 불가 |
| 관리자 계정 | pskword@gmail.com (Google 로그인) |

## 진행 상황 (2026-11-11)

아래 1~3단계는 완료했습니다. 다시 만들 일이 생길 때를 위해 절차를 남겨 둡니다.

- 프로젝트 생성(Analytics·Gemini 끔), Firestore 서울 리전 생성
- 익명·Google 로그인 사용 설정, 승인된 도메인에 `ucanon.com` 추가
- 웹 앱 `hogwarts-web` 등록, 설정값을 `js/firebase-config.js` 에 반영
- 보안 규칙 게시, `admins/pskword@gmail.com` 등록
- 실제 DB에서 답안 저장과 규칙 차단 확인(시험 회차 `prod-test`)

```
응답자(익명 로그인, 화면에 안 보임) ─▶ index.html ─▶ Firestore
                                                     games/{게임ID}/participants  공개 읽기(실시간 순위판)
                                                     games/{게임ID}/responses     관리자·본인만 읽기
관리자(Google 로그인) ──────────────▶ index.html?admin=1 ─▶ admins/{이메일} 로 권한 확인
```

## 파일

| 파일 | 역할 |
|---|---|
| `index.html` | 게임 페이지. 지민이가 만든 `Hogwarts.html`을 Firestore용으로 바꾼 것 |
| `js/firebase-config.js` | Firebase 웹 설정값, 기본 게임 ID |
| `js/hogwarts-db.js` | Firestore 읽기·쓰기, 실시간 순위 구독, 관리자 로그인 |
| `firestore.rules` | 보안 규칙 |
| `firebase.json`, `.firebaserc` | Firebase CLI로 규칙을 배포할 때 사용 |
| `test/` | 보안 규칙 자동 테스트(에뮬레이터) |
| `Hogwarts.html` | 원본 초안(서버 API 버전). GitHub Pages에서는 저장이 안 됨 |

## 1. Firebase 프로젝트 만들기 (콘솔, 수동)

pskword@gmail.com 으로 https://console.firebase.google.com 에 로그인합니다.

1. **프로젝트 추가**. 이름 예: `ucanon-hogwarts`. Google Analytics는 꺼도 됩니다.
2. **Firestore Database** > 데이터베이스 만들기. 위치는 `asia-northeast3 (서울)`, **프로덕션 모드**.
3. **Authentication** > 시작하기 > 로그인 방법에서 두 가지를 사용 설정합니다.
   - **익명**: 응답자용
   - **Google**: 관리자용. 지원 이메일은 pskword@gmail.com
4. **Authentication** > 설정 > 승인된 도메인에 `ucanon.com` 을 추가합니다.
5. **프로젝트 설정** > 일반 > 내 앱 > 웹 앱(`</>`) 추가. 호스팅은 체크하지 않습니다.
   표시되는 `firebaseConfig` 값을 `js/firebase-config.js` 에 붙여 넣습니다.
   프로젝트 ID는 `.firebaserc` 의 `REPLACE_ME` 에도 넣습니다.

## 2. 보안 규칙 배포

둘 중 하나를 고릅니다.

- **콘솔**: Firestore > 규칙 탭에 `firestore.rules` 내용을 그대로 붙여 넣고 게시.
- **CLI**: 터미널에서 pskword@gmail.com 으로 로그인한 뒤 배포합니다.

```bash
cd C:/Github_Personal/ucanon/jmp/hogwarts/test && npm install && npx firebase login
```

```bash
cd C:/Github_Personal/ucanon/jmp/hogwarts/test && npx firebase deploy --only firestore:rules --project 프로젝트ID
```

## 3. 관리자 등록

Firestore > 데이터에서 컬렉션 `admins` 를 만들고, 문서 ID를 `pskword@gmail.com` 으로 합니다.
필드는 필요 없습니다(콘솔이 요구하면 아무 필드나 하나 넣어도 됩니다).
관리자를 더 두려면 같은 방식으로 이메일 문서를 추가합니다.

## 4. 시험 후 공개

1. 로컬에서 실제 DB로 시험하려면 `http://localhost:포트/jmp/hogwarts/?prod` 처럼 `?prod` 를 붙입니다.
   붙이지 않으면 localhost에서는 에뮬레이터에 연결합니다.
2. 한 번 끝까지 풀어 보고 `?admin=1` 에서 결과와 CSV를 확인합니다.
3. 관리자 화면의 **이 게임 데이터 삭제**로 시험 데이터를 지웁니다.
4. GitHub에 푸시하면 https://ucanon.com/jmp/hogwarts/ 에 반영됩니다.

## 운영

- **새 회차**: 주소에 `?game=회차ID` 를 붙여 공유합니다(예: `?game=class-a`). 관리자도
  `?admin=1&game=class-a` 로 봅니다. 기본 회차를 바꾸려면 `js/firebase-config.js` 의 `DEFAULT_GAME_ID`.
- **한 기기 여러 명**: 첫 화면에서 다시 시작하면 새 참가자로 등록됩니다.
- **개인정보**: 이름이 공개 순위판에 보입니다. 행사 후 관리자 화면에서 데이터를 삭제하세요.
- **관리자 로그인**: 팝업 방식입니다. 카카오톡 같은 앱 안 브라우저에서는 막히므로 Chrome·Safari에서 엽니다.
- **문항 수 변경**: `firestore.rules` 의 `maxQuestions()` 와 `js/firebase-config.js` 의 `TOTAL_QUESTIONS` 를 함께 바꿉니다.

## 보안 규칙이 막는 것

`test/rules.test.mjs` 의 37개 항목으로 확인했습니다.

- 남의 참가자 이름으로 답안 제출, 이름·기숙사 변경
- 같은 문항 재제출, 문항 건너뛰기, 10문항 초과 제출
- 답안과 맞지 않는 점수·정답 수 증가, 없는 확신도 사용
- 응답자나 일반 Google 계정의 답안 목록 열람, 스스로 관리자 등록

정답표는 페이지 소스에 공개되어 있어, 마음먹고 소스를 보면 정답을 알 수 있습니다.
교실 행사용으로는 충분하지만 시험 용도라면 서버 측 채점(Cloud Functions, 유료)이 필요합니다.

## 로컬 개발

```bash
cd C:/Github_Personal/ucanon/jmp/hogwarts/test && npm install && npm test
```

에뮬레이터를 띄워 두고 페이지를 직접 보려면 `npm run emulators` 후 `C:/Github_Personal/ucanon` 을
정적 서버로 열어 `/jmp/hogwarts/` 로 접속합니다. 에뮬레이터 관리자 등록은 다음 명령으로 합니다.

```bash
curl -X POST "http://127.0.0.1:8080/v1/projects/demo-hogwarts/databases/(default)/documents/admins?documentId=pskword@gmail.com" -H "Authorization: Bearer owner" -H "Content-Type: application/json" -d "{\"fields\":{}}"
```
