// scripts/validate-data.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');

console.log(`[검사 시작] 데이터 폴더: ${DATA_DIR}`);

// 파일 로드
const loadJSON = (filename) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf-8'));
  } catch (e) {
    console.error(`❌ 파일 로드 실패: ${filename} (없거나 깨짐)`);
    process.exit(1);
  }
};

const films = loadJSON('films.json');
const entries = loadJSON('entries.json');
const screenings = loadJSON('screenings.json');

let errors = 0;

// 1. Film ID 중복 검사
const filmIds = new Set();
films.forEach(f => {
  if (filmIds.has(f.id)) {
    console.error(`[Film 중복] ${f.id}`);
    errors++;
  }
  filmIds.add(f.id);
});

// 2. Entry 검사
const entryIds = new Set();
entries.forEach(e => {
  if (entryIds.has(e.id)) {
    console.error(`[Entry 중복] ${e.id}`);
    errors++;
  }
  entryIds.add(e.id);

  if (!filmIds.has(e.filmId)) {
    console.error(`[Entry 고아] ${e.id} -> 없는 영화 ${e.filmId} 참조`);
    errors++;
  }
});

// 3. Screening 검사
const screeningIds = new Set();
screenings.forEach(s => {
  if (screeningIds.has(s.id)) {
    console.error(`[Screening 중복] ${s.id}`);
    errors++;
  }
  screeningIds.add(s.id);

  if (!entryIds.has(s.entryId)) {
    console.error(`[Screening 고아] ${s.id} -> 없는 Entry ${s.entryId} 참조`);
    errors++;
  }

  // 시간 순서 검사
  if (s.startsAt && s.endsAt) {
    const start = new Date(s.startsAt);
    const end = new Date(s.endsAt);
    
    // 날짜 유효성
    if (isNaN(start.getTime())) {
       console.error(`[날짜 오류] ${s.id} startsAt: ${s.startsAt}`);
       errors++;
    }
    if (isNaN(end.getTime())) {
       console.error(`[날짜 오류] ${s.id} endsAt: ${s.endsAt}`);
       errors++;
    }

    // 종료 시간이 시작 시간보다 빠른 경우 (심야 영화 26시 처리가 날짜 넘김 없이 시간만 적힌 경우 등)
    if (end <= start) {
      console.warn(`[시간 경고] ${s.id} (${s.startsAt} ~ ${s.endsAt}) 종료 시간이 더 빠르거나 같음. 확인 요망.`);
      // 경고는 error 카운트에 포함하지 않음 (의도된 0분 상영일 수도 있으므로)
    }
  }
});

console.log('--- 검사 결과 ---');
if (errors === 0) {
  console.log('✅ 데이터 무결성 이상 없음.');
  process.exit(0);
} else {
  console.error(`❌ 총 ${errors}개의 치명적 오류 발견. 배포 금지.`);
  process.exit(1);
}