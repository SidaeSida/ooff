// app/api/auth/[...nextauth]/route.ts (v5)
import { handlers } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export const { GET, POST } = handlers;
