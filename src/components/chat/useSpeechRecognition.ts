import { useState, useEffect, useRef, useCallback } from "react";

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  onstart: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  autoStart?: boolean;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

interface UseSpeechRecognitionReturn {
  transcript: string;
  isRecording: boolean;
  isSupported: boolean;
  error: string | null;
  startRecording: () => void;
  stopRecording: () => void;
  abortRecording: () => void;
  clearTranscript: () => void;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const {
    lang = "en-US",
    continuous = true,
    interimResults = true,
    maxAlternatives = 1,
    onResult,
    onError,
  } = options;

  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const isManualStopRef = useRef(false);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  }, [onResult, onError]);

  // Check browser support
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const supported = !!SpeechRecognition;
    setIsSupported(supported);
  }, []);

  // Initialize recognition
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;
    recognition.maxAlternatives = maxAlternatives;

    recognition.onstart = () => {
      setIsRecording(true);
      setError(null);
      finalTranscriptRef.current = "";
      setTranscript("");
      isManualStopRef.current = false;
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Build complete transcript from all results
      // In continuous mode, results array contains ALL results from the start
      let finalText = "";
      let interimText = "";

      // Process all results to build the complete sentence
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        
        if (result.isFinal) {
          // Accumulate all final results
          finalText += text + " ";
        } else {
          // Current interim result (what's being spoken now)
          interimText += text;
        }
      }

      // Store final transcript
      finalTranscriptRef.current = finalText.trim();
      
      // Combine final + interim for display
      const fullText = (finalText + interimText).trim();
      
      // Update state - this will trigger re-render and callback
      setTranscript(fullText);

      // Call callback with full transcript
      if (onResultRef.current && fullText) {
        onResultRef.current(fullText, interimText === "");
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = "Speech recognition error occurred";

      switch (event.error) {
        case "no-speech":
          // Don't stop on no-speech in continuous mode
          return;
        case "audio-capture":
          errorMessage = "No microphone found or microphone is not accessible.";
          break;
        case "not-allowed":
          errorMessage = "Microphone permission denied. Please allow microphone access.";
          break;
        case "network":
          errorMessage = "Network error occurred. Please check your connection.";
          break;
        case "aborted":
          return;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }

      setError(errorMessage);
      setIsRecording(false);
      if (onErrorRef.current) {
        onErrorRef.current(errorMessage);
      }
    };

    recognition.onend = () => {
      if (isManualStopRef.current || !continuous) {
        setIsRecording(false);
        // Ensure final transcript is set
        if (finalTranscriptRef.current) {
          setTranscript(finalTranscriptRef.current);
        }
      } else if (continuous) {
        // Try to restart if ended unexpectedly
        setTimeout(() => {
          if (recognitionRef.current && !isManualStopRef.current) {
            try {
              recognitionRef.current.start();
            } catch (err) {
              setIsRecording(false);
            }
          }
        }, 100);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore cleanup errors
        }
        recognitionRef.current = null;
      }
    };
  }, [
    isSupported,
    lang,
    continuous,
    interimResults,
    maxAlternatives,
  ]);

  const startRecording = useCallback(() => {
    if (!isSupported || !recognitionRef.current || isRecording) {
      return;
    }

    try {
      setError(null);
      setTranscript("");
      finalTranscriptRef.current = "";
      isManualStopRef.current = false;
      recognitionRef.current.start();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to start recording";
      setError(errorMessage);
      setIsRecording(false);
      if (onErrorRef.current) {
        onErrorRef.current(errorMessage);
      }
    }
  }, [isSupported, isRecording]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      try {
        isManualStopRef.current = true;
        recognitionRef.current.stop();
        setIsRecording(false);
        // Ensure we have the final transcript
        if (finalTranscriptRef.current) {
          setTranscript(finalTranscriptRef.current);
        }
      } catch (err) {
        setIsRecording(false);
      }
    }
  }, [isRecording]);

  const abortRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      try {
        isManualStopRef.current = true;
        recognitionRef.current.abort();
        setTranscript("");
        finalTranscriptRef.current = "";
        setIsRecording(false);
      } catch (err) {
        setIsRecording(false);
      }
    }
  }, [isRecording]);

  const clearTranscript = useCallback(() => {
    setTranscript("");
    finalTranscriptRef.current = "";
  }, []);

  return {
    transcript,
    isRecording,
    isSupported,
    error,
    startRecording,
    stopRecording,
    abortRecording,
    clearTranscript,
  };
}
