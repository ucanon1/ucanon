// 관리자 화면 차트(인라인 SVG). 색은 css/hogwarts.css의 .chart 규칙을 따릅니다.
import { esc } from './ui.js?v=202611112201';

const empty = (w, h, text) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(text)}"><text class="empty" x="${w / 2}" y="${h / 2}" text-anchor="middle">${esc(text)}</text></svg>`;

// 확신도 보정 그래프: 가로축은 고른 확신도, 세로축은 실제 정답률.
// 점선(이상적 보정) 위에 점이 있으면 과소확신, 아래에 있으면 과대확신입니다.
export function calibrationChart(rows, tiers) {
  const W = 720, H = 400, L = 64, R = 24, T = 20, B = 62;
  if (!rows.length) return `<div class="chart">${empty(W, 180, '아직 답안이 없습니다')}</div>`;
  const lo = 20, hi = 100;
  const x = v => L + (v - lo) / (hi - lo) * (W - L - R);
  const y = v => T + (100 - v) / 100 * (H - T - B);
  const ticksY = [0, 20, 40, 60, 80, 100];
  const grid = ticksY.map(v => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 10}" y="${y(v) + 4}" text-anchor="end">${v}%</text>`).join('');
  const ticksX = [...tiers].sort((a, b) => a - b).map(v => `<line class="axis" x1="${x(v)}" x2="${x(v)}" y1="${H - B}" y2="${H - B + 5}"/><text x="${x(v)}" y="${H - B + 22}" text-anchor="middle">${v}%</text>`).join('');
  const pts = rows.map(r => ({ c: r.confidence, a: r.accuracy, n: r.count }));
  const line = pts.map(p => `${x(p.c)},${y(p.a)}`).join(' ');
  const dots = pts.map(p => `<circle class="dot" cx="${x(p.c)}" cy="${y(p.a)}" r="7"><title>확신도 ${p.c}% · 정답률 ${p.a}% (${p.n}건)</title></circle>
    <text class="value" x="${x(p.c)}" y="${y(p.a) - 13}" text-anchor="middle">${p.a}%</text>`).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="확신도 보정 그래프">
    ${grid}
    <line class="axis" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/><line class="axis" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/>
    <line class="ideal" x1="${x(lo)}" y1="${y(lo)}" x2="${x(hi)}" y2="${y(hi)}"/>
    ${pts.length > 1 ? `<polyline class="actual" points="${line}"/>` : ''}
    ${dots}${ticksX}
    <text class="axis-title" x="${(L + W - R) / 2}" y="${H - 14}" text-anchor="middle">선택한 확신도</text>
    <text class="axis-title" transform="translate(16 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">실제 정답률</text>
  </svg>
  <div class="legend"><span><i></i> 이상적 보정(확신도 = 정답률)</span><span><i class="actual"></i> 실제 정답률</span></div></div>`;
}

// 가로 막대 그래프. 값이 음수일 수 있어 0을 기준선으로 그립니다.
// items: [{ label, value, house?, note? }]
export function barChart(items, { format = v => String(v), max = null, min = null, emptyText = '데이터가 없습니다', width = 720, labelWidth = 190 } = {}) {
  const W = width, rowH = 34, L = labelWidth, R = 64, T = 6;
  if (!items.length) return `<div class="chart">${empty(W, 120, emptyText)}</div>`;
  const values = items.map(i => i.value);
  const rawHi = max ?? Math.max(0, ...values), rawLo = min ?? Math.min(0, ...values);
  // 음수 막대의 숫자 표시가 이름 칸을 덮지 않도록 왼쪽에 여백을 둡니다.
  const pad = (rawHi - rawLo || 1) * 0.16;
  const hiV = rawHi, loV = rawLo < 0 ? rawLo - pad : rawLo;
  const span = hiV - loV || 1;
  const x = v => L + (v - loV) / span * (W - L - R);
  const H = T * 2 + items.length * rowH;
  const zero = x(0);
  const bars = items.map((it, i) => {
    const top = T + i * rowH + 6, h = rowH - 12;
    const x1 = Math.min(x(it.value), zero), w = Math.max(Math.abs(x(it.value) - zero), it.value === 0 ? 0 : 2);
    const labelX = it.value >= 0 ? x1 + w + 8 : x1 - 8;
    return `<g ${it.house ? `data-house="${it.house}"` : ''}>
      <text x="${L - 10}" y="${top + h / 2 + 4}" text-anchor="end">${esc(it.label)}</text>
      <rect class="bar${it.house ? ' house' : ''}" x="${x1}" y="${top}" width="${w}" height="${h}" rx="2"><title>${esc(it.label)}: ${esc(format(it.value))}${it.note ? ' · ' + esc(it.note) : ''}</title></rect>
      <text class="value" x="${labelX}" y="${top + h / 2 + 4}" text-anchor="${it.value >= 0 ? 'start' : 'end'}">${esc(format(it.value))}</text>
    </g>`;
  }).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="막대 그래프">
    <line class="axis" x1="${zero}" x2="${zero}" y1="0" y2="${H}"/>${bars}</svg></div>`;
}
