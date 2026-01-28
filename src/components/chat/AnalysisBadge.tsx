"use client";

import * as React from "react";
import { FileText, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AnalysisBadgeProps {
  analysis: {
    preview?: {
      service_type?: string;
      role_title?: string;
      primary_outcome?: string;
    };
    full_package?: {
      service_structure?: {
        service_type?: string;
      };
    };
  };
  businessName?: string;
  onClick?: () => void;
  className?: string;
}

export function AnalysisBadge({ analysis, businessName, onClick, className }: AnalysisBadgeProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const serviceType = 
    analysis.preview?.service_type || 
    analysis.full_package?.service_structure?.service_type || 
    "Job Description Analysis";

  const roleTitle = analysis.preview?.role_title;
  const primaryOutcome = analysis.preview?.primary_outcome;

  return (
    <Card className={cn("border border-border/50 shadow-sm", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-foreground" />
            <CardTitle className="text-sm font-semibold">
              Refining Analysis
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-border">
              {serviceType}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        {businessName && (
          <p className="text-xs text-muted-foreground mt-1">
            {businessName}
          </p>
        )}
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0 space-y-2 pb-3">
          {roleTitle && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Role Title</p>
              <p className="text-sm">{roleTitle}</p>
            </div>
          )}
          {primaryOutcome && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Primary Outcome</p>
              <p className="text-sm">{primaryOutcome}</p>
            </div>
          )}
          {onClick && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={onClick}
            >
              <ExternalLink className="h-3 w-3 mr-2" />
              View Full Analysis
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
