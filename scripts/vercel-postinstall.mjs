import { execSync } from "node:child_process";

const isVercel = process.env.VERCEL === "1";
const shouldMigrate = process.env.POSTINSTALL_MIGRATE === "1";

if (isVercel && shouldMigrate) {
  execSync("npx prisma migrate deploy --schema prisma/schema.prisma", {
    stdio: "inherit",
  });
}
