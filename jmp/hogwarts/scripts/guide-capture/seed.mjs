// 가이드 캡처용 예시 데이터: 에뮬레이터(demo-hogwarts)에 규칙을 건너뛰는 owner 토큰으로 기록
import { pathToFileURL } from 'node:url';
const { QUESTIONS } = await import(pathToFileURL('C:/Github_Personal/ucanon/jmp/hogwarts/js/data.js').href);
const BASE = 'http://127.0.0.1:8080/v1/projects/demo-hogwarts/databases/(default)/documents';
const H = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const GAME = 'house-cup-2026';

await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-hogwarts/databases/(default)/documents', { method: 'DELETE' });
const put = async (path, fields) => {
  const r = await fetch(`${BASE}/${path}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(path + ' ' + r.status + ' ' + await r.text());
};
const v = x => typeof x === 'string' ? { stringValue: x } : typeof x === 'boolean' ? { booleanValue: x } : { integerValue: String(x) };
const ts = d => ({ timestampValue: d.toISOString() });

await put('admins/pskword@gmail.com', {});

// [이름, 기숙사, 답(정답이면 'ok'), 확신도] — 문항 순서대로, 일부는 아직 진행 중
const players = [
  ['헤르미온느', 'Ravenclaw', ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'B', 'ok', 'ok'], [75, 60, 95, 75, 60, 95, 75, 60, 95, 75]],
  ['세드릭', 'Hufflepuff', ['ok', 'C', 'ok', 'ok', 'B', 'ok', 'ok', 'ok', 'ok', 'C'], [60, 45, 60, 75, 30, 60, 75, 60, 45, 30]],
  ['루나', 'Ravenclaw', ['ok', 'ok', 'D', 'ok', 'ok', 'B', 'ok', 'ok', 'C', 'ok'], [45, 60, 30, 60, 75, 45, 60, 45, 30, 60]],
  ['네빌', 'Gryffindor', ['ok', 'ok', 'ok', 'B', 'ok', 'ok', 'C', 'ok', 'ok', 'ok'], [30, 45, 45, 30, 60, 45, 30, 45, 60, 45]],
  ['드레이코', 'Slytherin', ['B', 'ok', 'A', 'ok', 'C', 'ok', 'ok', 'D', 'ok', 'B'], [95, 95, 95, 75, 95, 75, 95, 95, 75, 95]],
  ['초 챙', 'Ravenclaw', ['ok', 'ok', 'ok', 'ok', 'D', 'ok'], [60, 75, 60, 60, 45, 75]],
  ['지니', 'Gryffindor', ['ok', 'D', 'ok', 'ok'], [75, 60, 45, 60]],
  ['블레이즈', 'Slytherin', ['C', 'ok', 'ok'], [60, 45, 75]],
  ['한나', 'Hufflepuff', ['ok', 'ok', 'B', 'ok', 'ok', 'ok', 'ok'], [45, 45, 30, 60, 45, 60, 45]]
];

let clock = new Date(Date.now() - 40 * 60 * 1000);
for (const [i, [name, house, answers, conf]] of players.entries()) {
  const pid = `demo-${i + 1}`, uid = `demo-uid-${i + 1}`;
  let score = 0, correctCount = 0;
  const created = new Date(clock);
  for (const [k, a] of answers.entries()) {
    const q = QUESTIONS[k];
    const answer = a === 'ok' ? q.answer : a;
    const correct = answer === q.answer;
    const points = correct ? conf[k] : -conf[k];
    score += points; correctCount += correct ? 1 : 0;
    clock = new Date(clock.getTime() + (40 + (i * 7 + k * 13) % 50) * 1000);
    await put(`games/${GAME}/responses/${pid}_${q.id}`, {
      uid: v(uid), participantId: v(pid), questionId: v(q.id), answer: v(answer),
      confidence: v(conf[k]), correct: v(correct), points: v(points), submittedAt: ts(clock)
    });
  }
  await put(`games/${GAME}/participants/${pid}`, {
    uid: v(uid), name: v(name), house: v(house), score: v(score), correctCount: v(correctCount),
    answered: v(answers.length), createdAt: ts(created), updatedAt: ts(clock)
  });
  console.log(name, house, score, `${correctCount}/${answers.length}`);
}
