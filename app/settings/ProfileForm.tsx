// app/settings/ProfileForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/app/my/actions";

interface Props {
  initial: {
    nickname: string;
    bio: string;
    letterboxdId: string;
  };
}

// [핵심 수정] 컴포넌트 밖으로 이동하여 포커스 끊김 방지
const SocialInput = ({ label, value, onChange, placeholder }: any) => (
  <div className="flex items-center gap-3">
    <div className="w-24 shrink-0 text-sm font-bold text-gray-700">{label}</div>
    <div className="relative flex-1">
      <span className="absolute left-3 top-2.5 text-gray-400 font-medium">@</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-black transition-colors placeholder:text-gray-300"
        placeholder={placeholder}
      />
    </div>
  </div>
);

export default function ProfileForm({ initial }: Props) {
  const router = useRouter();
  const [nickname, setNickname] = useState(initial.nickname);
  const [bio, setBio] = useState(initial.bio);
  // [수정] Letterboxd만 남기고 나머지 State 제거
  const [letterboxdId, setLetterboxdId] = useState(initial.letterboxdId);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("nickname", nickname);
      formData.append("bio", bio);
      formData.append("letterboxdId", letterboxdId);

      const res = await updateProfile(formData);
      if (!res.success) {
        alert(res.message);
      } else {
        alert("Profile updated!");
        router.refresh();
      }
    } catch (e) {
      alert("Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Nickname */}
      <div className="space-y-1.5">
        <label className="block text-sm font-bold text-gray-900">Username</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-black transition-colors"
          placeholder="Your Username"
        />
      </div>

      {/* 2. Bio */}
      <div className="space-y-1.5">
        <label className="block text-sm font-bold text-gray-900">About</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={160}
          rows={2}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-black transition-colors resize-none"
          placeholder="Introduce yourself..."
        />
        <div className="text-right text-[10px] text-gray-400">
          {bio.length}/160
        </div>
      </div>

      {/* 3. Social Links (Letterboxd Only) */}        
      {/* Only Letterboxd */}
      <SocialInput 
        label="Letterboxd" 
        value={letterboxdId} 
        onChange={setLetterboxdId} 
        placeholder="username" 
      />

      {/* Save Button */}
      <div className="pt-6 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-6 py-2.5 bg-black text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-all shadow-sm"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}