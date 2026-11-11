// Firestore 보안 규칙 테스트. 에뮬레이터에서 실행합니다.
//   cd jmp/hogwarts/test && npm install && npm test
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, connectAuthEmulator, signInAnonymously, signInWithCredential, GoogleAuthProvider
} from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  collection, writeBatch, serverTimestamp, increment, setLogLevel
} from 'firebase/firestore';

setLogLevel('silent');
const PROJECT = 'demo-hogwarts';
const GAME = 'rules-test';
const ADMIN_EMAIL = 'admin@example.com';
let appCount = 0;

async function client(kind, email) {
  const app = initializeApp({ apiKey: 'demo-key', projectId: PROJECT }, `c${appCount++}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const fs = getFirestore(app);
  connectFirestoreEmulator(fs, '127.0.0.1', 8080);
  if (kind === 'anon') await signInAnonymously(auth);
  if (kind === 'google') {
    const token = JSON.stringify({ sub: email, email, email_verified: true });
    await signInWithCredential(auth, GoogleAuthProvider.credential(token));
  }
  return { app, fs, uid: auth.currentUser?.uid };
}

// 규칙을 건너뛰는 관리 요청(에뮬레이터 전용 owner 토큰)
async function seedAdmin(email) {
  const url = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/admins?documentId=${encodeURIComponent(email)}`;
  const res = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: '{"fields":{}}' });
  assert.ok(res.ok, `seed admin failed: ${res.status}`);
}
async function clearDb() {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
}

const pRef = (fs, id) => doc(fs, 'games', GAME, 'participants', id);
const rRef = (fs, pid, qid) => doc(fs, 'games', GAME, 'responses', `${pid}_${qid}`);
const participant = (uid, extra = {}) => ({
  uid, name: '해리', house: 'Gryffindor', score: 0, correctCount: 0, answered: 0,
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra
});
function answerBatch(fs, uid, pid, { qid, answer = 'A', confidence = 60, correct = true, points, scoreDelta, correctDelta, answeredDelta = 1 }) {
  points ??= correct ? confidence : -confidence;
  const b = writeBatch(fs);
  b.set(rRef(fs, pid, qid), { uid, participantId: pid, questionId: qid, answer, confidence, correct, points, submittedAt: serverTimestamp() });
  b.update(pRef(fs, pid), {
    score: increment(scoreDelta ?? points), correctCount: increment(correctDelta ?? (correct ? 1 : 0)),
    answered: increment(answeredDelta), updatedAt: serverTimestamp()
  });
  return b;
}

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
async function denied(promise) {
  try { await promise; } catch (e) {
    if (e.code === 'permission-denied') return;
    throw new Error(`expected permission-denied, got ${e.code}: ${e.message}`);
  }
  throw new Error('expected permission-denied, but write/read succeeded');
}

await clearDb();
await seedAdmin(ADMIN_EMAIL);
const alice = await client('anon');
const mallory = await client('anon');
const guest = await client('none');
const adminC = await client('google', ADMIN_EMAIL);
const notAdmin = await client('google', 'someone@example.com');
const PID = 'p-alice';

console.log('참가자 생성');
await test('로그인 없이는 참가자 생성 불가', () => denied(setDoc(pRef(guest.fs, 'p-guest'), participant('x'))));
await test('다른 uid로 생성 불가', () => denied(setDoc(pRef(mallory.fs, 'p-fake'), participant(alice.uid))));
await test('시작 점수 조작 불가', () => denied(setDoc(pRef(alice.fs, 'p-cheat'), participant(alice.uid, { score: 500 }))));
await test('없는 기숙사 불가', () => denied(setDoc(pRef(alice.fs, 'p-cheat2'), participant(alice.uid, { house: 'Durmstrang' }))));
await test('추가 필드 불가', () => denied(setDoc(pRef(alice.fs, 'p-cheat3'), participant(alice.uid, { admin: true }))));
await test('빈 이름 불가', () => denied(setDoc(pRef(alice.fs, 'p-cheat4'), participant(alice.uid, { name: '' }))));
await test('정상 생성', () => setDoc(pRef(alice.fs, PID), participant(alice.uid)));
await test('비로그인도 참가자 목록 읽기 가능(순위판)', async () => {
  const snap = await getDocs(collection(guest.fs, 'games', GAME, 'participants'));
  assert.equal(snap.size, 1);
});

console.log('답안 제출');
await test('Q1 정답 제출 성공', () => answerBatch(alice.fs, alice.uid, PID, { qid: 'Q1', confidence: 95, correct: true }).commit());
await test('점수 반영 확인(+95, 1정답, 1제출)', async () => {
  const p = (await getDoc(pRef(guest.fs, PID))).data();
  assert.deepEqual([p.score, p.correctCount, p.answered], [95, 1, 1]);
});
await test('같은 문항 재제출 불가', () => denied(answerBatch(alice.fs, alice.uid, PID, { qid: 'Q1' }).commit()));
await test('문항 건너뛰기 불가(Q3)', () => denied(answerBatch(alice.fs, alice.uid, PID, { qid: 'Q3' }).commit()));
await test('오답인데 가점 불가', () => denied(answerBatch(alice.fs, alice.uid, PID, { qid: 'Q2', correct: false, points: 60 }).commit()));
await test('답안과 다른 점수 증가 불가', () => denied(answerBatch(alice.fs, alice.uid, PID, { qid: 'Q2', confidence: 30, scoreDelta: 95 }).commit()));
await test('정답 수 부풀리기 불가', () => denied(answerBatch(alice.fs, alice.uid, PID, { qid: 'Q2', correct: false, correctDelta: 1 }).commit()));
await test('없는 확신도(100%) 불가', () => denied(answerBatch(alice.fs, alice.uid, PID, { qid: 'Q2', confidence: 100 }).commit()));
await test('답안 없이 점수만 갱신 불가', () => denied(updateDoc(pRef(alice.fs, PID), {
  score: increment(95), correctCount: increment(1), answered: increment(1), updatedAt: serverTimestamp()
})));
await test('점수 갱신 없이 답안만 생성 불가', () => denied(setDoc(rRef(alice.fs, PID, 'Q2'), {
  uid: alice.uid, participantId: PID, questionId: 'Q2', answer: 'A', confidence: 30, correct: true, points: 30, submittedAt: serverTimestamp()
})));
await test('이름·기숙사 변경 불가', () => denied(updateDoc(pRef(alice.fs, PID), { house: 'Slytherin' })));
await test('남의 참가자로 제출 불가', () => denied(answerBatch(mallory.fs, mallory.uid, PID, { qid: 'Q2' }).commit()));
await test('Q2 오답 제출 성공(-45)', () => answerBatch(alice.fs, alice.uid, PID, { qid: 'Q2', confidence: 45, correct: false }).commit());
await test('Q3~Q10 제출 성공', async () => {
  for (let i = 3; i <= 10; i++) await answerBatch(alice.fs, alice.uid, PID, { qid: `Q${i}`, confidence: 30, correct: i % 2 === 0 }).commit();
});
await test('Q11 제출 불가(최대 10문항)', () => denied(answerBatch(alice.fs, alice.uid, PID, { qid: 'Q11' }).commit()));
await test('최종 점수 확인', async () => {
  const p = (await getDoc(pRef(guest.fs, PID))).data();
  // 95 - 45 + (Q4,Q6,Q8,Q10 정답 +30×4) + (Q3,Q5,Q7,Q9 오답 -30×4) = 50
  assert.deepEqual([p.score, p.correctCount, p.answered], [50, 5, 10]);
});

console.log('답안 읽기');
await test('본인 답안 단건 읽기 가능(저장 복구용)', async () => {
  assert.equal((await getDoc(rRef(alice.fs, PID, 'Q1'))).data().points, 95);
});
await test('남의 답안 읽기 불가', () => denied(getDoc(rRef(mallory.fs, PID, 'Q1'))));
await test('비로그인 답안 목록 읽기 불가', () => denied(getDocs(collection(guest.fs, 'games', GAME, 'responses'))));
await test('응답자 답안 목록 읽기 불가', () => denied(getDocs(collection(alice.fs, 'games', GAME, 'responses'))));
await test('답안 수정 불가', () => denied(updateDoc(rRef(alice.fs, PID, 'Q2'), { correct: true, points: 45 })));

console.log('관리자');
await test('관리자 본인 확인 가능', async () => assert.ok((await getDoc(doc(adminC.fs, 'admins', ADMIN_EMAIL))).exists()));
await test('비관리자는 관리자 확인 시 문서 없음', async () => {
  await denied(getDoc(doc(notAdmin.fs, 'admins', ADMIN_EMAIL)));
  assert.equal((await getDoc(doc(notAdmin.fs, 'admins', 'someone@example.com'))).exists(), false);
});
await test('관리자 목록 열람 불가', () => denied(getDocs(collection(adminC.fs, 'admins'))));
await test('스스로 관리자 등록 불가', () => denied(setDoc(doc(notAdmin.fs, 'admins', 'someone@example.com'), {})));
await test('비관리자 Google 계정은 답안 목록 읽기 불가', () => denied(getDocs(collection(notAdmin.fs, 'games', GAME, 'responses'))));
await test('관리자는 답안 목록 읽기 가능', async () => {
  assert.equal((await getDocs(collection(adminC.fs, 'games', GAME, 'responses'))).size, 10);
});
await test('응답자는 삭제 불가', () => denied(deleteDoc(pRef(alice.fs, PID))));
await test('관리자는 삭제 가능', async () => {
  await deleteDoc(rRef(adminC.fs, PID, 'Q1'));
  await deleteDoc(pRef(adminC.fs, PID));
});

await Promise.all([alice, mallory, guest, adminC, notAdmin].map(c => deleteApp(c.app)));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
