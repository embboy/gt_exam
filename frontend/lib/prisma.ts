import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const prisma = globalForPrisma.prisma ?? new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
  return prisma;
}

const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const value = Reflect.get(getPrisma(), property);
    return typeof value === "function" ? value.bind(getPrisma()) : value;
  },
});

export default prisma;
