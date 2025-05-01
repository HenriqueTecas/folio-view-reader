import React, { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";
import { ZoomIn, ZoomOut, Maximize, Minimize, ChevronDown, ChevronUp, Info, Save, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { AnnotationToolbar, AnnotationTool } from "./AnnotationToolbar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Worker setup for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

interface Annotation {
  id?: string;
  type: string;
  points?: { x: number; y: number }[];
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
  color: string;
  size: number;
  opacity: number;
  text?: string;
  position?: { x: number; y: number };
  width?: number;
  height?: number;
}

interface PdfViewerProps {
  file: File;
}

// Generate a unique ID for annotations
const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Calculate distance between two points
const distanceBetweenPoints = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

// Check if a point is inside a rectangle
const pointInRectangle = (
  point: { x: number; y: number }, 
  startPoint: { x: number; y: number }, 
  endPoint: { x: number; y: number },
  tolerance = 0
) => {
  const minX = Math.min(startPoint.x, endPoint.x) - tolerance;
  const maxX = Math.max(startPoint.x, endPoint.x) + tolerance;
  const minY = Math.min(startPoint.y, endPoint.y) - tolerance;
  const maxY = Math.max(startPoint.y, endPoint.y) + tolerance;
  
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
};

// Check if a point is near a line (used for eraser detection)
const pointNearLine = (
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
  tolerance: number
) => {
  // Calculate distance from point to line segment
  const lengthSquared = Math.pow(lineEnd.x - lineStart.x, 2) + Math.pow(lineEnd.y - lineStart.y, 2);
  if (lengthSquared === 0) return distanceBetweenPoints(point, lineStart) <= tolerance;
  
  // Calculate projection of point onto line
  const t = Math.max(0, Math.min(1, (
    (point.x - lineStart.x) * (lineEnd.x - lineStart.x) + 
    (point.y - lineStart.y) * (lineEnd.y - lineStart.y)
  ) / lengthSquared));
  
  const projection = {
    x: lineStart.x + t * (lineEnd.x - lineStart.x),
    y: lineStart.y + t * (lineEnd.y - lineStart.y)
  };
  
  return distanceBetweenPoints(point, projection) <= tolerance;
};

// Check if a point is near a curve (for eraser on brush strokes)
const pointNearCurve = (
  point: { x: number; y: number },
  points: { x: number; y: number }[],
  tolerance: number
) => {
  if (points.length < 2) return false;
  
  // Check each segment of the curve
  for (let i = 1; i < points.length; i++) {
    if (pointNearLine(point, points[i-1], points[i], tolerance)) {
      return true;
    }
  }
  
  return false;
};

// Check if a point is inside a circle
const pointInCircle = (
  point: { x: number; y: number },
  startPoint: { x: number; y: number },
  endPoint: { x: number; y: number },
  tolerance = 0
) => {
  const radiusX = Math.abs(endPoint.x - startPoint.x) / 2;
  const radiusY = Math.abs(endPoint.y - startPoint.y) / 2;
  const centerX = Math.min(startPoint.x, endPoint.x) + radiusX;
  const centerY = Math.min(startPoint.y, endPoint.y) + radiusY;
  
  // Normalize point to account for elliptical shape
  const normalizedX = (point.x - centerX) / (radiusX + tolerance);
  const normalizedY = (point.y - centerY) / (radiusY + tolerance);
  
  // Check if point is inside the ellipse
  return Math.pow(normalizedX, 2) + Math.pow(normalizedY, 2) <= 1;
};

const PdfViewer: React.FC<PdfViewerProps> = ({ file }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const annotationsCanvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1.0);
  const [fileName, setFileName] = useState("");
  const [documentMetadata, setDocumentMetadata] = useState<any>(null);
  const [selectedTool, setSelectedTool] = useState<AnnotationTool>(null);
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState("#8B5CF6");
  const [brushOpacity, setBrushOpacity] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isMobile = useIsMobile();
  const [toolbarExpanded, setToolbarExpanded] = useState(false);
  const [documentId, setDocumentId] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);
  
  // Store annotations per page
  const [annotationsMap, setAnnotationsMap] = useState<Map<number, Annotation[]>>(new Map());
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Annotation | null>(null);
  const [eraserPoints, setEraserPoints] = useState<{ x: number; y: number }[]>([]);

  // Load PDF on file change
  useEffect(() => {
    let objectUrl: string | undefined;
    setLoading(true);
    setPdf(null);
    setFileName(file.name);

    // Generate a unique ID for this document
    const newDocumentId = `${file.name}-${file.size}-${file.lastModified}`;
    setDocumentId(newDocumentId);

    // Auto-adjust initial scale based on device
    const initialScale = isMobile ? 0.8 : 1.0;
    setScale(initialScale);

    // Try to load saved annotations from localStorage
    try {
      const savedAnnotations = localStorage.getItem(`pdf-annotations-${newDocumentId}`);
      if (savedAnnotations) {
        setAnnotationsMap(new Map(JSON.parse(savedAnnotations)));
      }
    } catch (err) {
      console.error("Failed to load saved annotations:", err);
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const loadingTask = pdfjsLib.getDocument({ data });
        const loadedPdf = await loadingTask.promise;
        
        setPdf(loadedPdf);
        setNumPages(loadedPdf.numPages);
        setPageNumber(1);
        
        // Get metadata
        const metadata = await loadedPdf.getMetadata();
        setDocumentMetadata(metadata);
      } catch (err) {
        console.error("Failed to load PDF:", err);
        toast({
          title: "Failed to load PDF",
          description: "The file could not be rendered. Please select a valid PDF.",
        });
      }
    };
    reader.readAsArrayBuffer(file);

    return () => {
      // Save annotations when component unmounts
      if (hasUnsavedChanges && documentId) {
        saveAnnotationsToStorage();
      }
      setPdf(null);
      objectUrl && URL.revokeObjectURL(objectUrl);
    };
  }, [file, isMobile]);

  // Auto-save annotations periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasUnsavedChanges && documentId) {
        saveAnnotationsToStorage();
        setHasUnsavedChanges(false);
      }
    }, 60000); // Auto-save every minute

    return () => clearInterval(interval);
  }, [hasUnsavedChanges, documentId]);

  // Calculate optimal scale
  useEffect(() => {
    if (!pdf || !containerRef.current) return;
    
    const calculateOptimalScale = async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
        const containerHeight = containerRef.current?.clientHeight || window.innerHeight * 0.7;
        
        const scaleX = (containerWidth - 40) / viewport.width;
        const scaleY = (containerHeight - 40) / viewport.height;
        
        // Use the smaller value to ensure it fits both dimensions
        const optimalScale = Math.min(scaleX, scaleY);
        
        // Only update if significantly different to avoid re-render loop
        if (Math.abs(optimalScale - scale) > 0.1) {
          setScale(optimalScale);
        }
      } catch (error) {
        console.error("Error calculating optimal scale:", error);
      }
    };
    
    calculateOptimalScale();
    
    // Add resize listener to recalculate on window size change
    const handleResize = () => calculateOptimalScale();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [pdf, pageNumber, containerRef.current]);

  // Render PDF page
  useEffect(() => {
    if (!pdf) return;
    setLoading(true);
    
    const renderPage = async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        
        // Set PDF canvas size
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const context = canvas.getContext("2d");
        if (!context) return;
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        setCanvasWidth(viewport.width);
        setCanvasHeight(viewport.height);
        
        // Also set annotation canvases to same size
        if (annotationsCanvasRef.current) {
          annotationsCanvasRef.current.width = viewport.width;
          annotationsCanvasRef.current.height = viewport.height;
        }
        
        if (tempCanvasRef.current) {
          tempCanvasRef.current.width = viewport.width;
          tempCanvasRef.current.height = viewport.height;
        }
        
        // Render PDF
        const renderContext = {
          canvasContext: context,
          viewport,
        };
        
        try {
          await page.render(renderContext).promise;
          setLoading(false);
          
          // After PDF is rendered, render the annotations for this page
          renderAnnotations();
        } catch (renderError) {
          console.error("Error rendering PDF:", renderError);
          setLoading(false);
          toast({
            title: "Error Rendering Page",
            description: "There was a problem displaying this page.",
          });
        }
      } catch (error) {
        console.error("Error getting PDF page:", error);
        setLoading(false);
        toast({
          title: "Error Rendering Page",
          description: "There was a problem displaying this page.",
        });
      }
    };
    
    renderPage();
  }, [pdf, pageNumber, scale]);

  // Save annotations to localStorage
  const saveAnnotationsToStorage = useCallback(() => {
    if (!documentId) return;
    
    try {
      // Convert Map to array of entries for JSON serialization
      const serializedMap = Array.from(annotationsMap.entries());
      localStorage.setItem(`pdf-annotations-${documentId}`, JSON.stringify(serializedMap));
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error("Failed to save annotations:", err);
      toast({
        title: "Error Saving Annotations",
        description: "There was a problem saving your annotations.",
      });
    }
  }, [documentId, annotationsMap]);

  // Render a single annotation
  const renderSingleAnnotation = useCallback((context: CanvasRenderingContext2D, annotation: Annotation) => {
    switch (annotation.type) {
      case "brush":
      case "highlighter": {
        context.globalAlpha = annotation.type === "highlighter" ? 0.3 : annotation.opacity;
        context.strokeStyle = annotation.color;
        context.lineWidth = annotation.size;
        context.lineCap = "round";
        context.lineJoin = "round";
        
        const points = annotation.points || [];
        if (points.length < 2) return;
        
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        
        for (let i = 1; i < points.length; i++) {
          const p1 = points[i - 1];
          const p2 = points[i];
          
          if (i < points.length - 1) {
            const midPoint = {
              x: (p1.x + p2.x) / 2,
              y: (p1.y + p2.y) / 2
            };
            context.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
          } else {
            context.lineTo(p2.x, p2.y);
          }
        }
        
        context.stroke();
        break;
      }
      
      case "rectangle": {
        if (!annotation.startPoint || !annotation.endPoint) return;
        
        context.strokeStyle = annotation.color;
        context.lineWidth = annotation.size;
        context.globalAlpha = annotation.opacity;
        
        const width = annotation.endPoint.x - annotation.startPoint.x;
        const height = annotation.endPoint.y - annotation.startPoint.y;
        
        context.beginPath();
        context.roundRect(
          annotation.startPoint.x,
          annotation.startPoint.y,
          width,
          height,
          4
        );
        context.stroke();
        break;
      }
      
      case "circle": {
        if (!annotation.startPoint || !annotation.endPoint) return;
        
        context.strokeStyle = annotation.color;
        context.lineWidth = annotation.size;
        context.globalAlpha = annotation.opacity;
        
        const radiusX = Math.abs(annotation.endPoint.x - annotation.startPoint.x) / 2;
        const radiusY = Math.abs(annotation.endPoint.y - annotation.startPoint.y) / 2;
        const centerX = Math.min(annotation.startPoint.x, annotation.endPoint.x) + radiusX;
        const centerY = Math.min(annotation.startPoint.y, annotation.endPoint.y) + radiusY;
        
        context.beginPath();
        context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        context.stroke();
        break;
      }
      
      case "arrow": {
        if (!annotation.startPoint || !annotation.endPoint) return;
        
        context.strokeStyle = annotation.color;
        context.fillStyle = annotation.color;
        context.lineWidth = annotation.size;
        context.globalAlpha = annotation.opacity;
        
        const headLength = 15;
        const dx = annotation.endPoint.x - annotation.startPoint.x;
        const dy = annotation.endPoint.y - annotation.startPoint.y;
        const angle = Math.atan2(dy, dx);
        
        // Draw arrow line
        context.beginPath();
        context.moveTo(annotation.startPoint.x, annotation.startPoint.y);
        context.lineTo(annotation.endPoint.x, annotation.endPoint.y);
        context.stroke();
        
        // Draw arrowhead
        context.beginPath();
        context.moveTo(annotation.endPoint.x, annotation.endPoint.y);
        context.lineTo(
          annotation.endPoint.x - headLength * Math.cos(angle - Math.PI / 6),
          annotation.endPoint.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        context.lineTo(
          annotation.endPoint.x - headLength * 0.8 * Math.cos(angle),
          annotation.endPoint.y - headLength * 0.8 * Math.sin(angle)
        );
        context.lineTo(
          annotation.endPoint.x - headLength * Math.cos(angle + Math.PI / 6),
          annotation.endPoint.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        context.closePath();
        context.fill();
        break;
      }
      
      case "text": {
        if (!annotation.position || !annotation.text) return;
        
        context.fillStyle = annotation.color;
        context.globalAlpha = annotation.opacity;
        context.font = `${annotation.size * 2}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        
        // Draw background bubble
        const padding = 8;
        const textMetrics = context.measureText(annotation.text);
        const textWidth = textMetrics.width;
        const textHeight = annotation.size * 2;
        const bubbleWidth = textWidth + padding * 2;
        const bubbleHeight = textHeight + padding * 2;
        
        context.globalAlpha = 0.1;
        context.fillStyle = annotation.color;
        context.beginPath();
        context.roundRect(
          annotation.position.x,
          annotation.position.y - textHeight,
          bubbleWidth,
          bubbleHeight,
          8
        );
        context.fill();
        
        // Draw border
        context.globalAlpha = 0.5;
        context.strokeStyle = annotation.color;
        context.lineWidth = 1;
        context.stroke();
        
        // Draw text
        context.globalAlpha = annotation.opacity;
        context.fillStyle = annotation.color;
        context.fillText(annotation.text, annotation.position.x + padding, annotation.position.y - padding);
        break;
      }
      
      case "sticky-note": {
        if (!annotation.position || !annotation.text || !annotation.width || !annotation.height) return;
        
        // Draw sticky note background
        context.fillStyle = "#FFEB3B"; // Yellow background
        context.globalAlpha = 0.9;
        
        // Add shadow
        context.shadowColor = 'rgba(0, 0, 0, 0.2)';
        context.shadowBlur = 8;
        context.shadowOffsetX = 2;
        context.shadowOffsetY = 2;
        
        // Draw rounded sticky note
        context.beginPath();
        context.roundRect(
          annotation.position.x,
          annotation.position.y,
          annotation.width,
          annotation.height,
          6
        );
        context.fill();
        
        // Reset shadow
        context.shadowColor = 'transparent';
        context.shadowBlur = 0;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        
        // Draw fold in corner
        context.beginPath();
        context.moveTo(annotation.position.x + annotation.width - 15, annotation.position.y);
        context.lineTo(annotation.position.x + annotation.width, annotation.position.y + 15);
        context.lineTo(annotation.position.x + annotation.width, annotation.position.y);
        context.closePath();
        context.fillStyle = "#E6D335";
        context.fill();
        
        // Draw note text
        context.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        context.fillStyle = "#000000";
        context.globalAlpha = 1;
        
        // Word wrap text
        const words = annotation.text.split(' ');
        let line = '';
        let lineHeight = 18;
        let y = annotation.position.y + 20;
        let x = annotation.position.x + 10;
        
        for (let i = 0; i < words.length; i++) {
          const testLine = line + words[i] + ' ';
          const metrics = context.measureText(testLine);
          const testWidth = metrics.width;
          
          if (testWidth > annotation.width - 20 && i > 0) {
            context.fillText(line, x, y);
            line = words[i] + ' ';
            y += lineHeight;
          } else {
            line = testLine;
          }
        }
        context.fillText(line, x, y);
        break;
      }
    }
  }, []);

  // Render annotations for current page
  const renderAnnotations = useCallback(() => {
    const canvas = annotationsCanvasRef.current;
    if (!canvas) return;
    
    const context = canvas.getContext("2d");
    if (!context) return;
    
    // Clear annotations canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get annotations for current page
    const annotations = annotationsMap.get(pageNumber) || [];
    
    // Render each annotation
    annotations.forEach(annotation => {
      renderSingleAnnotation(context, annotation);
    });
  }, [pageNumber, annotationsMap, renderSingleAnnotation]);

  // Add annotation to map and render it
  const addAnnotationAndRender = useCallback((annotation: Annotation) => {
    // Add ID if not present
    if (!annotation.id) {
      annotation.id = generateId();
    }
    
    // Get existing annotations for this page
    const pageAnnotations = annotationsMap.get(pageNumber) || [];
    
    // Create new map with updated annotations
    const newMap = new Map(annotationsMap);
    newMap.set(pageNumber, [...pageAnnotations, annotation]);
    
    // Update the state
    setAnnotationsMap(newMap);
    setHasUnsavedChanges(true);
    
    // Get the annotations canvas and render the new annotation
    const canvas = annotationsCanvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
      if (context) {
        // Render just the new annotation on top of existing ones
        renderSingleAnnotation(context, annotation);
      }
    }
  }, [pageNumber, annotationsMap, renderSingleAnnotation]);

  // Handle eraser to remove annotations
  const handleEraser = useCallback((point: { x: number; y: number }) => {
    // Get existing annotations
    const annotations = annotationsMap.get(pageNumber) || [];
    if (annotations.length === 0) return false;
    
    // Check for annotations that intersect with the eraser
    let annotationsRemoved = false;
    const remainingAnnotations = annotations.filter(annotation => {
      // Calculate tolerance for hit detection based on eraser size and annotation size
      const eraserSize = brushSize;
      const annotationSize = annotation.size || 1;
      const tolerance = eraserSize + annotationSize;
      
      let shouldKeep = true;
      
      switch (annotation.type) {
        case "brush":
        case "highlighter":
          // Check if any point in the brush stroke is near the eraser
          if (annotation.points) {
            for (let i = 1; i < annotation.points.length; i++) {
              if (pointNearLine(point, annotation.points[i-1], annotation.points[i], tolerance)) {
                shouldKeep = false;
                break;
              }
            }
          }
          break;
          
        case "rectangle":
          // Check if eraser is inside rectangle or near its border
          if (annotation.startPoint && annotation.endPoint) {
            // Check if point is inside the rectangle
            if (pointInRectangle(point, annotation.startPoint, annotation.endPoint, tolerance)) {
              shouldKeep = false;
            }
            
            // Also check if point is near any of the four sides
            if (shouldKeep) {
              const { startPoint, endPoint } = annotation;
              const topLeft = startPoint;
              const topRight = { x: endPoint.x, y: startPoint.y };
              const bottomLeft = { x: startPoint.x, y: endPoint.y };
              const bottomRight = endPoint;
              
              if (
                pointNearLine(point, topLeft, topRight, tolerance) ||
                pointNearLine(point, topRight, bottomRight, tolerance) ||
                pointNearLine(point, bottomRight, bottomLeft, tolerance) ||
                pointNearLine(point, bottomLeft, topLeft, tolerance)
              ) {
                shouldKeep = false;
              }
            }
          }
          break;
          
        case "circle":
          // Check if eraser is near the circle
          if (annotation.startPoint && annotation.endPoint) {
            if (pointInCircle(point, annotation.startPoint, annotation.endPoint, tolerance)) {
              shouldKeep = false;
            }
          }
          break;
          
        case "arrow":
          // Check if eraser is near the arrow line
          if (annotation.startPoint && annotation.endPoint) {
            if (pointNearLine(point, annotation.startPoint, annotation.endPoint, tolerance)) {
              shouldKeep = false;
            }
          }
          break;
          
        case "text":
        case "sticky-note":
          // Check if eraser is inside the text box or sticky note
          if (annotation.position && annotation.width && annotation.height) {
            const endPoint = {
              x: annotation.position.x + annotation.width,
              y: annotation.position.y + annotation.height
            };
            if (pointInRectangle(point, annotation.position, endPoint, tolerance)) {
              shouldKeep = false;
            }
          } else if (annotation.position && annotation.text) {
            // For text annotations without explicit width/height
            const padding = 8;
            const textWidth = annotation.text.length * 8; // Approximate
            const textHeight = annotation.size * 2;
            const bubbleWidth = textWidth + padding * 2;
            const bubbleHeight = textHeight + padding * 2;
            
            const textStart = {
              x: annotation.position.x,
              y: annotation.position.y - textHeight
            };
            
            const textEnd = {
              x: annotation.position.x + bubbleWidth,
              y: annotation.position.y
            };
            
            if (pointInRectangle(point, textStart, textEnd, tolerance)) {
              shouldKeep = false;
            }
          }
          break;
      }
      
      if (!shouldKeep) {
        annotationsRemoved = true;
      }
      
      return shouldKeep;
    });
    
    // If annotations were removed, update the state
    if (annotationsRemoved) {
      const newMap = new Map(annotationsMap);
      newMap.set(pageNumber, remainingAnnotations);
      setAnnotationsMap(newMap);
      setHasUnsavedChanges(true);
      
      // Redraw all annotations
      renderAnnotations();
      
      return true;
    }
    
    return false;
  }, [pageNumber, annotationsMap, brushSize, renderAnnotations]);

  // Get point coordinates relative to canvas
  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = tempCanvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const x = ("touches" in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ("touches" in e ? e.touches[0].clientY : e.clientY) - rect.top;
    
    return { x, y };
  };

  // Start drawing
  const handleDrawStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!selectedTool) return;
    
    const point = getCanvasPoint(e);
    if (!point) return;
    
    setIsDrawing(true);
    setLastPoint(point);
    setStartPoint(point);
    
    if (selectedTool === "eraser") {
      // Initialize eraser path
      setEraserPoints([point]);
      // Attempt to erase at the start point
      handleEraser(point);
    } else {
      setCurrentPath([point]);
      
      // For text and sticky notes, handle immediately
      if (selectedTool === "text") {
        handleTextTool(point);
      } else if (selectedTool === "sticky-note") {
        handleStickyNoteTool(point);
      }
    }
  };

  // Handle drawing
  const handleDrawMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !selectedTool || !lastPoint || !startPoint) return;
    if (selectedTool === "text" || selectedTool === "sticky-note") return;
    
    const newPoint = getCanvasPoint(e);
    if (!newPoint) return;
    
    const canvas = tempCanvasRef.current;
    if (!canvas) return;
    
    const context = canvas.getContext("2d");
    if (!context) return;
    
    // Special handling for eraser
    if (selectedTool === "eraser") {
      // Add point to eraser path
      setEraserPoints(prev => [...prev, newPoint]);
      
      // Try to erase annotations
      const erased = handleEraser(newPoint);
      
      // Draw the eraser cursor
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.beginPath();
      context.arc(newPoint.x, newPoint.y, brushSize, 0, Math.PI * 2);
      context.fillStyle = "rgba(200, 200, 200, 0.5)";
      context.fill();
      
      setLastPoint(newPoint);
      return;
    }
    
    // For other tools, continue with normal drawing
    // Clear temp canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set drawing styles
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = brushColor;
    context.fillStyle = brushColor;
    context.globalAlpha = selectedTool === "highlighter" ? 0.3 : brushOpacity;
    context.lineWidth = brushSize;
    
    // Update current stroke information based on tool
    let updatedStroke: Annotation | null = null;
    
    // Draw based on tool
    switch (selectedTool) {
      case "brush":
      case "highlighter": {
        // Update path
        const updatedPath = [...currentPath, newPoint];
        setCurrentPath(updatedPath);
        
        // Draw entire current path
        context.beginPath();
        context.moveTo(startPoint.x, startPoint.y);
        
        for (let i = 1; i < updatedPath.length; i++) {
          const p1 = updatedPath[i - 1];
          const p2 = updatedPath[i];
          
          if (i < updatedPath.length - 1) {
            const midPoint = {
              x: (p1.x + p2.x) / 2,
              y: (p1.y + p2.y) / 2
            };
            context.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
          } else {
            context.lineTo(p2.x, p2.y);
          }
        }
        
        context.stroke();
        
        // Update current stroke
        updatedStroke = {
          id: generateId(),
          type: selectedTool,
          points: updatedPath,
          color: brushColor,
          size: brushSize,
          opacity: brushOpacity
        };
        break;
      }
      
      case "rectangle": {
        const width = newPoint.x - startPoint.x;
        const height = newPoint.y - startPoint.y;
        
        context.beginPath();
        context.roundRect(startPoint.x, startPoint.y, width, height, 4);
        context.stroke();
        
        // Update current stroke
        updatedStroke = {
          id: generateId(),
          type: "rectangle",
          startPoint,
          endPoint: newPoint,
          color: brushColor,
          size: brushSize,
          opacity: brushOpacity
        };
        break;
      }
      
      case "circle": {
        const radiusX = Math.abs(newPoint.x - startPoint.x) / 2;
        const radiusY = Math.abs(newPoint.y - startPoint.y) / 2;
        const centerX = Math.min(startPoint.x, newPoint.x) + radiusX;
        const centerY = Math.min(startPoint.y, newPoint.y) + radiusY;
        
        context.beginPath();
        context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        context.stroke();
        
        // Update current stroke
        updatedStroke = {
          id: generateId(),
          type: "circle",
          startPoint,
          endPoint: newPoint,
          color: brushColor,
          size: brushSize,
          opacity: brushOpacity
        };
        break;
      }
      
      case "arrow": {
        const headLength = 15;
        const dx = newPoint.x - startPoint.x;
        const dy = newPoint.y - startPoint.y;
        const angle = Math.atan2(dy, dx);
        
        // Draw line
        context.beginPath();
        context.moveTo(startPoint.x, startPoint.y);
        context.lineTo(newPoint.x, newPoint.y);
        context.stroke();
        
        // Draw arrowhead
        context.beginPath();
        context.moveTo(newPoint.x, newPoint.y);
        context.lineTo(
          newPoint.x - headLength * Math.cos(angle - Math.PI / 6),
          newPoint.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        context.lineTo(
          newPoint.x - headLength * 0.8 * Math.cos(angle),
          newPoint.y - headLength * 0.8 * Math.sin(angle)
        );
        context.lineTo(
          newPoint.x - headLength * Math.cos(angle + Math.PI / 6),
          newPoint.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        context.closePath();
        context.fill();
        
        // Update current stroke
        updatedStroke = {
          id: generateId(),
          type: "arrow",
          startPoint,
          endPoint: newPoint,
          color: brushColor,
          size: brushSize,
          opacity: brushOpacity
        };
        break;
      }
    }
    
    // Update the current stroke
    setCurrentStroke(updatedStroke);
    setLastPoint(newPoint);
  };

  // Finish drawing
  const handleDrawEnd = () => {
    if (!isDrawing || !selectedTool || !startPoint) {
      setIsDrawing(false);
      setLastPoint(null);
      setStartPoint(null);
      setCurrentPath([]);
      setCurrentStroke(null);
      setEraserPoints([]);
      
      // Clear temp canvas
      const canvas = tempCanvasRef.current;
      if (canvas) {
        const context = canvas.getContext("2d");
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      
      return;
    }
    
    // Handle eraser differently - we don't need to add an annotation for it
    if (selectedTool === "eraser") {
      // Clear the eraser cursor
      const canvas = tempCanvasRef.current;
      if (canvas) {
        const context = canvas.getContext("2d");
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      
      setIsDrawing(false);
      setLastPoint(null);
      setStartPoint(null);
      setEraserPoints([]);
      return;
    }
    
    // Get finalized annotation
    let finalAnnotation: Annotation | null = currentStroke;
    
    // If we have a valid annotation, add it and render it
    if (finalAnnotation) {
      // Add annotation to map and render it
      addAnnotationAndRender(finalAnnotation);
      
      // Clear temp canvas
      const tempCanvas = tempCanvasRef.current;
      if (tempCanvas) {
        const tempContext = tempCanvas.getContext("2d");
        if (tempContext) {
          tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        }
      }
    }
    
    // Reset drawing state
    setIsDrawing(false);
    setLastPoint(null);
    setStartPoint(null);
    setCurrentPath([]);
    setCurrentStroke(null);
  };

  // Handle text annotation
  const handleTextTool = (point: { x: number; y: number }) => {
    const text = prompt("Add a comment:", "");
    if (!text) return;
    
    // Create text annotation
    const textAnnotation: Annotation = {
      id: generateId(),
      type: "text",
      position: point,
      text,
      color: brushColor,
      size: brushSize,
      opacity: brushOpacity
    };
    
    // Add annotation to map and render it
    addAnnotationAndRender(textAnnotation);
  };

  // Handle sticky note
  const handleStickyNoteTool = (point: { x: number; y: number }) => {
    const text = prompt("Enter note content:", "");
    if (!text) return;
    
    const noteWidth = Math.max(150, text.length * 7);
    const noteHeight = 100;
    
    // Create sticky note annotation
    const stickyAnnotation: Annotation = {
      id: generateId(),
      type: "sticky-note",
      position: point,
      text,
      width: noteWidth,
      height: noteHeight,
      color: brushColor,
      size: brushSize,
      opacity: brushOpacity
    };
    
    // Add annotation to map and render it
    addAnnotationAndRender(stickyAnnotation);
  };

  // Zoom in function
  const zoomIn = () => {
    setScale((prevScale) => Math.min(prevScale + 0.2, 3));
  };

  // Zoom out function
  const zoomOut = () => {
    setScale((prevScale) => Math.max(prevScale - 0.2, 0.3));
  };

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Save annotations explicitly
  const saveAnnotations = () => {
    saveAnnotationsToStorage();
    toast({
      title: "Annotations Saved",
      description: "Your annotations have been saved successfully.",
    });
  };

  // Clear page annotations
  const handleClearPageAnnotations = () => {
    const newMap = new Map(annotationsMap);
    newMap.delete(pageNumber);
    
    setAnnotationsMap(newMap);
    setHasUnsavedChanges(true);
    
    // Clear annotations canvas
    const canvas = annotationsCanvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    
    toast({
      title: "Page Cleared",
      description: "Annotations for this page have been cleared.",
    });
  };

  // Clear all annotations
  const handleClearAllAnnotations = () => {
    setAnnotationsMap(new Map());
    setHasUnsavedChanges(true);
    
    // Clear annotations canvas
    const canvas = annotationsCanvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    
    toast({
      title: "All Annotations Cleared",
      description: "All annotations have been removed from this document.",
    });
  };

  // Generate page buttons for pagination
  const getPageButtons = () => {
    const maxVisibleButtons = isMobile ? 3 : 5;
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
      {/* Header Controls */}
      <div className="w-full bg-white border-b rounded-t-lg shadow-sm mb-1">
        <div className="flex items-center justify-between px-4 py-2">
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
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-full hover:bg-gray-100 transition"
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <Minimize className="h-5 w-5 text-gray-700" />
              ) : (
                <Maximize className="h-5 w-5 text-gray-700" />
              )}
            </button>
            <div className="h-6 border-l border-gray-300 mx-1"></div>
            <Button
              size="sm"
              variant="ghost"
              className="flex items-center gap-1 px-2 h-9"
              onClick={saveAnnotations}
              title="Save annotations"
            >
              <Save className="h-4 w-4 text-gray-700" />
              <span className="text-sm">Save</span>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex items-center gap-1 px-2 h-9 text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Clear annotations"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="text-sm">Clear</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Annotations</AlertDialogTitle>
                  <AlertDialogDescription>
                    Do you want to clear annotations from just this page or the entire document?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleClearPageAnnotations}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    Clear This Page
                  </AlertDialogAction>
                  <AlertDialogAction 
                    onClick={handleClearAllAnnotations}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Clear All Pages
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          
          <div className="text-sm text-center font-medium text-gray-800 truncate max-w-md">
            {fileName} - Page {pageNumber} of {numPages}
          </div>
          
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="p-2 rounded-full hover:bg-gray-100 transition"
                  title="Document information"
                >
                  <Info className="h-5 w-5 text-gray-700" />
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
        
        {/* Annotation Toolbar - Collapsible */}
        <Collapsible 
          open={toolbarExpanded} 
          onOpenChange={setToolbarExpanded}
          className="w-full border-t"
        >
          <CollapsibleTrigger className="flex items-center justify-center w-full p-1 hover:bg-gray-50 text-gray-500">
            {toolbarExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-xs">Annotation Tools</span>
                <ChevronDown className="h-4 w-4" />
              </div>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 py-2">
            <AnnotationToolbar
              selectedTool={selectedTool}
              onToolSelect={setSelectedTool}
              brushSize={brushSize}
              onBrushSizeChange={setBrushSize}
              brushColor={brushColor}
              onBrushColorChange={setBrushColor}
              opacity={brushOpacity}
              onOpacityChange={setBrushOpacity}
              layout="horizontal"
            />
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Main PDF Viewer */}
      <div 
        className={cn(
          "w-full flex flex-col",
          isFullscreen && "fixed top-0 left-0 w-screen h-screen z-50 bg-gray-100 p-4"
        )}
      >
        <div 
          ref={containerRef}
          className={cn(
            "canvas-container relative overflow-auto max-h-[calc(100vh-13rem)] w-full flex justify-center bg-gray-100 rounded-lg p-5",
            isFullscreen && "h-full"
          )}
        >
          <div 
            ref={canvasContainerRef}
            className="relative"
            style={{ 
              width: canvasWidth || 'auto', 
              height: canvasHeight || 'auto' 
            }}
          >
            {/* PDF Canvas - Bottom layer */}
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 shadow-lg rounded bg-white"
            />
            
            {/* Annotations Canvas - Middle layer */}
            <canvas
              ref={annotationsCanvasRef}
              className="absolute top-0 left-0 z-10"
              style={{ pointerEvents: 'none' }}
            />
            
            {/* Temporary Drawing Canvas - Top layer */}
            <canvas
              ref={tempCanvasRef}
              className={cn(
                "absolute top-0 left-0 z-20",
                selectedTool === "eraser" ? "cursor-none" : selectedTool ? "cursor-crosshair" : "cursor-default"
              )}
              style={{ touchAction: "none" }}
              onMouseDown={handleDrawStart}
              onMouseMove={handleDrawMove}
              onMouseUp={handleDrawEnd}
              onMouseLeave={handleDrawEnd}
              onTouchStart={handleDrawStart}
              onTouchMove={handleDrawMove}
              onTouchEnd={handleDrawEnd}
            />
          </div>
          
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-30">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600"></div>
            </div>
          )}
        </div>
      </div>

      {/* Pagination Controls */}
      <div className={cn(
        "w-full mt-4", 
        isFullscreen && "fixed bottom-4 left-0 px-4"
      )}>
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