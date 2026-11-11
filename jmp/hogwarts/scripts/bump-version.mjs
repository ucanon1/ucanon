// 배포 전에 실행: 모든 css·js 참조에 버전(?v=...)을 붙여 브라우저 캐시를 무효화합니다.
// GitHub Pages는 파일을 10분간 캐시하므로, 버전이 없으면 새 admin.js가 옛 hogwarts-db.js를
// 불러오는 식으로 파일이 섞여 "is not a function" 오류가 날 수 있습니다.
//   node scripts/bump-version.mjs          (현재 시각으로)
//   node scripts/bump-version.mjs 2026-11-12a
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const now = new Date();
const p = n => String(n).padStart(2, '0');
const version = process.argv[2] || `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}`;
if (!/^[\w.-]+$/.test(version)) throw new Error('버전은 영문·숫자·.-_ 만 쓸 수 있습니다');

const files = ['index.html', 'admin.html', ...readdirSync(join(root, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f)];
// HTML의 href/src="css/..|js/..", JS의 from './x.js'
const patterns = [
  /((?:href|src)="(?:css|js)\/[\w-]+\.(?:css|js))(?:\?v=[\w.-]+)?(")/g,
  /(from '\.\/[\w-]+\.js)(?:\?v=[\w.-]+)?(')/g
];
let total = 0;
for (const f of files) {
  const path = join(root, f);
  const before = readFileSync(path, 'utf8');
  let count = 0;
  const after = patterns.reduce((s, re) => s.replace(re, (_, a, b) => { count++; return `${a}?v=${version}${b}`; }), before);
  if (after !== before) writeFileSync(path, after);
  total += count;
  if (count) console.log(`${f}: ${count}`);
}
console.log(`버전 ${version} 적용, 참조 ${total}곳`);
