
import React, { useEffect, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";

// Worker setup for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

interface PdfViewerProps {
  file: File;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ file }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  // Load PDF on file change
  useEffect(() => {
    let objectUrl: string | undefined;
    setLoading(true);
    setPdf(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const loadedPdf = await pdfjsLib.getDocument({ data }).promise;
        setPdf(loadedPdf);
        setNumPages(loadedPdf.numPages);
        setPageNumber(1);
      } catch (err) {
        toast({
          title: "Failed to load PDF",
          description:
            "The file could not be rendered. Please select a valid PDF.",
        });
      }
      setLoading(false);
    };
    reader.readAsArrayBuffer(file);

    return () => {
      setPdf(null);
      objectUrl && URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line
  }, [file]);

  // Render PDF page
  useEffect(() => {
    if (!pdf) return;
    setLoading(true);
    pdf.getPage(pageNumber).then((page) => {
      const viewport = page.getViewport({ scale: 1.8 }); // Increase for higher res
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const renderContext = {
        canvasContext: context!,
        viewport,
      };
      page.render(renderContext).promise.then(() => {
        setLoading(false);
      });
    });
  }, [pdf, pageNumber]);

  if (!pdf) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <span className="text-gray-500">Loading PDF...</span>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      <canvas
        ref={canvasRef}
        className="shadow-lg rounded bg-white"
        style={{ maxWidth: "100%", height: "auto" }}
      />
      <div className="flex gap-2 items-center mt-4">
        <button
          className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold transition"
          onClick={() => setPageNumber((n) => Math.max(1, n - 1))}
          disabled={pageNumber === 1}
        >
          Prev
        </button>
        <span className="text-gray-700 select-none">
          Page {pageNumber} of {numPages}
        </span>
        <button
          className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold transition"
          onClick={() => setPageNumber((n) => Math.min(numPages, n + 1))}
          disabled={pageNumber === numPages}
        >
          Next
        </button>
      </div>
      {loading && (
        <span className="mt-2 text-sm text-muted-foreground">Rendering page...</span>
      )}
    </div>
  );
};

export default PdfViewer;
