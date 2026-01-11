"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import filmsData from "@/data/films.json";
import { toggleFollow } from "@/app/my/actions";
import { getFollowList } from "../actions";

type Tab = "ratings" | "friends";
type UserData = {
  id: string;
  nickname: string | null;
  _count: { followedBy: number; following: number };
  isFollowing: boolean;
};

type ListUser = {
  id: string;
  nickname: string | null;
  isFollowing: boolean;
  isMe: boolean;
};

export default function UserProfileClient({
  user,
  initialRatings,
  myId,
}: {
  user: UserData;
  initialRatings: any[];
  myId: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("ratings");

  const [isFollowing, setIsFollowing] = useState(user.isFollowing);
  const [followerCount, setFollowerCount] = useState(user._count.followedBy);

  // Friends 탭용 상태
  const [listType, setListType] = useState<"followers" | "following">("followers");
  const [userList, setUserList] = useState<ListUser[] | null>(null);
  const [loadingList, setLoadingList] = useState(false);

  // 영화 데이터 매핑
  const filmMap = useMemo(() => {
    const map = new Map<string, any>();
    (filmsData as any[]).forEach((f) => map.set(f.id, f));
    return map;
  }, []);

  // 상단 팔로우 버튼 핸들러
  const handleFollowToggle = async () => {
    const nextState = !isFollowing;
    setIsFollowing(nextState);
    setFollowerCount((prev) => (nextState ? prev + 1 : prev - 1));
    try {
      await toggleFollow(user.id);
      router.refresh();
    } catch (e) {
      setIsFollowing(!nextState);
      setFollowerCount((prev) => (!nextState ? prev + 1 : prev - 1));
      alert("Error");
    }
  };

  // 탭 전환 및 리스트 로드 (숫자 클릭 & 탭 클릭 공용)
  const switchTabAndLoad = async (type: "followers" | "following") => {
    setActiveTab("friends");
    setListType(type);
    setLoadingList(true);
    setUserList(null);
    try {
      const list = await getFollowList(user.id, type);
      setUserList(list);
    } catch (e) {
      alert("Failed to load list");
    } finally {
      setLoadingList(false);
    }
  };

  // 리스트 내부 팔로우 버튼 핸들러
  const handleListFollow = async (targetId: string, currentStatus: boolean) => {
    setUserList(
      (prev) => prev?.map((u) => (u.id === targetId ? { ...u, isFollowing: !currentStatus } : u)) ?? null
    );

    if (targetId === user.id) {
      setIsFollowing(!currentStatus);
      setFollowerCount((prev) => (!currentStatus ? prev + 1 : prev - 1));
    }

    await toggleFollow(targetId);
    router.refresh();
  };

  const statsChipBase =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors";
  const statsChipActive = "bg-gray-900 text-white border-gray-900";
  const statsChipIdle = "bg-white text-gray-600 border-gray-200 hover:bg-gray-50";

  // MyRatingsClient 카드 톤과 동일
  const bg = "var(--bg-rated)";
  const bd = "var(--bd-rated)";
  const hover = "var(--bg-hover-r)";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* 1. Header Area */}
      <header className="pb-4 border-b border-gray-100">
        {/* 1줄 헤더: nickname (좌) + follow 버튼 (우) */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-gray-900 break-words">
              {user.nickname}
            </h1>
          </div>

          <button
            onClick={handleFollowToggle}
            className={`
              shrink-0 h-10 px-4 rounded-xl text-sm font-bold transition-all border
              ${isFollowing
                ? "bg-white text-gray-900 border-gray-300 hover:text-red-600 hover:border-red-200"
                : "bg-gray-900 text-white border-transparent hover:bg-gray-800"
              }
            `}
          >
            {isFollowing ? "Following" : "Follow"}
          </button>
        </div>

        {/* 통계는 작은 칩으로 아래에 '치워' 배치 (우측 정렬) */}
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            onClick={() => switchTabAndLoad("followers")}
            className={`
              ${statsChipBase}
              ${activeTab === "friends" && listType === "followers" ? statsChipActive : statsChipIdle}
            `}
          >
            <span className="tabular-nums">{followerCount}</span>
            <span className="text-[11px] font-medium opacity-90">Followers</span>
          </button>

          <button
            onClick={() => switchTabAndLoad("following")}
            className={`
              ${statsChipBase}
              ${activeTab === "friends" && listType === "following" ? statsChipActive : statsChipIdle}
            `}
          >
            <span className="tabular-nums">{user._count.following}</span>
            <span className="text-[11px] font-medium opacity-90">Following</span>
          </button>
        </div>
      </header>

      {/* 2. Tabs */}
      <nav className="flex w-full border-b border-gray-200">
        <button
          onClick={() => setActiveTab("ratings")}
          className={`
            flex-1 py-2.5 text-sm font-semibold border-b-2 transition-all
            ${activeTab === "ratings"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200"
            }
          `}
        >
          Ratings
        </button>
        <button
          onClick={() => {
            // Friends 탭을 누르면 자동으로 followers를 로딩
            if (activeTab !== "friends") {
              switchTabAndLoad("followers");
            }
          }}
          className={`
            flex-1 py-2.5 text-sm font-semibold border-b-2 transition-all
            ${activeTab === "friends"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200"
            }
          `}
        >
          Friends
        </button>
      </nav>

      {/* 3. Content */}
      <section className="min-h-[300px]">
        {/* Ratings Tab */}
        {activeTab === "ratings" && (
          <ul className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {initialRatings.length === 0 && (
              <li className="text-center py-20 text-gray-400 text-sm">No ratings shared yet.</li>
            )}

            {initialRatings.map((e) => {
               const f = filmMap.get(e.filmId);

               // 제목: 한글 우선 (영어 제목 괄호 표기 제거)
               const titleKo = f?.title_ko;
               const titleEn = f?.title;
               const displayTitle = titleKo ? titleKo : (titleEn ?? e.filmId);

               const year = f?.year ? ` (${f.year})` : "";
               const fullTitle = `${displayTitle}${year}`;

               // 감독: 한글 우선
               const directors = f?.credits?.directors_ko?.length
                 ? f.credits.directors_ko.join(", ")
                 : (f?.credits?.directors?.join(", ") ?? "");

               const d = e?.updatedAt ? new Date(e.updatedAt) : null;
               const ymd =
                 d && !Number.isNaN(d.getTime())
                   ? `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`
                   : "-";

               const badgeText =
                 e.rating === null || e.rating === "" ? "-" : Number(e.rating).toFixed(1);

               return (
                 <li
                   key={e.id}
                   className="border rounded-lg p-4 transition cursor-pointer"
                   style={{ background: bg, borderColor: bd }}
                   onMouseEnter={(ev) => {
                     (ev.currentTarget as HTMLLIElement).style.background = hover;
                   }}
                   onMouseLeave={(ev) => {
                     (ev.currentTarget as HTMLLIElement).style.background = bg;
                   }}
                   role="button"
                   tabIndex={0}
                   onClick={() => router.push(`/films/${e.filmId}`)}
                   onKeyDown={(ev) => {
                     if (ev.key === "Enter" || ev.key === " ") router.push(`/films/${e.filmId}`);
                   }}
                 >
                   {/* 상단: 제목/감독 + 평점 원형 배지 */}
                   <div className="flex items-start justify-between gap-3">
                     <div className="min-w-0 flex-1">
                       <div className="font-semibold text-[1.0rem] leading-snug text-white truncate">
                         {fullTitle}
                       </div>

                       {directors && (
                         <div className="text-[0.875rem] text-white/90 mt-1 truncate">
                           {directors}
                         </div>
                       )}
                     </div>

                     {/* 평점 배지: MyRatingsClient와 동일 */}
                     <div
                       className="shrink-0 w-12 h-12 rounded-[20px] grid place-items-center text-[1.05rem] font-semibold select-none"
                       style={{
                         background: "var(--badge-rated-bg)",
                         color: "var(--badge-rated-fg)",
                       }}
                       aria-label={`Rating ${badgeText}`}
                     >
                       {badgeText}
                     </div>
                   </div>

                   {/* 한줄평 */}
                   {e.shortReview && (
                     <div className="mt-3 pt-3 border-t border-white/20">
                       <p className="text-[14px] text-white/95 leading-relaxed break-words whitespace-pre-wrap">
                         {e.shortReview}
                       </p>
                     </div>
                   )}

                   {/* 하단 날짜: Updated : 추가 */}
                   <div className="mt-3 flex justify-end">
                     <p className="text-[11px] text-white/60">Updated : {ymd}</p>
                   </div>
                 </li>
               );
             })}

          </ul>
        )}

        {/* Friends Tab */}
        {activeTab === "friends" && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2 pt-2 pb-1">
              <h3 className="text-sm font-bold text-gray-900 capitalize">{listType}</h3>

              {/* 탭 전환 버튼 (서브 네비게이션) */}
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => switchTabAndLoad("followers")}
                  className={`text-xs px-2 py-1 rounded-md transition-colors ${
                    listType === "followers"
                      ? "bg-gray-100 text-gray-900 font-bold"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Followers
                </button>
                <button
                  onClick={() => switchTabAndLoad("following")}
                  className={`text-xs px-2 py-1 rounded-md transition-colors ${
                    listType === "following"
                      ? "bg-gray-100 text-gray-900 font-bold"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Following
                </button>
              </div>
            </div>

            {loadingList && <div className="py-10 text-center text-gray-400">Loading...</div>}

            {!loadingList && userList?.length === 0 && (
              <div className="py-10 text-center text-gray-400 text-sm">List is empty.</div>
            )}

            {!loadingList &&
              userList?.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div
                    className="min-w-0 flex-1 pr-3 cursor-pointer group"
                    onClick={() => {
                      if (u.isMe) router.push("/my");
                      else router.push(`/users/${u.id}`);
                    }}
                  >
                    <p className="font-bold text-gray-900 truncate group-hover:underline">{u.nickname}</p>
                  </div>

                  {!u.isMe && (
                    <button
                      onClick={() => handleListFollow(u.id, u.isFollowing)}
                      className={`
                        shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all
                        ${
                          u.isFollowing
                            ? "bg-white text-gray-900 border-gray-300 hover:text-red-600 hover:border-red-200"
                            : "bg-gray-900 text-white border-transparent hover:bg-gray-800"
                        }
                      `}
                    >
                      {u.isFollowing ? "Following" : "Follow"}
                    </button>
                  )}
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
