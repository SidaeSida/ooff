// scripts/patch_film_num_id.mjs (v3)
// 규칙: 단일 결론 => film_num_id(string), 복수 결론 => film_num_ids(string[])
// 보고: filled_single / filled_multi / unresolved(거의 없도록)

import fs from "fs";
import path from "path";

const R = (p) => path.join(process.cwd(), p);
const readJson = (p) => JSON.parse(fs.readFileSync(R(p), "utf8"));
const writeJson = (p, obj) => fs.writeFileSync(R(p), JSON.stringify(obj, null, 2), "utf8");

const ts = () => {
  const d = new Date();
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
};

const isJIFF = (editionId) => String(editionId || "").startsWith("edition_jiff_");
const isBIFF = (editionId) => String(editionId || "").startsWith("edition_biff_");

const extractPosterNumIds = (posters = []) => {
  const out = new Set();
  for (const p of posters) {
    const re = /film_(\d+)/gi;
    let m;
    while ((m = re.exec(String(p))) !== null) out.add(m[1]);
  }
  return out;
};

// detail_url에서 film id/idx 유추
const extractIdFromDetailUrl = (url) => {
  if (!url) return null;
  const s = String(url);
  const m =
    /(?:film_id|idx|fno|fid|id)\s*=\s*(\d{3,})/i.exec(s) ||
    /\/(\d{3,})(?:\.asp|\/|$)/i.exec(s);
  return m ? m[1] : null;
};

// 제목 정규화
const norm = (t) =>
  String(t || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[’'`]/g, "'")
    .replace(/[:–—\-]+/g, "-")
    .trim();

// 제목 -> film_id 인덱스
const buildTitleToIds = (festivalArr) => {
  const map = new Map(); // norm(title_ko/title_en) -> Set(film_id)
  const arr = Array.isArray(festivalArr) ? festivalArr : [];
  for (const item of arr) {
    const id = String(item?.film_id || item?.id || "").trim();
    if (!id) continue;
    const cands = new Set([item?.title_ko, item?.title_en, item?.title].map(norm).filter(Boolean));
    for (const key of cands) {
      const set = map.get(key) ?? new Set();
      set.add(id);
      map.set(key, set);
    }
  }
  return map;
};

// code -> bundleFilmIds
const buildCodeToBundleMap = (festivalArr) => {
  const map = new Map(); // code -> Set(bundleFilmId)
  const arr = Array.isArray(festivalArr) ? festivalArr : [];
  for (const item of arr) {
    const scrs = Array.isArray(item?.screenings) ? item.screenings : [];
    for (const s of scrs) {
      const code = (s?.code ?? "").toString().trim();
      if (!code) continue;
      const ids = Array.isArray(s?.bundleFilmIds) ? s.bundleFilmIds.map((x) => String(x)) : [];
      if (!ids.length) continue;
      const cur = map.get(code) ?? new Set();
      ids.forEach((id) => cur.add(id));
      map.set(code, cur);
    }
  }
  return map;
};

// ---------- load ----------
const films = readJson("data/films.json");
const entries = readJson("data/entries.json");
const screenings = readJson("data/screenings.json");
const ooffJIFF = readJson("data/ooff_jiff2025.json");
const ooffBIFF = readJson("data/ooff_biff2025.json");

const titleToIds_JIFF = buildTitleToIds(ooffJIFF);
const titleToIds_BIFF = buildTitleToIds(ooffBIFF);
const codeToBundle_JIFF = buildCodeToBundleMap(ooffJIFF);
const codeToBundle_BIFF = buildCodeToBundleMap(ooffBIFF);

// 인덱스
const entriesByFilmId = new Map();
for (const e of entries) {
  const k = String(e.filmId);
  if (!entriesByFilmId.has(k)) entriesByFilmId.set(k, []);
  entriesByFilmId.get(k).push(e);
}
const screeningsByEntryId = new Map();
for (const s of screenings) {
  const k = String(s.entryId);
  if (!screeningsByEntryId.has(k)) screeningsByEntryId.set(k, []);
  screeningsByEntryId.get(k).push(s);
}

// 집합 유틸
const setUnion = (...sets) => {
  const out = new Set();
  for (const s of sets) for (const v of s || []) out.add(String(v));
  return out;
};

// ---------- main ----------
let filled_single = 0;
let filled_multi = 0;
let overwritten = 0;
let unresolved = 0;
const unresolvedRows = [];

for (const f of films) {
  const posterIds = extractPosterNumIds(f.posters || []);
  const es = entriesByFilmId.get(String(f.id)) || [];

  // 1) detail_url
  const fromDetail = new Set();
  for (const e of es) {
    const id = extractIdFromDetailUrl(e.detail_url);
    if (id) fromDetail.add(id);
  }

  // 2) 제목 매칭(에디션 스코프)
  const fromTitle = new Set();
  const names = [norm(f.title_ko), norm(f.title_en), norm(f.title)].filter(Boolean);
  for (const e of es) {
    const pool = isJIFF(e.editionId) ? titleToIds_JIFF : isBIFF(e.editionId) ? titleToIds_BIFF : null;
    if (!pool) continue;
    for (const nm of names) {
      const set = pool.get(nm);
      if (set) set.forEach((v) => fromTitle.add(v));
    }
  }

  // 3) code -> bundle
  const fromBundle = new Set();
  for (const e of es) {
    const scrs = screeningsByEntryId.get(String(e.id)) || [];
    const codes = new Set(scrs.map((s) => (s.code ?? "").toString().trim()).filter(Boolean));
    for (const c of codes) {
      if (isJIFF(e.editionId)) codeToBundle_JIFF.get(c)?.forEach((id) => fromBundle.add(id));
      else if (isBIFF(e.editionId)) codeToBundle_BIFF.get(c)?.forEach((id) => fromBundle.add(id));
    }
  }

  // 4) poster
  const fromPoster = posterIds;

  // 후보 통합
  const all = setUnion(fromDetail, fromTitle, fromBundle, fromPoster);

  // 저장 정책
  if (all.size === 0) {
    unresolved++;
    unresolvedRows.push({
      filmId: f.id,
      title: f.title_ko || f.title || "",
      fromDetailUrl: [...fromDetail],
      fromTitle: [...fromTitle],
      fromBundle: [...fromBundle],
      fromPoster: [...fromPoster],
      note: "no-candidate",
    });
    continue;
  }

  if (all.size === 1) {
    const id = [...all][0];
    if (f.film_num_id && f.film_num_id !== id) overwritten++;
    f.film_num_id = String(id);
    delete f.film_num_ids;
    filled_single++;
  } else {
    const ids = [...all].sort();
    const changed =
      !Array.isArray(f.film_num_ids) ||
      ids.length !== f.film_num_ids.length ||
      ids.some((x, i) => x !== String(f.film_num_ids[i]));

    if (changed) filled_multi++;
    f.film_num_ids = ids.map(String);
    delete f.film_num_id;
  }
}

// ---------- write ----------
const backup = `data/films.backup_${ts()}.json`;
writeJson(backup, films);
writeJson("data/films.json", films);

// ---------- report ----------
console.log("---- patch_film_num_id v3 summary ----");
console.log(`filled_single: ${filled_single}`);
console.log(`filled_multi:  ${filled_multi}`);
console.log(`overwritten:   ${overwritten}`);
console.log(`unresolved:    ${unresolved}`);
if (unresolved) {
  const out = R(`data/film_num_id_unresolved_${ts()}.json`);
  fs.writeFileSync(out, JSON.stringify(unresolvedRows, null, 2), "utf8");
  console.log(`unresolved list: ${out}`);
}
console.log(`backup: ${backup}`);
