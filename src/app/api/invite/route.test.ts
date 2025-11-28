import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

// Mocks for external dependencies used in the invite route
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  verifyAccessToken: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendInviteEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
      },
      invitationToken: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    },
  };
});

const mockedHeaders = await import("next/headers");
const mockedAuth = await import("@/lib/auth");
const mockedEmail = await import("@/lib/email");
const mockedPrisma = await import("@/lib/prisma");

describe("POST /api/invite (invite member to tenant)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockCookies(accessToken: string | undefined) {
    (mockedHeaders.cookies as any).mockResolvedValue({
      get: vi.fn(() =>
        accessToken ? { value: accessToken } : undefined
      ),
    });
  }

  it("returns 401 when not authenticated (no access token)", async () => {
    mockCookies(undefined);

    const request = new Request("http://localhost/api/invite", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.message).toBe("Not authenticated.");
  });

  it("returns 401 when token is invalid", async () => {
    mockCookies("token123");
    (mockedAuth.verifyAccessToken as any).mockResolvedValue(null);

    const request = new Request("http://localhost/api/invite", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(mockedAuth.verifyAccessToken).toHaveBeenCalledWith("token123");
    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.message).toBe("Invalid token.");
  });

  it("returns 400 when required fields are missing", async () => {
    mockCookies("token123");
    (mockedAuth.verifyAccessToken as any).mockResolvedValue({
      userId: "admin-id",
    });

    const request = new Request("http://localhost/api/invite", {
      method: "POST",
      body: JSON.stringify({ organizationId: "org-1" }), // email + role missing
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toBe(
      "Organization ID, email, and role are required."
    );
  });

  it("returns 400 when role is invalid", async () => {
    mockCookies("token123");
    (mockedAuth.verifyAccessToken as any).mockResolvedValue({
      userId: "admin-id",
    });

    const request = new Request("http://localhost/api/invite", {
      method: "POST",
      body: JSON.stringify({
        organizationId: "org-1",
        email: "user@example.com",
        role: "OWNER", // invalid
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toContain("Invalid role.");
  });

  it("rejects when user belongs to another organization", async () => {
    mockCookies("token123");
    (mockedAuth.verifyAccessToken as any).mockResolvedValue({
      userId: "admin-id",
    });

    (mockedPrisma.prisma.user.findUnique as any).mockResolvedValue({
      id: "user-id",
      email: "user@example.com",
      organizations: [
        { organizationId: "other-org" }, // different org
      ],
    });

    const request = new Request("http://localhost/api/invite", {
      method: "POST",
      body: JSON.stringify({
        organizationId: "org-1",
        email: "user@example.com",
        role: "MEMBER",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toBe(
      "This email already belongs to another organization. Users cannot be invited to multiple organizations."
    );
  });

  it("rejects when user is already a member of the organization", async () => {
    mockCookies("token123");
    (mockedAuth.verifyAccessToken as any).mockResolvedValue({
      userId: "admin-id",
    });

    (mockedPrisma.prisma.user.findUnique as any).mockResolvedValue({
      id: "user-id",
      email: "user@example.com",
      organizations: [
        { organizationId: "org-1" }, // same org
      ],
    });

    const request = new Request("http://localhost/api/invite", {
      method: "POST",
      body: JSON.stringify({
        organizationId: "org-1",
        email: "user@example.com",
        role: "MEMBER",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toBe(
      "This user is already a member of this organization."
    );
  });

  it("rejects when there is an existing pending invite", async () => {
    mockCookies("token123");
    (mockedAuth.verifyAccessToken as any).mockResolvedValue({
      userId: "admin-id",
    });

    (mockedPrisma.prisma.user.findUnique as any).mockResolvedValue(null);
    (mockedPrisma.prisma.invitationToken.findFirst as any).mockResolvedValue({
      id: "invite-id",
    });

    const request = new Request("http://localhost/api/invite", {
      method: "POST",
      body: JSON.stringify({
        organizationId: "org-1",
        email: "user@example.com",
        role: "MEMBER",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(
      mockedPrisma.prisma.invitationToken.findFirst
    ).toHaveBeenCalled();
    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toBe(
      "This user has a pending invitation. Please remove the existing invitation to add another."
    );
  });

  it("handles unique constraint violation (P2002) as 409", async () => {
    mockCookies("token123");
    (mockedAuth.verifyAccessToken as any).mockResolvedValue({
      userId: "admin-id",
    });

    (mockedPrisma.prisma.user.findUnique as any).mockResolvedValue(null);
    (mockedPrisma.prisma.invitationToken.findFirst as any).mockResolvedValue(
      null
    );
    (mockedPrisma.prisma.invitationToken.create as any).mockRejectedValue({
      code: "P2002",
    });

    const request = new Request("http://localhost/api/invite", {
      method: "POST",
      body: JSON.stringify({
        organizationId: "org-1",
        email: "user@example.com",
        role: "MEMBER",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.message).toBe(
      "An invitation has already been sent to this email for this organization."
    );
  });

  it("creates an invitation and sends email on success", async () => {
    mockCookies("token123");
    (mockedAuth.verifyAccessToken as any).mockResolvedValue({
      userId: "admin-id",
    });

    (mockedPrisma.prisma.user.findUnique as any).mockResolvedValue(null);
    (mockedPrisma.prisma.invitationToken.findFirst as any).mockResolvedValue(
      null
    );
    (mockedPrisma.prisma.invitationToken.create as any).mockResolvedValue({
      id: "invite-id",
      email: "user@example.com",
    });

    const request = new Request("http://localhost/api/invite", {
      method: "POST",
      body: JSON.stringify({
        organizationId: "org-1",
        email: "user@example.com",
        role: "MEMBER",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(
      mockedPrisma.prisma.invitationToken.create
    ).toHaveBeenCalled();
    expect(mockedEmail.sendInviteEmail).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.invite).toBeDefined();
  });
});


