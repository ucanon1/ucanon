// Firebase 웹 앱 설정값.
// Firebase 콘솔 > 프로젝트 설정 > 내 앱(웹)에서 복사한 값으로 바꿉니다.
// 이 값은 공개되어도 괜찮습니다. 실제 접근 통제는 firestore.rules가 담당합니다.
export const firebaseConfig = {
  apiKey: 'AIzaSyDRHxDVXvrvLjQTjEERNfQYOdYn9TQW3P4',
  authDomain: 'ucanon-hogwarts.firebaseapp.com',
  projectId: 'ucanon-hogwarts',
  storageBucket: 'ucanon-hogwarts.firebasestorage.app',
  messagingSenderId: '345201038728',
  appId: '1:345201038728:web:513faad058de87631c963d'
};

// 기본 게임(회차) ID. 새 회차를 시작하려면 이 값을 바꾸거나
// 주소에 ?game=회차ID 를 붙입니다(영문 소문자·숫자·하이픈, 40자 이내).
export const DEFAULT_GAME_ID = 'house-cup-2026';

// firestore.rules의 문항 수(10)와 같아야 합니다.
export const TOTAL_QUESTIONS = 10;
