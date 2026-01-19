import { config } from "dotenv";
import { hash } from "bcrypt";
import { PrismaClient } from "@prisma/client";

config();

const isValidDatabaseUrl = (url: string | undefined): boolean => {
  if (!url || !url.trim()) return false;
  const urlMatch = url.match(/@([^:/]+):?(\d+)?\//);
  if (!urlMatch || !urlMatch[1] || urlMatch[1].trim().length === 0) {
    return false;
  }
  return true;
};

if (process.env.DATABASE_PUBLIC_URL && process.env.DATABASE_PUBLIC_URL.trim()) {
  const publicUrl = process.env.DATABASE_PUBLIC_URL.trim();
  if (isValidDatabaseUrl(publicUrl)) {
    process.env.DATABASE_URL = publicUrl;
    console.log("Using DATABASE_PUBLIC_URL for connection");
  } else {
    console.error(
      "Error: DATABASE_PUBLIC_URL is malformed (missing hostname/port)",
    );
    console.error("Current value:", publicUrl.replace(/:[^:@]+@/, ":****@"));
    console.error(
      "Railway may have transformed the URL. Override it directly:",
    );
    console.error(
      "DATABASE_URL='postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:22741/railway' npm run seed",
    );
  }
}

if (process.env.DATABASE_URL) {
  const dbUrl = process.env.DATABASE_URL;

  if (!isValidDatabaseUrl(dbUrl)) {
    console.error("Error: DATABASE_URL is malformed (missing hostname/port)");
    console.error("Current value:", dbUrl.replace(/:[^:@]+@/, ":****@")); // Hide password
    console.error("Solution: Override DATABASE_URL when running:");
    console.error(
      "DATABASE_URL='postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:22741/railway' npm run seed",
    );
    throw new Error(
      "Invalid DATABASE_URL: missing hostname or port. Railway may have transformed it.",
    );
  }

  if (
    dbUrl.includes("postgres.railway.internal") ||
    dbUrl.includes("railway.internal")
  ) {
    console.warn(
      "Warning: DATABASE_URL contains internal hostname. This won't work from your local machine.",
    );
    console.warn("Solution: Override DATABASE_URL when running:");
    console.warn(
      "DATABASE_URL='postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:22741/railway' npm run seed",
    );
    throw new Error(
      "DATABASE_URL uses internal hostname. Use public URL instead.",
    );
  }
}

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

async function main() {
  console.log("Seeding database...");

  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
    throw new Error(
      "DATABASE_URL is not set. Please set DATABASE_URL or DATABASE_PUBLIC_URL environment variable.\n" +
        "Example: DATABASE_URL='postgresql://postgres:password@yamanote.proxy.rlwy.net:22741/railway' npm run seed",
    );
  }

  const dbUrl = process.env.DATABASE_URL;
  const hostPart = dbUrl.split("@")[1]?.split("/")[0] || "unknown";
  console.log("Connected to:", hostPart);

  const systemOrg = await prisma.organization.upsert({
    where: { slug: "system-superadmin" },
    update: {},
    create: {
      name: "Level 9 Virtual",
      slug: "level-9-virtual",
    },
  });
  console.log("System organization created/verified:", systemOrg.id);

  const superadminEmails = [
    "yoradelambrad@gmail.com",
    "joerare@gmail.com",
    "yorsambrad@gmail.com",
  ];

  for (const email of superadminEmails) {
    const defaultPassword = await hash("ChangeMe123!", 10);

    const user = await prisma.user.upsert({
      where: { email },
      update: { globalRole: "SUPERADMIN" },
      create: {
        email,
        firstname: "New",
        lastname: "Admin",
        password: defaultPassword,
        globalRole: "SUPERADMIN",
      },
    });
    console.log(`User created/verified: ${email}`);

    await prisma.userOrganization.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: systemOrg.id,
        },
      },
      update: { role: "ADMIN" },
      create: {
        userId: user.id,
        organizationId: systemOrg.id,
        role: "ADMIN",
      },
    });
    console.log(`Linked to system organization: ${systemOrg.slug}`);
  }

  console.log("\nSeeding complete!");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
