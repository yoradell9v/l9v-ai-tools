/**
 * Utility function to copy text to clipboard
 * @param text - The text to copy
 * @param onSuccess - Optional callback when copy succeeds
 * @param onError - Optional callback when copy fails
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function copyToClipboard(
  text: string,
  onSuccess?: () => void,
  onError?: (error: Error) => void
): Promise<boolean> {
  try {
    // Use the modern Clipboard API if available
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      onSuccess?.();
      return true;
    } else {
      // Fallback for older browsers or non-secure contexts
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        
        if (successful) {
          onSuccess?.();
          return true;
        } else {
          throw new Error("Copy command failed");
        }
      } catch (err) {
        document.body.removeChild(textArea);
        throw err;
      }
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Failed to copy to clipboard");
    onError?.(err);
    return false;
  }
}
