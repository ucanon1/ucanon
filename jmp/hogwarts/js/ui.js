// 사용자·관리자 화면이 함께 쓰는 표시 도우미
import { HOUSES, QUESTIONS } from './data.js?v=202611112237';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 문항 본문: **굵게** 와 줄바꿈만 허용
export function richText(text) {
  return esc(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

export const signed = n => (n > 0 ? '+' : '') + n;
export const signClass = n => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');
export const houseOf = id => HOUSES.find(h => h.id === id);
export const questionOf = id => QUESTIONS.find(q => q.id === id);
export const LETTERS = 'ABCD';

export function choiceText(q, letter, lang = 'ko') {
  const list = lang === 'ko' ? q.choices : q.enChoices;
  return list[LETTERS.indexOf(letter)] ?? '';
}

export function houseLabel(id) {
  const h = houseOf(id);
  return h ? `<span class="house-name" data-house="${h.id}">${h.icon} <span class="hn">${esc(h.name)}</span></span>` : esc(id);
}

// 네 기숙사 점수 띠. previous를 넘기면 바뀐 기숙사 숫자를 살짝 튀게 합니다.
export function scoreStrip(totals, { mine = '', large = false, previous = null } = {}) {
  return `<div class="score-strip${large ? ' large' : ''}" data-score-strip>${HOUSES.map(h => {
    const v = totals?.[h.id] ?? 0;
    const changed = previous && previous[h.id] !== undefined && previous[h.id] !== v;
    return `<div class="score-house${h.id === mine ? ' is-mine' : ''}${changed ? ' bump' : ''}" data-house="${h.id}"><span title="${h.name}">${h.icon}<span class="hn"> ${h.name}</span></span><b>${signed(v)}</b></div>`;
  }).join('')}</div>`;
}

// 참가자 순위표. limit을 주면 상위 n명과 본인만 보여 줍니다.
export function rankingTable(participants, { you = '', limit = 0, lang = 'ko' } = {}) {
  const t = lang === 'ko'
    ? { rank: '순위', name: '이름', house: '기숙사', correct: '정답', score: '개인 점수', me: ' (나)', none: '아직 참가자가 없습니다.' }
    : { rank: 'Rank', name: 'Name', house: 'House', correct: 'Correct', score: 'Score', me: ' (you)', none: 'No participants yet.' };
  if (!participants.length) return `<p class="subtle center">${t.none}</p>`;
  const rows = participants
    .map((p, i) => ({ ...p, rank: i + 1 }))
    .filter(p => !limit || p.rank <= limit || p.id === you);
  return `<div class="table-wrap"><table><thead><tr><th class="num">${t.rank}</th><th>${t.name}</th><th>${t.house}</th><th class="num">${t.correct}</th><th class="num">${t.score}</th></tr></thead><tbody>${rows.map(p => `
    <tr class="${p.id === you ? 'is-you' : ''}"><td class="num">${p.rank}</td><td>${esc(p.name)}${p.id === you ? t.me : ''}</td><td>${houseLabel(p.house)}</td><td class="num">${p.correct_count}/${p.answered}</td><td class="num ${signClass(p.score)}">${signed(p.score)}</td></tr>`).join('')}</tbody></table></div>`;
}

export function downloadCsv(filename, header, rows) {
  const quote = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const body = [header, ...rows].map(r => r.map(quote).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// CSV용 현지 시각(예: 2026-11-11 19:17:58)
export function localStamp(iso) {
  if (!iso) return '';
  const d = new Date(iso), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
