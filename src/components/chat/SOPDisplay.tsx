"use client";

import * as React from "react";
import { FileText, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SOPDisplayProps {
  sop: {
    sopHtml?: string;
    sopMarkdown?: string;
    metadata?: {
      title?: string;
      tokens?: {
        prompt?: number;
        completion?: number;
        total?: number;
      };
    };
  };
  onApply?: () => void;
  className?: string;
}

export function SOPDisplay({ sop, onApply, className }: SOPDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(true); // Start expanded to show full content
  const [isApplying, setIsApplying] = useState(false);
  
  const sopTitle = sop.metadata?.title || "Standard Operating Procedure";
  const sopHtml = sop.sopHtml || "";
  
  // Extract a preview from the HTML (first few sections)
  const [preview, setPreview] = React.useState<string>("");
  
  React.useEffect(() => {
    if (!sopHtml || typeof window === "undefined") {
      setPreview("");
      return;
    }
    
    // Try to extract first heading and a few paragraphs
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = sopHtml;
    
    const headings = tempDiv.querySelectorAll("h1, h2, h3");
    const firstHeading = headings[0]?.textContent || "";
    
    const paragraphs = tempDiv.querySelectorAll("p");
    const previewText = Array.from(paragraphs)
      .slice(0, 3)
      .map(p => p.textContent)
      .filter(Boolean)
      .join(" ");
    
    const extractedPreview = firstHeading 
      ? `${firstHeading}\n\n${previewText.substring(0, 200)}...` 
      : previewText.substring(0, 300);
    
    setPreview(extractedPreview);
  }, [sopHtml]);

  return (
    <div className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm bg-muted text-foreground space-y-4 break-words", className)}>
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-semibold text-base">{sopTitle}</span>
        </div>
      </div>

      {/* Preview */}
      {preview && !isExpanded && (
        <div className="overflow-hidden">
          <div className="text-sm whitespace-pre-wrap leading-relaxed line-clamp-6 break-words">
            {preview}
          </div>
        </div>
      )}

      {/* Full SOP Content */}
      {isExpanded && sopHtml && (
        <div 
          className="w-full overflow-y-auto"
          style={{ 
            maxHeight: "400px",
            wordBreak: "break-word",
            overflowWrap: "break-word",
          }}
        >
          <div 
            className="prose prose-sm max-w-none dark:prose-invert break-words [&_table]:block [&_table]:overflow-x-auto [&_table]:whitespace-nowrap [&_pre]:break-words [&_pre]:whitespace-pre-wrap [&_*]:max-w-full"
            style={{ 
              wordBreak: "break-word",
              overflowWrap: "break-word",
              maxWidth: "100%",
            }}
            dangerouslySetInnerHTML={{ __html: sopHtml }}
          />
        </div>
      )}

      {/* Expand/Collapse Button */}
      {sopHtml && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-between h-8 text-xs"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span>{isExpanded ? "Hide" : "View"} Full SOP</span>
          {isExpanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </Button>
      )}

      {/* View on Page Button */}
      {onApply && (
        <div className="pt-2 border-t">
          <Button 
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onApply && !isApplying) {
                setIsApplying(true);
                try {
                  await onApply();
                } catch (error) {
                  console.error("Error applying SOP:", error);
                } finally {
                  setIsApplying(false);
                }
              }
            }} 
            className="w-full"
            size="sm"
            disabled={isApplying}
          >
            {isApplying ? "Applying..." : "View on Page"}
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            This will display the SOP on the main page. You can continue chatting to make edits.
          </p>
        </div>
      )}
    </div>
  );
}
