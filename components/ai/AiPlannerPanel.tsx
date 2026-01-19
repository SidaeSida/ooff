"use client";

import { useState, useEffect } from "react";

type Props = {
  isOpen: boolean;
  onToggle: () => void;
  userNickname: string;
};

// 진행 단계 (Stage)
type Stage = "SETUP" | "CHAT";

// 바텀시트 스냅 포인트
type SnapPoint = "CLOSED" | "HALF" | "FULL";

const FESTIVALS = [
  { id: "edition_jiff_2025", label: "JIFF 2025" },
  { id: "edition_biff_2025", label: "BIFF 2025" },
];

const AVAILABLE_DATES = [
  { iso: "2025-05-01", label: "5.01", dow: "목" },
  { iso: "2025-05-02", label: "5.02", dow: "금" },
  { iso: "2025-05-03", label: "5.03", dow: "토" },
  { iso: "2025-05-04", label: "5.04", dow: "일" },
  { iso: "2025-05-05", label: "5.05", dow: "월" },
  { iso: "2025-05-06", label: "5.06", dow: "화" },
  { iso: "2025-05-07", label: "5.07", dow: "수" },
];

export default function AiPlannerPanel({ isOpen, onToggle, userNickname }: Props) {
  // 상태
  const [stage, setStage] = useState<Stage>("SETUP");
  const [selectedFestival, setSelectedFestival] = useState<string>("edition_jiff_2025");
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  
  // 스냅 상태 (isOpen이 true면 기본 HALF)
  const [snap, setSnap] = useState<SnapPoint>("CLOSED");

  // isOpen 변경 시 스냅 동기화
  useEffect(() => {
    if (isOpen) {
      if (snap === "CLOSED") setSnap("HALF");
    } else {
      setSnap("CLOSED");
    }
  }, [isOpen]);

  const toggleDate = (iso: string) => {
    const next = new Set(selectedDates);
    if (next.has(iso)) next.delete(iso);
    else next.add(iso);
    setSelectedDates(next);
  };

  const handleStartChat = () => {
    if (selectedDates.size === 0) {
      alert("최소 하루 이상 선택해주세요!");
      return;
    }
    setStage("CHAT");
    // 채팅 시작 시 뒤의 시간표를 참고할 수 있게 HALF 유지
    setSnap("HALF");
  };

  // 스냅 높이 계산
  const getHeight = () => {
    switch (snap) {
      case "FULL": return "h-[95vh]";
      case "HALF": return "h-[50vh]";
      case "CLOSED": return "h-0"; 
      default: return "h-0";
    }
  };

  return (
    <>
      {/* 배경 오버레이 (열렸을 때만, 클릭 시 닫힘) */}
      {snap !== "CLOSED" && (
        <div 
          className="fixed inset-0 bg-black/20 z-[9998] transition-opacity"
          onClick={() => {
            setSnap("CLOSED");
            onToggle();
          }}
        />
      )}

      {/* [Unified Bottom Sheet] 
        - 데스크톱/모바일 모두 하단에서 올라옴
        - max-w-md mx-auto: 데스크톱에서 너무 넓어지지 않게 중앙 정렬
      */}
      <div 
        className={`fixed inset-x-0 bottom-0 z-[9999] bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-all duration-300 ease-out flex flex-col max-w-md mx-auto ${getHeight()}`}
      >
        {/* Handle Bar (Drag/Toggle Area) */}
        <div 
          className="shrink-0 flex items-center justify-center h-8 cursor-grab active:cursor-grabbing border-b border-gray-50"
          onClick={() => {
            // 토글 로직: CLOSED -> HALF -> FULL -> HALF ...
            if (snap === "CLOSED") {
                onToggle();
                setSnap("HALF");
            } else if (snap === "HALF") setSnap("FULL");
            else setSnap("HALF");
          }}
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Content */}
        {snap !== "CLOSED" && (
          <div className="flex-1 overflow-y-auto">
             <PanelContent 
              stage={stage}
              userNickname={userNickname}
              selectedFestival={selectedFestival}
              setSelectedFestival={setSelectedFestival}
              selectedDates={selectedDates}
              toggleDate={toggleDate}
              onStart={handleStartChat}
            />
          </div>
        )}
      </div>
    </>
  );
}

// ----------------------------------------------------------------
// 내부 컨텐츠 컴포넌트
// ----------------------------------------------------------------
function PanelContent({
  stage,
  userNickname,
  selectedFestival,
  setSelectedFestival,
  selectedDates,
  toggleDate,
  onStart,
}: any) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">✨</span>
          <h2 className="font-bold text-sm text-gray-900">AI Planner</h2>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5">
        {stage === "SETUP" ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <p className="text-lg font-bold text-gray-900 mb-1">
                반가워요, {userNickname}님!
              </p>
              <p className="text-xs text-gray-500">
                여행 계획을 먼저 알려주세요.
              </p>
            </div>

            {/* Q1. 영화제 선택 */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-800">어떤 영화제인가요?</label>
              <div className="grid grid-cols-2 gap-2">
                {FESTIVALS.map((fest) => (
                  <button
                    key={fest.id}
                    onClick={() => setSelectedFestival(fest.id)}
                    className={`py-2.5 px-3 rounded-lg text-xs font-medium border transition-all ${
                      selectedFestival === fest.id
                        ? "bg-black text-white border-black"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {fest.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Q2. 날짜 선택 (다중) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-800">
                언제 방문하시나요? <span className="font-normal text-gray-400">(다중 선택)</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {AVAILABLE_DATES.map((date) => {
                  const isSelected = selectedDates.has(date.iso);
                  return (
                    <button
                      key={date.iso}
                      onClick={() => toggleDate(date.iso)}
                      className={`flex flex-col items-center justify-center py-2 rounded-lg border transition-all ${
                        isSelected
                          ? "bg-black text-white border-black shadow-md"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <span className="text-[10px] opacity-80">{date.dow}</span>
                      <span className="text-xs font-bold">{date.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Start Button */}
            <div className="pt-4">
              <button
                onClick={onStart}
                className="w-full py-3 rounded-xl bg-[#FF4500] text-white text-sm font-bold shadow-lg shadow-orange-100 hover:bg-[#E03E00] active:scale-[0.98] transition-all"
              >
                플래닝 시작하기 →
              </button>
            </div>
          </div>
        ) : (
          /* CHAT STAGE */
          <div className="h-full flex flex-col animate-in fade-in duration-300">
            <div className="flex-1 flex flex-col justify-end space-y-4 pb-4">
               <div className="flex gap-2">
                 <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-lg shrink-0">✨</div>
                 <div className="bg-gray-100 rounded-2xl rounded-tl-none px-4 py-2.5 text-sm text-gray-800">
                    {selectedDates.size}일간의 일정을 짜드릴게요.<br/>
                    좋아하는 장르나 꼭 보고 싶은 영화가 있나요?
                 </div>
               </div>
               
               <div className="flex gap-2 justify-end">
                 <div className="bg-black text-white rounded-2xl rounded-tr-none px-4 py-2.5 text-sm">
                    고레에다 히로카즈 감독 영화는 꼭 보고싶어.
                 </div>
               </div>
            </div>

            <div className="pt-2 sticky bottom-0 bg-white">
                <form className="relative" onSubmit={(e) => e.preventDefault()}>
                    <input 
                        type="text" 
                        placeholder="예: 애니메이션 추천해줘..."
                        className="w-full h-11 pl-4 pr-12 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-black transition-colors"
                    />
                    <button className="absolute right-1.5 top-1.5 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center hover:bg-gray-800">
                        ↑
                    </button>
                </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}