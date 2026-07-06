// Runs `prisma migrate deploy` with retries. Concurrent Vercel builds contend
// for Prisma's advisory lock, which can time out transiently (P1002). Migrate
// deploy is idempotent, so retrying with backoff is safe and keeps a brief lock
// timeout from failing the whole build. A real migration error still fails after
// the retries are exhausted.
import { execSync } from "node:child_process";

function sleep(seconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, seconds * 1000);
}

const MAX_ATTEMPTS = 4;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  try {
    execSync("prisma migrate deploy", { stdio: "inherit" });
    process.exit(0);
  } catch {
    if (attempt === MAX_ATTEMPTS) {
      console.error(`prisma migrate deploy failed after ${MAX_ATTEMPTS} attempts.`);
      process.exit(1);
    }
    const wait = attempt * 5;
    console.warn(
      `prisma migrate deploy attempt ${attempt}/${MAX_ATTEMPTS} failed; retrying in ${wait}s…`
    );
    sleep(wait);
  }
}
