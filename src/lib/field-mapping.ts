import { OrganizationKnowledgeBase } from "./organizationKnowledgeBase";

/**
 * JD Form field defaults that can be populated from Organization Knowledge Base
 */
export interface JDFormDefaults {
  businessName: string;
  businessGoal: string;
  tools: string;
  timezone: string;
  weeklyHours: string;
  englishLevel: string;
  managementStyle: string;
}

/**
 * JD Form data structure (what the user fills in)
 */
export interface JDFormData {
  businessName?: string;
  businessGoal?: string;
  tools?: string;
  timezone?: string;
  weeklyHours?: string;
  englishLevel?: string;
  managementStyle?: string;
  [key: string]: any; // Allow other fields
}

/**
 * Resolved JD Form data with org KB defaults applied
 */
export interface ResolvedJDFormData {
  businessName: string;
  businessGoal: string;
  tools: string[];
  timezone: string;
  weeklyHours: number;
  englishLevel: string;
  managementStyle: string;
  [key: string]: any; // Allow other fields
}

/**
 * Maps Organization Knowledge Base fields to JD Form default values
 * Used to pre-fill the JD form with organization defaults
 * When KB is null, returns sensible defaults instead of __ORG_DEFAULT__ placeholders
 */
export function mapOrgKBToJDForm(
  orgKB: OrganizationKnowledgeBase | null
): JDFormDefaults {
  if (!orgKB) {
    return {
      businessName: "",
      businessGoal: "Growth & Scale", // Default when KB is not set up
      tools: "",
      timezone: "",
      weeklyHours: "40",
      englishLevel: "Excellent", // Default when KB is not set up
      managementStyle: "Async", // Default when KB is not set up
    };
  }

  return {
    businessName: orgKB.businessName || "",
    businessGoal: orgKB.primaryGoal || "__ORG_DEFAULT__",
    tools: Array.isArray(orgKB.toolStack)
      ? orgKB.toolStack.join(", ")
      : "",
    timezone: orgKB.defaultTimeZone || "",
    weeklyHours: orgKB.defaultWeeklyHours || "40",
    englishLevel: orgKB.defaultEnglishLevel || "__ORG_DEFAULT__",
    managementStyle: orgKB.defaultManagementStyle || "__ORG_DEFAULT__",
  };
}

/**
 * Resolves JD Form data by replacing __ORG_DEFAULT__ placeholders with actual org KB values
 * and merging tool stacks
 */
export function resolveJDFormWithOrgKB(
  formData: JDFormData,
  orgKB: OrganizationKnowledgeBase | null
): ResolvedJDFormData {
  const defaults = mapOrgKBToJDForm(orgKB);

  // Resolve businessName: use form value if provided, otherwise org KB default
  const businessName =
    formData.businessName?.trim() || defaults.businessName || "";

  // Resolve businessGoal: replace __ORG_DEFAULT__ with actual org KB value
  const businessGoal =
    formData.businessGoal === "__ORG_DEFAULT__"
      ? defaults.businessGoal === "__ORG_DEFAULT__"
        ? ""
        : defaults.businessGoal
      : formData.businessGoal || "";

  // Resolve tools: merge org KB tool stack with role-specific tools
  const orgTools = Array.isArray(orgKB?.toolStack) ? orgKB.toolStack : [];
  const roleSpecificTools = formData.tools
    ? formData.tools
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  // Combine and deduplicate
  const allTools = [
    ...new Set([...orgTools, ...roleSpecificTools].map((t) => t.toLowerCase())),
  ].map((t) => {
    // Find original case from either source
    return (
      orgTools.find((ot) => ot.toLowerCase() === t) ||
      roleSpecificTools.find((rt) => rt.toLowerCase() === t) ||
      t
    );
  });

  // Resolve timezone: use form value if provided, otherwise org KB default
  const timezone = formData.timezone?.trim() || defaults.timezone || "";

  // Resolve weeklyHours: use form value if provided, otherwise org KB default
  const weeklyHours = formData.weeklyHours
    ? parseInt(formData.weeklyHours, 10) || 0
    : parseInt(defaults.weeklyHours, 10) || 40;

  // Resolve englishLevel: replace __ORG_DEFAULT__ with actual org KB value
  const englishLevel =
    formData.englishLevel === "__ORG_DEFAULT__"
      ? defaults.englishLevel === "__ORG_DEFAULT__"
        ? ""
        : defaults.englishLevel
      : formData.englishLevel || "";

  // Resolve managementStyle: replace __ORG_DEFAULT__ with actual org KB value
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

/**
 * Converts resolved JD Form data to API intake format
 * This is the format expected by the /api/jd/analyze endpoint
 */
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

