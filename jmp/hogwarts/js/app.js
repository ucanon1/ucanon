// 사용자 화면: 안내 카드 → 이름 → 기숙사 → 규칙 카드(판돈 체험) → 10문항(정답 + 확신도) → 결과
// 답안은 제출할 때마다 Firestore에 저장되고, 기숙사 점수와 순위는 실시간으로 갱신됩니다.
import * as db from './hogwarts-db.js?v=202611112237';
import { HOUSES, QUESTIONS, TIERS, INTRO_PAGES, RULE_PAGES } from './data.js?v=202611112237';
import { $, $$, esc, richText, signed, signClass, houseOf, choiceText, LETTERS, scoreStrip, rankingTable } from './ui.js?v=202611112237';

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
    removed: '관리자가 이 참가 기록을 삭제했습니다',
    back: '이전', nextCard: '다음', startQuiz: '문제 풀기 시작', compete: '의 대표로 출전합니다.',
    stepPick: '① 답 고르기', stepPickSub: '선지 A–D 중 하나', stepBet: '② 확신도 걸기',
    warn: '95%를 걸고 틀리면 <b>−95</b>. 30%를 건 정답 세 번(+90)으로도 메울 수 없습니다.',
    bet: '판돈', simRight: '맞았다 ✓', simWrong: '틀렸다 ✗',
    scout: '대변인처럼 자신 있는 척하지 말고, 정찰병처럼 <b>“정말 이 확률에 걸 수 있는가?”</b>를 물으세요.',
    winTitle: '정답 · 기숙사 점수 획득', loseTitle: '오답 · 기숙사 점수 감점', price: n => `확신도 ${n}%의 대가입니다.`,
    tally: '순위를 집계하는 중…', yourRank: '내 개인 순위', yourHouse: '우리 기숙사 순위', ord: n => `${n}<sup>위</sup>`, people: '명',
    chaseUp: n => `바로 위 순위까지 <b>${n}점</b>`, chaseLead: n => `개인 1위 — 추격자와 <b>${n}점</b> 차`, chaseSolo: '개인 1위',
    hChaseUp: (name, n) => `${name}까지 <b>${n}점</b>`, hChaseLead: n => `기숙사 선두 — 2위와 <b>${n}점</b> 차`, hChaseSolo: '기숙사 선두',
    houseCup: '기숙사 대항전', top5: '개인 순위 TOP 5', me: ' (나)'
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
    removed: 'This record was removed by the organizer',
    back: 'Back', nextCard: 'Next', startQuiz: 'Start the Quiz', compete: ' — you now compete for this House.',
    stepPick: '① Pick an answer', stepPickSub: 'One of A–D', stepBet: '② Bet your confidence',
    warn: 'Bet 95% and miss: <b>−95</b>. Three correct 30% answers (+90) cannot cover it.',
    bet: 'Bet', simRight: 'Right ✓', simWrong: 'Wrong ✗',
    scout: 'Don’t sound sure like a press secretary. Ask like a scout: <b>“Would I really bet on this?”</b>',
    winTitle: 'CORRECT · POINTS FOR YOUR HOUSE', loseTitle: 'WRONG · POINTS LOST', price: n => `The price of ${n}% confidence.`,
    tally: 'Tallying the standings…', yourRank: 'YOUR RANK', yourHouse: 'YOUR HOUSE', ord: n => `<sup>#</sup>${n}`, people: '',
    chaseUp: n => `<b>${n} pts</b> to the next rank`, chaseLead: n => `1st — <b>${n} pts</b> ahead`, chaseSolo: '1st place',
    hChaseUp: (name, n) => `<b>${n} pts</b> behind ${name}`, hChaseLead: n => `House lead: <b>${n} pts</b>`, hChaseSolo: 'House lead',
    houseCup: 'HOUSE CUP STANDINGS', top5: 'TOP 5', me: ' (you)'
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
let introPage = 0, rulePage = 0;          // 안내·규칙 카드 쪽 번호
let simTier = 95, simScore = 0;           // 판돈 체험
let rankBefore = { rank: null, hrank: null }; // 이번 문제를 내기 전 순위(▲▼ 표시용)
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

// 내 최신 점수를 반영한 순위표(서버 반영 전에도 어긋나지 않게)
function liveStandings() {
  const ps = (board?.participants ?? []).map(p => ({ ...p }));
  if (state?.house) {
    const mine = ps.find(p => p.id === state.id);
    if (mine) { mine.score = myPoints(); mine.correct_count = myCorrect(); mine.answered = state.answers.length; }
    else if (state.answers.length) ps.push({ id: state.id, name: state.name, house: state.house, score: myPoints(), correct_count: myCorrect(), answered: state.answers.length });
  }
  ps.sort((a, b) => b.score - a.score || b.correct_count - a.correct_count);
  const totals = houseTotals();
  const houses = HOUSES.map(h => ({ ...h, score: totals[h.id] || 0 })).sort((a, b) => b.score - a.score);
  return { ps, houses };
}

// ---- 화면 ----

function render() {
  document.documentElement.lang = lang;
  stage.innerHTML = ({ home: homeView, name: nameView, house: houseView, rules: rulesView, question: questionView, feedback: feedbackView, finish: finishView })[view]();
  if (['question', 'feedback', 'finish'].includes(view)) db.results().catch(() => {});
  window.scrollTo(0, 0);
  const focus = $('[data-autofocus]', stage);
  if (focus) focus.focus({ preventScroll: true });
}

// 안내·규칙 카드 한 장과 넘김 단추
function card(pages, i, kind, lastLabel, showLast = true) {
  const s = t(), p = pages[i], T2 = p[lang], last = i === pages.length - 1;
  const extra = { houses: houseRow, twoStep, ledger }[p.extra]?.() ?? '';
  const pre = kind === 'rules' && i === 0 && state?.house ? `<p>${houseOf(state.house).icon} <b>${houseOf(state.house).name}</b>${s.compete}</p>` : '';
  const nextBtn = last
    ? (showLast ? `<button class="btn" data-card="${kind}" data-step="1">${lastLabel}　→</button>` : '<span></span>')
    : `<button class="btn" data-card="${kind}" data-step="1">${s.nextCard}　→</button>`;
  return `<article class="intro-card page-in"><div class="seal" aria-hidden="true">${p.seal}</div><h2>${T2.t}</h2>${pre}${T2.b}${extra}</article>
    <div class="intro-nav"><button class="btn btn-ghost" data-card="${kind}" data-step="-1" ${i ? '' : 'disabled'}>← ${s.back}</button>
      <div class="intro-dots" aria-label="${i + 1} / ${pages.length}">${pages.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>${nextBtn}</div>`;
}
const houseRow = () => `<div class="house-row">${HOUSES.map(h => `<span data-house="${h.id}" title="${h.name}">${h.icon}</span>`).join('')}</div>`;
const twoStep = () => { const s = t(); return `<div class="two-step"><div><b>${s.stepPick}</b>${s.stepPickSub}</div><div><b>${s.stepBet}</b>95 · 75 · 60 · 45 · 30%</div></div>`; };
function ledger() {
  const s = t();
  return `<div class="ledger" role="radiogroup">${TIERS.map(n => `<button type="button" class="lrow${n === simTier ? ' on' : ''}" data-sim-tier="${n}" role="radio" aria-checked="${n === simTier}">
      <span class="l"><i style="width:${n}%">−${n}</i></span><b>${n}%</b><span class="r"><i style="width:${n}%">+${n}</i></span></button>`).join('')}</div>
    <p class="warn-note">${s.warn}</p>
    <div class="sim"><span>${s.bet} <b id="simTier">${simTier}</b>%</span><span class="sim-score${simScore < 0 ? ' down' : ''}" id="simScore">${simScore > 0 ? '+' : simScore < 0 ? '−' : ''}${Math.abs(simScore)}</span>
      <button class="btn btn-sm" type="button" data-sim="1">${s.simRight}</button><button class="btn btn-ghost btn-sm" type="button" data-sim="-1">${s.simWrong}</button></div>
    <p>${s.scout}</p>`;
}

function homeView() {
  const s = t();
  const actions = !state ? ''
    : finished() ? `<button class="btn" data-action="review">${s.review}　→</button><button class="btn btn-ghost" data-action="restart">${s.restart}</button>`
    : `<button class="btn" data-action="resume">${s.resume}　→</button><button class="btn btn-ghost" data-action="restart">${s.restart}</button>`;
  return `<section class="hero${introPage > 0 ? ' compact' : ''}">
    <div class="crest" aria-hidden="true">✦</div>
    <p class="eyebrow">HOGWARTS SCHOOL OF WITCHCRAFT AND WIZARDRY</p>
    <h1>House Cup<br><em>Critical Thinking Trivia</em></h1>
    <div class="divider" aria-hidden="true">✦　✦　✦</div>
    ${card(INTRO_PAGES, introPage, 'intro', s.begin, !state)}
    ${actions ? `<div class="hero-actions">${actions}</div>` : ''}
  </section>`;
}

function rulesView() {
  return `<section class="hero compact">${card(RULE_PAGES, rulePage, 'rules', t().startQuiz)}</section>`;
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
        <button class="tier${choice.tier === n ? ' selected' : ''}" type="button" role="radio" aria-checked="${choice.tier === n}" data-tier="${n}">${n}%<small><span class="long">${s.right(n)} · ${s.wrong(n)}</span><span class="short">±${n}</span></small></button>`).join('')}</div>
      <button id="submitAnswer" class="btn btn-block" type="button" ${choice.answer && choice.tier ? '' : 'disabled'}>${s.submit}　→</button>
    </article>`;
}

function feedbackView() {
  const s = t(), r = lastResult, last = state.index >= QUESTIONS.length;
  return `<section class="panel feedback ${r.correct ? 'win' : 'lose'}">
    <span class="big-delta">${r.points > 0 ? '+' : '−'}${Math.abs(r.points)}</span>
    <p class="eyebrow">${r.correct ? s.winTitle : s.loseTitle}</p>
    ${!r.correct && r.confidence >= 75 ? `<p class="subtle">${s.price(r.confidence)}</p>` : ''}
    <section class="rank-board" data-rank-board>${board ? rankBoard() : `<p class="subtle center">${s.tally}</p>`}</section>
    <div class="row center next-row"><button class="btn" data-action="next" data-autofocus>${last ? s.results : s.nextQ}　→</button></div>
  </section>`;
}

// 내 순위·기숙사 순위(이전 문제 대비 ▲▼), 추격 점수, 기숙사 대항전, TOP 5
function rankBoard() {
  const s = t(), { ps, houses } = liveStandings();
  const ms = myPoints(), rank = ps.filter(p => p.score > ms).length + 1, total = Math.max(ps.length, 1);
  const myH = houses.find(h => h.id === state.house), hr = houses.filter(h => h.score > myH.score).length + 1;
  const mv = (before, now) => before ? (before > now ? `<em class="mv up">▲ ${before - now}</em>` : before < now ? `<em class="mv down">▼ ${now - before}</em>` : '<em class="mv">–</em>') : '';
  const up = ps.filter(p => p.score > ms).sort((a, b) => a.score - b.score)[0];
  const dn = ps.filter(p => p.score < ms).sort((a, b) => b.score - a.score)[0];
  const chase = up ? s.chaseUp(up.score - ms) : dn ? s.chaseLead(ms - dn.score) : s.chaseSolo;
  const ha = houses.filter(h => h.score > myH.score).pop(), hb = houses.filter(h => h.score < myH.score)[0];
  const hchase = ha ? s.hChaseUp(ha.name, ha.score - myH.score) : hb ? s.hChaseLead(myH.score - hb.score) : s.hChaseSolo;
  const hmin = Math.min(...houses.map(h => h.score)), hmax = Math.max(...houses.map(h => h.score));
  const medal = ['🥇', '🥈', '🥉', '4'];
  const hrows = houses.map(h => `<div class="lad${h.id === state.house ? ' me' : ''}" data-house="${h.id}"><b>${medal[houses.filter(x => x.score > h.score).length]}</b><span>${h.icon} ${h.name}</span><span class="bar"><i style="width:${hmax === hmin ? 50 : 8 + (h.score - hmin) / (hmax - hmin) * 92}%"></i></span><b>${signed(h.score)}</b></div>`).join('');
  const prow = (p, n, me) => `<div class="lad${me ? ' me' : ''}" data-house="${p.house}"><b>${n}</b><span>${esc(p.name)}${me ? s.me : ''} ${houseOf(p.house)?.icon ?? ''}</span><small>${p.correct_count}/${QUESTIONS.length}</small><b>${signed(p.score)}</b></div>`;
  const top = ps.slice(0, 5).map(p => prow(p, ps.filter(x => x.score > p.score).length + 1, p.id === state.id)).join('')
    + (rank > 5 ? '<p class="subtle center" style="margin:0">⋯</p>' + prow({ name: state.name, house: state.house, score: ms, correct_count: myCorrect() }, rank, true) : '');
  return `<div class="rank-hero">
      <div class="rank-box"><small>${s.yourRank}</small><b>${s.ord(rank)}</b><span class="subtle">/ ${total}${s.people}</span>${mv(rankBefore.rank, rank)}</div>
      <div class="rank-box" data-house="${myH.id}"><small>${s.yourHouse}</small><b>${s.ord(hr)}</b><span class="subtle">${myH.icon} ${myH.name}</span>${mv(rankBefore.hrank, hr)}</div>
    </div>
    <p class="chase">${chase}　·　${hchase}</p>
    <h3>${s.houseCup}</h3><div class="ladder">${hrows}</div>
    <h3>${s.top5}</h3><div class="ladder">${top}</div>`;
}

// 현재 순위를 기억해 다음 문제 결과에서 ▲▼를 계산합니다.
function rememberRanks() {
  if (!board || !state?.house) return;
  const { ps, houses } = liveStandings(), ms = myPoints();
  const myH = houses.find(h => h.id === state.house);
  state.rank = ps.filter(p => p.score > ms).length + 1;
  state.hrank = houses.filter(h => h.score > myH.score).length + 1;
  save();
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
    <section class="rankings"><h3>${s.ranking}</h3><div data-rankings>${board ? rankingTable(board.participants, { you: state.id, lang }) : `<p class="subtle center">${s.loading}</p>`}</div></section>
    <p class="subtle" style="margin-top:20px">${s.savedAll}</p>
    <div class="row center"><button class="btn btn-ghost" data-action="restart">${s.restart}</button></div>
  </section>`;
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
  const rb = $('[data-rank-board]', stage);
  if (rb && board && view === 'feedback') rb.innerHTML = rankBoard();
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
  rankBefore = { rank: state.rank ?? null, hrank: state.hrank ?? null };
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
  state = { id: crypto.randomUUID(), name: '', house: '', index: 0, answers: [], joined: false, ruled: false };
  rulePage = 0; simTier = 95; simScore = 0;
  save();
  choice = { answer: '', tier: 0 };
  view = 'name';
  render();
}

function viewForState() {
  if (!state) return 'home';
  if (!state.name) return 'name';
  if (!state.house) return 'house';
  if (!state.ruled && state.index === 0) return 'rules';
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
  if (action === 'next') { rememberRanks(); view = viewForState(); return render(); }
  if (el.dataset.card) {
    const step = Number(el.dataset.step);
    if (el.dataset.card === 'intro') {
      if (step > 0 && introPage === INTRO_PAGES.length - 1) return startNew();
      introPage = Math.max(0, Math.min(INTRO_PAGES.length - 1, introPage + step));
    } else {
      if (step > 0 && rulePage === RULE_PAGES.length - 1) { state.ruled = true; save(); view = 'question'; return render(); }
      rulePage = Math.max(0, Math.min(RULE_PAGES.length - 1, rulePage + step));
    }
    return render();
  }
  if (el.dataset.simTier) {
    simTier = Number(el.dataset.simTier);
    $$('.lrow', stage).forEach(r => { const on = r === el; r.classList.toggle('on', on); r.setAttribute('aria-checked', on); });
    $('#simTier').textContent = simTier;
    return;
  }
  if (el.dataset.sim) {
    const v = Number(el.dataset.sim);
    simScore += v * simTier;
    const sc = $('#simScore');
    sc.textContent = (simScore > 0 ? '+' : simScore < 0 ? '−' : '') + Math.abs(simScore);
    sc.className = 'sim-score' + (v < 0 ? ' down' : '');
    void sc.offsetWidth; // 같은 연출을 다시 재생
    sc.classList.add('hit');
    return;
  }
  if (el.dataset.pickHouse) { state.house = el.dataset.pickHouse; state.ruled = false; rulePage = 0; save(); view = 'rules'; return render(); }
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
  $('#helpLink').textContent = lang === 'ko' ? '도움말' : 'Help';
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
  introPage = 0;
  view = 'home';
  render();
});

// 대연회장의 떠다니는 촛불. 같은 배치가 나오도록 고정된 난수열을 씁니다.
(function candles() {
  const wrap = document.createElement('div');
  wrap.className = 'candles';
  wrap.setAttribute('aria-hidden', 'true');
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const count = matchMedia('(max-width: 620px)').matches ? 14 : 26;
  for (let i = 0; i < count; i++) {
    const c = document.createElement('i');
    c.className = 'candle';
    c.style.cssText = `--x:${(rnd() * 96 + 2).toFixed(1)}%;--y:${(rnd() * 70 + 4).toFixed(1)}%;--d:${(3 + rnd() * 4).toFixed(2)}s;height:${(18 + rnd() * 22).toFixed(0)}px;animation-delay:-${(rnd() * 5).toFixed(2)}s`;
    wrap.appendChild(c);
  }
  document.body.prepend(wrap);
})();

// 풀던 문제가 있으면 바로 이어서, 아니면 첫 화면부터
view = state?.house && !finished() ? viewForState() : 'home';
render();
