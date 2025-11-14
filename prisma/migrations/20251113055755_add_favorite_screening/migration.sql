-- CreateTable (FavoriteScreening만 생성)
CREATE TABLE "FavoriteScreening" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "screeningId" TEXT NOT NULL,
    "priority" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FavoriteScreening_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoriteScreening_userId_idx" ON "FavoriteScreening"("userId");

-- CreateIndex
CREATE INDEX "FavoriteScreening_screeningId_idx" ON "FavoriteScreening"("screeningId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteScreening_userId_screeningId_key"
  ON "FavoriteScreening"("userId", "screeningId");

-- AddForeignKey
ALTER TABLE "FavoriteScreening"
  ADD CONSTRAINT "FavoriteScreening_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
