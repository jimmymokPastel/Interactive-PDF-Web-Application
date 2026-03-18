/**
 * Configuration types for interactive PDF behaviors.
 * This is the data-driven config that makes the viewer reusable
 * for any similarly-structured interactive PDF without custom logic per file.
 */

export type InteractionType = "popup" | "choice";

export interface PopupInteraction {
  type: "popup";
  /** Text to display in the popup */
  content: string;
}

export interface ChoiceOption {
  label: string;
  /** Whether this option is the correct answer */
  correct: boolean;
}

export interface ChoiceInteraction {
  type: "choice";
  /** Available options for the user to pick from */
  options: ChoiceOption[];
  /** Popup/hint text shown after selection (optional) */
  feedbackCorrect?: string;
  feedbackIncorrect?: string;
}

export interface WordInteraction {
  /**
   * Regex or plain string to match in the text layer.
   * Use a string for exact word match (case-insensitive).
   * Use a RegExp for more complex patterns.
   */
  pattern: string | RegExp;
  interaction: PopupInteraction | ChoiceInteraction;
}

export interface PDFViewerConfig {
  /** URL/path to the PDF file, or an ArrayBuffer of its bytes (for local file import) */
  src: string | ArrayBuffer;
  /** List of interactive word behaviors */
  interactions: WordInteraction[];
}
