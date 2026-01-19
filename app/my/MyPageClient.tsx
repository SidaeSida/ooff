"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation"; // [수정] useSearchParams 추가

import MyRatingsClient from "./MyRatingsClient";
import SignOutButton from "./SignOutButton";
import { searchUsers, toggleFollow, toggleBlock, getBlockedUsers, getTopUsers } from "./actions";
import { getFollowList } from "../users/actions";
import FeedTab from "./FeedTab";

type Tab = "ratings" | "friends" | "feed";

interface Props {
  initialTab?: Tab;
  user: {
    id: string;
    email: string;
    nickname: string;
    followers: number;
    following: number;
    isDefaultNickname: boolean;
    bio?: string | null;
    letterboxdId?: string | null;
  };
}

type ListUser = {
  id: string;
  nickname: string | null;
  isFollowing: boolean;
  ratingCount?: number;
};

function AutoFitSingleLineText({ text, className = "", maxPx = 36, minPx = 18, stepPx = 1 }: any) {
  const elRef = useRef<HTMLSpanElement | null>(null);
  const [fontPx, setFontPx] = useState<number>(maxPx);

  const fit = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    let size = maxPx;
    el.style.fontSize = `${size}px`;
    const clientW = el.clientWidth;
    if (!clientW) { setFontPx(size); return; }
    while (size > minPx && el.scrollWidth > clientW) {
      size -= stepPx;
      el.style.fontSize = `${size}px`;
    }
    setFontPx(size);
  }, [maxPx, minPx, stepPx]);

  useLayoutEffect(() => { fit(); }, [text, fit]);

  useEffect(() => {
    fit();
    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => fit()) : null;
    if (ro && elRef.current) ro.observe(elRef.current);
    return () => { window.removeEventListener("resize", onResize); ro?.disconnect(); };
  }, [fit]);

  return (
    <span
      ref={elRef}
      className={`block w-full whitespace-nowrap overflow-hidden text-ellipsis ${className}`}
      style={{ fontSize: fontPx }}
      title={text}
    >
      {text}
    </span>
  );
}

export default function MyPageClient({ user, initialTab }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams(); // [추가] 쿼리 파라미터 감지

  // 초기값은 props에서 받지만, 이후에는 URL과 동기화
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "ratings");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [userList, setUserList] = useState<ListUser[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"search" | "followers" | "following" | "blocked">("search");

  // [신규] 탭 변경 핸들러 (URL 업데이트 포함)
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    // URL 쿼리 파라미터 업데이트 (스크롤 유지, 히스토리 대체)
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    router.replace(`/my?${params.toString()}`, { scroll: false });
  };

  // [신규] URL이 외부 요인(뒤로가기 등)으로 바뀌었을 때 탭 상태 동기화
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl && (tabFromUrl === "ratings" || tabFromUrl === "friends" || tabFromUrl === "feed")) {
      setActiveTab(tabFromUrl as Tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!initialTab) return;
    setActiveTab(initialTab);
  }, [initialTab]);

  // Friends 탭 진입 시 검색어가 없으면 'Top Users' 자동 로드
  useEffect(() => {
    if (activeTab === 'friends' && viewMode === 'search' && !searchQuery) {
       loadTopUsers();
    }
  }, [activeTab, viewMode, searchQuery]);

  const loadTopUsers = async () => {
    setIsLoading(true);
    try {
      const top = await getTopUsers();
      setUserList(top);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    if (!searchQuery.trim()) {
      loadTopUsers();
      return;
    }
    setViewMode("search");
    setIsLoading(true);
    try {
      const results = await searchUsers(searchQuery);
      setUserList(results);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadList = async (type: "followers" | "following" | "blocked") => {
    setViewMode(type);
    setSearchQuery("");
    setIsLoading(true);
    setUserList(null);
    try {
      if (type === "blocked") {
        const list = await getBlockedUsers();
        setUserList(list);
      } else {
        const list = await getFollowList(user.id, type);
        setUserList(list);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const switchTabAndLoad = (type: "followers" | "following") => {
    handleTabChange("friends"); // [수정] 탭 변경 함수 사용
    loadList(type);
  };

  const handleToggle = async (targetId: string, currentStatus: boolean) => {
    setUserList((prev) => prev?.map((u) => (u.id === targetId ? { ...u, isFollowing: !currentStatus } : u)) ?? null);
    try {
      await toggleFollow(targetId);
      router.refresh();
    } catch (error) {
      setUserList((prev) => prev?.map((u) => (u.id === targetId ? { ...u, isFollowing: currentStatus } : u)) ?? null);
      alert("Failed to update follow status");
    }
  };

  const handleUnblock = async (targetId: string) => {
    if (!confirm("Unblock this user?")) return;
    setUserList((prev) => prev?.filter((u) => u.id !== targetId) ?? null);
    try {
      await toggleBlock(targetId);
      router.refresh();
    } catch (error) {
      alert("Failed to unblock");
      loadList("blocked");
    }
  };

  const statsChipBase = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors";
  const statsChipActive = "bg-gray-900 text-white border-gray-900";
  const statsChipIdle = "bg-white text-gray-600 border-gray-200 hover:bg-gray-50";

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="relative pb-6 border-b border-gray-100">
        <Link href="/settings" className="absolute right-0 top-0 text-gray-400 hover:text-gray-900 p-2" title="Settings">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>

        <div className="pt-2">
          {/* Nickname Row */}
          <div className="pr-12">
            <div className="flex items-center gap-2 group min-w-0">
              <div className="flex-1 min-w-0">
                <AutoFitSingleLineText text={user.nickname} className="font-extrabold tracking-tight text-gray-900 leading-tight" />
              </div>
              {user.isDefaultNickname && (
                <Link href="/settings" className="shrink-0 text-red-500 hover:text-red-700 p-1 animate-pulse" title="Change your nickname">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </Link>
              )}
            </div>
          </div>

          {/* Bio & Social Links */}
          <div className="mt-3">
            {user.bio && (
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed break-words mb-3 pr-2">
                {user.bio}
              </p>
            )}

            {user.letterboxdId && (
              <div className="mt-4">
                <a
                  href={`https://letterboxd.com/${user.letterboxdId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                  title={`Letterboxd: @${user.letterboxdId}`}
                  aria-label={`Letterboxd: @${user.letterboxdId}`}
                >
                  <svg width="44" height="24" viewBox="0 0 44 24" aria-hidden="true" className="shrink-0">
                    <circle cx="14" cy="12" r="5" fill="#FF8000" />
                    <circle cx="23" cy="12" r="5" fill="#00E054" />
                    <circle cx="32" cy="12" r="5" fill="#40BCF4" />
                  </svg>
                  <span className="leading-none">Letterboxd · @{user.letterboxdId}</span>
                </a>
              </div>
            )}
          </div>

          {/* Stats & SignOut */}
          <div className="mt-5 flex items-center w-full gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => switchTabAndLoad("followers")}
                className={`${statsChipBase} ${activeTab === "friends" && viewMode === "followers" ? statsChipActive : statsChipIdle}`}
              >
                <span className="tabular-nums">{user.followers}</span>
                <span className="text-[11px] font-medium opacity-90">Followers</span>
              </button>
              <button
                onClick={() => switchTabAndLoad("following")}
                className={`${statsChipBase} ${activeTab === "friends" && viewMode === "following" ? statsChipActive : statsChipIdle}`}
              >
                <span className="tabular-nums">{user.following}</span>
                <span className="text-[11px] font-medium opacity-90">Following</span>
              </button>
            </div>
            <div className="ml-auto shrink-0">
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex w-full border-b border-gray-200">
        {(["ratings", "friends", "feed"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)} // [수정] 탭 변경 핸들러 교체
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === tab
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      {/* Content */}
      <section className="min-h-[300px]">
        {activeTab === "ratings" && (
          <div className="animate-in fade-in duration-300">
            <MyRatingsClient />
          </div>
        )}

        {activeTab === "feed" && (
          <div className="animate-in fade-in duration-300">
            <FeedTab />
          </div>
        )}

        {activeTab === "friends" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Find a friend by nickname"
                className="w-full h-11 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                onFocus={() => {
                  if (viewMode !== "search") {
                    setViewMode("search");
                    if(!searchQuery) loadTopUsers();
                  }
                }}
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* List Area */}
            <div className="space-y-3 min-h-[100px]">
              {/* Sub Navigation */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1 border-b border-gray-100 pb-2">
                <h3 className="text-sm font-bold text-gray-900 capitalize min-w-[60px]">{viewMode === 'search' ? 'Discovery' : viewMode}</h3>
                <div className="flex gap-1">
                  <button onClick={() => { setViewMode("search"); setSearchQuery(""); loadTopUsers(); }} className={`px-2 py-0.5 text-[11px] rounded border ${viewMode === "search" ? "bg-black text-white border-black" : "bg-white text-gray-500 border-gray-200"}`}>Search</button>
                  <button onClick={() => loadList("followers")} className={`px-2 py-0.5 text-[11px] rounded border ${viewMode === "followers" ? "bg-black text-white border-black" : "bg-white text-gray-500 border-gray-200"}`}>Followers</button>
                  <button onClick={() => loadList("following")} className={`px-2 py-0.5 text-[11px] rounded border ${viewMode === "following" ? "bg-black text-white border-black" : "bg-white text-gray-500 border-gray-200"}`}>Following</button>
                  <button onClick={() => loadList("blocked")} className={`px-2 py-0.5 text-[11px] rounded border ${viewMode === "blocked" ? "bg-red-50 text-red-600 border-red-200 font-medium" : "bg-white text-gray-400 border-gray-200"}`}>Blocked</button>
                </div>
              </div>

              {isLoading && <p className="text-center text-sm text-gray-400 py-4">Loading...</p>}
              {!isLoading && userList && userList.length === 0 && <p className="text-center text-sm text-gray-400 py-4">{viewMode === "search" ? "No users found." : viewMode === "blocked" ? "No blocked users." : "List is empty."}</p>}
              {!isLoading && userList?.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="min-w-0 flex-1 pr-3 cursor-pointer group" onClick={() => { if(!u.isFollowing) router.push(`/users/${u.id}`); }}>
                        <div className="flex items-center gap-2">
                            <Link href={`/users/${u.id}`} className="font-bold text-gray-900 truncate hover:underline">{u.nickname}</Link>
                            {u.ratingCount !== undefined && u.ratingCount > 0 && <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">★ {u.ratingCount}</span>}
                        </div>
                    </div>
                    {viewMode === "blocked" ? (
                      <button onClick={() => handleUnblock(u.id)} className="shrink-0 px-4 py-1.5 rounded-lg text-xs font-bold transition-all border bg-white text-red-600 border-red-200 hover:bg-red-50">Unblock</button>
                    ) : (
                      <button onClick={() => handleToggle(u.id, u.isFollowing)} className={`shrink-0 px-4 py-1.5 rounded-lg text-xs font-bold transition-all border ${u.isFollowing ? "bg-white text-gray-900 border-gray-300 hover:text-red-600" : "bg-gray-900 text-white border-transparent hover:bg-gray-800"}`}>{u.isFollowing ? "Following" : "Follow"}</button>
                    )}
                  </div>
                ))}
              {!isLoading && !userList && viewMode === "search" && <div className="text-center py-10 text-gray-400 text-sm">Search friends or click stats to view lists.</div>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}