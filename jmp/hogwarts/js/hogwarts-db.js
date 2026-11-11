// 호그와트 기숙사 컵 데이터 계층: GitHub Pages 정적 페이지에서 Firestore에 직접 읽고 씁니다.
//
// 데이터 모델
//   games/{gameId}/participants/{participantId}  공개 읽기. 실시간 기숙사 점수와 순위에 사용
//     uid, name, house, score, correctCount, answered, createdAt, updatedAt
//   games/{gameId}/responses/{participantId}_{questionId}  관리자와 본인만 읽기
//     uid, participantId, questionId, answer, confidence, correct, points, submittedAt
//   admins/{email}  관리자 허용 목록(Firebase 콘솔에서만 관리)
//
// 응답자는 화면에 보이지 않는 익명 로그인을 쓰고, 관리자는 Google 로그인을 씁니다.
// 관리자 로그인은 별도 앱 인스턴스('admin')를 써서 같은 기기의 응답자 세션을 건드리지 않습니다.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {
  getAuth, connectAuthEmulator, signInAnonymously, signInWithPopup, signOut, GoogleAuthProvider
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, collection, getDocs,
  onSnapshot, writeBatch, serverTimestamp, increment, query, where, collectionGroup
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { firebaseConfig, DEFAULT_GAME_ID, TOTAL_QUESTIONS } from './firebase-config.js?v=202611112201';
import { TIERS as DATA_TIERS, HOUSES as DATA_HOUSES } from './data.js?v=202611112201';

const params = new URLSearchParams(location.search);
const requestedGame = params.get('game') || '';
export const GAME_ID = /^[a-z0-9-]{1,40}$/.test(requestedGame) ? requestedGame : DEFAULT_GAME_ID;

// localhost에서는 Firebase 에뮬레이터에 붙습니다. 실제 DB로 시험하려면 주소에 ?prod 를 붙입니다.
export const USE_EMULATOR = ['localhost', '127.0.0.1'].includes(location.hostname) && !params.has('prod');

const HOUSES = DATA_HOUSES.map(h => h.id);
const TIERS = [...DATA_TIERS].sort((a, b) => a - b);
const SAVE_TIMEOUT_MS = 15000;

function setup(name) {
  const config = USE_EMULATOR ? { ...firebaseConfig, apiKey: 'demo-key', projectId: 'demo-hogwarts' } : firebaseConfig;
  const app = initializeApp(config, name);
  const auth = getAuth(app);
  const fs = getFirestore(app);
  if (USE_EMULATOR) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(fs, '127.0.0.1', 8080);
  }
  return { auth, fs };
}

let playerCtx, adminCtx;
const player = () => (playerCtx ??= setup('player'));
const admin = () => (adminCtx ??= setup('admin'));

const participantRef = (fs, id) => doc(fs, 'games', GAME_ID, 'participants', id);
const responseRef = (fs, participantId, questionId) => doc(fs, 'games', GAME_ID, 'responses', `${participantId}_${questionId}`);

function withTimeout(promise) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('저장 시간 초과'), { code: 'timeout' })), SAVE_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function playerUser() {
  const { auth } = player();
  await auth.authStateReady();
  if (!auth.currentUser) await signInAnonymously(auth);
  return auth.currentUser;
}

// 답안 1건 저장. 첫 답안이면 참가자 문서를 먼저 만듭니다.
// 응답 문서 생성과 참가자 점수 갱신은 한 배치로 묶여야 보안 규칙을 통과합니다.
export async function submitAnswer(state, answer) {
  const user = await playerUser();
  const { fs } = player();
  const pRef = participantRef(fs, state.id);
  if (!state.joined) {
    const snap = await withTimeout(getDoc(pRef));
    if (!snap.exists()) {
      await withTimeout(setDoc(pRef, {
        uid: user.uid, name: state.name, house: state.house,
        score: 0, correctCount: 0, answered: 0,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      }));
    }
    state.joined = true;
  }
  const batch = writeBatch(fs);
  batch.set(responseRef(fs, state.id, answer.questionId), {
    uid: user.uid, participantId: state.id, questionId: answer.questionId, answer: answer.answer,
    confidence: answer.confidence, correct: answer.correct, points: answer.points,
    submittedAt: serverTimestamp()
  });
  batch.update(pRef, {
    score: increment(answer.points), correctCount: increment(answer.correct ? 1 : 0),
    answered: increment(1), updatedAt: serverTimestamp()
  });
  await withTimeout(batch.commit());
}

// 저장이 거부됐을 때, 앞선 시도가 이미 서버에 반영됐는지 확인합니다.
// 반영돼 있으면 서버에 저장된 답안을 돌려주고, 아니면 null을 돌려줍니다.
export async function recover(state, questionId) {
  const { fs } = player();
  await playerUser();
  // 없는 답안 문서는 규칙상 읽기가 거부되므로(소유자 확인 불가) '없음'으로 봅니다.
  const snap = await getDoc(responseRef(fs, state.id, questionId)).catch(e => {
    if (e.code === 'permission-denied') return null;
    throw e;
  });
  if (!snap?.exists()) {
    // 관리자가 이 참가자를 삭제했다면 더 이상 이어서 풀 수 없습니다.
    if (state.joined && !(await getDoc(participantRef(fs, state.id))).exists()) return { removed: true };
    return null;
  }
  state.joined = true;
  const r = snap.data();
  return { questionId: r.questionId, answer: r.answer, confidence: r.confidence, correct: r.correct, points: r.points };
}

// 실시간 기숙사 점수와 참가자 순위. 처음 필요할 때 구독을 시작합니다.
let board = null, unsubscribe = null;
const waiters = [], listeners = new Set();

function buildBoard(docs) {
  const houses = Object.fromEntries(HOUSES.map(h => [h, 0]));
  const participants = docs.map(d => {
    const p = d.data();
    if (p.house in houses) houses[p.house] += p.score || 0;
    return {
      id: d.id, name: p.name, house: p.house, score: p.score || 0,
      correct_count: p.correctCount || 0, answered: p.answered || 0,
      createdAt: p.createdAt?.toMillis?.() ?? Date.now()
    };
  });
  participants.sort((a, b) => b.score - a.score || b.correct_count - a.correct_count || a.createdAt - b.createdAt);
  return { houses, participants };
}

function startBoard() {
  if (unsubscribe) return;
  unsubscribe = onSnapshot(collection(player().fs, 'games', GAME_ID, 'participants'), snap => {
    board = buildBoard(snap.docs);
    waiters.splice(0).forEach(w => w.resolve(board));
    listeners.forEach(fn => { try { fn(board); } catch (e) { console.error(e); } });
  }, err => {
    console.error('순위 구독 실패', err);
    unsubscribe = null;
    waiters.splice(0).forEach(w => w.reject(err));
  });
}

// 최신 순위판. 첫 데이터가 8초 안에 오지 않으면 실패로 처리해 화면이 멈추지 않게 합니다.
export function results() {
  startBoard();
  if (board) return Promise.resolve(board);
  return new Promise((resolve, reject) => {
    const w = { resolve, reject };
    waiters.push(w);
    setTimeout(() => {
      const i = waiters.indexOf(w);
      if (i >= 0) { waiters.splice(i, 1); reject(new Error('순위 불러오기 시간 초과')); }
    }, 8000);
  });
}

export function onBoard(fn) { listeners.add(fn); }

// ---- 관리자 ----

export async function adminUser() {
  const { auth } = admin();
  await auth.authStateReady();
  return auth.currentUser;
}

export async function adminSignIn() {
  const { auth } = admin();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return (await signInWithPopup(auth, provider)).user;
}

export async function adminSignOut() { await signOut(admin().auth); }

export async function isAdmin(user) {
  if (!user?.email) return false;
  try {
    return (await getDoc(doc(admin().fs, 'admins', user.email))).exists();
  } catch (e) {
    if (e.code === 'permission-denied') return false;
    throw e;
  }
}

// 관리자 집계: 참가자·답안 문서로 순위, 답변 기록, 확신도 보정표를 계산합니다.
function buildAdmin(pDocs, rDocs) {
  const board = buildBoard(pDocs);
  const base = board.participants;
  const byId = Object.fromEntries(base.map(p => [p.id, p]));
  const responses = rDocs.map(d => {
    const r = d.data(), p = byId[r.participantId];
    return {
      participantId: r.participantId, participant: p?.name ?? '(삭제됨)', house: p?.house ?? '',
      questionId: r.questionId, answer: r.answer, confidence: r.confidence, correct: r.correct,
      points: r.points, submittedAt: r.submittedAt?.toDate?.().toISOString() ?? ''
    };
  }).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const participants = base.map(p => ({
    ...p,
    points_lost: responses.filter(r => r.participantId === p.id && !r.correct).reduce((n, r) => n - r.points, 0)
  }));
  const calibration = TIERS.map(c => {
    const rows = responses.filter(r => r.confidence === c), correct = rows.filter(r => r.correct).length;
    return { confidence: c, count: rows.length, correct, accuracy: rows.length ? Math.round(correct / rows.length * 100) : 0 };
  }).filter(row => row.count > 0);
  return { gameId: GAME_ID, totalQuestions: TOTAL_QUESTIONS, houses: board.houses, participants, responses, calibration };
}

export async function adminData() {
  const { fs } = admin();
  const [pSnap, rSnap] = await Promise.all([
    getDocs(collection(fs, 'games', GAME_ID, 'participants')),
    getDocs(collection(fs, 'games', GAME_ID, 'responses'))
  ]);
  return buildAdmin(pSnap.docs, rSnap.docs);
}

// 관리자 실시간 구독: 참가자나 답안이 바뀔 때마다 집계를 다시 계산해 onData에 넘깁니다.
// 돌려주는 함수를 부르면 구독을 끝냅니다.
export function watchAdmin(onData, onError) {
  const { fs } = admin();
  let pDocs = null, rDocs = null;
  const emit = () => { if (pDocs && rDocs) onData(buildAdmin(pDocs, rDocs)); };
  const fail = e => { console.error('관리자 구독 실패', e); onError?.(e); };
  const u1 = onSnapshot(collection(fs, 'games', GAME_ID, 'participants'), s => { pDocs = s.docs; emit(); }, fail);
  const u2 = onSnapshot(collection(fs, 'games', GAME_ID, 'responses'), s => { rDocs = s.docs; emit(); }, fail);
  return () => { u1(); u2(); };
}

// 참가자 한 명과 그 답안을 삭제합니다(부적절한 이름 정리 등).
export async function deleteParticipant(participantId) {
  const { fs } = admin();
  const rSnap = await getDocs(query(collection(fs, 'games', GAME_ID, 'responses'), where('participantId', '==', participantId)));
  const batch = writeBatch(fs);
  rSnap.forEach(d => batch.delete(d.ref));
  batch.delete(participantRef(fs, participantId));
  await batch.commit();
  return rSnap.size;
}

// ---- 전체 데이터(모든 회차) ----
// 회차 문서(games/{id})는 따로 만들지 않으므로, 모든 회차의 participants·responses를
// 컬렉션 그룹 조회로 한꺼번에 찾습니다. 관리자 목록(admins)은 건드리지 않습니다.
async function allDocs() {
  const { fs } = admin();
  const [pSnap, rSnap] = await Promise.all([
    getDocs(collectionGroup(fs, 'participants')),
    getDocs(collectionGroup(fs, 'responses'))
  ]);
  const gameOf = d => d.ref.parent.parent?.id ?? '';
  return { pDocs: pSnap.docs, rDocs: rSnap.docs, gameOf };
}

// 회차별 참가자·답안 수와 전체 답안 백업용 행
export async function allGamesSummary() {
  const { pDocs, rDocs, gameOf } = await allDocs();
  const games = {};
  const bump = (id, key) => { (games[id] ??= { id, participants: 0, responses: 0 })[key]++; };
  pDocs.forEach(d => bump(gameOf(d), 'participants'));
  rDocs.forEach(d => bump(gameOf(d), 'responses'));
  const people = Object.fromEntries(pDocs.map(d => [gameOf(d) + '/' + d.id, d.data()]));
  const backup = rDocs.map(d => {
    const r = d.data(), p = people[gameOf(d) + '/' + r.participantId];
    return {
      gameId: gameOf(d), submittedAt: r.submittedAt?.toDate?.().toISOString() ?? '',
      name: p?.name ?? '', house: p?.house ?? '', questionId: r.questionId, answer: r.answer,
      confidence: r.confidence, correct: r.correct, points: r.points
    };
  }).sort((a, b) => a.gameId.localeCompare(b.gameId) || a.submittedAt.localeCompare(b.submittedAt));
  return {
    games: Object.values(games).sort((a, b) => a.id.localeCompare(b.id)),
    participants: pDocs.length, responses: rDocs.length, backup
  };
}

// 모든 회차의 참가자와 답안을 삭제합니다. onProgress(지운 수, 전체 수)로 진행 상황을 알립니다.
export async function resetAllData(onProgress) {
  const { fs } = admin();
  const { pDocs, rDocs } = await allDocs();
  const refs = [...rDocs, ...pDocs].map(d => d.ref); // 답안 먼저, 참가자 나중
  onProgress?.(0, refs.length);
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(fs);
    refs.slice(i, i + 400).forEach(ref => batch.delete(ref));
    await batch.commit();
    onProgress?.(Math.min(i + 400, refs.length), refs.length);
  }
  return refs.length;
}

// 현재 게임의 참가자와 답안을 모두 삭제합니다(개인정보 정리용).
export async function deleteGameData() {
  const { fs } = admin();
  const refs = [];
  for (const name of ['responses', 'participants']) {
    (await getDocs(collection(fs, 'games', GAME_ID, name))).forEach(d => refs.push(d.ref));
  }
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(fs);
    refs.slice(i, i + 400).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
  return refs.length;
}
