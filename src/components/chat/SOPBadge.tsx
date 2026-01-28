"use client";

import * as React from "react";
import { FileText, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SOPBadgeProps {
  sop: {
    sopHtml?: string;
    metadata?: {
      title?: string;
    };
  };
  onClick?: () => void;
  className?: string;
}

export function SOPBadge({ sop, onClick, className }: SOPBadgeProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const sopTitle = sop.metadata?.title || "Standard Operating Procedure";

  return (
    <Card className={cn("border border-border/50 shadow-sm", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-foreground" />
            <CardTitle className="text-sm font-semibold">
              Refining SOP
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-border">
              SOP
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
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0 space-y-2 pb-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Title</p>
            <p className="text-sm">{sopTitle}</p>
          </div>
          {onClick && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={onClick}
            >
              <ExternalLink className="h-3 w-3 mr-2" />
              View Full SOP
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
