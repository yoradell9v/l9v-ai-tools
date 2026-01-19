import { prisma } from "@/lib/core/prisma";
import { extractFromFile, ExtractedFileContent } from "@/lib/extraction/extract-content";
import { mapInsightsToFields } from "@/lib/extraction/document-field-mapping";
import { applyInsightsToKnowledgeBase } from "@/lib/knowledge-base/knowledge-base-applicator";

export async function processDocumentExtraction(documentId: string): Promise<void> {
  try {
    await prisma.organizationDocument.update({
      where: { id: documentId },
      data: { extractionStatus: "PROCESSING" },
    });

    const document = await prisma.organizationDocument.findUnique({
      where: { id: documentId },
      include: {
        knowledgeBase: true,
      },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    let extractedContent: ExtractedFileContent;
    try {
      extractedContent = await extractFromFile(
        document.url,
        document.name,
        document.type,
        document.key,
        true 
      );
    } catch (error) {
      console.error(`Error extracting content from ${document.name}:`, error);
      await prisma.organizationDocument.update({
        where: { id: documentId },
        data: {
          extractionStatus: "FAILED",
          extractionError: error instanceof Error ? error.message : "Unknown extraction error",
        },
      });
      return;
    }

    await prisma.organizationDocument.update({
      where: { id: documentId },
      data: {
        extractedContent: extractedContent as any,
        extractedAt: new Date(),
      },
    });

    const fieldMappings = await mapInsightsToFields(
      extractedContent,
      document.knowledgeBase
    );

    await applyInsightsToKnowledgeBase(
      document.knowledgeBase.id,
      documentId,
      document.uploadedBy,
      fieldMappings,
      extractedContent
    );

    await prisma.organizationDocument.update({
      where: { id: documentId },
      data: { extractionStatus: "COMPLETED" },
    });
  } catch (error) {
    console.error(`Error processing document extraction for ${documentId}:`, error);
    await prisma.organizationDocument.update({
      where: { id: documentId },
      data: {
        extractionStatus: "FAILED",
        extractionError: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

