// prisma/seed.ts
import { config } from "dotenv";
import { hash } from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Load environment variables
config();

// Create a fresh Prisma client for seeding
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ["error", "warn"],
});

async function main() {
  // 1. Create system organization for all superadmins
  const systemOrg = await prisma.organization.upsert({
    where: { slug: "system-superadmin" },
    update: {},
    create: {
      name: "System Administration",
      slug: "system-superadmin",
    },
  });

  console.log("System organization created/verified:", systemOrg.id);

  // 2. Define superadmin emails (accounts that should have superadmin access)
  const superadminEmails = ["yoradelambrad@gmail.com"];

  for (const email of superadminEmails) {
    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // User exists - just ensure they have SUPERADMIN role
      console.log(`User exists: ${email}`);

      if (user.globalRole !== "SUPERADMIN") {
        user = await prisma.user.update({
          where: { email },
          data: { globalRole: "SUPERADMIN" },
        });
        console.log(`Upgraded to SUPERADMIN`);
      } else {
        console.log(`Already SUPERADMIN`);
      }
    } else {
      // User doesn't exist - create with default password
      console.log(`→ Creating new user: ${email}`);
      const defaultPassword = await hash("ChangeMe123!", 10);

      user = await prisma.user.create({
        data: {
          email,
          firstname: "New",
          lastname: "Admin",
          password: defaultPassword,
          globalRole: "SUPERADMIN",
        },
      });
      console.log(`Created with default password`);
    }

    // Link to system organization (idempotent)
    const existingLink = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: systemOrg.id,
        },
      },
    });

    if (!existingLink) {
      await prisma.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: systemOrg.id,
          role: "ADMIN",
        },
      });
      console.log(`Linked to system organization`);
    } else {
      console.log(`Already linked to system organization`);
    }
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
    await pool.end();
  });
