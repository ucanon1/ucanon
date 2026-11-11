# GitHub Pages + Firebase 설문조사 시스템 검토

작성일: 2026-11-11

## 1. 검토 결론

**가능하다.** 별도 서버 없이 GitHub Pages(ucanon.com)의 정적 HTML과 Firebase JS SDK만으로
설문 응답 저장과 관리자 조회를 구현할 수 있다. ucanon 저장소는 빌드 과정 없는 순수 HTML/JS
구조이므로 페이지 두 개와 공용 초기화 스크립트를 추가하는 것으로 충분하다.

## 2. 아키텍처

```
 응답자 (로그인 없음) ──▶ survey.html ──▶ Cloud Firestore (responses 컬렉션)
                           [GitHub Pages]            ▲
                                                     │ 관리자 ID 토큰
 관리자 (Google 로그인) ──▶ admin.html  ──▶ Firebase Auth (관리자 허용 목록)
                           [GitHub Pages]
```

보안 규칙 요약: 응답자는 **생성만**, 관리자는 **읽기만** 허용.

### 구성 요소

| 구성 요소 | 역할 |
|---|---|
| survey.html | 응답자가 로그인 없이 작성. 제출 시 Firebase SDK가 Firestore에 문서를 직접 생성 |
| Cloud Firestore | `surveys/{설문ID}/responses/{자동ID}` 구조로 저장. 답변 맵 + 서버 타임스탬프 |
| admin.html | Firebase Auth Google 로그인 후 응답 표 조회, CSV 다운로드 |
| Firebase Auth | Google 로그인 제공. 승인된 도메인에 `ucanon.com` 등록 필요 |
| admins 컬렉션 | 관리자 이메일을 문서 ID로 등록. Firebase 콘솔에서만 관리 |

SDK는 gstatic CDN에서 모듈(ESM) 방식으로 불러오므로 기존 사이트 방식과 동일하게 동작한다.
Firebase Hosting은 사용하지 않는다(페이지는 GitHub Pages가 서빙).

### 데이터 모델

```
surveys/{surveyId}
  title, questions[]            # 설문 정의(공개 읽기, 관리자만 쓰기)
  responses/{autoId}
    answers: map                # 문항ID → 답변
    createdAt: serverTimestamp  # 제출 시각

admins/{email}                  # 존재 여부만 확인, 내용 없음
```

## 3. Firestore 보안 규칙 초안

Firebase 설정값(API 키 등)은 HTML에 공개되지만 정상이다. 실제 접근 통제는 규칙이 담당한다.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function isAdmin() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && exists(/databases/$(db)/documents/admins/$(request.auth.token.email));
    }
    match /surveys/{surveyId} {
      allow read: if true;            // 설문 문항 정의는 공개
      allow write: if isAdmin();
      match /responses/{id} {
        allow create: if request.resource.data.keys().hasOnly(['answers', 'createdAt'])
                      && request.resource.data.answers is map
                      && request.resource.data.answers.size() <= 50
                      && request.resource.data.createdAt == request.time;
        allow read, update, delete: if isAdmin();
      }
    }
    match /admins/{email} {
      allow read, write: if false;    // Firebase 콘솔에서만 관리
    }
  }
}
```

## 4. 대안 비교

| 방식 | 장점 | 단점 |
|---|---|---|
| 클라이언트에서 Firestore 직접 저장 (**추천**) | 무료 요금제로 충분, 구현 단순 | 스팸 방어를 규칙과 App Check에 의존 |
| Cloud Functions 경유 | 서버 측 검증·알림 가능 | 유료 요금제(Blaze) 필요 |
| Google Forms + Sheets | 가장 빠름 | 디자인·도메인 자유도 없음 |

## 5. 주의할 점

- **스팸·중복 제출**: 규칙의 필드 검증으로 1차 방어. 필요하면 App Check(reCAPTCHA v3)를 켜고,
  브라우저 localStorage에 제출 표시를 남겨 중복을 막는다.
- **개인정보**: 이름·연락처를 받는다면 수집 목적과 보관 기간을 설문 안내에 명시하고,
  관리자 페이지에 삭제 기능을 둔다.
- **비용**: Spark 무료 요금제로 소규모 설문에는 충분(아래 6절 참고).
- **저장소 공개 여부**: 저장소가 공개라면 설문 문항과 관리자 페이지 소스도 공개된다.
  데이터는 규칙으로 보호되므로 문제는 없다.

## 6. Firebase 무료(Spark) 요금제 한도

출처: https://firebase.google.com/pricing (2026-11-11 확인)

| 서비스 | 항목 | 무료 한도 |
|---|---|---|
| Cloud Firestore | 저장 용량 | 1 GiB |
| | 문서 쓰기 | 하루 2만 건 |
| | 문서 읽기 | 하루 5만 건 |
| | 문서 삭제 | 하루 2만 건 |
| | 네트워크 송신 | 월 10 GiB |
| Authentication | 월간 활성 사용자 | 5만 명 |
| | 전화번호 인증 | 무료 요금제 사용 불가 |
| Hosting | 저장 용량 | 10 GB |
| | 전송량 | 하루 360 MB |
| Cloud Functions | 전체 | 무료 요금제 사용 불가 (Blaze 필요) |
| Cloud Storage | 전체 | 무료 요금제 사용 불가 (Blaze 필요) |
| App Check | 전체 | 무료, 인증 제공자별 별도 할당량 |

### 설문 용도로 환산

- 응답 1건 = 쓰기 1건. 하루 2만 명이 제출해도 한도 안.
- 응답 문서는 보통 1 KB 안팎 → 1 GiB면 수십만 건 저장 가능.
- 관리자 조회 시 응답 수만큼 읽기 발생. 응답 수천 건이면 하루 열 번 새로고침해도 여유.
- Cloud Functions·Cloud Storage는 신용카드를 등록하는 Blaze 요금제가 필요.
  추천 구성은 Firestore와 Auth만 쓰므로 무료 범위에 머문다. 파일 첨부 설문이나
  서버 측 처리가 필요해지면 Blaze로 전환(무료 할당량은 동일, 초과분만 과금).
- 무료 요금제는 한도를 넘으면 과금 없이 요청이 거부된다. 사용량은 Firebase 콘솔
  사용량 탭에서 일별 확인.

## 7. 구축 순서

1. Firebase 콘솔에서 프로젝트 생성, Firestore와 Google 로그인 활성화,
   승인 도메인에 `ucanon.com` 추가 (수동 작업).
2. 보안 규칙 배포, `admins` 컬렉션에 관리자 이메일 등록.
3. ucanon 저장소에 survey 폴더를 만들어 설문 페이지, 관리자 페이지,
   공용 Firebase 초기화 스크립트 작성.
4. 테스트 제출 후 관리자 페이지에서 조회·CSV 확인, GitHub에 푸시.
