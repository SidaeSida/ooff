import { openai } from "@ai-sdk/openai";
import {
  streamText,
  tool,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { auth } from "@/auth";
import { getScreeningsContext, getUserTasteContext } from "@/lib/ai/data-loader";

// 개발용: gpt-4o / 배포용: gpt-4o-mini
const MODEL_NAME = "gpt-4o";

export const maxDuration = 30;

type RequestBody = {
  messages: UIMessage[];
  data?: {
    editionId?: string;
    dates?: string[];
  };
};

export async function POST(req: Request) {
  // 1) 인증
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2) 요청 파싱
  const { messages, data }: RequestBody = await req.json();
  const editionId = data?.editionId;
  const dates = data?.dates;

  if (!editionId || !Array.isArray(dates) || dates.length === 0) {
    return new Response("Missing editionId or dates", { status: 400 });
  }

  // 3) 컨텍스트 로딩
  const screeningsMap = getScreeningsContext(editionId, dates);
  const userTaste = await getUserTasteContext(session.user.id);

  const systemPrompt = `
You are an expert film festival programmer and curator for 'OOFF'.

[YOUR GOAL]
Recommend the best screening schedule for the user based on their taste and the available screenings.

[DATA CONTEXT]
1. User's Taste (High rated films):
${JSON.stringify(userTaste)}

2. Available Screenings (Grouped by date):
${JSON.stringify(screeningsMap)}

[RULES]
1. Analyze User Taste (genres/directors/mood).
2. Match screenings accordingly.
3. Logistics:
   - Ensure at least a 30-minute gap between movies.
   - Do not schedule overlapping movies.
4. Quantity: roughly 2-3 per day, prioritize match quality.
5. Output: when you have a solid schedule, call the tool 'suggestScreenings'.
   - reason must be Korean and persuasive.
`;

  // 4) 스트리밍 + 툴
  const result = streamText({
    model: openai(MODEL_NAME),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: {
      suggestScreenings: tool({
        description: "Suggest a list of screenings to the user.",
        inputSchema: z.object({
          recommendations: z.array(
            z.object({
              screeningId: z.string(),
              reason: z.string(),
            })
          ),
        }),
        // 실행은 서버에서 즉시 완료 → UI로 tool output 스트리밍됨
        execute: async ({ recommendations }) => {
          return { recommendations };
        },
      }),
    },
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
