// app/my/MyPageClient.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import MyRatingsClient from "./MyRatingsClient";
import SignOutButton from "./SignOutButton";
import { updateNickname } from "./actions";

type Tab = "ratings" | "network" | "timetable";

interface Props {
  user: {
    email: string;
    nickname: string;
    followers: number;
    following: number;
    isDefaultNickname: boolean;
  };
}

export default function MyPageClient({ user }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("ratings");
  
  // 닉네임 수정 상태 관리
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editNickname, setEditNickname] = useState(user.nickname);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveNickname = async () => {
    if (!confirm(`Change nickname to "${editNickname}"?`)) return;
    
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("nickname", editNickname);
      await updateNickname(formData);
      setIsEditingProfile(false);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Zone 1: Identity Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-gray-100">
        
        {/* Left Side: Identity */}
        <div className="space-y-4 relative">
          {/* Nickname & Edit Icon */}
          <div className="flex items-center gap-2 group">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
              {user.nickname}
            </h1>
            <button
              onClick={() => {
                setEditNickname(user.nickname);
                setIsEditingProfile(true);
              }}
              className={`
                text-gray-400 hover:text-gray-600 p-1 transition-opacity
                ${user.isDefaultNickname ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
              `}
              title="Change Nickname"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>

          {/* Email & Sign Out */}
          <div className="flex flex-col gap-3">
             <p className="text-sm text-gray-500 font-medium">{user.email}</p>
             <div className="w-fit">
               <SignOutButton />
             </div>
          </div>
        </div>

        {/* Right Side: Settings & Stats */}
        <div className="flex flex-col gap-6 md:items-end">
          
           {/* Settings Icon */}
           {/* 수정된 부분: mt-2 추가하여 아래로 내림 */}
           <div className="flex justify-end w-full mt-2">
             <Link href="/settings" className="text-gray-400 hover:text-gray-900 transition-colors p-2 -mr-2">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
             </Link>
           </div>

           {/* Stats (기존 코드 유지) */}
           <div className="flex items-center gap-10 md:gap-12 pb-1">
             <div className="text-center cursor-pointer hover:opacity-70 transition-opacity">
               <span className="block text-2xl font-bold text-gray-900">{user.followers}</span>
               <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Followers</span>
             </div>
             <div className="text-center cursor-pointer hover:opacity-70 transition-opacity">
               <span className="block text-2xl font-bold text-gray-900">{user.following}</span>
               <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Following</span>
             </div>
           </div>
        </div>

      </header>

      {/* Zone 2: Tabs (3등분) */}
      <nav className="flex w-full border-b border-gray-200">
        {(["ratings", "network", "timetable"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              flex-1 py-3 text-sm font-medium border-b-2 transition-all
              ${activeTab === tab 
                ? "border-gray-900 text-gray-900" 
                : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200"}
            `}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      {/* Zone 3: Content */}
      <section className="min-h-[300px]">
        {activeTab === "ratings" && (
           <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
             <MyRatingsClient />
           </div>
        )}
        
        {activeTab === "network" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="relative">
              <input 
                type="text" 
                placeholder="Find a friend by nickname..." 
                className="w-full h-10 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400 transition-colors"
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="text-center py-10 text-gray-400 text-sm">No friends added yet.</div>
          </div>
        )}

        {activeTab === "timetable" && (
           <div className="text-center py-20 text-gray-400 animate-in fade-in slide-in-from-bottom-2 duration-300">
             Timetable functionality coming soon...
           </div>
        )}
      </section>

      {/* Nickname Edit Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-gray-900">Change Nickname</h3>
                <p className="text-sm text-gray-500">Enter a new nickname for your profile.</p>
              </div>
              
              <input 
                type="text" 
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
                className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-base"
                placeholder="New nickname"
                autoFocus
              />

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setIsEditingProfile(false)}
                  className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveNickname}
                  disabled={isSaving || !editNickname.trim()}
                  className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? "Saving..." : "Confirm"}
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}