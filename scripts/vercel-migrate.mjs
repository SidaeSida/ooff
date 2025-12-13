import { execSync } from "node:child_process";

if (process.env.POSTINSTALL_MIGRATE !== "1") process.exit(0);

execSync("npx prisma migrate deploy", { stdio: "inherit" });
