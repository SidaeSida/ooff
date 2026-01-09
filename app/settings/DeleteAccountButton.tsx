// app/settings/DeleteAccountButton.tsx
"use client";

import { useState } from "react";
import { deleteAccount } from "@/app/my/actions";
import { signOut } from "next-auth/react"; // 클라이언트용 signOut 사용

export default function DeleteAccountButton() {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete your account? This action cannot be undone.")) return;
    if (!confirm("All your data (ratings, reviews, timetable) will be permanently deleted. Proceed?")) return;

    setLoading(true);
    try {
      // 1. 서버에 삭제 요청
      await deleteAccount();

      // 2. 삭제 성공 시 여기서 로그아웃 & 홈으로 이동
      // (서버 액션에서 리다이렉트 에러가 안 날아오므로 안전함)
      await signOut({ callbackUrl: "/" });
      
    } catch (error) {
      console.error(error);
      alert("Failed to delete account. Please try again.");
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="px-4 py-2 bg-white border border-red-200 text-red-600 text-xs font-bold rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Deleting..." : "Delete"}
    </button>
  );
}