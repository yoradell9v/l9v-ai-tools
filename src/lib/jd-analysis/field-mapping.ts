import { OrganizationKnowledgeBase } from "@/lib/knowledge-base/organization-knowledge-base";

export interface JDFormDefaults {
  businessName: string;
  businessGoal: string;
  tools: string;
  timezone: string;
  weeklyHours: string;
  englishLevel: string;
  managementStyle: string;
}

export interface JDFormData {
  businessName?: string;
  businessGoal?: string;
  tools?: string;
  timezone?: string;
  weeklyHours?: string;
  englishLevel?: string;
  managementStyle?: string;
  [key: string]: any;
}

export interface ResolvedJDFormData {
  businessName: string;
  businessGoal: string;
  tools: string[];
  timezone: string;
  weeklyHours: number;
  englishLevel: string;
  managementStyle: string;
  [key: string]: any;
}

export function mapOrgKBToJDForm(
  orgKB: OrganizationKnowledgeBase | null
): JDFormDefaults {
  if (!orgKB) {
    return {
      businessName: "",
      businessGoal: "Growth & Scale",
      tools: "",
      timezone: "",
      weeklyHours: "40",
      englishLevel: "Excellent",
      managementStyle: "Async",
    };
  }

  return {
    businessName: orgKB.businessName || "",
    businessGoal: orgKB.primaryGoal || "__ORG_DEFAULT__",
    tools: "",
    timezone: orgKB.defaultTimeZone || "",
    weeklyHours: orgKB.defaultWeeklyHours || "40",
    englishLevel: orgKB.defaultEnglishLevel || "__ORG_DEFAULT__",
    managementStyle: orgKB.defaultManagementStyle || "__ORG_DEFAULT__",
  };
}

export function resolveJDFormWithOrgKB(
  formData: JDFormData,
  orgKB: OrganizationKnowledgeBase | null
): ResolvedJDFormData {
  const defaults = mapOrgKBToJDForm(orgKB);

  const businessName =
    formData.businessName?.trim() || defaults.businessName || "";

  const businessGoal =
    formData.businessGoal === "__ORG_DEFAULT__"
      ? defaults.businessGoal === "__ORG_DEFAULT__"
        ? ""
        : defaults.businessGoal
      : formData.businessGoal || "";

  const orgTools = Array.isArray(orgKB?.toolStack) ? orgKB.toolStack : [];
  const roleSpecificTools = formData.tools
    ? formData.tools
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const allTools = [
    ...new Set([...orgTools, ...roleSpecificTools].map((t) => t.toLowerCase())),
  ].map((t) => {
    return (
      orgTools.find((ot) => ot.toLowerCase() === t) ||
      roleSpecificTools.find((rt) => rt.toLowerCase() === t) ||
      t
    );
  });

  const timezone = formData.timezone?.trim() || defaults.timezone || "";

  const weeklyHours = formData.weeklyHours
    ? parseInt(formData.weeklyHours, 10) || 0
    : parseInt(defaults.weeklyHours, 10) || 40;

  const englishLevel =
    formData.englishLevel === "__ORG_DEFAULT__"
      ? defaults.englishLevel === "__ORG_DEFAULT__"
        ? ""
        : defaults.englishLevel
      : formData.englishLevel || "";

  const managementStyle =
    formData.managementStyle === "__ORG_DEFAULT__"
      ? defaults.managementStyle === "__ORG_DEFAULT__"
        ? ""
        : defaults.managementStyle
      : formData.managementStyle || "";

  return {
    ...formData,
    businessName,
    businessGoal,
    tools: allTools,
    timezone,
    weeklyHours,
    englishLevel,
    managementStyle,
  };
}

export function resolvedJDFormToIntakePayload(
  resolvedData: ResolvedJDFormData
): any {
  return {
    brand: {
      name: resolvedData.businessName.trim(),
    },
    website: resolvedData.website || "",
    business_goal: resolvedData.businessGoal || "",
    outcome_90d: resolvedData.outcome90Day || "",
    tasks_top5: Array.isArray(resolvedData.tasks)
      ? resolvedData.tasks.filter((t) => t && t.trim()).slice(0, 5)
      : [],
    requirements: Array.isArray(resolvedData.requirements)
      ? resolvedData.requirements.filter((r) => r && r.trim())
      : [],
    weekly_hours: resolvedData.weeklyHours || 0,
    timezone: resolvedData.timezone || "",
    client_facing: resolvedData.clientFacing === "Yes",
    tools: resolvedData.tools || [],
    tools_raw: resolvedData.tools?.join(", ") || "",
    english_level: resolvedData.englishLevel || "",
    management_style: resolvedData.managementStyle || "",
    reporting_expectations: resolvedData.reportingExpectations || "",
    security_needs: resolvedData.securityNeeds || "",
    deal_breakers: resolvedData.dealBreakers || "",
    nice_to_have_skills: resolvedData.niceToHaveSkills || "",
    existing_sops: resolvedData.existingSOPs === "Yes",
  };
}
