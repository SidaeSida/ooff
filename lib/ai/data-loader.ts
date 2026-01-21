import { prisma } from "@/lib/prisma";
import filmsData from "@/data/films.json";
import entriesData from "@/data/entries.json";
import screeningsData from "@/data/screenings.json";

// ------------------------------------------------------------------
// Types (AI에게 보낼 경량화된 데이터 구조)
// ------------------------------------------------------------------

export type MinifiedScreening = {
  i: string; // id
  t: string; // title (korean preferred)
  s: string; // start time (HH:MM)
  e: string; // end time (HH:MM)
  v: string; // venue
  g: string; // genres (comma separated)
  d: string; // directors (comma separated)
};

export type MinifiedTaste = {
  t: string; // title
  r: number; // rating
  g: string; // genres
  d: string; // directors
};

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function getHm(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

// 종료 시간이 없는 경우 런타임으로 계산
function calculateEndTime(startIso: string, runtime: number = 100): string {
  const date = new Date(startIso);
  date.setMinutes(date.getMinutes() + runtime);
  return getHm(date.toISOString());
}

// ------------------------------------------------------------------
// Main Functions
// ------------------------------------------------------------------

/**
 * 1. 상영작 압축기 (Screenings Context)
 * - 특정 에디션(JIFF 2025 등)과 날짜 목록을 받아, 해당 날짜의 상영 스케줄을 압축하여 반환합니다.
 * - 반환 형식: { "2025-05-01": [...], "2025-05-02": [...] }
 */
export function getScreeningsContext(editionId: string, dates: string[]) {
  // 1. 데이터 인덱싱 (속도 최적화)
  const filmMap = new Map<string, any>();
  (filmsData as any[]).forEach((f) => filmMap.set(f.id, f));

  const entryMap = new Map<string, any>();
  (entriesData as any[]).forEach((e) => entryMap.set(e.id, e));

  const result: Record<string, MinifiedScreening[]> = {};

  // 결과 객체 초기화
  dates.forEach((date) => {
    result[date] = [];
  });

  // 2. 스크리닝 순회 및 필터링
  (screeningsData as any[]).forEach((scr) => {
    const scrDate = scr.startsAt.split("T")[0];
    
    // 요청한 날짜가 아니면 패스
    if (!dates.includes(scrDate)) return;

    const entry = entryMap.get(scr.entryId);
    if (!entry) return;
    
    // 영화제(edition) 불일치 패스
    if (entry.editionId !== editionId) return;

    const film = filmMap.get(entry.filmId);
    if (!film) return;

    // 3. 데이터 압축 (Minification)
    // - 필드명을 한 글자로 줄임
    // - 불필요한 정보 제거 (이미지, 줄거리 등)
    const endTime = scr.endsAt 
      ? getHm(scr.endsAt) 
      : calculateEndTime(scr.startsAt, film.runtime);

    result[scrDate].push({
      i: scr.id,                                   
      t: film.title_ko || film.title || "Untitled",
      s: getHm(scr.startsAt),                      
      e: endTime,
      v: scr.venue || "Unknown",                   
      g: film.genres?.join(",") || "",             
      d: film.credits?.directors?.join(",") || "", 
    });
  });

  // 4. 시간순 정렬 (Start Time 오름차순)
  Object.keys(result).forEach((date) => {
    result[date].sort((a, b) => a.s.localeCompare(b.s));
  });

  return result;
}

/**
 * 2. 사용자 취향 추출기 (User Taste Context)
 * - DB에서 사용자가 4.0 이상 평가한 영화를 가져와 취향 정보를 압축합니다.
 * - 우선순위: 1. 높은 평점순, 2. 최신 평가순
 * - 최대 20개 제한
 */
export async function getUserTasteContext(userId: string): Promise<MinifiedTaste[]> {
  // 1. DB 조회
  const ratings = await prisma.userEntry.findMany({
    where: {
      userId,
      rating: { gte: 4 }, // 평점 4.0 이상만
    },
    orderBy: [
      { rating: 'desc' },    // 1순위: 점수 높은 순
      { updatedAt: 'desc' }  // 2순위: 최신순
    ],
    take: 20, // Top 20
    select: {
      filmId: true,
      rating: true,
    }
  });

  if (!ratings.length) return [];

  // 2. 매핑을 위한 Film Map 생성 (이미지/줄거리 제외한 메타데이터용)
  const filmMap = new Map<string, any>();
  (filmsData as any[]).forEach((f) => filmMap.set(f.id, f));

  const tasteList: MinifiedTaste[] = [];

  // 3. 데이터 결합 및 압축
  ratings.forEach((r) => {
    const film = filmMap.get(r.filmId);
    if (film) {
      tasteList.push({
        t: film.title_ko || film.title,
        r: Number(r.rating),
        g: (film.genres || []).join(","),
        d: (film.credits?.directors || []).join(","),
      });
    }
  });

  return tasteList;
}