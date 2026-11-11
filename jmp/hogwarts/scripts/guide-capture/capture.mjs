// 사용자 가이드 화면 캡처(Playwright 번들 Chromium 헤드리스 1개만 사용)
import { mkdirSync } from 'node:fs';
const { chromium } = await import('file:///C:/Github_Personal/ai-knowledge-system/web/node_modules/playwright/index.mjs');

const EN = process.env.CAPTURE_LANG === 'en';
const SUFFIX = EN ? '-en' : '';
const OUT = 'C:/Github_Personal/ucanon/jmp/hogwarts/docs/user-guide/images';
const BASE = 'http://localhost:8765/jmp/hogwarts/';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const shots = [];
const wait = ms => new Promise(r => setTimeout(r, ms));

async function shot(page, name, opts = {}) {
  await page.evaluate(() => {
    // 개발용 에뮬레이터 표시는 실제 사이트에 없으므로 캡처에서 뺍니다.
    document.querySelectorAll('p.subtle').forEach(p => { if (p.textContent.includes('로컬 에뮬레이터')) p.remove(); });
    document.querySelectorAll('span.subtle').forEach(s => { if (!s.children.length) s.textContent = s.textContent.replace(' · 로컬 에뮬레이터', ''); });
    document.querySelectorAll('.score-house.bump').forEach(e => e.classList.remove('bump'));
  });
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await wait(250);
  const path = `${OUT}/${name}${SUFFIX}.png`;
  if (opts.selector) await page.locator(opts.selector).first().screenshot({ path });
  else if (opts.full) {
    // 고정 배경·상단바가 어긋나지 않도록 화면 높이를 페이지 전체 높이로 늘려 찍습니다.
    const vp = page.viewportSize();
    await page.evaluate(() => window.scrollTo(0, 0));
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: vp.width, height: h });
    await wait(400);
    await page.screenshot({ path });
    await page.setViewportSize(vp);
  } else await page.screenshot({ path });
  shots.push(name);
  console.log('saved', name);
}

async function answer(page, letter, tier) {
  await page.click(`[data-answer="${letter}"]`);
  await page.click(`[data-tier="${tier}"]`);
}
async function submit(page) {
  await page.click('#submitAnswer');
  await page.waitForSelector('[data-action="next"]', { timeout: 20000 });
  await page.waitForFunction(() => document.querySelector('[data-rank-board] .rank-hero'), null, { timeout: 15000 });
  await wait(600);
}

// ---------- 데스크톱 ----------
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
if (EN) await ctx.addInitScript(() => localStorage.setItem('hogwarts-lang', 'en'));
const page = await ctx.newPage();
page.on('dialog', d => d.accept());
page.on('pageerror', e => console.log('PAGE ERROR', e.message));

// 관리자 화면에서 시작(로그인 전)
await page.goto(BASE + 'admin.html');
await page.waitForSelector('#signIn');
if (!EN) await shot(page, '01-admin-login');

// 상단 '퀴즈 화면' 링크로 사용자 화면 이동
await page.click('#playLink');
await page.waitForSelector('.intro-card');
await wait(700);
await shot(page, '02-home-full', { full: true });          // 안내 카드 1: 입학 허가서
await page.click('[data-card="intro"][data-step="1"]');
await page.waitForSelector('.house-row');
await wait(600);
await shot(page, '02b-intro-houses');                        // 안내 카드 2: 네 기숙사

await page.click('[data-card="intro"][data-step="1"]');      // 기숙사 배정식 시작
await page.waitForSelector('#playerName');
await page.fill('#playerName', EN ? 'Harry' : '해리');
await shot(page, '03-name');

await page.click('[data-form="name"] button[type=submit]');
await page.waitForSelector('[data-pick-house]');
await shot(page, '04-house', { full: true });

await page.click('[data-pick-house="Gryffindor"]');
await page.waitForSelector('.two-step');
await wait(600);
await shot(page, '04b-rules-two-step', { full: true });     // 규칙 카드 1: 두 번 선택
await page.click('[data-card="rules"][data-step="1"]');
await page.waitForSelector('.ledger');
await page.click('[data-sim-tier="95"]');
await page.click('[data-sim="-1"]');                          // 95% 걸고 틀린 체험
await wait(700);
await shot(page, '04c-rules-ledger', { full: true });       // 규칙 카드 2: 판돈 체험

await page.click('[data-card="rules"][data-step="1"]');      // 문제 풀기 시작
await page.waitForSelector('.question-card');
await page.waitForFunction(() => /\+/.test(document.querySelector('[data-score-strip]')?.textContent || ''));
await shot(page, '05-question-start');
await answer(page, 'C', 75);                                  // Q1 정답 C
await shot(page, '06-question-selected', { full: true });

await submit(page);
await shot(page, '07-feedback-correct', { full: true });

await page.click('[data-action="next"]');
await page.waitForSelector('.question-card');
await answer(page, 'B', 95);                                  // Q2 정답은 A → 95% 오답 예시
await submit(page);
await shot(page, '08-feedback-wrong', { full: true });

const rest = { Q3: ['D', 60], Q4: ['B', 45], Q5: ['C', 75], Q6: ['B', 30], Q7: ['B', 60], Q8: ['D', 45], Q9: ['A', 60], Q10: ['C', 75] };
for (const [, [letter, tier]] of Object.entries(rest)) {
  await page.click('[data-action="next"]');
  await page.waitForSelector('.question-card');
  await answer(page, letter, tier);
  await submit(page);
}
await page.click('[data-action="next"]');
await page.waitForSelector('.finish');
await page.waitForFunction(() => document.querySelector('[data-rankings] table'));
await wait(600);
await shot(page, '09-finish', { full: true });

// 언어 전환
if (!EN) {
await page.click('.lang-switch [data-lang="en"]');
await wait(400);
await shot(page, '10-english');
await page.click('.lang-switch [data-lang="ko"]');
}

// 로고 → 첫 화면(돌아온 참가자)
await page.click('#brandLink');
await page.waitForSelector('.hero-actions');
await page.locator('.hero-actions').scrollIntoViewIfNeeded();
await wait(300);
await shot(page, '11-home-returning', { selector: '.hero-actions' });

// ---------- 모바일 ----------
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
if (EN) await mctx.addInitScript(() => localStorage.setItem('hogwarts-lang', 'en'));
const m = await mctx.newPage();
m.on('pageerror', e => console.log('PAGE ERROR (mobile)', e.message));
await m.goto(BASE);
await m.waitForSelector('.intro-card');
await m.click('[data-card="intro"][data-step="1"]');
await m.click('[data-card="intro"][data-step="1"]');
await m.fill('#playerName', EN ? 'Ron' : '론');
await m.click('[data-form="name"] button[type=submit]');
await m.click('[data-pick-house="Gryffindor"]');
await m.click('[data-card="rules"][data-step="1"]');
await m.click('[data-card="rules"][data-step="1"]');
await m.waitForSelector('.question-card');
await m.waitForFunction(() => /\+/.test(document.querySelector('[data-score-strip]')?.textContent || ''));
await shot(m, '12-mobile-question');
await answer(m, 'C', 95);
await submit(m);
await m.evaluate(() => window.scrollTo(0, 0));
await shot(m, '13-mobile-feedback');

if (EN) { await browser.close(); console.log('done', shots.length); process.exit(0); }
// ---------- 관리자(로그인 후) ----------
async function signInAs(p, email) {
  await p.evaluate(async email => {
    const { getApp } = await import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js');
    const { getAuth, signInWithCredential, signOut, GoogleAuthProvider } = await import('https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js');
    const auth = getAuth(getApp('admin'));
    await signOut(auth);
    await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true })));
  }, email);
}

await page.goto(BASE + 'admin.html');
await page.waitForSelector('#signIn');
await signInAs(page, 'someone@example.com');
await page.reload();
await page.waitForSelector('#signOut');
await shot(page, '14-admin-no-permission');

await signInAs(page, 'pskword@gmail.com');
await page.reload();
await page.waitForFunction(() => document.querySelector('#live')?.dataset.state === 'on');
await wait(800);
await shot(page, '15-admin-dashboard');
await shot(page, '16-admin-kpi-charts', { selector: '#kpis' });
await page.evaluate(() => document.querySelector('.grid-2').id = 'cap-grid');
await shot(page, '17-admin-house-tier', { selector: '#cap-grid' });
await shot(page, '18-admin-calibration', { selector: '#calibration' });
await shot(page, '19-admin-questions', { selector: '#questions' });
await shot(page, '20-admin-participants', { selector: '#participants' });
await shot(page, '21-admin-log', { selector: '#log' });
await page.selectOption('#fResult', 'no');
await page.selectOption('#fHouse', 'Slytherin');
await wait(300);
await shot(page, '22-admin-log-filter', { selector: '#log' });
await page.selectOption('#fResult', '');
await page.selectOption('#fHouse', '');
await shot(page, '23-admin-matrix', { selector: '#matrix' });
await page.evaluate(() => { const panels = document.querySelectorAll('#admin > .panel'); panels[panels.length - 1].id = 'cap-danger'; });
await shot(page, '24-admin-delete', { selector: '#cap-danger' });
// 전체 데이터 초기화 대화상자(확인 단계를 채운 상태, 실제 삭제는 하지 않고 취소)
await page.click('#resetAll');
await page.waitForFunction(() => /건 영구 삭제/.test(document.querySelector('#resetConfirm')?.textContent || ''));
await page.check('#resetAck');
await page.fill('#resetPhrase', '전체 초기화');
await wait(300);
await shot(page, '26-admin-reset-dialog', { selector: '#resetDialog' });
await page.click('#resetCancel');
await page.evaluate(() => document.querySelector('.admin-bar').id = 'cap-bar');
await shot(page, '25-admin-bar', { selector: '#cap-bar' });

await browser.close();
console.log('done', shots.length);
