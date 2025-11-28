import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

// Mock Prisma client used in the route
vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      organization: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    },
  };
});

const mockedPrisma = await import("@/lib/prisma");

describe("POST /api/tenant (create tenant)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when name or slug is missing", async () => {
    const request = new Request("http://localhost/api/tenant", {
      method: "POST",
      body: JSON.stringify({ name: "Acme Inc" }), // slug missing
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toBe("Name and slug are required.");
  });

  it("returns 409 when tenant with slug already exists", async () => {
    (mockedPrisma.prisma.organization.findUnique as any).mockResolvedValue({
      id: "existing-id",
      slug: "acme",
    });

    const request = new Request("http://localhost/api/tenant", {
      method: "POST",
      body: JSON.stringify({ name: "Acme Inc", slug: "acme" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(
      mockedPrisma.prisma.organization.findUnique
    ).toHaveBeenCalledWith({ where: { slug: "acme" } });
    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.message).toBe("Tenant already exists.");
  });

  it("creates a new tenant and returns 201 on success", async () => {
    (mockedPrisma.prisma.organization.findUnique as any).mockResolvedValue(
      null
    );
    (mockedPrisma.prisma.organization.create as any).mockResolvedValue({
      id: "new-id",
      name: "Acme Inc",
      slug: "acme",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    });

    const request = new Request("http://localhost/api/tenant", {
      method: "POST",
      body: JSON.stringify({ name: "Acme Inc", slug: "acme" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(
      mockedPrisma.prisma.organization.findUnique
    ).toHaveBeenCalledWith({ where: { slug: "acme" } });
    expect(mockedPrisma.prisma.organization.create).toHaveBeenCalled();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.tenant).toMatchObject({
      id: "new-id",
      name: "Acme Inc",
      slug: "acme",
    });
  });

  it("returns 500 on unexpected errors", async () => {
    (mockedPrisma.prisma.organization.findUnique as any).mockRejectedValue(
      new Error("DB down")
    );

    const request = new Request("http://localhost/api/tenant", {
      method: "POST",
      body: JSON.stringify({ name: "Acme Inc", slug: "acme" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.message).toBe("Internal server error.");
  });
});


