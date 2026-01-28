import * as pdfjs from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Set worker source
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface PdfPage {
  pageNumber: number;
  blob: Blob;
  thumbnail: string;
}

export interface PdfParseResult {
  totalPages: number;
  pages: PdfPage[];
}

const THUMBNAIL_SCALE = 0.3;
const RENDER_SCALE = 2.0; // Higher quality for API processing

async function renderPageToBlob(
  page: pdfjs.PDFPageProxy,
  scale: number
): Promise<Blob> {
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to get canvas 2D context");
  }

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to convert canvas to blob"));
        }
        // Cleanup
        canvas.width = 0;
        canvas.height = 0;
      },
      "image/png",
      0.9
    );
  });
}

async function renderPageToDataUrl(
  page: pdfjs.PDFPageProxy,
  scale: number
): Promise<string> {
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to get canvas 2D context");
  }

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  const dataUrl = canvas.toDataURL("image/png", 0.7);

  // Cleanup
  canvas.width = 0;
  canvas.height = 0;

  return dataUrl;
}

export async function parsePdf(file: File): Promise<PdfParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  const pages: PdfPage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);

    // Render full-quality blob for processing
    const blob = await renderPageToBlob(page, RENDER_SCALE);

    // Render thumbnail for preview
    const thumbnail = await renderPageToDataUrl(page, THUMBNAIL_SCALE);

    pages.push({
      pageNumber: i,
      blob,
      thumbnail,
    });

    // Cleanup page resources
    page.cleanup();
  }

  // Cleanup PDF document
  await pdf.destroy();

  return {
    totalPages: pdf.numPages,
    pages,
  };
}

export async function* parsePdfStream(
  file: File
): AsyncGenerator<PdfPage, void, unknown> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);

      const blob = await renderPageToBlob(page, RENDER_SCALE);
      const thumbnail = await renderPageToDataUrl(page, THUMBNAIL_SCALE);

      page.cleanup();

      yield {
        pageNumber: i,
        blob,
        thumbnail,
      };
    }
  } finally {
    await pdf.destroy();
  }
}
