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
  onSnapshot, writeBatch, serverTimestamp, increment
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { firebaseConfig, DEFAULT_GAME_ID, TOTAL_QUESTIONS } from './firebase-config.js';

const params = new URLSearchParams(location.search);
const requestedGame = params.get('game') || '';
export const GAME_ID = /^[a-z0-9-]{1,40}$/.test(requestedGame) ? requestedGame : DEFAULT_GAME_ID;

// localhost에서는 Firebase 에뮬레이터에 붙습니다. 실제 DB로 시험하려면 주소에 ?prod 를 붙입니다.
export const USE_EMULATOR = ['localhost', '127.0.0.1'].includes(location.hostname) && !params.has('prod');

const HOUSES = ['Gryffindor', 'Ravenclaw', 'Hufflepuff', 'Slytherin'];
const TIERS = [30, 45, 60, 75, 95];
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
  const snap = await getDoc(responseRef(fs, state.id, questionId));
  if (!snap.exists()) return null;
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

// 기존 /api/admin 응답과 같은 모양으로 돌려줍니다.
export async function adminData() {
  const { fs } = admin();
  const [pSnap, rSnap] = await Promise.all([
    getDocs(collection(fs, 'games', GAME_ID, 'participants')),
    getDocs(collection(fs, 'games', GAME_ID, 'responses'))
  ]);
  const base = buildBoard(pSnap.docs).participants;
  const byId = Object.fromEntries(base.map(p => [p.id, p]));
  const responses = rSnap.docs.map(d => {
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
  return { gameId: GAME_ID, totalQuestions: TOTAL_QUESTIONS, participants, responses, calibration };
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
