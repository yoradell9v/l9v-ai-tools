"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { FileText, Plus, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import BaseIntakeForm from "@/components/forms/BaseIntakeForm";
import { sopGeneratorConfig } from "@/components/forms/configs/sopGeneratorConfig";
import { useUser } from "@/context/UserContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface GeneratedSOP {
  sop: string;
  metadata: {
    title: string;
    generatedAt: string;
    tokens: {
      prompt: number;
      completion: number;
      total: number;
    };
    organizationProfileUsed: boolean;
  };
}

export default function SopPage() {
  const { user } = useUser();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [generatedSOP, setGeneratedSOP] = useState<GeneratedSOP | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <div className="flex items-center gap-2 p-4 border-b">
        <SidebarTrigger />
      </div>
      <div className="transition-all duration-300 ease-in-out min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold">SOP Builder AI</h1>
                <p className="text-sm text-muted-foreground">
                  Automatically generate standard operating procedures for your business
                </p>
              </div>
              <Button onClick={() => setIsModalOpen(true)} className="sm:self-start">
                <Plus className="h-4 w-4 mr-2" />
                <span>Generate SOP</span>
              </Button>
            </div>
          </div>

          {isProcessing && (
            <Card>
              <CardContent className="flex items-center gap-3 py-4">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <p className="text-sm font-medium">
                  {statusMessage || "Processing your SOP..."}
                </p>
              </CardContent>
            </Card>
          )}

          {error && !isProcessing && (
            <Card className="border-destructive/30 bg-destructive/10">
              <CardContent className="py-4">
                <p className="text-sm text-destructive">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setError(null);
                    setIsModalOpen(true);
                  }}
                >
                  Try Again
                </Button>
              </CardContent>
            </Card>
          )}

          {generatedSOP && !isProcessing && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      {generatedSOP.metadata.title}
                    </CardTitle>
                    <CardDescription>
                      Generated on {new Date(generatedSOP.metadata.generatedAt).toLocaleString()}
                      {generatedSOP.metadata.organizationProfileUsed && (
                        <span className="ml-2">• Using organization profile</span>
                      )}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setIsModalOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Generate New SOP
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ node, ...props }) => (
                        <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0" {...props} />
                      ),
                      h2: ({ node, ...props }) => (
                        <h2 className="text-xl font-semibold mb-3 mt-5 first:mt-0" {...props} />
                      ),
                      h3: ({ node, ...props }) => (
                        <h3 className="text-lg font-semibold mb-2 mt-4 first:mt-0" {...props} />
                      ),
                      p: ({ node, ...props }) => (
                        <p className="mb-3 leading-relaxed last:mb-0" {...props} />
                      ),
                      strong: ({ node, ...props }) => (
                        <strong className="font-semibold" {...props} />
                      ),
                      ul: ({ node, ...props }: any) => (
                        <ul className="mb-3 ml-6 list-disc space-y-1 last:mb-0" {...props} />
                      ),
                      ol: ({ node, ...props }: any) => (
                        <ol className="mb-3 ml-6 list-decimal space-y-1 last:mb-0" {...props} />
                      ),
                      li: ({ node, ...props }) => (
                        <li className="leading-relaxed" {...props} />
                      ),
                    }}
                  >
                    {generatedSOP.sop}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}

          {!generatedSOP && !isProcessing && !error && (
            <Card className="text-center">
              <CardContent className="py-12 space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">No SOPs Generated Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Create your first Standard Operating Procedure to get started
                  </p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Generate Your First SOP
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {user && (
        <Dialog open={isModalOpen} onOpenChange={(open) => !isProcessing && setIsModalOpen(open)}>
          <DialogContent className="w-[min(900px,95vw)] sm:max-w-3xl max-h-[90vh] overflow-hidden p-0 sm:p-2">

            <DialogHeader className="px-4 pt-4 pb-2">
              <DialogTitle >Generate SOP</DialogTitle>
              <DialogDescription>
                Fill out the details below and the AI will generate a clear, detailed SOP for your process.
              </DialogDescription>
            </DialogHeader>
            <div className="px-4 pb-4">
              <BaseIntakeForm
                userId={user.id}
                config={sopGeneratorConfig}
                onClose={() => {
                  if (!isProcessing) {
                    setIsModalOpen(false);
                  }
                }}
                onSuccess={async (data) => {
                  // Success is handled in onSubmit
                }}
                onProgress={(stage) => {
                  setStatusMessage(stage || "Generating SOP...");
                }}
                onSubmit={async (formData, uploadedFileUrls) => {
                  setIsProcessing(true);
                  setStatusMessage("Generating your SOP...");
                  setError(null);

                  try {
                    const response = await fetch("/api/sop/generate", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      credentials: "include",
                      body: JSON.stringify(formData),
                    });

                    const result = await response.json();

                    if (!response.ok || !result.success) {
                      throw new Error(result.message || "Failed to generate SOP");
                    }


                    setGeneratedSOP({
                      sop: result.sop,
                      metadata: result.metadata,
                    });

                    setIsModalOpen(false);
                    setIsProcessing(false);
                    toast.success("SOP generated successfully!", {
                      description: `Your SOP "${result.metadata.title}" has been created.`,
                    });

                    return {
                      success: true,
                      message: "SOP generated successfully",
                    };
                  } catch (error: any) {
                    console.error("SOP generation error:", error);
                    setIsProcessing(false);
                    const errorMessage = error.message || "Failed to generate SOP";
                    setError(errorMessage);
                    toast.error("Failed to generate SOP", {
                      description: errorMessage,
                    });
                    throw error;
                  }
                }}
                onError={(error) => {
                  console.error("SOP generation error:", error);
                  toast.error(error || "Failed to generate SOP");
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}