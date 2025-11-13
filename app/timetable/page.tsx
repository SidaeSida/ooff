// app/timetable/page.tsx

import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import filmsData from "@/data/films.json";
import entriesData from "@/data/entries.json";
import screeningsRaw from "@/data/screenings.json";
import TimetableClient from "./TimetableClient";

export const dynamic = "force-dynamic";

// ---------- 타입 ----------

type Film = {
  id: string;
  title: string;
  title_ko?: string;
  title_en?: string;
  runtime?: number;
};

type Entry = {
  id: string;
  filmId: string;
  editionId: string;
  section?: string | null;
};

type Screening = {
  id: string;
  entryId: string;
  code: string | null;
  startsAt: string;
  endsAt: string | null;
  venue: string;
  city?: string | null;
  withGV?: boolean | null;
  dialogue?: string | null;
  subtitles?: string | null;
  rating?: string | null;
};

type SearchParams = {
  edition?: string;
  date?: string;
};

// Next 16: searchParams 가 Promise 로 들어옴
type PageProps = {
  searchParams: Promise<SearchParams>;
};

type ViewRow = {
  id: string;
  filmId: string;
  filmTitle: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  editionId: string;
  section?: string | null;
  venue: string;
  code?: string | null;
  withGV?: boolean | null;
  subtitles?: string | null;
  rating?: string | null;

  startMin: number;
  endMin: number;
  priority: number | null;
};

// TimetableClient 에서 사용할 타입 별칭
export type TimetableRow = ViewRow;

// ---------- 상수/헬퍼 ----------

const EDITION_LABEL: Record<string, string> = {
  edition_jiff_2025: "JIFF 2025",
  edition_biff_2025: "BIFF 2025",
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function formatDateLabel(dateIso: string) {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return dateIso;

  const month = d.getMonth() + 1;
  const day = d.getDate();
  const w = WEEKDAYS[d.getDay()];
  return `${month}월${day}일(${w})`;
}

function isWeekend(dateIso: string) {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return false;
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

// ---------- 페이지 컴포넌트 ----------

export default async function TimetablePage({ searchParams }: PageProps) {
  // 1) 로그인 확인
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?next=/timetable");
  }
  const userId = session.user.id;

  // 2) 내가 하트한 상영 목록 (priority 포함)
  const favoriteRows = await prisma.favoriteScreening.findMany({
    where: { userId },
    select: { screeningId: true, priority: true },
  });

  if (!favoriteRows.length) {
    return (
      <main className="p-4 space-y-3">
        <h1 className="text-xl font-semibold">나의 타임테이블</h1>
        <p className="text-sm text-gray-600">
          아직 하트한 상영이 없습니다. 영화 상세 페이지에서 보고 싶은 상영에
          하트를 누르면 이곳에 모여서 보입니다.
        </p>
      </main>
    );
  }

  const favoritePriority = new Map<string, number | null>();
  for (const row of favoriteRows) {
    favoritePriority.set(row.screeningId, row.priority ?? null);
  }
  const favoriteIds = new Set(favoritePriority.keys());

  // 3) JSON → 인덱스
  const films = filmsData as Film[];
  const entries = entriesData as Entry[];
  const screenings = screeningsRaw as Screening[];

  const filmById: Record<string, Film> = Object.fromEntries(
    films.map((f) => [f.id, f])
  );
  const entryById: Record<string, Entry> = Object.fromEntries(
    entries.map((e) => [e.id, e])
  );

  // 4) 상영 + 영화 + 출품 정보 → ViewRow
  const merged: ViewRow[] = screenings
    .filter((s) => favoriteIds.has(s.id))
    .map((s) => {
      const entry = entryById[s.entryId];
      const film = entry ? filmById[entry.filmId] : undefined;

      const date = s.startsAt.slice(0, 10); // YYYY-MM-DD
      const time = s.startsAt.slice(11, 16); // HH:mm

      const [hh, mm] = time.split(":").map((v) => Number(v) || 0);
      const startMin = hh * 60 + mm;

      let endMin: number;
      if (s.endsAt) {
        const t2 = s.endsAt.slice(11, 16);
        const [hh2, mm2] = t2.split(":").map((v) => Number(v) || 0);
        endMin = hh2 * 60 + mm2;
      } else {
        const runtime = film?.runtime ?? 120;
        endMin = startMin + runtime;
      }

      return {
        id: s.id,
        filmId: entry?.filmId ?? s.entryId,
        filmTitle:
          film?.title_ko ||
          film?.title ||
          film?.title_en ||
          entry?.filmId ||
          s.entryId,
        date,
        time,
        editionId: entry?.editionId ?? "unknown",
        section: entry?.section ?? null,
        venue: s.venue,
        code: s.code,
        withGV: s.withGV ?? false,
        subtitles: s.subtitles ?? null,
        rating: s.rating ?? null,
        startMin,
        endMin,
        priority: favoritePriority.get(s.id) ?? null,
      };
    })
    .filter((row) => row.editionId !== "unknown");

  if (!merged.length) {
    return (
      <main className="p-4 space-y-3">
        <h1 className="text-xl font-semibold">나의 타임테이블</h1>
        <p className="text-sm text-gray-600">
          아직 하트한 상영이 없습니다. 영화 상세 페이지에서 보고 싶은 상영에
          하트를 누르면 이곳에 모여서 보입니다.
        </p>
      </main>
    );
  }

  // 5) searchParams Promise 해제
  const sp = await searchParams;

  // 6) 영화제(edition) 목록
  const editions = Array.from(
    new Set(merged.map((m) => m.editionId))
  ).sort((a, b) => a.localeCompare(b));

  const currentEdition =
    sp.edition && editions.includes(sp.edition) ? sp.edition : editions[0];

  // 7) 현재 영화제 안에서 날짜 목록
  const days = Array.from(
    new Set(
      merged
        .filter((m) => m.editionId === currentEdition)
        .map((m) => m.date)
    )
  ).sort((a, b) => a.localeCompare(b));

  const currentDate =
    sp.date && days.includes(sp.date) ? sp.date : days[0];

  // 8) 최종 필터링 (영화제 + 날짜)
  const filtered = merged
    .filter((m) => m.editionId === currentEdition && m.date === currentDate)
    .sort((a, b) => a.time.localeCompare(b.time));

  const currentEditionLabel =
    EDITION_LABEL[currentEdition] ?? currentEdition;

  const pillBase =
    "text-[12px] px-3 py-1 rounded-full border transition-colors duration-150";

  // 9) 렌더링
  return (
    <main className="p-4 space-y-4">
      {/* 상단 필터 바 */}
      <section className="space-y-3">
        {/* 영화제 선택 */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-gray-500">영화제</span>
          {editions.map((eid) => {
            const active = eid === currentEdition;
            const params = new URLSearchParams();
            params.set("edition", eid);
            params.set("date", currentDate);
            const href = `/timetable?${params.toString()}`;

            return (
              <Link
                key={eid}
                href={href}
                className={
                  pillBase +
                  " " +
                  (active
                    ? "bg-black border-black"
                    : "bg-white border-gray-300 hover:bg-gray-100")
                }
              >
                <span className={active ? "text-white" : "text-gray-800"}>
                  {EDITION_LABEL[eid] ?? eid}
                </span>
              </Link>
            );
          })}
        </div>

        {/* 날짜 선택 */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-gray-500">날짜</span>
          {days.map((d) => {
            const active = d === currentDate;
            const params = new URLSearchParams();
            params.set("edition", currentEdition);
            params.set("date", d);
            const href = `/timetable?${params.toString()}`;
            const weekend = isWeekend(d);
            const label = formatDateLabel(d);

            const textClass = active
              ? "text-white"
              : weekend
              ? "text-[#D30000]"
              : "text-gray-800";

            return (
              <Link
                key={d}
                href={href}
                className={
                  pillBase +
                  " " +
                  (active
                    ? "bg-black border-black"
                    : "bg-white border-gray-300 hover:bg-gray-100")
                }
              >
                <span className={textClass}>{label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 타임라인 영역 (클라이언트 컴포넌트) */}
      <section>
        <TimetableClient
          rows={filtered}
          editionLabel={currentEditionLabel}
          dateIso={currentDate}
        />
      </section>
    </main>
  );
}
