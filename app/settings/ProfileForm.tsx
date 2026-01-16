"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateProfile, checkNickname } from "@/app/my/actions";

interface Props {
  initial: {
    nickname: string;
    bio: string;
    letterboxdId: string;
  };
}

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
  const [letterboxdId, setLetterboxdId] = useState(initial.letterboxdId);
  const [loading, setLoading] = useState(false);

  // 닉네임 검사 상태
  const [checking, setChecking] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<{
    available: boolean;
    message: string;
  } | null>(null);

  // 디바운싱: 사용자가 입력을 멈춘 후 500ms 뒤에 검사
  useEffect(() => {
    // 1. 초기값이거나 빈 값이면 검사 안 함 (상태 초기화 필수!)
    if (!nickname.trim() || nickname === initial.nickname) {
      setNicknameStatus(null);
      setChecking(false); // [수정] 여기서도 로딩을 확실하게 꺼줘야 함!
      return;
    }

    // 2. 검사 시작 (로딩 켜기)
    setChecking(true);
    setNicknameStatus(null);

    const timer = setTimeout(async () => {
      try {
        const result = await checkNickname(nickname);
        setNicknameStatus(result);
      } catch (error) {
        setNicknameStatus({ available: false, message: "Check failed" });
      } finally {
        setChecking(false); // 검사 끝나면 끄기
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [nickname, initial.nickname]);

  const handleSubmit = async () => {
    // 닉네임이 변경되었는데 중복/유효하지 않으면 저장 불가
    if (nickname !== initial.nickname && nicknameStatus?.available === false) {
      alert("Please check your username.");
      return;
    }

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
        <div className="relative">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-colors ${
              nicknameStatus?.available === false 
                ? "border-red-500 focus:border-red-500" 
                : nicknameStatus?.available === true 
                  ? "border-green-500 focus:border-green-500" 
                  : "border-gray-300 focus:border-black"
            }`}
            placeholder="Your Username"
          />
          {/* 로딩 인디케이터 */}
          {checking && (
            <div className="absolute right-3 top-3">
              <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin"></div>
            </div>
          )}
        </div>
        
        {/* 상태 메시지 */}
        <div className="h-4 text-[11px] px-1 font-medium">
          {checking ? (
            <span className="text-gray-400">Checking...</span>
          ) : nicknameStatus ? (
            <span className={nicknameStatus.available ? "text-green-600" : "text-red-500"}>
              {nicknameStatus.message}
            </span>
          ) : (
            // 기존 닉네임과 같거나 빈 값일 때 안내
            nickname === initial.nickname && <span className="text-gray-400">Current username</span>
          )}
        </div>
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
      <div className="space-y-4 pt-4 border-t border-gray-100">
        <SocialInput 
          label="Letterboxd" 
          value={letterboxdId} 
          onChange={setLetterboxdId} 
          placeholder="username" 
        />
      </div>

      {/* Save Button */}
      <div className="pt-6 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={loading || (nickname !== initial.nickname && nicknameStatus?.available === false)}
          className="px-6 py-2.5 bg-black text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}