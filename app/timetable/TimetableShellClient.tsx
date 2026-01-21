"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { TimetableRow } from "./page";
import AiPlannerPanel from "@/components/ai/AiPlannerPanel"; 

// TimetableClient를 클라이언트 전용(dynamic, ssr:false)으로 로드
const InnerTimetableClient = dynamic(
  () => import("./TimetableClient"),
  {
    ssr: false,
    loading: () => (
      <div className="mt-4 text-sm text-gray-500">
        Loading timetable...
      </div>
    ),
  },
);

type Props = {
  rows: TimetableRow[];
  editionLabel: string;
  dateIso: string;
  userNickname: string;
};

export default function TimetableShellClient(props: Props) {
  // AI 패널 열림 상태 (기본값: 닫힘)
  const [isAiOpen, setIsAiOpen] = useState(false);

  return (
    <>
      <InnerTimetableClient 
        {...props} 
        // [신규] 자식 컴포넌트에서 AI 패널을 열 수 있도록 함수 전달
        onOpenAi={() => setIsAiOpen(true)}
      />

      {/* [Unified] Floating Button (FAB) - Desktop/Mobile 모두 표시 */}
      <button
        onClick={() => setIsAiOpen((prev) => !prev)}
        className={`fixed bottom-6 right-6 z-[5000] flex items-center justify-center w-14 h-14 bg-black text-white rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer ${
          isAiOpen ? "translate-y-[200%]" : "translate-y-0"
        }`}
        aria-label="Open AI Planner"
      >
        <span className="text-2xl">✨</span>
      </button>

      {/* [Unified] AI Planner Panel (Bottom Sheet) */}
      <AiPlannerPanel 
        isOpen={isAiOpen} 
        onToggle={() => setIsAiOpen((prev) => !prev)}
        userNickname={props.userNickname}
      />
    </>
  );
}