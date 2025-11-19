// app/timetable/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import filmsData from "@/data/films.json";
import entriesData from "@/data/entries.json";
import screeningsRaw from "@/data/screenings.json";
import TimetableShellClient from "./TimetableShellClient";

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

type PageProps = {
  searchParams: Promise<SearchParams>;
};

type BundleFilm = {
  filmId: string;
  title: string;
};

type ViewRow = {
  id: string;
  filmId: string;
  filmTitle: string;
  date: string;
  time: string;
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
  order: number | null;
  bundleFilms?: BundleFilm[];
};

export type TimetableRow = ViewRow;

// ---------- 헬퍼 ----------

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

function buildBundleKey(editionId: string | undefined, code: string | null) {
  const c = (code ?? "").trim();
  if (!editionId || !c) return null;
  return `${editionId}__${c}`;
}

// ---------- 페이지 ----------

export default async function TimetablePage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?next=/timetable");
  }
  const userId = session.user.id;

  // 즐겨찾기 조회
  let favoriteRows: { screeningId: string; priority: number | null; sortOrder: number | null }[] = [];

  try {
    favoriteRows = await prisma.favoriteScreening.findMany({
      where: { userId },
      select: { screeningId: true, priority: true, sortOrder: true },
    });
  } catch {
    favoriteRows = [];
  }

  if (!favoriteRows.length) {
    return (
      <main className="p-4 space-y-3">
        <h1 className="text-xl font-semibold">My Timetable</h1>
        <p className="text-sm text-gray-600">
          No favorite screenings yet. Add ♥ on a screening to build your timetable.
        </p>
      </main>
    );
  }

  const favoritePriority = new Map<string, number | null>();
  const favoriteOrder = new Map<string, number | null>();

  for (const row of favoriteRows) {
    favoritePriority.set(row.screeningId, row.priority ?? null);
    favoriteOrder.set(row.screeningId, row.sortOrder ?? null);
  }

  const favoriteIds = new Set(favoritePriority.keys());

  // JSON 로드
  const films = filmsData as Film[];
  const entries = entriesData as Entry[];
  const screenings = screeningsRaw as Screening[];

  const filmById = Object.fromEntries(films.map((f) => [f.id, f]));
  const entryById = Object.fromEntries(entries.map((e) => [e.id, e]));

  // bundleMap: editionId + code → 해당 상영에 포함된 영화 리스트
  const bundleMap = new Map<string, BundleFilm[]>();

  for (const s of screenings) {
    const entry = entryById[s.entryId];
    if (!entry) continue;

    const key = buildBundleKey(entry.editionId, s.code);
    if (!key) continue;

    const film = filmById[entry.filmId];
    const title = film?.title_ko || film?.title || film?.title_en || entry.filmId;

    const list = bundleMap.get(key) ?? [];
    if (!list.some((x) => x.filmId === entry.filmId)) {
      list.push({ filmId: entry.filmId, title });
    }
    bundleMap.set(key, list);
  }
  // merged rows
  const merged: ViewRow[] = screenings
    .filter((s) => favoriteIds.has(s.id))
    .map((s) => {
      const entry = entryById[s.entryId];
      const film = entry ? filmById[entry.filmId] : undefined;

      const date = s.startsAt.slice(0, 10);
      const time = s.startsAt.slice(11, 16);

      const [hh, mm] = time.split(":").map((v) => Number(v) || 0);
      const startMin = hh * 60 + mm;

      const editionId = entry?.editionId ?? "unknown";
      const primaryFilmId = entry?.filmId ?? s.entryId;

      // bundleList 먼저 선언
      const bundleKey = buildBundleKey(editionId, s.code);
      const bundleList = bundleKey ? bundleMap.get(bundleKey) ?? [] : [];

      // runtime 계산
      let endMin: number;

      if (s.endsAt) {
        const t2 = s.endsAt.slice(11, 16);
        const [hh2, mm2] = t2.split(":").map((v) => Number(v) || 0);
        endMin = hh2 * 60 + mm2;
      } else {
        // 기본값
        let runtime = 120;

        // 다중상영 영화 → 구성 영화 runtime 합산
        if (bundleList.length > 1) {
          const runtimes = bundleList.map((bf) => {
            const rt = filmById[bf.filmId]?.runtime;
            return typeof rt === "number" ? rt : null;
          });

          // 모두 runtime이 있을 때만 합산
          if (runtimes.every((x) => x !== null)) {
            runtime = (runtimes as number[]).reduce((a, b) => a + b, 0);
          }
        } else {
          runtime = typeof film?.runtime === "number" ? film.runtime : 120;
        }
        endMin = startMin + runtime;
      }


      // filmTitle / bundleFilms
      let filmTitle: string;
      let bundleFilms: BundleFilm[] | undefined;

      if (bundleList.length > 1) {
        const sorted = [...bundleList].sort((a, b) => {
          if (a.filmId === primaryFilmId) return -1;
          if (b.filmId === primaryFilmId) return 1;
          return a.title.localeCompare(b.title, "ko");
        });
        filmTitle = sorted.map((x) => x.title).join(" + ");
        bundleFilms = sorted;
      } else {
        filmTitle =
          film?.title_ko ||
          film?.title ||
          film?.title_en ||
          entry?.filmId ||
          s.entryId;
      }

      return {
        id: s.id,
        filmId: primaryFilmId,
        filmTitle,
        date,
        time,
        editionId,
        section: entry?.section ?? null,
        venue: s.venue,
        code: s.code,
        withGV: s.withGV ?? false,
        subtitles: s.subtitles ?? null,
        rating: s.rating ?? null,
        startMin,
        endMin,
        priority: favoritePriority.get(s.id) ?? null,
        order: favoriteOrder.get(s.id) ?? null,
        bundleFilms,
      };
    })
    .filter((row) => row.editionId !== "unknown");

  if (!merged.length) {
    return (
      <main className="p-4 space-y-3">
        <h1 className="text-xl font-semibold">My Timetable</h1>
        <p className="text-sm text-gray-600">No favorite screenings yet.</p>
      </main>
    );
  }

  const sp = await searchParams;

  const editions = Array.from(new Set(merged.map((m) => m.editionId)));
  editions.sort((a, b) => {
    const order = (id: string) =>
      id.startsWith("edition_jiff_") ? 0 : id.startsWith("edition_biff_") ? 1 : 99;
    const oa = order(a);
    const ob = order(b);
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b);
  });

  const currentEdition =
    sp.edition && editions.includes(sp.edition) ? sp.edition : editions[0];

  const days = Array.from(
    new Set(merged.filter((m) => m.editionId === currentEdition).map((m) => m.date))
  ).sort();

  const currentDate = sp.date && days.includes(sp.date) ? sp.date : days[0];

  const filtered = merged
    .filter((m) => m.editionId === currentEdition && m.date === currentDate)
    .sort((a, b) => a.time.localeCompare(b.time));

  const currentEditionLabel = EDITION_LABEL[currentEdition] ?? currentEdition;

  const pillBase =
    "text-[12px] px-3 py-1 rounded-full border transition-colors duration-150";

  return (
    <main className="p-4 space-y-4">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-gray-500">영화제</span>
          {editions.map((eid) => {
            const active = eid === currentEdition;
            const params = new URLSearchParams();
            params.set("edition", eid);
            params.set("date", currentDate);
            return (
              <Link
                key={eid}
                href={`/timetable?${params.toString()}`}
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

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-gray-500">날짜</span>
          {days.map((d) => {
            const active = d === currentDate;
            const params = new URLSearchParams();
            params.set("edition", currentEdition);
            params.set("date", d);

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
                href={`/timetable?${params.toString()}`}
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

      <section>
        <TimetableShellClient
          rows={filtered}
          editionLabel={currentEditionLabel}
          dateIso={currentDate}
        />
      </section>
    </main>
  );
}
