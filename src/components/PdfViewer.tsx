import React, { useEffect, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";
import { ZoomIn, ZoomOut, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { AnnotationToolbar, AnnotationTool } from "./AnnotationToolbar";
import { AnnotationCanvas } from "./AnnotationCanvas";

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
  const [scale, setScale] = useState(1.5);
  const [searchText, setSearchText] = useState("");
  const [fileName, setFileName] = useState("");
  const [documentMetadata, setDocumentMetadata] = useState<any>(null);
  const [selectedTool, setSelectedTool] = useState<AnnotationTool>(null);
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState("#8B5CF6");
  const [brushOpacity, setBrushOpacity] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load PDF on file change
  useEffect(() => {
    let objectUrl: string | undefined;
    setLoading(true);
    setPdf(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const loadedPdf = await pdfjsLib.getDocument({ data }).promise;
        setPdf(loadedPdf);
        setNumPages(loadedPdf.numPages);
        setPageNumber(1);
        
        // Get metadata
        const metadata = await loadedPdf.getMetadata();
        setDocumentMetadata(metadata);
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
      const viewport = page.getViewport({ scale });
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
  }, [pdf, pageNumber, scale]);

  // Zoom in function
  const zoomIn = () => {
    setScale((prevScale) => Math.min(prevScale + 0.25, 3));
  };

  // Zoom out function
  const zoomOut = () => {
    setScale((prevScale) => Math.max(prevScale - 0.25, 0.5));
  };

  // Generate page buttons for pagination
  const getPageButtons = () => {
    const maxVisibleButtons = 5;
    const buttons = [];
    
    let startPage = Math.max(1, pageNumber - Math.floor(maxVisibleButtons / 2));
    let endPage = Math.min(numPages, startPage + maxVisibleButtons - 1);
    
    if (endPage - startPage + 1 < maxVisibleButtons) {
      startPage = Math.max(1, endPage - maxVisibleButtons + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <PaginationItem key={i}>
          <PaginationLink
            isActive={i === pageNumber}
            onClick={() => setPageNumber(i)}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }
    
    return buttons;
  };

  if (!pdf) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <span className="text-gray-500">Loading PDF...</span>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            className="p-2 rounded-full hover:bg-gray-100 transition"
            title="Zoom out"
          >
            <ZoomOut className="h-5 w-5 text-gray-700" />
          </button>
          <span className="text-sm font-medium">{Math.round(scale * 100)}%</span>
          <button
            onClick={zoomIn}
            className="p-2 rounded-full hover:bg-gray-100 transition"
            title="Zoom in"
          >
            <ZoomIn className="h-5 w-5 text-gray-700" />
          </button>
        </div>
        <div className="text-sm text-center font-medium text-gray-800 truncate max-w-md">
          {fileName}
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="p-2 rounded-full hover:bg-gray-100 transition"
                title="Document information"
              >
                <Search className="h-5 w-5 text-gray-700" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-2">
                <h3 className="font-medium">Document Information</h3>
                <div className="text-sm">
                  <p><strong>File name:</strong> {fileName}</p>
                  <p><strong>Pages:</strong> {numPages}</p>
                  {documentMetadata && documentMetadata.info && (
                    <>
                      {documentMetadata.info.Title && <p><strong>Title:</strong> {documentMetadata.info.Title}</p>}
                      {documentMetadata.info.Author && <p><strong>Author:</strong> {documentMetadata.info.Author}</p>}
                      {documentMetadata.info.CreationDate && (
                        <p><strong>Creation Date:</strong> {documentMetadata.info.CreationDate}</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="w-full flex gap-4">
        <div className="w-64 flex-shrink-0">
          <AnnotationToolbar
            selectedTool={selectedTool}
            onToolSelect={setSelectedTool}
            brushSize={brushSize}
            onBrushSizeChange={setBrushSize}
            brushColor={brushColor}
            onBrushColorChange={setBrushColor}
            opacity={brushOpacity}
            onOpacityChange={setBrushOpacity}
          />
        </div>

        <div className="flex-1">
          <div 
            ref={containerRef}
            className="canvas-container relative overflow-auto max-h-[70vh] w-full flex justify-center bg-gray-100 rounded-lg"
          >
            <canvas
              ref={canvasRef}
              className="shadow-lg rounded bg-white"
            />
            {canvasRef.current && (
              <AnnotationCanvas
                width={canvasRef.current.width}
                height={canvasRef.current.height}
                tool={selectedTool}
                color={brushColor}
                size={brushSize}
                opacity={brushOpacity}
              />
            )}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600"></div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="w-full mt-4">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => setPageNumber((n) => Math.max(1, n - 1))}
                aria-disabled={pageNumber === 1}
                className={pageNumber === 1 ? "opacity-50 cursor-not-allowed" : ""}
              />
            </PaginationItem>
            
            {getPageButtons()}
            
            <PaginationItem>
              <PaginationNext 
                onClick={() => setPageNumber((n) => Math.min(numPages, n + 1))}
                aria-disabled={pageNumber === numPages}
                className={pageNumber === numPages ? "opacity-50 cursor-not-allowed" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
};

export default PdfViewer;
