-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('private', 'friends', 'public');

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "email" TEXT NOT NULL,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "UserEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filmId" TEXT NOT NULL,
    "rating" DECIMAL(2,1),
    "shortReview" VARCHAR(200),
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "Visibility" NOT NULL DEFAULT 'private',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPrivacy" (
    "userId" TEXT NOT NULL,
    "ratingVisibility" "Visibility" NOT NULL DEFAULT 'private',
    "reviewVisibility" "Visibility" NOT NULL DEFAULT 'private',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPrivacy_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
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
CREATE INDEX "UserEntry_userId_idx" ON "UserEntry"("userId");

-- CreateIndex
CREATE INDEX "UserEntry_filmId_idx" ON "UserEntry"("filmId");

-- CreateIndex
CREATE UNIQUE INDEX "UserEntry_userId_filmId_key" ON "UserEntry"("userId", "filmId");

-- CreateIndex
CREATE INDEX "FavoriteScreening_userId_idx" ON "FavoriteScreening"("userId");

-- CreateIndex
CREATE INDEX "FavoriteScreening_screeningId_idx" ON "FavoriteScreening"("screeningId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteScreening_userId_screeningId_key" ON "FavoriteScreening"("userId", "screeningId");

-- AddForeignKey
ALTER TABLE "UserEntry" ADD CONSTRAINT "UserEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPrivacy" ADD CONSTRAINT "UserPrivacy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteScreening" ADD CONSTRAINT "FavoriteScreening_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
