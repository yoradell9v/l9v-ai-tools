import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/core/prisma";
import { verifyAccessToken } from "@/lib/core/auth";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const decoded = await verifyAccessToken(accessToken);
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Invalid token." },
        { status: 401 }
      );
    }
    const userOrganizations = await prisma.userOrganization.findMany({
      where: {
        userId: decoded.userId,
        organization: {
          deactivatedAt: null,
        },
        deactivatedAt: null,
      },
      select: {
        id: true,
        userId: true,
        organizationId: true,
      },
    });

    if (userOrganizations.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          sops: [],
          total: 0,
        },
      });
    }

    const organizationIds = userOrganizations.map((uo) => uo.organizationId);

    const allUserOrganizations = await prisma.userOrganization.findMany({
      where: {
        organizationId: {
          in: organizationIds,
        },
        organization: {
          deactivatedAt: null,
        },
        deactivatedAt: null,
      },
      select: {
        id: true,
      },
    });

    const userOrganizationIds = allUserOrganizations.map((uo) => uo.id);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    const includeAllVersions =
      searchParams.get("includeAllVersions") === "true";

    const groupBySOP = searchParams.get("groupBySOP") === "true";
    const sortBy = searchParams.get("sortBy") || "recent";

    const where: any = {
      userOrganizationId: {
        in: userOrganizationIds,
      },
    };

    let hasVersionFields = false;
    try {
      const result = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'SOP' AND column_name = 'versionNumber'
        LIMIT 1
      `;
      hasVersionFields = result.length > 0;
    } catch (e: any) {
      hasVersionFields = false;
      console.warn(
        "[SOP Saved] Could not check for version fields - assuming migration not applied"
      );
    }

    const whereClause: any = {
      userOrganizationId: {
        in: userOrganizationIds,
      },
    };

    if (hasVersionFields && !includeAllVersions && !groupBySOP) {
      whereClause.isCurrentVersion = true;
    }

    const baseSelect: any = {
      id: true,
      title: true,
      content: true,
      intakeData: true,
      usedKnowledgeBaseVersion: true,
      knowledgeBaseSnapshot: true,
      contributedInsights: true,
      organizationId: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
      userOrganization: {
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              firstname: true,
              lastname: true,
              email: true,
            },
          },
        },
      },
    };

    if (hasVersionFields) {
      baseSelect.versionNumber = true;
      baseSelect.rootSOPId = true;
      baseSelect.isCurrentVersion = true;
      baseSelect.versionCreatedAt = true;
    }
    let sops: any[];
    let total: number;

    let orderBy: any = { createdAt: "desc" };
    if (hasVersionFields && groupBySOP && sortBy === "oldest") {
      orderBy = { createdAt: "asc" };
    } else if (hasVersionFields && baseSelect.versionCreatedAt) {
      orderBy =
        sortBy === "oldest"
          ? { versionCreatedAt: "asc" }
          : { versionCreatedAt: "desc" };
    } else {
      orderBy =
        sortBy === "oldest" ? { createdAt: "asc" } : { createdAt: "desc" };
    }

    try {
      [sops, total] = await Promise.all([
        prisma.sOP.findMany({
          where: whereClause,
          skip: groupBySOP ? 0 : skip,
          take: groupBySOP ? 10000 : limit,
          orderBy,
          select: baseSelect,
        }),
        prisma.sOP.count({ where: whereClause }),
      ]);
    } catch (error: any) {
      if (
        error.message?.includes("Unknown column") ||
        error.message?.includes("does not exist") ||
        error.code === "P2021" ||
        error.code === "P2001"
      ) {
        console.warn(
          "[SOP Saved] Query failed with version fields, retrying without them"
        );

        delete baseSelect.versionNumber;
        delete baseSelect.rootSOPId;
        delete baseSelect.isCurrentVersion;
        delete whereClause.isCurrentVersion;

        [sops, total] = await Promise.all([
          prisma.sOP.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
              createdAt: "desc",
            },
            select: baseSelect,
          }),
          prisma.sOP.count({ where: whereClause }),
        ]);
      } else {
        throw error;
      }
    }

    const sopsWithVersions =
      hasVersionFields && sops[0]?.versionNumber !== undefined
        ? sops
        : sops.map((sop: any) => ({
            ...sop,
            versionNumber: sop.versionNumber ?? 1,
            rootSOPId: sop.rootSOPId ?? sop.id,
            isCurrentVersion: sop.isCurrentVersion ?? true,
            versionCreatedAt: sop.versionCreatedAt ?? sop.createdAt,
          }));

    if (groupBySOP) {
      const groupsMap = new Map<
        string,
        {
          rootSOPId: string;
          versions: any[];
          mostRecentVersionDate: Date;
          oldestVersionDate: Date;
        }
      >();

      for (const sop of sopsWithVersions) {
        const groupKey = sop.rootSOPId || sop.id;
        const versionDate = sop.versionCreatedAt
          ? new Date(sop.versionCreatedAt)
          : new Date(sop.createdAt);

        if (!groupsMap.has(groupKey)) {
          groupsMap.set(groupKey, {
            rootSOPId: groupKey,
            versions: [],
            mostRecentVersionDate: versionDate,
            oldestVersionDate: versionDate,
          });
        }

        const group = groupsMap.get(groupKey)!;
        group.versions.push(sop);

        if (versionDate > group.mostRecentVersionDate) {
          group.mostRecentVersionDate = versionDate;
        }
        if (versionDate < group.oldestVersionDate) {
          group.oldestVersionDate = versionDate;
        }
      }

      let groups = Array.from(groupsMap.values()).map((group) => {
        group.versions.sort((a, b) => {
          const dateA = a.versionCreatedAt
            ? new Date(a.versionCreatedAt)
            : new Date(a.createdAt);
          const dateB = b.versionCreatedAt
            ? new Date(b.versionCreatedAt)
            : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });
        const currentVersion =
          group.versions.find((v: any) => v.isCurrentVersion) ||
          group.versions[0];

        return {
          rootSOPId: group.rootSOPId,
          title: currentVersion.title,
          currentVersion,
          versions: group.versions,
          mostRecentVersionDate: group.mostRecentVersionDate.toISOString(),
          oldestVersionDate: group.oldestVersionDate.toISOString(),
          versionCount: group.versions.length,
        };
      });

      groups.sort((a, b) => {
        const dateA = new Date(
          sortBy === "recent" ? a.mostRecentVersionDate : a.oldestVersionDate
        );
        const dateB = new Date(
          sortBy === "recent" ? b.mostRecentVersionDate : b.oldestVersionDate
        );
        return sortBy === "recent"
          ? dateB.getTime() - dateA.getTime()
          : dateA.getTime() - dateB.getTime();
      });

      const totalGroups = groups.length;
      const paginatedGroups = groups.slice(skip, skip + limit);

      return NextResponse.json({
        success: true,
        data: {
          groups: paginatedGroups,
          total: totalGroups,
          page,
          limit,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        sops: sopsWithVersions,
        total,
        page,
        limit,
      },
    });
  } catch (error: any) {
    console.error("[SOP Saved] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch saved SOPs",
      },
      { status: 500 }
    );
  }
}
