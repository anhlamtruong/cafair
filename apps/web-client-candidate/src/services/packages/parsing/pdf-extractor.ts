/**
 * PDF Text Extractor
 *
 * Extracts raw text from a PDF buffer using pdf-parse v2 (class-based API).
 * Falls back to an error so the caller can decide whether to retry or abort.
 */

import { PDFParse } from "pdf-parse";

export async function extractTextFromPdf(
  buffer: Buffer | Uint8Array,
): Promise<string> {
  let parser: PDFParse | undefined;
  try {
    parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    return (result.text ?? "").trim();
  } catch (error) {
    console.error(
      "[pdf-extractor] Failed to extract text:",
      error instanceof Error ? error.message : error,
    );
    throw new Error(
      `PDF text extraction failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await parser?.destroy();
  }
}
