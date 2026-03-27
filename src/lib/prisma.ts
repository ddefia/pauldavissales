import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

// Force fresh client after schema changes by keying on a version
const SCHEMA_VERSION = 2; // bump when schema changes
const globalKey = `prisma_v${SCHEMA_VERSION}`;
const globalStore = globalThis as unknown as Record<string, PrismaClient | undefined>;

export const prisma = globalStore[globalKey] ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalStore[globalKey] = prisma;
}

export default prisma;
