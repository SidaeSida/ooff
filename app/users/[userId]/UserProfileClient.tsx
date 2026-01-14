// app/users/[userId]/UserProfileClient.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import filmsData from "@/data/films.json";
import { toggleFollow, toggleBlock } from "@/app/my/actions";
import { getFollowList } from "../actions";

type Tab = "ratings" | "friends";
type UserData = {
  id: string;
  nickname: string | null;
  _count: { followedBy: number; following: number };
  isFollowing: boolean;
  bio?: string | null;
  instagramId?: string | null;
  twitterId?: string | null;
  letterboxdId?: string | null;
  threadsId?: string | null;
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
  isBlocking: initialBlocking,
}: {
  user: UserData;
  initialRatings: any[];
  myId: string;
  isBlocking: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("ratings");

  const [isFollowing, setIsFollowing] = useState(user.isFollowing);
  const [followerCount, setFollowerCount] = useState(user._count.followedBy);
  const [isBlocking, setIsBlocking] = useState(initialBlocking);

  const [listType, setListType] = useState<"followers" | "following">("followers");
  const [userList, setUserList] = useState<ListUser[] | null>(null);
  const [loadingList, setLoadingList] = useState(false);

  const filmMap = useMemo(() => {
    const map = new Map<string, any>();
    (filmsData as any[]).forEach((f) => map.set(f.id, f));
    return map;
  }, []);

  const handleFollowToggle = async () => {
    if (isBlocking) {
      alert("Please unblock this user first.");
      return;
    }
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

  const handleBlockToggle = async () => {
    const actionName = isBlocking ? "Unblock" : "Block";
    if (!confirm(`Are you sure you want to ${actionName} this user?`)) return;

    const nextState = !isBlocking;
    setIsBlocking(nextState);

    if (nextState && isFollowing) {
      setIsFollowing(false);
      setFollowerCount((prev) => Math.max(0, prev - 1));
    }

    try {
      await toggleBlock(user.id);
      router.refresh();
    } catch (e) {
      setIsBlocking(!nextState);
      alert("Failed to update block status");
    }
  };

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

  const statsChipBase = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors";
  const statsChipActive = "bg-gray-900 text-white border-gray-900";
  const statsChipIdle = "bg-white text-gray-600 border-gray-200 hover:bg-gray-50";

  const bg = "var(--bg-rated)";
  const bd = "var(--bd-rated)";
  const hover = "var(--bg-hover-r)";

  if (isBlocking) {
    return (
      <div className="py-20 text-center space-y-4">
        <h1 className="text-2xl font-bold text-gray-400">Blocked User</h1>
        <p className="text-gray-500">You have blocked this user.</p>
        <button
          onClick={handleBlockToggle}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold"
        >
          Unblock
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* 1. Header Area */}
      <header className="pb-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-gray-900 break-words">
              {user.nickname}
            </h1>

            {/* Bio & Social Links */}
            <div className="mt-3 pr-4">
              {user.bio && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed break-words mb-3">
                  {user.bio}
                </p>
              )}
              
              {/* Social Icons Row */}
              {(user.letterboxdId || user.twitterId || user.threadsId || user.instagramId) && (
                <div className="flex items-center gap-3">
                  {/* 1. Letterboxd */}
                  {user.letterboxdId && (
                    <a 
                      href={`https://letterboxd.com/${user.letterboxdId}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-gray-400 hover:text-[#00E054] transition-colors"
                      title={`Letterboxd: @${user.letterboxdId}`}
                    >
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><circle cx="20" cy="4" r="1"/>
                      </svg>
                    </a>
                  )}

                  {/* 2. X (Twitter) */}
                  {user.twitterId && (
                    <a 
                      href={`https://x.com/${user.twitterId}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-gray-400 hover:text-black transition-colors"
                      title={`X: @${user.twitterId}`}
                    >
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4l11.733 16h4.267l-11.733 -16z"/><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"/>
                      </svg>
                    </a>
                  )}

                  {/* 3. Threads */}
                  {user.threadsId && (
                    <a 
                      href={`https://www.threads.net/@${user.threadsId}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-gray-400 hover:text-black transition-colors"
                      title={`Threads: @${user.threadsId}`}
                    >
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 12a4 4 0 1 0 4 4 4 4 0 0 0-4-4Z"/>
                        <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>
                      </svg>
                    </a>
                  )}

                  {/* 4. Instagram */}
                  {user.instagramId && (
                    <a 
                      href={`https://instagram.com/${user.instagramId}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-gray-400 hover:text-[#E1306C] transition-colors"
                      title={`Instagram: @${user.instagramId}`}
                    >
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                      </svg>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
             <button
              onClick={handleBlockToggle}
              className="h-10 px-3 rounded-xl border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
              title="Block this user"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
              </svg>
            </button>

            <button
              onClick={handleFollowToggle}
              className={`
                h-10 px-4 rounded-xl text-sm font-bold transition-all border
                ${isFollowing
                  ? "bg-white text-gray-900 border-gray-300 hover:text-red-600 hover:border-red-200"
                  : "bg-gray-900 text-white border-transparent hover:bg-gray-800"
                }
              `}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
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
               const titleKo = f?.title_ko;
               const titleEn = f?.title;
               const displayTitle = titleKo ? titleKo : (titleEn ?? e.filmId);
               const year = f?.year ? ` (${f.year})` : "";
               const fullTitle = `${displayTitle}${year}`;
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
                     <div
                       className="shrink-0 w-12 h-12 rounded-[20px] grid place-items-center text-[1.05rem] font-semibold select-none"
                       style={{
                         background: "var(--badge-rated-bg)",
                         color: "var(--badge-rated-fg)",
                       }}
                     >
                       {badgeText}
                     </div>
                   </div>
                   {e.shortReview && (
                     <div className="mt-3 pt-3 border-t border-white/20">
                       <p className="text-[14px] text-white/95 leading-relaxed break-words whitespace-pre-wrap">
                         {e.shortReview}
                       </p>
                     </div>
                   )}
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