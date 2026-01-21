"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import AiRecommendationCard from "./AiRecommendationCard";

type Props = {
  isOpen: boolean;
  onToggle: () => void;
  userNickname: string;
};

type Stage = "SETUP" | "CHAT";
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
  const [stage, setStage] = useState<Stage>("SETUP");
  const [selectedFestival, setSelectedFestival] = useState<string>("edition_jiff_2025");
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [snap, setSnap] = useState<SnapPoint>("CLOSED");

  // v6: transport 기반
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const [input, setInput] = useState("");

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (isOpen) {
      if (snap === "CLOSED") setSnap("HALF");
    } else {
      setSnap("CLOSED");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setSnap("HALF");
  };

  // 스크롤 자동 이동
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getHeight = () => {
    switch (snap) {
      case "FULL":
        return "h-[95vh]";
      case "HALF":
        return "h-[50vh]";
      case "CLOSED":
        return "h-0";
      default:
        return "h-0";
    }
  };

  return (
    <>
      {snap !== "CLOSED" && (
        <div
          className="fixed inset-0 bg-black/20 z-[9998] transition-opacity"
          onClick={() => {
            setSnap("CLOSED");
            onToggle();
          }}
        />
      )}

      <div
        className={`fixed inset-x-0 bottom-0 z-[9999] bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-all duration-300 ease-out flex flex-col max-w-md mx-auto ${getHeight()}`}
      >
        {/* 핸들바 */}
        <div
          className="shrink-0 flex items-center justify-center h-8 cursor-grab active:cursor-grabbing border-b border-gray-50"
          onClick={() => {
            if (snap === "CLOSED") {
              onToggle();
              setSnap("HALF");
            } else if (snap === "HALF") setSnap("FULL");
            else setSnap("HALF");
          }}
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* 컨텐츠 영역 */}
        {snap !== "CLOSED" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-lg">✨</span>
                <h2 className="font-bold text-sm text-gray-900">AI Planner</h2>
              </div>
              {stage === "CHAT" && (
                <button onClick={() => setStage("SETUP")} className="text-xs text-gray-400 underline">
                  다시 설정
                </button>
              )}
            </div>

            {/* SETUP */}
            {stage === "SETUP" && (
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                <div>
                  <p className="text-lg font-bold text-gray-900 mb-1">반가워요, {userNickname}님!</p>
                  <p className="text-xs text-gray-500">여행 계획을 먼저 알려주세요.</p>
                </div>

                {/* 영화제 선택 */}
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

                {/* 날짜 선택 */}
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

                <div className="pt-4">
                  <button
                    onClick={handleStartChat}
                    className="w-full py-3 rounded-xl bg-[#FF4500] text-white text-sm font-bold shadow-lg shadow-orange-100 hover:bg-[#E03E00] active:scale-[0.98] transition-all"
                  >
                    플래닝 시작하기 →
                  </button>
                </div>
              </div>
            )}

            {/* CHAT */}
            {stage === "CHAT" && (
              <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
                {/* 메시지 리스트 */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* 초기 안내 */}
                  {messages.length === 0 && (
                    <div className="flex gap-2 animate-in fade-in slide-in-from-bottom-2">
                      <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-lg shrink-0 text-white">
                        ✨
                      </div>
                      <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-gray-800 shadow-sm max-w-[85%]">
                        {selectedDates.size}일간의 일정을 짜드릴게요.
                        <br />
                        좋아하는 장르나 꼭 보고 싶은 영화가 있나요?
                      </div>
                    </div>
                  )}

                  {/* 대화 매핑 (v6: content/toolInvocations 대신 parts) */}
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {m.role === "assistant" && (
                        <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-lg shrink-0 text-white mt-1">
                          ✨
                        </div>
                      )}

                      <div className="max-w-[85%] space-y-2">
                        {m.parts.map((part, idx) => {
                          // 1) 텍스트 파트
                          if (part.type === "text") {
                            return (
                              <div
                                key={idx}
                                className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm whitespace-pre-wrap ${
                                  m.role === "user"
                                    ? "bg-black text-white rounded-tr-none"
                                    : "bg-white border border-gray-100 text-gray-800 rounded-tl-none"
                                }`}
                              >
                                {part.text}
                              </div>
                            );
                          }

                          // 2) 툴 출력 파트: tool-suggestScreenings
                          if (part.type === "tool-suggestScreenings") {
                            const p = part as any;
                            if (p.state !== "output-available") return null;

                            const recommendations = p.output?.recommendations ?? [];
                            if (!Array.isArray(recommendations) || recommendations.length === 0) return null;

                            return (
                              <div
                                key={idx}
                                className="mt-2 space-y-2 animate-in fade-in slide-in-from-bottom-2"
                              >
                                {recommendations.map((rec: any) => (
                                  <AiRecommendationCard
                                    key={rec.screeningId}
                                    screeningId={rec.screeningId}
                                    reason={rec.reason}
                                  />
                                ))}
                              </div>
                            );
                          }

                          return null;
                        })}
                      </div>
                    </div>
                  ))}

                  {/* 로딩 인디케이터 */}
                  {isLoading && messages[messages.length - 1]?.role === "user" && (
                    <div className="flex gap-2">
                      <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-lg shrink-0 text-white">
                        ✨
                      </div>
                      <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-gray-500 shadow-sm flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* 입력창 */}
                <div className="p-3 bg-white border-t border-gray-100 shrink-0">
                  <form
                    className="relative flex items-center"
                    onSubmit={(e) => {
                      e.preventDefault();

                      const text = input.trim();
                      if (!text) return;

                      if (snap === "HALF") setSnap("FULL");

                      sendMessage(
                        { text },
                        {
                          body: {
                            data: {
                              editionId: selectedFestival,
                              dates: Array.from(selectedDates),
                            },
                          },
                        }
                      );

                      setInput("");
                    }}
                  >
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="예: 애니메이션 추천해줘..."
                      disabled={status !== "ready"}
                      className="w-full h-11 pl-4 pr-12 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all disabled:opacity-70"
                    />
                    <button
                      type="submit"
                      disabled={status !== "ready" || !input.trim()}
                      className="absolute right-1.5 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-black transition-colors"
                    >
                      ↑
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
