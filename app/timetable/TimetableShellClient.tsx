// app/timetable/TimetableShellClient.tsx

"use client";

import dynamic from "next/dynamic";
import type { TimetableRow } from "./page";

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
};

export default function TimetableShellClient(props: Props) {
  return <InnerTimetableClient {...props} />;
}
