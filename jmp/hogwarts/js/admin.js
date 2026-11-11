// 관리자 화면: Google 로그인 → admins 허용 목록 확인 → 실시간 집계
// 참가자나 답안이 바뀌면 그래프와 표가 자동으로 다시 계산됩니다.
import * as db from './hogwarts-db.js?v=202611111928';
import { HOUSES, QUESTIONS, TIERS } from './data.js?v=202611111928';
import { $, esc, signed, signClass, houseOf, houseLabel, questionOf, choiceText, downloadCsv, formatTime, localStamp } from './ui.js?v=202611111928';
import { calibrationChart, barChart } from './charts.js?v=202611111928';

const root = $('#admin');
const filters = { text: '', house: '', question: '', result: '' };
let data = null;
let stopWatch = null;

const gameQs = new URLSearchParams(location.search).has('game') ? '?game=' + encodeURIComponent(db.GAME_ID) : '';
$('#playLink').href = './' + gameQs;
$('#brandLink').href = './' + gameQs;

function notice(html, kind = '') {
  return `<p class="notice ${kind}">${html}</p>`;
}

function loginErrorText(e) {
  const code = e?.code || '';
  if (/popup-blocked|operation-not-supported|web-storage/.test(code)) return '로그인 팝업이 막혔습니다. 팝업을 허용하거나, 카카오톡 등 앱 안의 브라우저가 아니라 Chrome·Safari에서 열어 주세요.';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return '로그인 창이 닫혔습니다.';
  if (code === 'auth/unauthorized-domain') return '이 주소는 Firebase 승인된 도메인에 없습니다.';
  return '로그인하지 못했습니다: ' + esc(code || e?.message || e);
}

// ---- 로그인 흐름 ----

function showSignedOut(message = '') {
  stopWatch?.(); stopWatch = null;
  root.innerHTML = `<div class="panel center stack" style="max-width:520px;margin:0 auto">
    <h2>관리자 로그인</h2>
    <p class="subtle">등록된 관리자 Google 계정으로 로그인하면 실시간 결과와 모든 답변 기록을 볼 수 있습니다.</p>
    <button class="btn" id="signIn" type="button">Google 계정으로 로그인 →</button>
    ${message ? notice(message, 'error') : ''}
    ${db.USE_EMULATOR ? '<p class="subtle">로컬 에뮬레이터에 연결되어 있습니다.</p>' : ''}
  </div>`;
  $('#signIn').onclick = async () => {
    try { await db.adminSignIn(); await route(); }
    catch (e) { console.error(e); showSignedOut(loginErrorText(e)); }
  };
}

async function route() {
  const user = await db.adminUser();
  if (!user) return showSignedOut();
  if (!(await db.isAdmin(user))) {
    root.innerHTML = `<div class="panel center stack" style="max-width:520px;margin:0 auto">
      <h2>권한이 없습니다</h2>
      <p class="subtle">${esc(user.email || '')} 계정은 관리자로 등록되어 있지 않습니다.</p>
      <button class="btn btn-ghost" id="signOut" type="button">다른 계정으로 로그인</button></div>`;
    $('#signOut').onclick = async () => { await db.adminSignOut(); showSignedOut(); };
    return;
  }
  showDashboard(user);
}

// ---- 대시보드 뼈대(한 번만 그림) ----

function showDashboard(user) {
  root.innerHTML = `
    <div class="admin-bar">
      <form class="game" id="gameForm">
        <label class="sr-only" for="gameId">게임 ID</label>
        <span class="subtle">게임 ID</span>
        <input class="input" id="gameId" value="${esc(db.GAME_ID)}" pattern="[a-z0-9-]{1,40}" title="영문 소문자, 숫자, 하이픈 40자 이내" style="width:200px">
        <button class="btn btn-ghost btn-sm" type="submit">이동</button>
        <span class="live" id="live" data-state="off">연결 중…</span>
      </form>
      <div class="row">
        <span class="subtle">${esc(user.email)}${db.USE_EMULATOR ? ' · 로컬 에뮬레이터' : ''}</span>
        <button class="btn btn-ghost btn-sm" id="signOut" type="button">로그아웃</button>
      </div>
    </div>
    <div class="kpi-grid" id="kpis"></div>

    <div class="grid-2">
      <section class="panel" id="houses"><div class="panel-head"><h3>기숙사 점수</h3><span class="count-note">참가자 점수 합계</span></div><div id="houseChart"></div></section>
      <section class="panel"><div class="panel-head"><h3>확신도별 응답 분포</h3><span class="count-note">어떤 확신도를 많이 골랐는지</span></div><div id="tierChart"></div></section>
    </div>

    <section class="panel" id="calibration">
      <div class="panel-head"><h3>확신도 보정 그래프</h3><span class="count-note">답안이 들어올 때마다 자동 계산</span></div>
      <p class="subtle">각 점은 해당 확신도를 고른 답안의 실제 정답률입니다. 점선보다 위면 과소확신, 아래면 과대확신입니다.</p>
      <div id="calChart"></div><div id="calTable"></div>
    </section>

    <section class="panel" id="questions">
      <div class="panel-head"><h3>문항별 정답률</h3><span class="count-note">어려운 문항일수록 막대가 짧습니다</span></div>
      <div id="questionChart"></div><div id="questionTable"></div>
    </section>

    <section class="panel" id="participants">
      <div class="panel-head"><h3>참가자 순위</h3><span class="count-note" id="participantCount"></span></div>
      <div id="participantTable"></div>
    </section>

    <section class="panel" id="log">
      <div class="panel-head"><h3>모든 답변 기록</h3>
        <div class="row"><span class="count-note" id="logCount"></span><button class="btn btn-ghost btn-sm" id="exportLog" type="button">CSV 내려받기</button></div></div>
      <div class="filters">
        <input class="input" id="fText" type="search" placeholder="이름 검색" aria-label="이름 검색">
        <select class="input" id="fHouse" aria-label="기숙사"><option value="">모든 기숙사</option>${HOUSES.map(h => `<option value="${h.id}">${h.icon} ${h.name}</option>`).join('')}</select>
        <select class="input" id="fQuestion" aria-label="문항"><option value="">모든 문항</option>${QUESTIONS.map(q => `<option value="${q.id}">${q.id} · ${esc(q.title)}</option>`).join('')}</select>
        <select class="input" id="fResult" aria-label="결과"><option value="">정답·오답 모두</option><option value="ok">정답만</option><option value="no">오답만</option></select>
      </div>
      <div id="logTable"></div>
    </section>

    <section class="panel" id="matrix">
      <div class="panel-head"><h3>참가자별 전체 답안</h3><button class="btn btn-ghost btn-sm" id="exportMatrix" type="button">CSV 내려받기(구글 설문 형식)</button></div>
      <p class="subtle">참가자 한 명이 한 줄입니다. 문항마다 답, 확신도, 정답 여부, 점수를 보여 줍니다.</p>
      <div id="matrixTable"></div>
    </section>

    <section class="panel">
      <div class="panel-head"><h3>데이터 정리</h3></div>
      <p class="subtle">행사가 끝나면 이름 같은 개인정보를 지우세요. 이 게임(${esc(db.GAME_ID)})의 참가자와 답안을 모두 삭제하며 되돌릴 수 없습니다.</p>
      <button class="btn btn-danger" id="deleteAll" type="button">이 게임 데이터 모두 삭제</button>
      <p id="adminMsg" class="subtle"></p>
    </section>`;

  $('#signOut').onclick = async () => { await db.adminSignOut(); showSignedOut(); };
  $('#gameForm').onsubmit = e => {
    e.preventDefault();
    const id = $('#gameId').value.trim();
    if (!/^[a-z0-9-]{1,40}$/.test(id)) return $('#gameId').reportValidity();
    location.search = '?game=' + encodeURIComponent(id);
  };
  const bind = (id, key) => $(id).addEventListener('input', e => { filters[key] = e.target.value; renderLog(); });
  bind('#fText', 'text'); bind('#fHouse', 'house'); bind('#fQuestion', 'question'); bind('#fResult', 'result');
  $('#exportLog').onclick = exportLog;
  $('#exportMatrix').onclick = exportMatrix;
  $('#deleteAll').onclick = deleteAll;
  $('#participantTable').addEventListener('click', onParticipantClick);

  const live = $('#live');
  stopWatch = db.watchAdmin(d => {
    data = d;
    live.dataset.state = 'on';
    live.textContent = '실시간 · ' + new Date().toLocaleTimeString('ko-KR');
    renderAll();
  }, e => {
    live.dataset.state = 'error';
    live.textContent = '연결 끊김: ' + (e.code || e.message);
  });
}

// ---- 집계 ----

function questionStats() {
  return QUESTIONS.map(q => {
    const rows = data.responses.filter(r => r.questionId === q.id);
    const correct = rows.filter(r => r.correct).length;
    const wrongCounts = {};
    rows.filter(r => !r.correct).forEach(r => { wrongCounts[r.answer] = (wrongCounts[r.answer] || 0) + 1; });
    const topWrong = Object.entries(wrongCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      q, count: rows.length, correct,
      accuracy: rows.length ? Math.round(correct / rows.length * 100) : 0,
      avgConfidence: rows.length ? Math.round(rows.reduce((n, r) => n + r.confidence, 0) / rows.length) : 0,
      points: rows.reduce((n, r) => n + r.points, 0),
      topWrong
    };
  });
}

// ---- 렌더링 ----

function renderAll() {
  renderKpis();
  renderHouses();
  renderTiers();
  renderCalibration();
  renderQuestions();
  renderParticipants();
  renderLog();
  renderMatrix();
}

function renderKpis() {
  const ps = data.participants, rs = data.responses;
  const done = ps.filter(p => p.answered >= QUESTIONS.length).length;
  const acc = rs.length ? Math.round(rs.filter(r => r.correct).length / rs.length * 100) : 0;
  const avg = ps.length ? Math.round(ps.reduce((n, p) => n + p.score, 0) / ps.length) : 0;
  const kpi = (label, value) => `<div class="kpi"><small>${label}</small><b>${value}</b></div>`;
  $('#kpis').innerHTML = kpi('참가자', ps.length) + kpi('완료', `${done}`) + kpi('제출된 답안', rs.length) + kpi('전체 정답률', acc + '%') + kpi('평균 개인 점수', signed(avg));
}

function renderHouses() {
  const items = HOUSES.map(h => ({ label: `${h.icon} ${h.name}`, value: data.houses[h.id] || 0, house: h.id, note: `${data.participants.filter(p => p.house === h.id).length}명` }))
    .sort((a, b) => b.value - a.value);
  $('#houseChart').innerHTML = barChart(items, { format: signed, width: 400, labelWidth: 130 });
}

function renderTiers() {
  const items = [...TIERS].sort((a, b) => b - a).map(c => ({ label: `${c}%`, value: data.responses.filter(r => r.confidence === c).length }));
  $('#tierChart').innerHTML = barChart(data.responses.length ? items : [], { format: v => `${v}건`, width: 400, labelWidth: 60, emptyText: '아직 답안이 없습니다' });
}

function renderCalibration() {
  $('#calChart').innerHTML = calibrationChart(data.calibration, TIERS);
  if (!data.calibration.length) { $('#calTable').innerHTML = ''; return; }
  $('#calTable').innerHTML = `<div class="table-wrap"><table><thead><tr><th>확신도</th><th class="num">답안 수</th><th class="num">정답</th><th class="num">실제 정답률</th><th class="num">차이</th><th>판정</th></tr></thead><tbody>${data.calibration.map(c => {
    const gap = c.accuracy - c.confidence;
    const verdict = Math.abs(gap) <= 10 ? '잘 맞음' : gap > 0 ? '과소확신' : '과대확신';
    return `<tr><td>${c.confidence}%</td><td class="num">${c.count}</td><td class="num">${c.correct}</td><td class="num">${c.accuracy}%</td><td class="num ${signClass(gap)}">${signed(gap)}%p</td><td>${verdict}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function renderQuestions() {
  const stats = questionStats();
  const answered = stats.filter(s => s.count);
  $('#questionChart').innerHTML = answered.length
    ? barChart(stats.map(s => ({ label: `${s.q.id} ${s.q.title.length > 9 ? s.q.title.slice(0, 9) + '…' : s.q.title}`, value: s.accuracy, note: `${s.count}명 응답` })), { format: v => v + '%', max: 100, min: 0 })
    : barChart([], { emptyText: '아직 답안이 없습니다' });
  $('#questionTable').innerHTML = `<div class="table-wrap"><table><thead><tr><th>문항</th><th class="num">응답</th><th class="num">정답률</th><th class="num">평균 확신도</th><th class="num">점수 합계</th><th>가장 많이 고른 오답</th><th>정답</th></tr></thead><tbody>${stats.map(s => `
    <tr><td>${s.q.id} · ${esc(s.q.title)}</td><td class="num">${s.count}</td><td class="num">${s.count ? s.accuracy + '%' : '—'}</td><td class="num">${s.count ? s.avgConfidence + '%' : '—'}</td><td class="num ${signClass(s.points)}">${signed(s.points)}</td>
    <td>${s.topWrong ? `${s.topWrong[0]} (${s.topWrong[1]}명) ${esc(truncate(choiceText(s.q, s.topWrong[0]), 28))}` : '—'}</td><td>${s.q.answer}</td></tr>`).join('')}</tbody></table></div>`;
}

const truncate = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);

function renderParticipants() {
  const ps = data.participants;
  $('#participantCount').textContent = `${ps.length}명`;
  if (!ps.length) { $('#participantTable').innerHTML = '<p class="subtle center">아직 참가자가 없습니다.</p>'; return; }
  const last = id => data.responses.filter(r => r.participantId === id).map(r => r.submittedAt).sort().pop();
  $('#participantTable').innerHTML = `<div class="table-wrap"><table><thead><tr><th class="num">순위</th><th>이름</th><th>기숙사</th><th class="num">진행</th><th class="num">정답</th><th class="num">개인 점수</th><th class="num">잃은 점수</th><th>마지막 제출</th><th></th></tr></thead><tbody>${ps.map((p, i) => `
    <tr><td class="num">${i + 1}</td><td>${esc(p.name)}</td><td>${houseLabel(p.house)}</td><td class="num">${p.answered}/${QUESTIONS.length}</td><td class="num">${p.correct_count}</td>
    <td class="num ${signClass(p.score)}">${signed(p.score)}</td><td class="num">${p.points_lost ? '−' + p.points_lost : 0}</td><td>${formatTime(last(p.id))}</td>
    <td><button class="btn btn-danger btn-sm" type="button" data-delete="${esc(p.id)}" data-name="${esc(p.name)}">삭제</button></td></tr>`).join('')}</tbody></table></div>`;
}

function filteredLog() {
  const text = filters.text.trim().toLowerCase();
  return data.responses
    .filter(r => (!text || r.participant.toLowerCase().includes(text))
      && (!filters.house || r.house === filters.house)
      && (!filters.question || r.questionId === filters.question)
      && (!filters.result || (filters.result === 'ok') === r.correct))
    .slice()
    .reverse(); // 최신 답안이 위로
}

function renderLog() {
  if (!data) return;
  const rows = filteredLog();
  $('#logCount').textContent = `${rows.length} / ${data.responses.length}건`;
  if (!rows.length) { $('#logTable').innerHTML = `<p class="subtle center">${data.responses.length ? '조건에 맞는 답안이 없습니다.' : '아직 답안이 없습니다.'}</p>`; return; }
  $('#logTable').innerHTML = `<div class="table-wrap"><table><thead><tr><th>제출 시각</th><th>이름</th><th>기숙사</th><th>문항</th><th>답</th><th>정답</th><th class="num">확신도</th><th>결과</th><th class="num">점수</th></tr></thead><tbody>${rows.map(r => {
    const q = questionOf(r.questionId);
    return `<tr><td>${formatTime(r.submittedAt)}</td><td>${esc(r.participant)}</td><td>${houseLabel(r.house)}</td><td>${r.questionId} · ${esc(q?.title ?? '')}</td>
      <td title="${esc(q ? choiceText(q, r.answer) : '')}">${r.answer}</td><td>${q?.answer ?? ''}</td><td class="num">${r.confidence}%</td>
      <td><span class="tag ${r.correct ? 'ok' : 'no'}">${r.correct ? '정답' : '오답'}</span></td><td class="num ${signClass(r.points)}">${signed(r.points)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function renderMatrix() {
  const ps = data.participants;
  if (!ps.length) { $('#matrixTable').innerHTML = '<p class="subtle center">아직 참가자가 없습니다.</p>'; return; }
  const head1 = `<tr><th rowspan="2">이름</th><th rowspan="2">기숙사</th><th rowspan="2">정답</th><th rowspan="2">점수</th>${QUESTIONS.map(q => `<th colspan="4">${q.id}</th>`).join('')}</tr>`;
  const head2 = `<tr>${QUESTIONS.map(() => '<th>답</th><th>확신</th><th>정오</th><th>점수</th>').join('')}</tr>`;
  const body = ps.map(p => {
    const by = Object.fromEntries(data.responses.filter(r => r.participantId === p.id).map(r => [r.questionId, r]));
    return `<tr><td>${esc(p.name)}</td><td>${houseLabel(p.house)}</td><td>${p.correct_count}/${QUESTIONS.length}</td><td class="${signClass(p.score)}">${signed(p.score)}</td>${QUESTIONS.map(q => {
      const r = by[q.id];
      return r ? `<td>${r.answer}</td><td>${r.confidence}%</td><td>${r.correct ? '○' : '×'}</td><td class="${signClass(r.points)}">${signed(r.points)}</td>` : '<td>—</td><td>—</td><td>—</td><td>—</td>';
    }).join('')}</tr>`;
  }).join('');
  $('#matrixTable').innerHTML = `<div class="table-wrap"><table class="matrix"><thead>${head1}${head2}</thead><tbody>${body}</tbody></table></div>`;
}

// ---- 내보내기·삭제 ----

function exportLog() {
  if (!data) return;
  const rows = filteredLog().reverse().map(r => {
    const q = questionOf(r.questionId);
    return [localStamp(r.submittedAt), r.participant, houseOf(r.house)?.name ?? r.house, r.questionId, q?.title ?? '', r.answer, q ? choiceText(q, r.answer) : '', q?.answer ?? '', r.confidence, r.correct ? '정답' : '오답', r.points];
  });
  downloadCsv(`hogwarts-${db.GAME_ID}-answers.csv`, ['제출 시각', '이름', '기숙사', '문항', '문항 제목', '답', '답 내용', '정답', '확신도', '결과', '점수'], rows);
}

function exportMatrix() {
  if (!data) return;
  const header = ['Participant', 'House', 'Correct', 'Final score', 'Points lost'];
  QUESTIONS.forEach(q => header.push(`${q.id} answer`, `${q.id} confidence`, `${q.id} correct`, `${q.id} points`));
  const rows = data.participants.map(p => {
    const by = Object.fromEntries(data.responses.filter(r => r.participantId === p.id).map(r => [r.questionId, r]));
    const row = [p.name, p.house, `${p.correct_count}/${QUESTIONS.length}`, p.score, p.points_lost];
    QUESTIONS.forEach(q => { const r = by[q.id]; row.push(r?.answer ?? '', r ? `${r.confidence}%` : '', r ? (r.correct ? 'Yes' : 'No') : '', r?.points ?? ''); });
    return row;
  });
  downloadCsv(`hogwarts-${db.GAME_ID}-google-forms-style.csv`, header, rows);
}

async function onParticipantClick(e) {
  const btn = e.target.closest('[data-delete]');
  if (!btn) return;
  if (!confirm(`'${btn.dataset.name}' 참가자와 답안을 삭제할까요? 되돌릴 수 없습니다.`)) return;
  btn.disabled = true;
  try {
    const n = await db.deleteParticipant(btn.dataset.delete);
    $('#adminMsg').textContent = `'${btn.dataset.name}' 참가자와 답안 ${n}건을 삭제했습니다.`;
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    alert('삭제하지 못했습니다: ' + (err.code || err.message));
  }
}

async function deleteAll() {
  const typed = prompt(`이 게임의 참가자와 답안을 모두 삭제합니다. 되돌릴 수 없습니다.\n계속하려면 게임 ID(${db.GAME_ID})를 입력하세요.`);
  if (typed !== db.GAME_ID) return;
  const msg = $('#adminMsg');
  msg.textContent = '삭제 중…';
  try { msg.textContent = `${await db.deleteGameData()}건을 삭제했습니다.`; }
  catch (e) { console.error(e); msg.textContent = '삭제하지 못했습니다: ' + (e.code || e.message); }
}

route().catch(e => { console.error(e); root.innerHTML = notice('관리자 화면을 열지 못했습니다: ' + esc(e.message || e), 'error'); });
