
import React, { useState, useCallback } from "react";
import PdfViewer from "@/components/PdfViewer";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const onFileChange = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    if (file.type !== "application/pdf") {
      toast({
        title: "Unsupported file type",
        description: "Please upload a PDF document.",
      });
      return;
    }
    setPdfFile(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      onFileChange(e.dataTransfer.files);
    },
    []
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileChange(e.target.files);
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-100 to-blue-50 py-6">
      <div className="bg-white max-w-2xl w-full shadow-xl p-8 rounded-lg">
        <h1 className="text-3xl font-bold text-center mb-1">
          PDF Viewer
        </h1>
        <p className="text-center text-gray-500 mb-8">
          Import a PDF to read and preview it in your browser.
        </p>
        {!pdfFile ? (
          <div
            className={`border-2 border-dashed transition-all ${
              dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
            } flex flex-col items-center justify-center py-16 cursor-pointer rounded-lg`}
            onDrop={handleDrop}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onClick={() => {
              const input = document.getElementById("pdf-upload");
              input && input.click();
            }}
            tabIndex={0}
            role="button"
          >
            <svg
              width="40"
              height="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="mb-3 text-blue-500"
              viewBox="0 0 24 24"
            >
              <path d="M15.707 10.293A1 1 0 0 1 17 11v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h6a1 1 0 0 1 .707.293l2 2z"/>
              <path d="M15 3v4a1 1 0 0 0 1 1h4"/>
            </svg>
            <span className="text-lg text-gray-600">
              Drag & drop a PDF here, or <span className="underline text-blue-600">browse</span>
            </span>
            <input
              id="pdf-upload"
              type="file"
              accept="application/pdf"
              style={{ display: "none" }}
              onChange={handleFileInput}
            />
          </div>
        ) : (
          <div>
            <PdfViewer file={pdfFile} />
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setPdfFile(null)}
                className="px-4 py-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 font-medium transition"
              >
                Import another PDF
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="mt-8 text-center text-sm text-gray-400">
        Made with <span className="text-blue-500 font-bold">Lovable</span>
      </div>
    </div>
  );
};

export default Index;
