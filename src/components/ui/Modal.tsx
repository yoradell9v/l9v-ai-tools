"use client";

import { Fragment, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string | ReactNode;
  message?: string;
  body?: ReactNode | string;
  confirmText?: string | ReactNode;
  cancelText?: string;
  confirmVariant?: "primary" | "danger";
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "7xl";
  isSubmitting?: boolean;
};

export default function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  body,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "primary",
  maxWidth = "md",
  isSubmitting = false,
}: ModalProps) {
  const maxWidthClasses: Record<"sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "7xl", string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "4xl": "max-w-4xl",
    "7xl": "max-w-7xl",
  };
  if (!isOpen) return null;

  const confirmButtonClasses =
    confirmVariant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "text-white bg-[var(--primary)] dark:bg-[var(--accent)] hover:brightness-110 ";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`relative rounded-lg border ${maxWidthClasses[maxWidth]} w-full max-h-[calc(100vh-2rem)] flex flex-col pointer-events-auto bg-[var(--card-bg)] border-[var(--border-color)] shadow-lg`}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div className="flex-1 flex flex-col overflow-hidden p-8">
                {/* Title */}
                {title && (
                  <div className="mb-2">
                    {typeof title === "string" ? (
                      <h3 className="text-xl font-semibold text-[var(--primary)] dark:text-[var(--accent)]">
                        {title}
                      </h3>
                    ) : (
                      title
                    )}
                  </div>
                )}

                {/* Message */}
                {message && (
                  <p className="text-xs sm:text-sm leading-relaxed mb-3 sm:mb-4 text-[var(--text-secondary)]">
                    {message}
                  </p>
                )}

                {/* Body */}
                {body && (
                  <div className="flex-1 min-h-0 mb-4 sm:mb-6 overflow-y-auto">
                    {typeof body === "string" ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: body }}
                        className="text-sm"
                      />
                    ) : (
                      body // React component
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t sm:border-t-0 sm:pt-0 border-[var(--border-color)]">
                  {cancelText && (
                    <button
                      onClick={onClose}
                      className="px-4 py-2.5 sm:py-2 text-sm font-medium transition-colors duration-200 rounded-lg bg-[var(--hover-bg)] text-[var(--text-primary)] hover:brightness-95"
                    >
                      {cancelText}
                    </button>
                  )}

                  {confirmText && (
                    <button
                      onClick={onConfirm}
                      disabled={isSubmitting}
                      className={`px-4 py-2.5 sm:py-2 text-sm font-medium rounded-lg transition-all duration-200 ${confirmButtonClasses} ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                    >
                      {confirmText}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
