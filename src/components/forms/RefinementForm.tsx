import React, { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RefinementFormProps {
  analysisId: string;
  userId: string;
  serviceType?: string;
  onRefinementComplete: (refinedPackage: any) => void;
}

const RefinementForm: React.FC<RefinementFormProps> = ({
  analysisId,
  userId,
  serviceType,
  onRefinementComplete,
}) => {
  const [feedback, setFeedback] = useState("");
  const [refinementAreas, setRefinementAreas] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "clarification" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [clarificationQuestions, setClarificationQuestions] = useState<any[]>(
    []
  );
  const [changesSummary, setChangesSummary] = useState<any[]>([]);

  const getAvailableAreas = () => {
    const commonAreas = [{ value: "service_type", label: "Service Type" }];

    if (serviceType === "Dedicated VA") {
      return [
        ...commonAreas,
        { value: "role_title", label: "Role Title" },
        { value: "responsibilities", label: "Responsibilities" },
        { value: "kpis", label: "KPIs" },
        { value: "hours", label: "Weekly Hours" },
        { value: "tools", label: "Tools Required" },
        { value: "timeline", label: "Timeline & Onboarding" },
        { value: "outcomes", label: "90-Day Outcomes" },
        { value: "skills", label: "Skills Required" },
      ];
    }
    if (serviceType === "Unicorn VA Service") {
      return [
        ...commonAreas,
        { value: "role_title", label: "Core VA Role Title" },
        { value: "responsibilities", label: "Core Responsibilities" },
        { value: "kpis", label: "KPIs" },
        { value: "hours", label: "Weekly Hours" },
        { value: "tools", label: "Tools Required" },
        { value: "timeline", label: "Timeline & Onboarding" },
        { value: "team_support", label: "Team Support Areas" },
        { value: "outcomes", label: "90-Day Outcomes" },
        { value: "skills", label: "Skills Required" },
      ];
    }
    if (serviceType === "Projects on Demand") {
      return [
        ...commonAreas,
        { value: "projects", label: "Projects" },
        { value: "project_deliverables", label: "Project Deliverables" },
        { value: "project_timeline", label: "Project Timeline" },
        { value: "project_scope", label: "Project Scope" },
        { value: "project_skills", label: "Required Skills" },
        { value: "total_hours", label: "Total Hours" },
        { value: "project_sequence", label: "Project Sequence" },
      ];
    }

    return [
      ...commonAreas,
      { value: "role_title", label: "Role/Project Title" },
      { value: "responsibilities", label: "Responsibilities" },
      { value: "kpis", label: "KPIs" },
      { value: "hours", label: "Hours" },
      { value: "tools", label: "Tools Required" },
      { value: "timeline", label: "Timeline" },
    ];
  };

  const availableAreas = getAvailableAreas();

  const toggleArea = (area: string) => {
    setRefinementAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!feedback.trim()) {
      setStatus("error");
      setMessage("Please provide feedback about what you'd like to change.");
      return;
    }

    if (refinementAreas.length === 0) {
      setStatus("error");
      setMessage("Please select at least one area to refine.");
      return;
    }

    setIsSubmitting(true);
    setStatus("idle");
    setMessage("");

    try {
      const response = await fetch("/api/jd/refine", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId,
          userId,
          feedback,
          refinement_areas: refinementAreas,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.feedback_type === "spam" || data.feedback_type === "irrelevant") {
          setStatus("error");
          setMessage(data.message || "Invalid feedback provided");
        } else {
          throw new Error(data.error || "Refinement failed");
        }
        return;
      }

      if (data.status === "clarification_needed") {
        setStatus("clarification");
        setMessage(data.message);
        setClarificationQuestions(data.questions || []);
        return;
      }

      setStatus("success");
      setMessage(`Analysis refined successfully! (Iteration ${data.iteration})`);
      setChangesSummary(data.changes_made || []);
      onRefinementComplete(data.refined_package);

      setTimeout(() => {
        setFeedback("");
        setRefinementAreas([]);
        setStatus("idle");
        setChangesSummary([]);
      }, 3000);
    } catch (error) {
      console.error("Refinement error:", error);
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Failed to refine analysis"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const feedbackPlaceholder =
    serviceType === "Projects on Demand"
      ? "Example: The timeline for Project 1 feels aggressive. Extend to 4-5 weeks and include user testing documentation."
      : serviceType === "Unicorn VA Service"
        ? "Example: Hours feel low. Increase to ~35/week and add graphic design to team support."
        : "Example: Hours feel low for the listed responsibilities. Increase to ~35/week and add KPIs for social engagement.";

  const tipText =
    serviceType === "Projects on Demand"
      ? "Instead of “change the project”, try “Project 1 needs an SEO audit deliverable.”"
      : "Instead of “change the role”, try “Title should emphasize content strategy, not just social.”";

  return (
    <Card className="border-none shadow-none">
      <CardContent className="space-y-6 ">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">
            What would you like to change?
          </h2>
          <p className="text-sm text-muted-foreground">
            Be specific for best results. Select the areas you want to refine and
            share concise feedback.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="refinement-feedback">
              What would you like to change? <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="refinement-feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={feedbackPlaceholder}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">💡 Tip: {tipText}</p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Which sections should we update? <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {availableAreas.map((area) => {
                const selected = refinementAreas.includes(area.value);
                return (
                  <Button
                    key={area.value}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "justify-start whitespace-normal text-left min-h-10 leading-snug",
                      selected && "shadow-sm"
                    )}
                    aria-pressed={selected}
                    disabled={isSubmitting}
                    onClick={() => toggleArea(area.value)}
                  >
                    {area.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {status === "clarification" && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-900/20">
              <AlertTriangle className="text-amber-600" />
              <AlertTitle className="text-sm font-semibold">{message}</AlertTitle>
              <AlertDescription className="space-y-2">
                <ul className="space-y-2">
                  {clarificationQuestions.map((q: any, idx: number) => (
                    <li key={idx} className="text-sm">
                      <span className="font-medium">• {q.question}</span>
                      {q.why && (
                        <p className="text-xs text-muted-foreground mt-1 ml-4">
                          {q.why}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {status === "error" && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {status === "success" && (
            <Alert className="border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-900/20">
              <CheckCircle2 className="text-green-600" />
              <AlertTitle className="flex items-center gap-2">
                {message}
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100">
                  Updated
                </Badge>
              </AlertTitle>
              {changesSummary.length > 0 && (
                <AlertDescription className="space-y-2">
                  <p className="text-xs font-semibold text-green-800 dark:text-green-200">
                    Changes made
                  </p>
                  <ul className="space-y-1">
                    {changesSummary.map((change: any, idx: number) => (
                      <li key={idx} className="text-sm">
                        <span className="font-medium">{change.section}:</span>{" "}
                        {change.change_description}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              )}
            </Alert>
          )}

          <Separator />

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || !feedback.trim() || refinementAreas.length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" />
                Refining analysis...
              </>
            ) : (
              <>
                <MessageCircle />
                Refine analysis
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default RefinementForm;