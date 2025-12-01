import { hash } from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const systemOrg = await prisma.organization.upsert({
      where: { slug: "system-superadmin" },
      update: {},
      create: { name: "System Administration", slug: "system-superadmin" },
    });

    const email = "yoradelambrad@gmail.com";
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

    await prisma.userOrganization.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: systemOrg.id,
        },
      },
      update: { role: "ADMIN" },
      create: { userId: user.id, organizationId: systemOrg.id, role: "ADMIN" },
    });

    return new Response(JSON.stringify({ message: "Database seeded!" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Seeding failed", details: err }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  } finally {
    await prisma.$disconnect();
  }
}
