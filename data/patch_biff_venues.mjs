// patch_biff_venues.mjs
// BIFF venue 값에서 "상영관 + 작품 제목 나열" 형태를
// "상영관"만 남도록 자동 정리하는 스크립트디비.

import fs from "node:fs";

// 이 스크립트와 같은 폴더에 있다고 가정
const SCREENINGS_PATH_IN  = "./screenings.json";
const OOFF_BIFF_PATH_IN   = "./ooff_biff2025.json";

const SCREENINGS_PATH_OUT = "./screenings.biffVenueFixed.json";
const OOFF_BIFF_PATH_OUT  = "./ooff_biff2025.biffVenueFixed.json";

function readJson(path) {
  const txt = fs.readFileSync(path, "utf8");
  return JSON.parse(txt);
}

function writeJson(path, data) {
  const txt = JSON.stringify(data, null, 2) + "\n";
  fs.writeFileSync(path, txt, "utf8");
}

// screenings.json 에서 BIFF venue 패턴을 보고
// "정상 상영관 이름"과 "치환 맵(fixMap)"을 추출
function buildFixMapFromScreenings(screenings) {
  const biffRows = screenings.filter(
    (s) => s && s.festivalId === "festival_biff"
  );

  const venuesSet = new Set();
  for (const row of biffRows) {
    const v = (row.venue || "").trim();
    if (v) venuesSet.add(v);
  }
  const venues = Array.from(venuesSet);

  // 1단계: 자기보다 긴 venue의 prefix로 쓰이는 놈들을 base venue로 취급
  const baseSet = new Set();
  for (const v of venues) {
    for (const w of venues) {
      if (v === w) continue;
      if (w.startsWith(v + " ")) {
        baseSet.add(v);
        break;
      }
    }
  }

  const baseVenues = Array.from(baseSet).sort();

  // 2단계: base + " " 로 시작하는 긴 venue → base 로 치환
  const fixMap = {};
  for (const v of venues) {
    for (const base of baseVenues) {
      if (v !== base && v.startsWith(base + " ")) {
        fixMap[v] = base;
        break;
      }
    }
  }

  return { baseVenues, fixMap };
}

// screenings.json 패치
function patchScreenings(screenings, fixMap) {
  const cloned = JSON.parse(JSON.stringify(screenings));
  let changed = 0;

  for (const row of cloned) {
    if (!row || row.festivalId !== "festival_biff") continue;
    const oldVenue = (row.venue || "").trim();
    const newVenue = fixMap[oldVenue];
    if (newVenue && newVenue !== oldVenue) {
      row.venue = newVenue;
      changed += 1;
    }
  }

  return { data: cloned, changed };
}

// ooff_biff2025.json 패치
function patchOoffBiff(ooff, fixMap) {
  const cloned = JSON.parse(JSON.stringify(ooff));
  let changed = 0;

  if (!cloned.items || !Array.isArray(cloned.items)) {
    throw new Error("ooff_biff2025.json: items 배열이 없습니다.");
  }

  for (const item of cloned.items) {
    const festivals = item.festivals || [];
    for (const fest of festivals) {
      const screenings = fest.screenings || [];
      for (const scr of screenings) {
        const oldVenue = (scr.venue || "").trim();
        const newVenue = fixMap[oldVenue];
        if (newVenue && newVenue !== oldVenue) {
          scr.venue = newVenue;
          changed += 1;
        }
      }
    }
  }

  return { data: cloned, changed };
}

// 메인 실행
function main() {
  console.log("[patch_biff_venues] 시작");

  // 1) screenings.json 읽기
  const screenings = readJson(SCREENINGS_PATH_IN);
  console.log(
    `[patch_biff_venues] screenings.json rows: ${Array.isArray(screenings) ? screenings.length : "N/A"}`
  );

  // 2) fixMap 생성
  const { baseVenues, fixMap } = buildFixMapFromScreenings(screenings);
  console.log(
    `[patch_biff_venues] BIFF base venues (${baseVenues.length}) :`
  );
  for (const v of baseVenues) {
    console.log(`  - ${v}`);
  }
  console.log(
    `[patch_biff_venues] 치환 대상 venue 개수: ${Object.keys(fixMap).length}`
  );

  if (Object.keys(fixMap).length === 0) {
    console.log(
      "[patch_biff_venues] fixMap 이 비어 있습니다. 패턴이 안 잡혔는지 확인이 필요합니다."
    );
    return;
  }

  // 3) screenings.json 패치
  const { data: screeningsPatched, changed: changedScreenings } =
    patchScreenings(screenings, fixMap);
  writeJson(SCREENINGS_PATH_OUT, screeningsPatched);
  console.log(
    `[patch_biff_venues] screenings.json: ${changedScreenings}개 상영의 venue 수정 → ${SCREENINGS_PATH_OUT}`
  );

  // 4) ooff_biff2025.json 패치
  const ooffBiff = readJson(OOFF_BIFF_PATH_IN);
  const { data: ooffPatched, changed: changedOoff } = patchOoffBiff(
    ooffBiff,
    fixMap
  );
  writeJson(OOFF_BIFF_PATH_OUT, ooffPatched);
  console.log(
    `[patch_biff_venues] ooff_biff2025.json: ${changedOoff}개 상영의 venue 수정 → ${OOFF_BIFF_PATH_OUT}`
  );

  console.log("[patch_biff_venues] 완료. 출력 파일을 확인 후 리네임해 사용하시기 바랍니다.");
}

main();
