import { prisma } from "@/lib/core/prisma";
import { isSimilar } from "@/lib/utils/similarity";

interface HiringHistoryRole {
  roleTitle: string;
  serviceType: string;
  hoursPerWeek?: number;
  firstSeen: string;
  lastSeen: string;
  count: number;
  sourceIds: string[];
}

interface HiringHistory {
  roles: HiringHistoryRole[];
  patterns: {
    mostRequestedRoles: string[];
    preferredServiceTypes: string[];
    averageHoursPerWeek: number;
  };
}

interface ServicePreference {
  serviceType: "Dedicated VA" | "Projects on Demand" | "Unicorn VA Service";
  confidence: number;
  lastRecommended: string;
  reasoning?: string;
}

interface ServicePreferences {
  preferredServiceTypes: ServicePreference[];
  serviceFitScores?: {
    dedicatedVA: number[];
    projectsOnDemand: number[];
    unicornVA: number[];
  };
}

interface SkillRequirements {
  technical: string[];
  soft: string[];
  domain: string[];
  frequency: Record<string, number>;
}

interface BottleneckHistoryEntry {
  bottleneck: string;
  identifiedAt: string;
  sourceId: string;
}

const SIMILARITY_THRESHOLD = 0.85;
const MAX_ROLES_TO_TRACK = 50;
const MAX_BOTTLENECKS_TO_TRACK = 20;

export async function updateHiringHistory(
  knowledgeBaseId: string,
  roleData: {
    roleTitle: string;
    serviceType: string;
    hoursPerWeek?: number;
    sourceId: string;
  }
): Promise<void> {
  const knowledgeBase = await prisma.organizationKnowledgeBase.findUnique({
    where: { id: knowledgeBaseId },
    select: { hiringHistory: true },
  });

  if (!knowledgeBase) {
    throw new Error(`Knowledge base ${knowledgeBaseId} not found`);
  }

  const now = new Date().toISOString();
  let hiringHistory: HiringHistory = knowledgeBase.hiringHistory
    ? (knowledgeBase.hiringHistory as unknown as HiringHistory)
    : {
        roles: [],
        patterns: {
          mostRequestedRoles: [],
          preferredServiceTypes: [],
          averageHoursPerWeek: 0,
        },
      };

  const existingRoleIndex = hiringHistory.roles.findIndex(
    (role) =>
      isSimilar(role.roleTitle, roleData.roleTitle, SIMILARITY_THRESHOLD) &&
      role.serviceType === roleData.serviceType
  );

  if (existingRoleIndex >= 0) {
    const existingRole = hiringHistory.roles[existingRoleIndex];
    existingRole.count += 1;
    existingRole.lastSeen = now;
    existingRole.sourceIds.push(roleData.sourceId);

    if (roleData.hoursPerWeek !== undefined) {
      existingRole.hoursPerWeek = roleData.hoursPerWeek;
    }
  } else {
    const newRole: HiringHistoryRole = {
      roleTitle: roleData.roleTitle,
      serviceType: roleData.serviceType,
      hoursPerWeek: roleData.hoursPerWeek,
      firstSeen: now,
      lastSeen: now,
      count: 1,
      sourceIds: [roleData.sourceId],
    };

    hiringHistory.roles.push(newRole);

    if (hiringHistory.roles.length > MAX_ROLES_TO_TRACK) {
      hiringHistory.roles.sort(
        (a, b) =>
          new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
      );
      hiringHistory.roles = hiringHistory.roles.slice(0, MAX_ROLES_TO_TRACK);
    }
  }

  hiringHistory.patterns = calculateHiringPatterns(hiringHistory.roles);
  await prisma.organizationKnowledgeBase.update({
    where: { id: knowledgeBaseId },
    data: { hiringHistory: hiringHistory as any },
  });
}

function calculateHiringPatterns(
  roles: HiringHistoryRole[]
): HiringHistory["patterns"] {
  if (roles.length === 0) {
    return {
      mostRequestedRoles: [],
      preferredServiceTypes: [],
      averageHoursPerWeek: 0,
    };
  }

  const roleCounts = new Map<string, number>();
  roles.forEach((role) => {
    const current = roleCounts.get(role.roleTitle) || 0;
    roleCounts.set(role.roleTitle, current + role.count);
  });

  const mostRequestedRoles = Array.from(roleCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([roleTitle]) => roleTitle);

  const serviceTypeCounts = new Map<string, number>();
  roles.forEach((role) => {
    const current = serviceTypeCounts.get(role.serviceType) || 0;
    serviceTypeCounts.set(role.serviceType, current + role.count);
  });

  const preferredServiceTypes = Array.from(serviceTypeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([serviceType]) => serviceType);

  const rolesWithHours = roles.filter(
    (r) => r.hoursPerWeek !== undefined && r.hoursPerWeek !== null
  );
  const averageHoursPerWeek =
    rolesWithHours.length > 0
      ? rolesWithHours.reduce((sum, r) => sum + (r.hoursPerWeek || 0), 0) /
        rolesWithHours.length
      : 0;

  return {
    mostRequestedRoles,
    preferredServiceTypes,
    averageHoursPerWeek: Math.round(averageHoursPerWeek * 10) / 10,
  };
}

export async function updateServicePreferences(
  knowledgeBaseId: string,
  serviceData: {
    recommendedService: string;
    serviceFitScores: {
      dedicatedVA: number;
      projectsOnDemand: number;
      unicornVA: number;
    };
    reasoning?: string;
    sourceId: string;
  }
): Promise<void> {
  const knowledgeBase = await prisma.organizationKnowledgeBase.findUnique({
    where: { id: knowledgeBaseId },
    select: { servicePreferences: true },
  });

  if (!knowledgeBase) {
    throw new Error(`Knowledge base ${knowledgeBaseId} not found`);
  }

  const now = new Date().toISOString();
  let servicePreferences: ServicePreferences = knowledgeBase.servicePreferences
    ? (knowledgeBase.servicePreferences as unknown as ServicePreferences)
    : { preferredServiceTypes: [] };

  const existingServiceIndex =
    servicePreferences.preferredServiceTypes.findIndex(
      (pref) => pref.serviceType === serviceData.recommendedService
    );

  if (existingServiceIndex >= 0) {
    const existing =
      servicePreferences.preferredServiceTypes[existingServiceIndex];
    existing.confidence = Math.round((existing.confidence + 85) / 2);
    existing.lastRecommended = now;
    if (serviceData.reasoning) {
      existing.reasoning = serviceData.reasoning;
    }
  } else {
    servicePreferences.preferredServiceTypes.push({
      serviceType:
        serviceData.recommendedService as ServicePreference["serviceType"],
      confidence: 85,
      lastRecommended: now,
      reasoning: serviceData.reasoning,
    });
  }

  if (!servicePreferences.serviceFitScores) {
    servicePreferences.serviceFitScores = {
      dedicatedVA: [],
      projectsOnDemand: [],
      unicornVA: [],
    };
  }

  servicePreferences.serviceFitScores.dedicatedVA.push(
    serviceData.serviceFitScores.dedicatedVA
  );
  servicePreferences.serviceFitScores.projectsOnDemand.push(
    serviceData.serviceFitScores.projectsOnDemand
  );
  servicePreferences.serviceFitScores.unicornVA.push(
    serviceData.serviceFitScores.unicornVA
  );

  const maxScores = 20;
  if (servicePreferences.serviceFitScores.dedicatedVA.length > maxScores) {
    servicePreferences.serviceFitScores.dedicatedVA =
      servicePreferences.serviceFitScores.dedicatedVA.slice(-maxScores);
  }
  if (servicePreferences.serviceFitScores.projectsOnDemand.length > maxScores) {
    servicePreferences.serviceFitScores.projectsOnDemand =
      servicePreferences.serviceFitScores.projectsOnDemand.slice(-maxScores);
  }
  if (servicePreferences.serviceFitScores.unicornVA.length > maxScores) {
    servicePreferences.serviceFitScores.unicornVA =
      servicePreferences.serviceFitScores.unicornVA.slice(-maxScores);
  }

  await prisma.organizationKnowledgeBase.update({
    where: { id: knowledgeBaseId },
    data: { servicePreferences: servicePreferences as any },
  });
}

export async function updateSkillRequirements(
  knowledgeBaseId: string,
  skills: {
    technical?: string[];
    soft?: string[];
    domain?: string[];
    sourceId: string;
  }
): Promise<void> {
  const knowledgeBase = await prisma.organizationKnowledgeBase.findUnique({
    where: { id: knowledgeBaseId },
    select: { skillRequirements: true },
  });

  if (!knowledgeBase) {
    throw new Error(`Knowledge base ${knowledgeBaseId} not found`);
  }

  let skillRequirements: SkillRequirements = knowledgeBase.skillRequirements
    ? (knowledgeBase.skillRequirements as unknown as SkillRequirements)
    : { technical: [], soft: [], domain: [], frequency: {} };

  const mergeSkills = (existing: string[], newSkills?: string[]) => {
    if (!newSkills || newSkills.length === 0) return existing;

    const skillSet = new Set(existing.map((s) => s.toLowerCase().trim()));
    newSkills.forEach((skill) => {
      const normalized = skill.trim();
      if (normalized.length > 0) {
        skillSet.add(normalized.toLowerCase());
      }
    });

    return Array.from(skillSet).map((s) => {
      const original = newSkills?.find((ns) => ns.toLowerCase().trim() === s);
      return original || s;
    });
  };

  skillRequirements.technical = mergeSkills(
    skillRequirements.technical,
    skills.technical
  );
  skillRequirements.soft = mergeSkills(skillRequirements.soft, skills.soft);
  skillRequirements.domain = mergeSkills(
    skillRequirements.domain,
    skills.domain
  );

  const allSkills = [
    ...(skills.technical || []),
    ...(skills.soft || []),
    ...(skills.domain || []),
  ];

  allSkills.forEach((skill) => {
    const normalized = skill.toLowerCase().trim();
    skillRequirements.frequency[normalized] =
      (skillRequirements.frequency[normalized] || 0) + 1;
  });

  await prisma.organizationKnowledgeBase.update({
    where: { id: knowledgeBaseId },
    data: { skillRequirements: skillRequirements as any },
  });
}

export async function updateBottleneckHistory(
  knowledgeBaseId: string,
  bottleneck: string,
  sourceId: string
): Promise<void> {
  const knowledgeBase = await prisma.organizationKnowledgeBase.findUnique({
    where: { id: knowledgeBaseId },
    select: { bottleneckHistory: true },
  });

  if (!knowledgeBase) {
    throw new Error(`Knowledge base ${knowledgeBaseId} not found`);
  }

  const now = new Date().toISOString();
  let bottleneckHistory: BottleneckHistoryEntry[] =
    knowledgeBase.bottleneckHistory
      ? (knowledgeBase.bottleneckHistory as unknown as BottleneckHistoryEntry[])
      : [];

  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const recentBottlenecks = bottleneckHistory.filter(
    (entry) => new Date(entry.identifiedAt) >= new Date(thirtyDaysAgo)
  );

  const isDuplicate = recentBottlenecks.some((entry) =>
    isSimilar(entry.bottleneck, bottleneck, SIMILARITY_THRESHOLD)
  );

  if (!isDuplicate) {
    bottleneckHistory.push({
      bottleneck: bottleneck.trim(),
      identifiedAt: now,
      sourceId: sourceId,
    });

    if (bottleneckHistory.length > MAX_BOTTLENECKS_TO_TRACK) {
      bottleneckHistory.sort(
        (a, b) =>
          new Date(b.identifiedAt).getTime() -
          new Date(a.identifiedAt).getTime()
      );
      bottleneckHistory = bottleneckHistory.slice(0, MAX_BOTTLENECKS_TO_TRACK);
    }

    await prisma.organizationKnowledgeBase.update({
      where: { id: knowledgeBaseId },
      data: { bottleneckHistory: bottleneckHistory as any },
    });
  }
}
