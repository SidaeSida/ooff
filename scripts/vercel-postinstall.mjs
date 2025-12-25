import { execSync } from "node:child_process";

// Vercel 환경인지, 그리고 마이그레이션 스위치가 켜져 있는지 확인
const isVercel = process.env.VERCEL === "1";
const shouldMigrate = process.env.POSTINSTALL_MIGRATE === "1";

console.log("--- [OOFF Deployment Check] ---");
console.log(`Is Vercel: ${isVercel}`);
console.log(`Migrate Flag (POSTINSTALL_MIGRATE): ${shouldMigrate}`);

if (isVercel && shouldMigrate) {
  try {
    console.log("🚀 Starting Prisma Migration (deploy mode)...");
    // deploy 모드는 데이터 소실 없이 스키마 변경만 적용함 (안전함)
    execSync("npx prisma migrate deploy --schema prisma/schema.prisma", {
      stdio: "inherit",
    });
    console.log("✅ Migration completed successfully.");
  } catch (error) {
    console.error("❌ Migration FAILED. Stopping build.");
    process.exit(1); // 마이그레이션 실패 시 배포 중단 (안전장치)
  }
} else {
  console.log("⏩ Skipping migration. (Set POSTINSTALL_MIGRATE='1' to enable)");
}
console.log("-------------------------------");