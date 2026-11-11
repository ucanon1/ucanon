// 사용자 화면: 이름 → 기숙사 선택 → 10문항(정답 + 확신도) → 결과
// 답안은 제출할 때마다 Firestore에 저장되고, 기숙사 점수와 순위는 실시간으로 갱신됩니다.
import * as db from './hogwarts-db.js?v=202611111928';
import { HOUSES, QUESTIONS, TIERS, INTRO } from './data.js?v=202611111928';
import { $, $$, esc, richText, signed, signClass, houseOf, choiceText, LETTERS, scoreStrip, rankingTable } from './ui.js?v=202611111928';

const T = {
  ko: {
    begin: '기숙사 배정식 시작', resume: '이어서 풀기', review: '내 결과 보기', restart: '새 참가자로 시작',
    restartConfirm: '지금 기록은 그대로 저장되어 있습니다. 새 참가자로 처음부터 시작할까요?',
    hat: '마법의 분류 모자', nameTitle: '참가자 이름을 입력하세요', nameLabel: '이름', namePh: '이름 입력', next: '계속',
    houseTitle: '어느 기숙사를 대표할까요?', houseHint: '기숙사 특징만 보고 선택하세요. 선택 후에는 바꿀 수 없습니다.',
    question: '문제', personal: '개인 점수', correct: '정답', rank: '순위', rankUnit: '위',
    risk: '확신도가 높을수록 정답 보상도 커지지만, 오답 시 감점도 커집니다.', confidence: '정답 확신도',
    right: n => `정답 +${n}`, wrong: n => `오답 −${n}`, submit: '답안 제출', saving: '저장 중…', saveFail: '저장 실패 · 다시 시도',
    saved: '저장됨', savingState: '저장 중', saveError: '저장 실패', ok: '정답!', no: '오답',
    yourAnswer: '내 답', rightAnswer: '정답', thisPoints: '이번 문제 점수', total: '개인 누적', houseScores: '전체 기숙사 점수',
    ranking: '참가자 순위', nextQ: '다음 문제', results: '결과 보기', finishTitle: '모든 문제를 마쳤습니다!',
    finalHouses: '기숙사 점수', myAnswers: '내 답안', savedAll: '모든 답안이 저장되었습니다.', loading: '불러오는 중…',
    q: '문항', conf: '확신도', pts: '점수', yes: '정답', noShort: '오답', resultOf: id => `${id} 결과`,
    removed: '관리자가 이 참가 기록을 삭제했습니다'
  },
  en: {
    begin: 'Begin the Sorting', resume: 'Continue', review: 'View my results', restart: 'Start as a new player',
    restartConfirm: 'Your current record stays saved. Start over as a new player?',
    hat: 'THE SORTING HAT', nameTitle: 'Enter your name', nameLabel: 'Name', namePh: 'Your name', next: 'Continue',
    houseTitle: 'Choose your House', houseHint: 'Choose based on each House’s traits. You cannot change it later.',
    question: 'QUESTION', personal: 'PERSONAL SCORE', correct: 'correct', rank: 'Rank', rankUnit: '',
    risk: 'Higher confidence means a bigger reward for a correct answer—and a bigger penalty for a wrong one.', confidence: 'HOW CONFIDENT ARE YOU?',
    right: n => `Right +${n}`, wrong: n => `Wrong −${n}`, submit: 'Submit Answer', saving: 'Saving…', saveFail: 'Save failed · Retry',
    saved: 'Saved', savingState: 'Saving', saveError: 'Save failed', ok: 'Correct!', no: 'Not quite',
    yourAnswer: 'Your answer', rightAnswer: 'Correct answer', thisPoints: 'THIS ANSWER', total: 'PERSONAL TOTAL', houseScores: 'ALL HOUSE SCORES',
    ranking: 'PARTICIPANT RANKING', nextQ: 'Next Question', results: 'See Results', finishTitle: 'You’ve completed the quiz!',
    finalHouses: 'HOUSE SCORES', myAnswers: 'MY ANSWERS', savedAll: 'All of your answers have been saved.', loading: 'Loading…',
    q: 'Question', conf: 'Confidence', pts: 'Points', yes: 'Correct', noShort: 'Wrong', resultOf: id => `${id} RESULT`,
    removed: 'This record was removed by the organizer'
  }
};

const STORE_KEY = 'hogwarts-game:' + db.GAME_ID;
let lang = 'ko';
let view = 'home';
let state = load();
let choice = { answer: '', tier: 0 };
let board = null;          // 최신 순위판 { houses, participants }
let prevHouses = null;     // 직전 기숙사 점수(바뀐 칸 강조용)
let saveState = 'saved';
let lastResult = null;     // 방금 제출한 답안(피드백 화면용)
const t = () => T[lang];
const stage = $('#stage');

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { return null; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* 저장소를 못 쓰는 브라우저 */ }
}
const myPoints = () => state?.answers.reduce((n, a) => n + a.points, 0) ?? 0;
const myCorrect = () => state?.answers.filter(a => a.correct).length ?? 0;
const finished = () => state && state.index >= QUESTIONS.length;
const myRank = () => {
  const i = board?.participants.findIndex(p => p.id === state?.id) ?? -1;
  return i >= 0 ? i + 1 : null;
};
// 서버 순위판이 아직 내 최신 점수를 반영하지 못했을 때도 화면이 어긋나지 않도록 내 기숙사 점수를 보정합니다.
function houseTotals() {
  const totals = { ...(board?.houses ?? Object.fromEntries(HOUSES.map(h => [h.id, 0]))) };
  if (state?.house) {
    const mine = board?.participants.find(p => p.id === state.id);
    totals[state.house] += myPoints() - (mine?.score ?? 0);
  }
  return totals;
}

// ---- 화면 ----

function render() {
  document.documentElement.lang = lang;
  stage.innerHTML = ({ home: homeView, name: nameView, house: houseView, question: questionView, feedback: feedbackView, finish: finishView })[view]();
  if (['question', 'feedback', 'finish'].includes(view)) db.results().catch(() => {});
  window.scrollTo(0, 0);
  const focus = $('[data-autofocus]', stage);
  if (focus) focus.focus();
}

function homeView() {
  const s = t();
  const actions = !state ? `<button class="btn" data-action="begin">${s.begin}　→</button>`
    : finished() ? `<button class="btn" data-action="review">${s.review}　→</button><button class="btn btn-ghost" data-action="restart">${s.restart}</button>`
    : `<button class="btn" data-action="resume">${s.resume}　→</button><button class="btn btn-ghost" data-action="restart">${s.restart}</button>`;
  return `<section class="hero">
    <div class="crest" aria-hidden="true">✦</div>
    <p class="eyebrow">HOGWARTS SCHOOL OF WITCHCRAFT AND WIZARDRY</p>
    <h1>House Cup<br><em>Critical Thinking Trivia</em></h1>
    <div class="divider" aria-hidden="true">✦　✦　✦</div>
    <section class="panel intro">${INTRO[lang]}</section>
    <div class="hero-actions">${actions}</div>
  </section>`;
}

function nameView() {
  const s = t();
  return `<div class="stage-head"><p class="eyebrow">${s.hat}</p><h2>${s.nameTitle}</h2></div>
    <form class="panel stack" data-form="name" style="max-width:420px;margin:0 auto">
      <label class="field">${s.nameLabel}<input id="playerName" maxlength="30" autocomplete="name" required placeholder="${s.namePh}" value="${esc(state?.name || '')}" data-autofocus></label>
      <button class="btn btn-block" type="submit">${s.next}　→</button>
    </form>`;
}

function houseView() {
  const s = t();
  return `<div class="stage-head"><p class="eyebrow">${s.hat}</p><h2>${s.houseTitle}</h2><p class="subtle">${s.houseHint}</p></div>
    <div class="house-grid">${HOUSES.map(h => `
      <button class="house-card" type="button" data-house="${h.id}" data-pick-house="${h.id}">
        <span class="house-icon" aria-hidden="true">${h.icon}</span><b>${h.name}</b>
        <span class="traits">${lang === 'ko' ? h.traits : h.en}</span>
        <span class="desc">${lang === 'ko' ? h.desc : h.edesc}</span>
      </button>`).join('')}</div>`;
}

function progressMarkup() {
  const s = t(), n = Math.min(state.index + 1, QUESTIONS.length);
  return `<div class="progress"><div class="progress-meta"><span>${s.question} ${n} / ${QUESTIONS.length}</span><span>${esc(state.name)}</span></div>
    <div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${QUESTIONS.length}" aria-valuenow="${state.index}"><i style="width:${state.index / QUESTIONS.length * 100}%"></i></div></div>`;
}

function personalMarkup() {
  const s = t(), h = houseOf(state.house), rank = myRank();
  const saveLabel = { saved: s.saved, saving: s.savingState, error: s.saveError }[saveState];
  return `<div class="personal-strip" data-personal data-house="${state.house}">
    <span class="who">${esc(state.name)} · <b>${h.icon} ${h.name}</b></span>
    <span class="points">${s.personal}　${signed(myPoints())}</span>
    <small>${myCorrect()}/${state.answers.length} ${s.correct}${rank ? ` · ${s.rank} ${rank}${s.rankUnit}` : ''}</small>
    <span class="save-status" data-state="${saveState}">${saveLabel}</span>
  </div>`;
}

function questionView() {
  const s = t(), q = QUESTIONS[state.index];
  const choices = lang === 'ko' ? q.choices : q.enChoices;
  return `${progressMarkup()}${scoreStrip(houseTotals(), { mine: state.house })}${personalMarkup()}
    <article class="panel question-card">
      <p class="eyebrow">${q.id}　✦　${esc(lang === 'ko' ? q.title : q.enTitle)}</p>
      <div class="question-copy">${richText(lang === 'ko' ? q.ko : q.en)}</div>
      <div class="choices" role="radiogroup">${choices.map((c, i) => `
        <button class="choice${choice.answer === LETTERS[i] ? ' selected' : ''}" type="button" role="radio" aria-checked="${choice.answer === LETTERS[i]}" data-answer="${LETTERS[i]}"><span>${LETTERS[i]}</span>${esc(c)}</button>`).join('')}</div>
      <p class="risk-note">${s.risk}</p>
      <p class="eyebrow confidence-title">${s.confidence}</p>
      <div class="tiers" role="radiogroup">${TIERS.map(n => `
        <button class="tier${choice.tier === n ? ' selected' : ''}" type="button" role="radio" aria-checked="${choice.tier === n}" data-tier="${n}">${n}%<small>${s.right(n)} · ${s.wrong(n)}</small></button>`).join('')}</div>
      <button id="submitAnswer" class="btn btn-block" type="button" ${choice.answer && choice.tier ? '' : 'disabled'}>${s.submit}　→</button>
    </article>`;
}

function feedbackView() {
  const s = t(), r = lastResult, q = QUESTIONS.find(x => x.id === r.questionId), rank = myRank();
  const last = state.index >= QUESTIONS.length;
  return `<section class="panel feedback">
    <p class="eyebrow">${s.resultOf(r.questionId)}</p>
    <div class="verdict ${r.correct ? 'ok' : 'no'}">${r.correct ? s.ok : s.no}</div>
    <div class="answer-compare">
      <div><small>${s.yourAnswer} · ${r.confidence}%</small><b>${r.answer}</b> ${esc(choiceText(q, r.answer, lang))}</div>
      <div><small>${s.rightAnswer}</small><b>${q.answer}</b> ${esc(choiceText(q, q.answer, lang))}</div>
    </div>
    <p class="section-label">${s.thisPoints}</p>
    <div class="delta ${r.points > 0 ? 'up' : 'down'}">${signed(r.points)}</div>
    <div class="personal-total" data-personal-total>${personalTotalInner()}</div>
    <p class="section-label">${s.houseScores}</p>
    <div data-live-strip>${scoreStrip(houseTotals(), { mine: state.house, large: true })}</div>
    <section class="rankings"><h3>${s.ranking}</h3><div data-rankings>${board ? rankingTable(board.participants, { you: state.id, limit: 10, lang }) : `<p class="subtle center">${s.loading}</p>`}</div></section>
    <div class="row center" style="margin-top:24px"><button class="btn" data-action="next" data-autofocus>${last ? s.results : s.nextQ}　→</button></div>
  </section>`;
}

function personalTotalInner() {
  const s = t(), h = houseOf(state.house), rank = myRank();
  return `<span>${esc(state.name)} · ${h.icon} ${h.name} · ${s.total}</span><b>${signed(myPoints())}</b>
    <small>${myCorrect()}/${state.answers.length} ${s.correct}${rank ? ` · ${s.rank} ${rank}${s.rankUnit}` : ''}</small>`;
}

function finishView() {
  const s = t();
  return `<section class="panel finish">
    <p class="eyebrow">THE GREAT HALL · HOUSE CUP</p>
    <div class="crest" aria-hidden="true">🏆</div>
    <h2>${s.finishTitle}</h2>
    <div class="personal-total" data-personal-total>${personalTotalInner()}</div>
    <p class="section-label">${s.finalHouses}</p>
    <div data-live-strip>${scoreStrip(houseTotals(), { mine: state.house, large: true })}</div>
    <section class="rankings"><h3>${s.myAnswers}</h3>${myAnswersTable()}</section>
    <section class="rankings"><h3>${s.ranking}</h3><div data-rankings>${board ? rankingTable(board.participants, { you: state.id, lang }) : `<p class="subtle center">${s.loading}</p>`}</div></section>
    <p class="subtle" style="margin-top:20px">${s.savedAll}</p>
    <div class="row center"><button class="btn btn-ghost" data-action="restart">${s.restart}</button></div>
  </section>`;
}

function myAnswersTable() {
  const s = t();
  return `<div class="table-wrap"><table><thead><tr><th>${s.q}</th><th>${s.yourAnswer}</th><th>${s.rightAnswer}</th><th class="num">${s.conf}</th><th class="num">${s.pts}</th></tr></thead><tbody>${state.answers.map(a => {
    const q = QUESTIONS.find(x => x.id === a.questionId);
    return `<tr><td>${a.questionId} · ${esc(lang === 'ko' ? q.title : q.enTitle)}</td><td>${a.answer} <span class="tag ${a.correct ? 'ok' : 'no'}">${a.correct ? s.yes : s.noShort}</span></td><td>${q.answer}</td><td class="num">${a.confidence}%</td><td class="num ${signClass(a.points)}">${signed(a.points)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

// ---- 실시간 갱신(선택 중인 답은 건드리지 않고 점수 영역만 바꿉니다) ----

function patchLive() {
  if (!state?.house) return;
  const totals = houseTotals();
  $$('[data-score-strip]', stage).forEach(el => {
    const large = el.classList.contains('large');
    el.outerHTML = scoreStrip(totals, { mine: state.house, large, previous: prevHouses });
  });
  prevHouses = totals;
  const personal = $('[data-personal]', stage);
  if (personal) personal.outerHTML = personalMarkup();
  const total = $('[data-personal-total]', stage);
  if (total) total.innerHTML = personalTotalInner();
  const rankings = $('[data-rankings]', stage);
  if (rankings && board) rankings.innerHTML = rankingTable(board.participants, { you: state.id, limit: view === 'feedback' ? 10 : 0, lang });
}

db.onBoard(b => { board = b; patchLive(); });

function setSaveState(next) {
  saveState = next;
  const el = $('.save-status', stage);
  if (el) { el.dataset.state = next; el.textContent = { saved: t().saved, saving: t().savingState, error: t().saveError }[next]; }
}

// ---- 동작 ----

async function submit() {
  const s = t(), q = QUESTIONS[state.index];
  const correct = choice.answer === q.answer;
  let answer = { questionId: q.id, answer: choice.answer, confidence: choice.tier, correct, points: correct ? choice.tier : -choice.tier };
  const button = $('#submitAnswer');
  button.disabled = true;
  button.textContent = s.saving;
  $$('.choice, .tier', stage).forEach(b => { b.disabled = true; });
  setSaveState('saving');
  try {
    await db.submitAnswer(state, answer);
  } catch (e) {
    // 앞선 시도가 이미 저장됐다면 서버 기록을 따릅니다.
    const recovered = e.code === 'permission-denied' ? await db.recover(state, q.id).catch(() => null) : null;
    if (recovered?.removed) {
      setSaveState('error');
      button.textContent = s.removed;
      stage.insertAdjacentHTML('beforeend', `<div class="row center" style="margin-top:16px"><button class="btn" data-action="restartNow">${s.restart}</button></div>`);
      return;
    }
    if (!recovered) {
      console.error(e);
      setSaveState('error');
      button.disabled = false;
      button.textContent = s.saveFail;
      $$('.choice, .tier', stage).forEach(b => { b.disabled = false; });
      return;
    }
    answer = recovered;
  }
  state.answers.push({ ...answer, at: new Date().toISOString() });
  state.index++;
  save();
  setSaveState('saved');
  lastResult = answer;
  choice = { answer: '', tier: 0 };
  view = 'feedback';
  render();
}

function startNew() {
  state = { id: crypto.randomUUID(), name: '', house: '', index: 0, answers: [], joined: false };
  save();
  choice = { answer: '', tier: 0 };
  view = 'name';
  render();
}

function viewForState() {
  if (!state) return 'home';
  if (!state.name) return 'name';
  if (!state.house) return 'house';
  return finished() ? 'finish' : 'question';
}

stage.addEventListener('submit', e => {
  if (e.target.dataset.form !== 'name') return;
  e.preventDefault();
  const name = $('#playerName').value.trim().replace(/\s+/g, ' ');
  if (!name) return $('#playerName').focus();
  state.name = name;
  save();
  view = 'house';
  render();
});

stage.addEventListener('click', e => {
  const el = e.target.closest('button');
  if (!el || el.disabled) return;
  const action = el.dataset.action;
  if (action === 'begin' || action === 'restartNow') return startNew();
  if (action === 'resume' || action === 'review') { view = viewForState(); return render(); }
  if (action === 'restart') { if (confirm(t().restartConfirm)) startNew(); return; }
  if (action === 'next') { view = viewForState(); return render(); }
  if (el.dataset.pickHouse) { state.house = el.dataset.pickHouse; save(); view = 'question'; return render(); }
  if (el.dataset.answer || el.dataset.tier) {
    if (el.dataset.answer) choice.answer = el.dataset.answer;
    if (el.dataset.tier) choice.tier = Number(el.dataset.tier);
    $$('.choice', stage).forEach(b => { const on = b.dataset.answer === choice.answer; b.classList.toggle('selected', on); b.setAttribute('aria-checked', on); });
    $$('.tier', stage).forEach(b => { const on = Number(b.dataset.tier) === choice.tier; b.classList.toggle('selected', on); b.setAttribute('aria-checked', on); });
    $('#submitAnswer').disabled = !(choice.answer && choice.tier);
    return;
  }
  if (el.id === 'submitAnswer') submit();
});

// 언어 선택: 고른 언어 버튼을 눌린 상태로 표시하고, 다음 방문에도 기억합니다.
function applyLang(next) {
  lang = next;
  try { localStorage.setItem('hogwarts-lang', lang); } catch { /* 저장소를 못 쓰는 브라우저 */ }
  $$('.lang-switch [data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  $('#adminLink').textContent = lang === 'ko' ? '관리자' : 'Admin';
}

$('.lang-switch').addEventListener('click', e => {
  const btn = e.target.closest('[data-lang]');
  if (!btn || btn.dataset.lang === lang) return;
  applyLang(btn.dataset.lang);
  if (view === 'feedback' && !lastResult) view = viewForState();
  render();
});

try { if (localStorage.getItem('hogwarts-lang') === 'en') applyLang('en'); } catch { /* 기본은 한국어 */ }

// 회차(?game=)를 관리자 링크와 로고 링크에 이어 붙입니다.
if (new URLSearchParams(location.search).has('game')) {
  const qs = '?game=' + encodeURIComponent(db.GAME_ID);
  $('#adminLink').href = 'admin.html' + qs;
  $('#brandLink').href = './' + qs;
}

// 로고를 누르면 첫 화면으로(이어서 풀기·새 참가자로 시작 선택)
$('#brandLink').addEventListener('click', e => {
  if (e.button !== 0 || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  view = 'home';
  render();
});

// 풀던 문제가 있으면 바로 이어서, 아니면 첫 화면부터
view = state?.house && !finished() ? 'question' : 'home';
render();
