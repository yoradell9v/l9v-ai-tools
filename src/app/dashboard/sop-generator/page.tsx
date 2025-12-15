"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { FileText, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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

export default function SopPage() {
  const { user } = useUser();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

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
                  setIsModalOpen(false);
                  setIsProcessing(true);
                  setStatusMessage("Processing your SOP...");

                  // TODO: Handle backend response when API is ready
                  // For now, just show success message
                  setTimeout(() => {
                    setIsProcessing(false);
                    toast.success("SOP generated successfully!");
                    // TODO: Navigate to SOP view page when ready
                    // router.push(`/dashboard/sop-generator/${sopId}`);
                  }, 1000);
                }}
                onProgress={(stage) => {
                  setStatusMessage(stage || "Generating SOP...");
                }}
                onSubmit={async (formData, uploadedFileUrls) => {
                  setStatusMessage("Generating your SOP...");

                  // TODO: Implement backend API call when ready
                  // For now, return mock success
                  return {
                    success: true,
                    message: "SOP generation initiated",
                    // sopId: "mock-id",
                  };
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