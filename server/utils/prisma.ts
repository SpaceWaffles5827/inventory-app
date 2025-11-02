import { PrismaClient } from "@prisma/client";

const make = () =>
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

declare global {
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma ?? make();
if (process.env.NODE_ENV !== "production") global.prisma = prisma;

export default prisma;
