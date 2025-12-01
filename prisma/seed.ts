// prisma/seed.ts
import { config } from "dotenv";
import { hash } from "bcrypt";
import { PrismaClient } from "@prisma/client";

// Load .env file
config();

// Validate URL has hostname and port
const isValidDatabaseUrl = (url: string | undefined): boolean => {
  if (!url || !url.trim()) return false;
  // Check if URL has proper format: postgresql://user:pass@host:port/db
  // Must have hostname (not empty between @ and : or /)
  const urlMatch = url.match(/@([^:/]+):?(\d+)?\//);
  if (!urlMatch || !urlMatch[1] || urlMatch[1].trim().length === 0) {
    return false;
  }
  return true;
};

// Prioritize DATABASE_PUBLIC_URL over DATABASE_URL for local seeding
// This allows using public URL when running from local machine
// Railway CLI sets DATABASE_URL to internal hostname, so we need to override it
if (process.env.DATABASE_PUBLIC_URL && process.env.DATABASE_PUBLIC_URL.trim()) {
  const publicUrl = process.env.DATABASE_PUBLIC_URL.trim();
  if (isValidDatabaseUrl(publicUrl)) {
    process.env.DATABASE_URL = publicUrl;
    console.log("🔗 Using DATABASE_PUBLIC_URL for connection");
  } else {
    console.error("❌ Error: DATABASE_PUBLIC_URL is malformed (missing hostname/port)");
    console.error("   Current value:", publicUrl.replace(/:[^:@]+@/, ':****@')); // Hide password
    console.error("💡 Railway may have transformed the URL. Override it directly:");
    console.error("   DATABASE_URL='postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:22741/railway' npm run seed");
  }
}

// Check if DATABASE_URL is valid
if (process.env.DATABASE_URL) {
  const dbUrl = process.env.DATABASE_URL;
  
  // Check if URL is malformed (missing hostname)
  if (!isValidDatabaseUrl(dbUrl)) {
    console.error("❌ Error: DATABASE_URL is malformed (missing hostname/port)");
    console.error("   Current value:", dbUrl.replace(/:[^:@]+@/, ':****@')); // Hide password
    console.error("💡 Solution: Override DATABASE_URL when running:");
    console.error("   DATABASE_URL='postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:22741/railway' npm run seed");
    throw new Error("Invalid DATABASE_URL: missing hostname or port. Railway may have transformed it.");
  }
  
  // Check if DATABASE_URL is using internal hostname (won't work from local machine)
  if (dbUrl.includes('postgres.railway.internal') || dbUrl.includes('railway.internal')) {
    console.warn("⚠️  Warning: DATABASE_URL contains internal hostname. This won't work from your local machine.");
    console.warn("💡 Solution: Override DATABASE_URL when running:");
    console.warn("   DATABASE_URL='postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:22741/railway' npm run seed");
    throw new Error("DATABASE_URL uses internal hostname. Use public URL instead.");
  }
}

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

async function main() {
  console.log("🌱 Seeding database...");
  
  // Validate DATABASE_URL exists
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
    throw new Error(
      "DATABASE_URL is not set. Please set DATABASE_URL or DATABASE_PUBLIC_URL environment variable.\n" +
      "Example: DATABASE_URL='postgresql://postgres:password@yamanote.proxy.rlwy.net:22741/railway' npm run seed"
    );
  }
  
  const dbUrl = process.env.DATABASE_URL;
  const hostPart = dbUrl.split("@")[1]?.split("/")[0] || "unknown";
  console.log("📍 Connected to:", hostPart);

  // 1. Create system organization for all superadmins
  const systemOrg = await prisma.organization.upsert({
    where: { slug: "system-superadmin" },
    update: {},
    create: {
      name: "System Administration",
      slug: "system-superadmin",
    },
  });
  console.log("✅ System organization created/verified:", systemOrg.id);

  // 2. Define superadmin emails
  const superadminEmails = ["yoradelambrad@gmail.com", "joerare@gmail.com", "yorsambrad@gmail.com"];

  for (const email of superadminEmails) {
    const defaultPassword = await hash("ChangeMe123!", 10);

    // Upsert user: create if missing, otherwise ensure SUPERADMIN role
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
    console.log(`✅ User created/verified: ${email}`);

    // Upsert userOrganization link (idempotent)
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
    console.log(`🔗 Linked to system organization: ${systemOrg.slug}`);
  }

  console.log("\n🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
