// app/my/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function deleteUserEntry(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const filmId = String(formData.get("filmId") ?? "").trim();
  if (!filmId) throw new Error("filmId required");

  try {
    await prisma.userEntry.delete({
      where: {
        userId_filmId: {
          userId: session.user.id as string,
          filmId,
        },
      },
    });
  } catch {
    // 이미 없었던 경우도 동일하게 통과
  }

  // /my 페이지 데이터를 서버에서 재검증
  revalidatePath("/my", "page");
}
