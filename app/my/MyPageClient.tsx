"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import MyRatingsClient from "./MyRatingsClient";
import SignOutButton from "./SignOutButton";
import { updateNickname, searchUsers, toggleFollow } from "./actions";
import { getFollowList } from "../users/actions"; // 팔로워 목록 가져오기 위해 사용

type Tab = "ratings" | "friends" | "timetable";

interface Props {
  user: {
    id: string; // [추가] 내 ID
    email: string;
    nickname: string;
    followers: number;
    following: number;
    isDefaultNickname: boolean;
  };
}

type ListUser = {
  id: string;
  nickname: string | null;
  isFollowing: boolean;
};

// ... (AutoFitSingleLineText 함수는 그대로 유지) ...
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
    while (size > minPx && el.scrollWidth > clientW) { size -= stepPx; el.style.fontSize = `${size}px`; }
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
  return <span ref={elRef} className={`block w-full whitespace-nowrap overflow-hidden text-ellipsis ${className}`} style={{ fontSize: fontPx }} title={text}>{text}</span>;
}

export default function MyPageClient({ user }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("ratings");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editNickname, setEditNickname] = useState(user.nickname);
  const [isSaving, setIsSaving] = useState(false);

  // --- Friends 탭 관련 상태 ---
  const [searchQuery, setSearchQuery] = useState("");
  const [userList, setUserList] = useState<ListUser[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"search" | "followers" | "following">("search");

  // 닉네임 변경
  const handleSaveNickname = async () => {
    if (!confirm(`Change nickname to "${editNickname}"?`)) return;
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("nickname", editNickname);
      await updateNickname(formData);
      router.refresh();
      setIsEditingProfile(false);
    } catch (e: any) { alert(e.message); } finally { setIsSaving(false); }
  };

  // 1. 검색 핸들러
  const handleSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    if (!searchQuery.trim()) {
      setUserList(null);
      return;
    }
    setViewMode("search"); // 검색 모드로 전환
    setIsLoading(true);
    try {
      const results = await searchUsers(searchQuery);
      setUserList(results);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

    // 2. 팔로워/팔로잉 리스트 불러오기 (숫자 클릭 시)
  const loadList = async (type: "followers" | "following") => {
    setViewMode(type);
    setSearchQuery(""); // 검색어 초기화
    setIsLoading(true);
    setUserList(null);
    try {
      const list = await getFollowList(user.id, type);
      setUserList(list);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  // 헤더의 Followers/Following 클릭: Friends 탭으로 이동 + 리스트 로드
  const switchTabAndLoad = (type: "followers" | "following") => {
    setActiveTab("friends");
    loadList(type);
  };

  // 3. 팔로우 토글
  const handleToggle = async (targetId: string, currentStatus: boolean) => {
    setUserList((prev) => prev?.map(u => u.id === targetId ? { ...u, isFollowing: !currentStatus } : u) ?? null);
    try {
      await toggleFollow(targetId);
      router.refresh();
    } catch (error) {
      setUserList((prev) => prev?.map(u => u.id === targetId ? { ...u, isFollowing: currentStatus } : u) ?? null);
      alert("Failed to update follow status");
    }
  };

  // UserProfileClient와 동일한 톤의 작은 칩
  const statsChipBase =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors";
  const statsChipActive = "bg-gray-900 text-white border-gray-900";
  const statsChipIdle = "bg-white text-gray-600 border-gray-200 hover:bg-gray-50";

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="relative pb-6 border-b border-gray-100">
        <Link href="/settings" className="absolute right-0 top-0 text-gray-400 hover:text-gray-900 p-2">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
        <div>
          <div className="pr-12">
            <div className="flex items-start gap-2 group min-w-0">
              <div className="flex-1 min-w-0">
                <AutoFitSingleLineText text={user.nickname} className="font-extrabold tracking-tight text-gray-900 leading-tight" />
              </div>
              <button onClick={() => { setEditNickname(user.nickname); setIsEditingProfile(true); }} className={`shrink-0 mt-1.5 text-gray-400 hover:text-gray-600 p-1 ${user.isDefaultNickname ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </button>
            </div>
          </div>
          {/* 헤더 2줄째: 왼쪽 Followers/Following 칩 + 오른쪽 Sign out */}
          <div className="mt-3 flex items-center w-full gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => switchTabAndLoad("followers")}
                className={`
                  ${statsChipBase}
                  ${activeTab === "friends" && viewMode === "followers" ? statsChipActive : statsChipIdle}
                `}
              >
                <span className="tabular-nums">{user.followers}</span>
                <span className="text-[11px] font-medium opacity-90">Followers</span>
              </button>

              <button
                onClick={() => switchTabAndLoad("following")}
                className={`
                  ${statsChipBase}
                  ${activeTab === "friends" && viewMode === "following" ? statsChipActive : statsChipIdle}
                `}
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
        {(["ratings", "friends", "timetable"] as Tab[]).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 text-sm font-medium border-b-2 transition-all ${activeTab === tab ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200"}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      {/* Content */}
      <section className="min-h-[300px]">
        {activeTab === "ratings" && <div className="animate-in fade-in duration-300"><MyRatingsClient /></div>}

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
                onFocus={() => { if(viewMode !== 'search') { setViewMode('search'); setUserList(null); } }}
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* List Area (Inline) */}
            <div className="space-y-3 min-h-[100px]">
              {/* Title Header (for Follow lists) */}
              {viewMode !== 'search' && (
                 <h3 className="text-sm font-bold text-gray-900 px-1 capitalize">{viewMode}</h3>
              )}

              {isLoading && <p className="text-center text-sm text-gray-400 py-4">Loading...</p>}
              
              {!isLoading && userList && userList.length === 0 && (
                 <p className="text-center text-sm text-gray-400 py-4">
                   {viewMode === 'search' ? "No user found." : "List is empty."}
                 </p>
              )}

              {!isLoading && userList?.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                  <Link href={`/users/${u.id}`} className="min-w-0 flex-1 pr-4 cursor-pointer hover:opacity-70 transition-opacity">
                     <p className="font-bold text-gray-900 truncate">{u.nickname}</p>
                     {/* 이메일 제거됨 */}
                  </Link>
                  <button
                    onClick={() => handleToggle(u.id, u.isFollowing)}
                    className={`shrink-0 px-4 py-1.5 rounded-lg text-xs font-bold transition-all border
                      ${u.isFollowing ? "bg-white text-gray-900 border-gray-300 hover:text-red-600" : "bg-gray-900 text-white border-transparent hover:bg-gray-800"}
                    `}
                  >
                    {u.isFollowing ? "Following" : "Follow"}
                  </button>
                </div>
              ))}

              {!isLoading && !userList && viewMode === 'search' && (
                <div className="text-center py-10 text-gray-400 text-sm">
                  Search friends or click stats to view lists.
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === "timetable" && <div className="text-center py-20 text-gray-400">Timetable coming soon...</div>}
      </section>

      {/* Edit Modal (생략 - 기존 유지) */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           {/* ... 기존 모달 코드 그대로 사용 ... */}
           <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900">Change Nickname</h3>
              <p className="text-sm text-gray-500">Enter a new nickname.</p>
            </div>
            <input type="text" value={editNickname} onChange={(e) => setEditNickname(e.target.value)} className="w-full h-11 px-3 border rounded-lg" autoFocus />
            <div className="flex gap-3 pt-2">
              <button onClick={() => setIsEditingProfile(false)} className="flex-1 px-4 py-2.5 bg-white border rounded-xl">Cancel</button>
              <button onClick={handleSaveNickname} className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-xl">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}