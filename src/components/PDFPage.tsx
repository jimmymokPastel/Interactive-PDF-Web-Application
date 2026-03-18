"use client";

import dynamic from "next/dynamic";
import React, { useCallback, useRef, useState } from "react";
import type { PDFViewerConfig } from "@/lib/pdf-interactions";

// Dynamically import to avoid SSR issues with pdfjs-dist
const InteractivePDFViewer = dynamic(
  () => import("@/components/InteractivePDFViewer"),
  { ssr: false }
);

/**
 * Predefined interaction behaviours (unchanged from the original spec).
 * The `src` field is injected at runtime once the user loads a file.
 */
const INTERACTIONS: PDFViewerConfig["interactions"] = [
  {
    pattern: "optimistic",
    interaction: {
      type: "popup",
      content:
        "Optimistic: Hopeful and confident about the future. In scheduling, an optimistic estimate assumes everything goes to plan with minimal delays.",
    },
  },
  {
    pattern: "duration",
    interaction: {
      type: "popup",
      content:
        "Duration: The total time taken to complete an activity or task. In project management, duration is distinguished from effort (person-hours).",
    },
  },
  {
    pattern: /\bminutes?\b/i,
    interaction: {
      type: "choice",
      options: [
        { label: "minute", correct: false },
        { label: "minutes", correct: true },
        { label: "hour", correct: false },
        { label: "hours", correct: false },
      ],
      feedbackCorrect: "Correct! 'minutes' is the right answer.",
      feedbackIncorrect: "Incorrect. The correct answer is 'minutes'.",
    },
  },
];

// ---------------------------------------------------------------------------
// Drop-zone / import UI
// ---------------------------------------------------------------------------
function ImportScreen({
  onFile,
}: {
  onFile: (buf: ArrayBuffer, name: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(
    (file: File) => {
      if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
        setError("Only PDF files are supported.");
        return;
      }
      setError(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result instanceof ArrayBuffer) {
          onFile(e.target.result, file.name);
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [onFile]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset so the same file can be re-selected
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            Interactive PDF Viewer
          </h1>
          <p className="text-gray-500 text-sm">
            Import a PDF to begin. Interactive words will be highlighted
            automatically.
          </p>
        </div>

        {/* Drop zone */}
        <div
          className={`
            relative flex flex-col items-center justify-center gap-4
            rounded-xl border-2 border-dashed p-12 text-center
            cursor-pointer select-none transition-colors
            ${
              dragging
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/30"
            }
          `}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          aria-label="Import PDF"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
        >
          {/* PDF icon */}
          <svg
            className={`w-14 h-14 transition-colors ${
              dragging ? "text-blue-500" : "text-gray-400"
            }`}
            fill="none"
            viewBox="0 0 48 48"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <rect x="8" y="4" width="28" height="36" rx="3" className="fill-gray-100 stroke-current" />
            <path d="M28 4v10h8" strokeLinecap="round" strokeLinejoin="round" />
            <path
              d="M14 22h12M14 27h8"
              strokeLinecap="round"
            />
            <rect x="10" y="31" width="14" height="8" rx="1.5" className="fill-red-500 stroke-none" />
            <text
              x="17"
              y="38"
              fontSize="5"
              fontWeight="bold"
              fill="white"
              textAnchor="middle"
              stroke="none"
            >
              PDF
            </text>
          </svg>

          <div>
            <p className="font-semibold text-gray-700">
              {dragging ? "Drop your PDF here" : "Drag & drop a PDF here"}
            </p>
            <p className="text-sm text-gray-400 mt-1">or click to browse</p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={handleInputChange}
          />
        </div>

        {error && (
          <p className="mt-3 text-center text-sm text-red-600">{error}</p>
        )}

        <p className="mt-4 text-center text-xs text-gray-400">
          The file is processed entirely in your browser — nothing is uploaded.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------
export default function PDFPage() {
  const [pdfSource, setPdfSource] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback((buf: ArrayBuffer, name: string) => {
    setPdfSource(buf);
    setFileName(name);
  }, []);

  const handleReset = useCallback(() => {
    setPdfSource(null);
    setFileName(null);
  }, []);

  if (!pdfSource) {
    return <ImportScreen onFile={handleFile} />;
  }

  const config: PDFViewerConfig = {
    src: pdfSource,
    interactions: INTERACTIONS,
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-white border-b border-gray-200 px-4 py-2 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <svg
            className="w-5 h-5 shrink-0 text-red-500"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7.414A2 2 0 0017.414 6L14 2.586A2 2 0 0012.586 2H4zm2 10a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1-4a1 1 0 000 2h4a1 1 0 000-2H7z"
              clipRule="evenodd"
            />
          </svg>
          <span
            className="text-sm font-medium text-gray-700 truncate max-w-xs"
            title={fileName ?? undefined}
          >
            {fileName}
          </span>
        </div>
        <button
          onClick={handleReset}
          className="shrink-0 flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          Import another PDF
        </button>
      </div>

      <InteractivePDFViewer config={config} />
    </div>
  );
}
