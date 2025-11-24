export const getConfidenceValue = (confidence: any): number => {
  if (!confidence) return 0;
  const lower = confidence.toLowerCase();
  if (lower.includes("high")) return 85;
  if (lower.includes("medium")) return 60;
  if (lower.includes("low")) return 35;
  return 0;
};

export const getConfidenceColor = (confidence: any): string => {
  if (!confidence) return "bg-zinc-300";
  const lower = confidence.toLowerCase();
  if (lower.includes("high")) return "bg-emerald-500";
  if (lower.includes("medium")) return "bg-amber-500";
  if (lower.includes("low")) return "bg-orange-500";
  return "bg-zinc-300";
};
