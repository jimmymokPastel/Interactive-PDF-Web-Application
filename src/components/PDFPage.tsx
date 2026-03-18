"use client";

import dynamic from "next/dynamic";
import type { PDFViewerConfig } from "@/lib/pdf-interactions";

// Dynamically import the viewer to avoid SSR issues with pdfjs-dist
const InteractivePDFViewer = dynamic(
  () => import("@/components/InteractivePDFViewer"),
  { ssr: false }
);

/**
 * PDF interaction configuration.
 *
 * To reuse this viewer for a different PDF, update `src` and the `interactions`
 * array below — no changes to the viewer component itself are needed.
 */
const pdfConfig: PDFViewerConfig = {
  src: "/pdf/document.pdf",
  interactions: [
    // ------------------------------------------------------------------
    // 1. Clicking "optimistic" opens/closes an informational popup
    // ------------------------------------------------------------------
    {
      pattern: "optimistic",
      interaction: {
        type: "popup",
        content:
          "Optimistic: Hopeful and confident about the future. In scheduling, an optimistic estimate assumes everything goes to plan with minimal delays.",
      },
    },

    // ------------------------------------------------------------------
    // 2. Clicking "duration" opens/closes an informational popup
    // ------------------------------------------------------------------
    {
      pattern: "duration",
      interaction: {
        type: "popup",
        content:
          "Duration: The total time taken to complete an activity or task. In project management, duration is distinguished from effort (person-hours).",
      },
    },

    // ------------------------------------------------------------------
    // 3. Clicking "minute" or "minutes" opens a multiple-choice question.
    //    The answer is final once selected.
    // ------------------------------------------------------------------
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
  ],
};

export default function PDFPage() {
  return <InteractivePDFViewer config={pdfConfig} />;
}
