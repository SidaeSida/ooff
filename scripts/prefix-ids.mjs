// scripts/prefix-ids.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname 설정 (ES Module)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 설정: 수정할 에디션과 접두사
// (필요 시 이 두 줄만 수정해서 재사용 가능)
// scripts/prefix-ids.mjs 파일을 열어서 윗부분을 수정하세요
const TARGET_EDITION = 'edition_biff_2025';  // JIFF -> BIFF 변경
const ID_PREFIX = 'biff2025_';              // 접두사 변경
// 경로 설정: scripts 폴더의 상위(..) -> data 폴더
const DATA_DIR = path.join(__dirname, '..', 'data'); 

const filmsPath = path.join(DATA_DIR, 'films.json');
const entriesPath = path.join(DATA_DIR, 'entries.json');

console.log(`[작업 시작] ${TARGET_EDITION} 데이터를 찾아 ID에 "${ID_PREFIX}"를 붙입니다...`);

// 파일 읽기
const films = JSON.parse(fs.readFileSync(filmsPath, 'utf-8'));
const entries = JSON.parse(fs.readFileSync(entriesPath, 'utf-8'));

// 변경 대상 영화 ID 수집
const targetFilmIds = new Set();
entries.forEach(entry => {
  if (entry.editionId === TARGET_EDITION) {
    targetFilmIds.add(entry.filmId);
  }
});

console.log(`-> 총 ${targetFilmIds.size}개의 영화가 변경 대상입니다.`);

let updateCount = 0;

// 영화 ID 변경
films.forEach(film => {
  // 해당 에디션의 영화이고, 아직 접두사가 안 붙은 경우만
  if (targetFilmIds.has(film.id) && !film.id.startsWith(ID_PREFIX)) {
    const oldId = film.id;
    const newId = `${ID_PREFIX}${oldId}`;
    
    // 1. films.json 수정
    film.id = newId;
    
    // 2. entries.json 수정 (참조하는 filmId 변경)
    entries.forEach(entry => {
      if (entry.filmId === oldId) {
        entry.filmId = newId;
      }
    });
    
    updateCount++;
  }
});

// 파일 저장
fs.writeFileSync(filmsPath, JSON.stringify(films, null, 2), 'utf-8');
fs.writeFileSync(entriesPath, JSON.stringify(entries, null, 2), 'utf-8');

console.log(`[작업 완료] ${updateCount}개의 ID가 업데이트되었습니다.`);