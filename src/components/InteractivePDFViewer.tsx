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

    let matches = false;
    let matchedText = item.str;

    if (typeof pattern === "string") {
      // Case-insensitive whole-word match
      const re = new RegExp(`\\b${escapeRegex(pattern)}\\b`, "i");
      matches = re.test(item.str);
      matchedText = item.str;
    } else {
      // Reset lastIndex for stateful regexes (global/sticky flags)
      if (pattern.global || pattern.sticky) pattern.lastIndex = 0;
      matches = pattern.test(item.str);
      matchedText = item.str;
    }

    if (matches) {
      // PDF transform matrix: [a, b, c, d, e, f]
      // e = x translation, f = y translation (PDF coords, origin bottom-left)
      // a/d = scale factors (font size can be derived from |d|)
      const [a, , , d, tx, ty] = item.transform;
      // Use the item's actual height if available, fall back to |d| (font size)
      const itemHeight = item.height > 0 ? item.height : Math.abs(d) || Math.abs(a);
      const itemWidth = item.width > 0 ? item.width : 0;

      // Convert from PDF space (bottom-left origin) to canvas space (top-left origin)
      const scale = pageViewport.scale;
      const canvasX = tx * scale;
      // ty is the baseline in PDF coords; subtract itemHeight to get top of glyph
      const canvasY = pageViewport.height - (ty + itemHeight) * scale;
      const canvasW = itemWidth * scale;
      const canvasH = itemHeight * scale;

      results.push({
        x: (canvasX / pageViewport.width) * 100,
        y: (canvasY / pageViewport.height) * 100,
        w: Math.max((canvasW / pageViewport.width) * 100, 3),
        h: Math.max((canvasH / pageViewport.height) * 100, 1.5),
        text: matchedText,
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
// Sub-component: Choice overlay
// ---------------------------------------------------------------------------
function ChoiceOverlay({
  options,
  state,
  onSelect,
  feedbackCorrect,
  feedbackIncorrect,
}: {
  options: ChoiceOption[];
  state: ChoiceState;
  onSelect: (label: string) => void;
  feedbackCorrect?: string;
  feedbackIncorrect?: string;
}) {
  const selectedOption = options.find((o) => o.label === state.selected);
  const isCorrect = selectedOption?.correct ?? false;

  return (
    <div
      className="absolute z-30 bg-white border border-gray-300 rounded shadow-lg p-3 text-sm"
      style={{ bottom: "110%", left: "50%", transform: "translateX(-50%)", minWidth: 200 }}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="font-semibold text-gray-700 mb-2">Select the correct word:</p>
      <div className="flex flex-col gap-1">
        {options.map((opt) => {
          const isSelected = state.selected === opt.label;
          let btnClass =
            "px-3 py-1 rounded border text-left transition-colors font-medium ";

          if (state.locked && isSelected) {
            btnClass += opt.correct
              ? "bg-green-100 border-green-500 text-green-800"
              : "bg-red-100 border-red-500 text-red-800";
          } else if (state.locked && opt.correct) {
            btnClass += "bg-green-50 border-green-400 text-green-700";
          } else {
            btnClass += "bg-gray-50 border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-400";
          }

          return (
            <button
              key={opt.label}
              className={btnClass}
              onClick={() => !state.locked && onSelect(opt.label)}
              disabled={state.locked}
            >
              {state.locked && isSelected && (
                <span className="mr-1">{opt.correct ? "✓" : "✗"}</span>
              )}
              {state.locked && !isSelected && opt.correct && (
                <span className="mr-1 text-green-600">✓</span>
              )}
              {opt.label}
            </button>
          );
        })}
      </div>
      {state.locked && state.selected && (
        <div
          className={`mt-2 text-xs font-semibold px-2 py-1 rounded ${
            isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}
        >
          {isCorrect
            ? (feedbackCorrect ?? "Correct!")
            : (feedbackIncorrect ?? "Incorrect — the correct answer is highlighted.")}
        </div>
      )}
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

  const handleRegionClick = (region: InteractiveRegion, regionKey: string) => {
    const interaction = config.interactions[region.interactionIndex];

    if (interaction.interaction.type === "popup") {
      // Toggle popup open/closed
      setPopupStates((prev) => ({
        ...prev,
        [regionKey]: {
          open: !prev[regionKey]?.open,
          regionKey,
        },
      }));
    } else if (interaction.interaction.type === "choice") {
      // If already locked (answer selected), do nothing — choice is final
      if (choiceStates[regionKey]?.locked) return;
      // Otherwise toggle the choice panel open/closed
      setPopupStates((prev) => ({
        ...prev,
        [regionKey]: {
          open: !prev[regionKey]?.open,
          regionKey,
        },
      }));
    }
  };

  const handleChoiceSelect = (regionKey: string, label: string) => {
    // Lock the answer — it cannot be changed
    setChoiceStates((prev) => ({
      ...prev,
      [regionKey]: { selected: label, locked: true },
    }));
    // Keep the panel visible so user can see the result
    setPopupStates((prev) => ({
      ...prev,
      [regionKey]: { open: true, regionKey },
    }));
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
    <div className="flex flex-col items-center bg-gray-200 min-h-screen py-6 px-2">
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
                  {/* Clickable highlight */}
                  <div
                    className={`
                      w-full h-full cursor-pointer rounded-sm
                      ${isLocked && choiceState.selected
                        ? choiceState.selected &&
                          (interaction.interaction as { type: string; options?: ChoiceOption[] }).options?.find(
                            (o: ChoiceOption) => o.label === choiceState.selected
                          )?.correct
                          ? "bg-green-400/30 border border-green-500"
                          : "bg-red-400/30 border border-red-400"
                        : isPopupOpen
                        ? "bg-blue-300/40 border border-blue-500"
                        : isChoice
                        ? "bg-yellow-200/50 border border-yellow-400 hover:bg-yellow-300/60"
                        : "bg-blue-200/40 border border-blue-400 hover:bg-blue-300/50"
                      }
                      transition-colors
                    `}
                    onClick={() => handleRegionClick(region, key)}
                    title={
                      isChoice
                        ? "Click to select an answer"
                        : isPopupOpen
                        ? "Click to close"
                        : "Click for more info"
                    }
                  />

                  {/* Popup or choice panel */}
                  {isPopupOpen && interaction.interaction.type === "popup" && (
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

                  {isPopupOpen && interaction.interaction.type === "choice" && (
                    <ChoiceOverlay
                      options={
                        (
                          interaction.interaction as {
                            type: "choice";
                            options: ChoiceOption[];
                            feedbackCorrect?: string;
                            feedbackIncorrect?: string;
                          }
                        ).options
                      }
                      state={choiceState}
                      onSelect={(label) => handleChoiceSelect(key, label)}
                      feedbackCorrect={
                        (
                          interaction.interaction as {
                            feedbackCorrect?: string;
                          }
                        ).feedbackCorrect
                      }
                      feedbackIncorrect={
                        (
                          interaction.interaction as {
                            feedbackIncorrect?: string;
                          }
                        ).feedbackIncorrect
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
