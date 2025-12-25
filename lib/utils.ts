// lib/utils.ts
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

// --- URL & Router Utils ---

export function setQuery(
  router: AppRouterInstance | any,
  pathname: string,
  prev: URLSearchParams,
  patch: Record<string, string | undefined>
) {
  const sp = new URLSearchParams(prev.toString());
  Object.entries(patch).forEach(([k, v]) => {
    if (v === undefined || v === '') sp.delete(k);
    else sp.set(k, v);
  });
  const qs = sp.toString();
  router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
}

// --- CSV Processing Utils ---

export function parseCsv(csv: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < csv.length && csv[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        const trimmed = cur.trim();
        if (trimmed) out.push(trimmed);
        cur = "";
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  const trimmed = cur.trim();
  if (trimmed) out.push(trimmed);
  return out;
}

export function buildCsv(list: string[]): string {
  const uniq: string[] = [];
  for (const v of list) {
    const s = v.trim();
    if (s && !uniq.includes(s)) uniq.push(s);
  }
  const encoded = uniq.map((v) => {
    let s = v;
    if (s.includes(`"`)) s = s.replace(/"/g, `""`);
    if (s.includes(",")) return `"${s}"`;
    return s;
  });
  return encoded.join(",");
}

export function toggleCsv(currentCsv: string | null, value: string): string {
  const cur = parseCsv(currentCsv ?? "");
  const set = new Set(cur);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return buildCsv(Array.from(set));
}

export function csvOfAll(arr: string[]): string | undefined {
  if (!arr.length) return undefined;
  return buildCsv(arr);
}

export function isAllSelected(currentCsv: string | null, options: string[]): boolean {
  if (!options.length) return false;
  const cur = new Set(parseCsv(currentCsv ?? ""));
  return options.every((o) => cur.has(o));
}

// --- Date & Formatting Utils ---

export function ymd(iso?: string | null) {
  return iso ? iso.slice(0, 10) : '';
}

export function hm(iso?: string | null) {
  return iso ? iso.slice(11, 16) : "";
}

export function weekdayKFromISO(iso?: string | null) {
  if (!iso) return '';
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return ['일', '월', '화', '수', '목', '금', '토'][dow];
}

export function isWeekendISO(iso?: string | null) {
  if (!iso) return false;
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6;
}

export function mdK(iso?: string | null) {
  if (!iso) return '';
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  const w = weekdayKFromISO(iso);
  return `${m}월 ${d}일(${w})`;
}

export function normId(s: string) {
  try { return decodeURIComponent(String(s)).trim().toLowerCase(); }
  catch { return String(s).trim().toLowerCase(); }
}

// --- Math Utils ---

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}