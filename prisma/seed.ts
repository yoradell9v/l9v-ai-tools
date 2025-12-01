// prisma/seed.ts
import { config } from "dotenv";
import { hash } from "bcrypt";
import { PrismaClient } from "@prisma/client";

// Load .env file
config();

// Prioritize DATABASE_PUBLIC_URL over DATABASE_URL for local seeding
// This allows using public URL when running from local machine
if (process.env.DATABASE_PUBLIC_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
}

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

async function main() {
  console.log("🌱 Seeding database...");
  console.log(
    "📍 Connected to:",
    process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] || "unknown"
  );

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
  const superadminEmails = ["yoradelambrad@gmail.com", "joerare@gmail.com"];

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
