"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import type { PDFViewerConfig, WordInteraction, ChoiceOption } from "@/lib/pdf-interactions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
  hasEOL: boolean;
}

interface RenderedPage {
  pageNum: number;
  canvasDataUrl: string;
  width: number;
  height: number;
  textItems: TextItem[];
  viewport: { width: number; height: number; scale: number };
}

interface InteractiveRegion {
  pageNum: number;
  x: number; // percentage of page width
  y: number; // percentage of page height
  w: number; // percentage of page width
  h: number; // percentage of page height
  interactionIndex: number;
  matchedText: string;
}

interface PopupState {
  open: boolean;
  regionKey: string;
}

interface ChoiceState {
  selected: string | null;
  locked: boolean;
}

// ---------------------------------------------------------------------------
// Helper: Find matching text items in a page
// ---------------------------------------------------------------------------
function findTextMatches(
  textItems: TextItem[],
  interaction: WordInteraction,
  pageViewport: { width: number; height: number; scale: number }
): Array<{ x: number; y: number; w: number; h: number; text: string }> {
  const results: Array<{ x: number; y: number; w: number; h: number; text: string }> = [];
  const pattern = interaction.pattern;

  for (const item of textItems) {
    if (!item.str.trim()) continue;

    // Build a regex that captures the match position within the item string
    let re: RegExp;
    if (typeof pattern === "string") {
      re = new RegExp(`\\b${escapeRegex(pattern)}\\b`, "gi");
    } else {
      // Ensure global flag so we can iterate all occurrences
      const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
      re = new RegExp(pattern.source, flags);
    }

    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(item.str)) !== null) {
      const matchStart = m.index;
      const matchLen = m[0].length;
      const itemLen = item.str.length;

      // PDF transform matrix: [a, b, c, d, e, f]
      const [a, , , d, tx, ty] = item.transform;
      const itemHeight = item.height > 0 ? item.height : Math.abs(d) || Math.abs(a);
      const itemWidth = item.width > 0 ? item.width : 0;

      // Approximate x-offset and width of the matched substring using
      // character-position ratio (assumes uniform character spacing — good
      // enough for proportional fonts at this highlight granularity).
      const charRatioStart = itemLen > 0 ? matchStart / itemLen : 0;
      const charRatioLen = itemLen > 0 ? matchLen / itemLen : 1;
      const matchPdfX = tx + itemWidth * charRatioStart;
      const matchPdfW = itemWidth * charRatioLen;

      // Convert from PDF space (bottom-left origin) to canvas space (top-left origin)
      const scale = pageViewport.scale;
      const canvasX = matchPdfX * scale;
      const canvasY = pageViewport.height - (ty + itemHeight) * scale;
      const canvasW = matchPdfW * scale;
      const canvasH = itemHeight * scale;

      results.push({
        x: (canvasX / pageViewport.width) * 100,
        y: (canvasY / pageViewport.height) * 100,
        w: Math.max((canvasW / pageViewport.width) * 100, 2),
        h: Math.max((canvasH / pageViewport.height) * 100, 1.5),
        text: m[0],
      });
    }
  }

  return results;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Sub-component: Popup overlay
// ---------------------------------------------------------------------------
function PopupOverlay({
  content,
  onClose,
}: {
  content: string;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute z-30 bg-white border border-gray-300 rounded shadow-lg p-3 text-sm max-w-xs"
      style={{ bottom: "110%", left: "50%", transform: "translateX(-50%)", minWidth: 180 }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="absolute top-1 right-1 text-gray-400 hover:text-gray-700 text-xs font-bold"
        onClick={onClose}
        aria-label="Close popup"
      >
        ✕
      </button>
      <p className="text-gray-800 pr-4">{content}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function InteractivePDFViewer({ config }: { config: PDFViewerConfig }) {
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [regions, setRegions] = useState<InteractiveRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [popupStates, setPopupStates] = useState<Record<string, PopupState>>({});
  const [choiceStates, setChoiceStates] = useState<Record<string, ChoiceState>>({});
  const renderInProgress = useRef(false);

  const renderPDF = useCallback(async () => {
    if (renderInProgress.current) return;
    renderInProgress.current = true;
    setLoading(true);
    setError(null);
    // Clear previous interaction state for the new document
    setPopupStates({});
    setChoiceStates({});

    try {
      const pdfjs = await import("pdfjs-dist");
      // Use a static public path so Turbopack/webpack don't need to bundle the worker.
      // The file is copied to public/pdf.worker.min.mjs at build time.
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      // pdfjs accepts a string URL or a typed-array/ArrayBuffer via `data`
      const src = config.src;
      const loadingTask =
        typeof src === "string"
          ? pdfjs.getDocument(src)
          : pdfjs.getDocument({ data: new Uint8Array(src) });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;

      const renderedPages: RenderedPage[] = [];
      const allRegions: InteractiveRegion[] = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const scale = 1.8;
        const viewport = page.getViewport({ scale });

        // Render to canvas
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL("image/png");

        // Get text content
        const textContent = await page.getTextContent();
        const textItems = textContent.items as TextItem[];

        const pageViewport = {
          width: viewport.width,
          height: viewport.height,
          scale,
        };

        renderedPages.push({
          pageNum,
          canvasDataUrl: dataUrl,
          width: viewport.width,
          height: viewport.height,
          textItems,
          viewport: pageViewport,
        });

        // Find interactive regions for this page
        config.interactions.forEach((interaction, idx) => {
          const matches = findTextMatches(textItems, interaction, pageViewport);
          matches.forEach((match) => {
            allRegions.push({
              pageNum,
              x: match.x,
              y: match.y,
              w: match.w,
              h: match.h,
              interactionIndex: idx,
              matchedText: match.text,
            });
          });
        });
      }

      setPages(renderedPages);
      setRegions(allRegions);
    } catch (err) {
      console.error("PDF render error:", err);
      setError(err instanceof Error ? err.message : "Failed to load PDF.");
    } finally {
      setLoading(false);
      renderInProgress.current = false;
    }
  }, [config]);

  useEffect(() => {
    renderPDF();
  }, [renderPDF]);

  const getRegionKey = (region: InteractiveRegion, matchIndex: number) =>
    `p${region.pageNum}-i${region.interactionIndex}-m${matchIndex}`;

  const closeAllPopups = useCallback(() => {
    setPopupStates((prev) => {
      const next: Record<string, PopupState> = {};
      for (const k of Object.keys(prev)) {
        next[k] = { ...prev[k], open: false };
      }
      return next;
    });
  }, []);

  const handleRegionClick = (region: InteractiveRegion, regionKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Only popup interactions use a click-to-toggle highlight
    if (config.interactions[region.interactionIndex].interaction.type !== "popup") return;
    const isOpen = !!popupStates[regionKey]?.open;
    // Close all others, then toggle this one
    setPopupStates((prev) => {
      const next: Record<string, PopupState> = {};
      for (const k of Object.keys(prev)) {
        next[k] = { ...prev[k], open: false };
      }
      next[regionKey] = { open: !isOpen, regionKey };
      return next;
    });
  };

  const handleChoiceSelect = (regionKey: string, label: string, interactionIndex: number) => {
    // Lock ALL choice regions with the same interaction index (same question type)
    // Extract all region keys that match this interaction
    const keysToLock: string[] = [];
    regions.forEach((r, idx) => {
      if (r.interactionIndex === interactionIndex) {
        // Rebuild the key using same logic as getRegionKey
        const pageRegions = regions.filter((pr) => pr.pageNum === r.pageNum);
        const matchIndex = pageRegions.indexOf(r);
        keysToLock.push(`p${r.pageNum}-i${r.interactionIndex}-m${matchIndex}`);
      }
    });

    setChoiceStates((prev) => {
      const next = { ...prev };
      for (const key of keysToLock) {
        next[key] = { selected: label, locked: true };
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading PDF…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white rounded shadow p-6 max-w-md text-center">
          <p className="text-red-600 font-semibold mb-2">Error loading PDF</p>
          <p className="text-gray-600 text-sm">{error}</p>
          <p className="text-gray-400 text-xs mt-2">
            Make sure the PDF is placed at <code>public/pdf/document.pdf</code>
          </p>
        </div>
      </div>
    );
  }

  // Group regions by page for rendering
  const regionsByPage: Record<number, Array<{ region: InteractiveRegion; key: string }>> = {};
  let globalMatchIndex = 0;
  for (const region of regions) {
    if (!regionsByPage[region.pageNum]) regionsByPage[region.pageNum] = [];
    regionsByPage[region.pageNum].push({
      region,
      key: getRegionKey(region, globalMatchIndex++),
    });
  }

  return (
    <div className="flex flex-col items-center bg-gray-200 min-h-screen py-6 px-2" onClick={closeAllPopups}>
      <div className="w-full max-w-4xl">
        {pages.map((page) => (
          <div key={page.pageNum} className="relative mb-6 shadow-xl" style={{ lineHeight: 0 }}>
            {/* PDF canvas image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={page.canvasDataUrl}
              alt={`Page ${page.pageNum}`}
              className="w-full block"
              draggable={false}
            />

            {/* Interactive regions overlay */}
            {(regionsByPage[page.pageNum] ?? []).map(({ region, key }) => {
              const interaction = config.interactions[region.interactionIndex];
              const isChoice = interaction.interaction.type === "choice";
              const isPopupOpen = !!popupStates[key]?.open;
              const choiceState = choiceStates[key] ?? { selected: null, locked: false };
              const isLocked = choiceState.locked;

              if (isChoice) {
                // Choice: clickable highlight on the word. Click to select answer.
                const choiceInteraction = interaction.interaction as {
                  type: "choice";
                  options: ChoiceOption[];
                  feedbackCorrect?: string;
                  feedbackIncorrect?: string;
                };
                const selectedOption = choiceInteraction.options.find(
                  (o) => o.label.toLowerCase() === region.matchedText.toLowerCase()
                );
                const isCorrect = selectedOption?.correct ?? false;

                // When locked, hide the highlight and show only the badge
                const showHighlight = !isLocked;

                return (
                  <div
                    key={key}
                    className="absolute"
                    style={{
                      left: `${region.x}%`,
                      top: `${region.y}%`,
                      width: `${region.w}%`,
                      height: `${region.h}%`,
                      minWidth: 24,
                      minHeight: 16,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isLocked) {
                        handleChoiceSelect(key, region.matchedText, region.interactionIndex);
                      }
                    }}
                    title={isLocked ? undefined : "Click to select answer"}
                  >
                    {showHighlight && (
                      <div className="w-full h-full cursor-pointer rounded-sm bg-yellow-200/60 border border-yellow-400 hover:bg-yellow-300/70 transition-colors" />
                    )}
                    {isLocked && (
                      <span
                        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-xs font-bold rounded-full text-white ${
                          isCorrect ? "bg-green-500" : "bg-red-500"
                        }`}
                      >
                        {isCorrect ? "✓" : "✗"}
                      </span>
                    )}
                  </div>
                );
              }

              // Popup: keep the clickable highlight + floating popup behaviour
              return (
                <div
                  key={key}
                  className="absolute"
                  style={{
                    left: `${region.x}%`,
                    top: `${region.y}%`,
                    width: `${region.w}%`,
                    height: `${region.h}%`,
                    minWidth: 24,
                    minHeight: 16,
                  }}
                >
                  <div
                    className={`
                      w-full h-full cursor-pointer rounded-sm transition-colors
                      ${isPopupOpen
                        ? "bg-blue-300/40 border border-blue-500"
                        : "bg-blue-200/40 border border-blue-400 hover:bg-blue-300/50"
                      }
                    `}
                    onClick={(e) => handleRegionClick(region, key, e)}
                    title={isPopupOpen ? "Click to close" : "Click for more info"}
                  />
                  {isPopupOpen && (
                    <PopupOverlay
                      content={(interaction.interaction as { type: "popup"; content: string }).content}
                      onClose={() =>
                        setPopupStates((prev) => ({
                          ...prev,
                          [key]: { open: false, regionKey: key },
                        }))
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
