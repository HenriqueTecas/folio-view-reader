
import React, { useRef, useEffect, useState } from "react";
import { AnnotationTool } from "./AnnotationToolbar";

interface Point {
  x: number;
  y: number;
}

interface AnnotationCanvasProps {
  width: number;
  height: number;
  tool: AnnotationTool;
  color: string;
  size: number;
  opacity: number;
}

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({
  width,
  height,
  tool,
  color,
  size,
  opacity,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPoint, setLastPoint] = useState<Point | null>(null);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [textInputPosition, setTextInputPosition] = useState<Point | null>(null);
  const [textContent, setTextContent] = useState<string>("");
  
  // Effect to set up canvas context when props change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.lineCap = "round";
    context.lineJoin = "round";
    
    if (tool === "eraser") {
      context.globalCompositeOperation = "destination-out";
      context.strokeStyle = "rgba(0,0,0,1)";
    } else {
      context.globalCompositeOperation = "source-over";
      context.strokeStyle = color;
    }
    
    if (tool === "highlighter") {
      context.globalAlpha = 0.3;
    } else {
      context.globalAlpha = opacity;
    }
    
    context.lineWidth = size;
  }, [color, size, opacity, tool]);

  const getPoint = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x =
      ("touches" in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y =
      ("touches" in e ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x, y };
  };

  // Start drawing or shape creation
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!tool) return;
    
    const point = getPoint(e);
    if (!point) return;

    setIsDrawing(true);
    setLastPoint(point);
    setStartPoint(point);
    
    // Handle text and sticky note tools
    if (tool === "text" || tool === "sticky-note") {
      setTextInputPosition(point);
      handleTextTool(point);
    }
  };

  // Create text input for text annotations
  const handleTextTool = (point: Point) => {
    if (tool === "text") {
      const text = prompt("Enter your comment:", "");
      if (text) {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!context || !canvas) return;
        
        context.font = `${size * 2}px Arial`;
        context.fillStyle = color;
        context.globalAlpha = opacity;
        context.fillText(text, point.x, point.y);
        
        setTextInputPosition(null);
        setIsDrawing(false);
      }
    } else if (tool === "sticky-note") {
      const note = prompt("Enter note content:", "");
      if (note) {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!context || !canvas) return;
        
        // Draw sticky note background
        context.fillStyle = "#FFEB3B"; // Yellow background
        context.globalAlpha = 0.8;
        const noteWidth = Math.max(150, note.length * 7);
        const noteHeight = 100;
        context.fillRect(point.x, point.y, noteWidth, noteHeight);
        
        // Draw note text
        context.font = "14px Arial";
        context.fillStyle = "#000000";
        context.globalAlpha = 1;
        
        // Word wrap text
        const words = note.split(' ');
        let line = '';
        let lineHeight = 18;
        let y = point.y + 20;
        let x = point.x + 10;
        
        for(let i = 0; i < words.length; i++) {
          const testLine = line + words[i] + ' ';
          const metrics = context.measureText(testLine);
          const testWidth = metrics.width;
          
          if (testWidth > noteWidth - 20 && i > 0) {
            context.fillText(line, x, y);
            line = words[i] + ' ';
            y += lineHeight;
          }
          else {
            line = testLine;
          }
        }
        context.fillText(line, x, y);
        
        setTextInputPosition(null);
        setIsDrawing(false);
      }
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !lastPoint || !tool) return;

    const newPoint = getPoint(e);
    if (!newPoint) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context || !canvas) return;

    switch (tool) {
      case "brush":
      case "highlighter":
      case "eraser":
        // Freehand drawing
        context.beginPath();
        context.moveTo(lastPoint.x, lastPoint.y);
        context.lineTo(newPoint.x, newPoint.y);
        context.stroke();
        break;
      case "rectangle":
      case "circle":
      case "arrow":
        // For shape tools, we'll draw on mouseup/touchend
        // Just update the current position for preview
        break;
      default:
        break;
    }

    setLastPoint(newPoint);
  };

  const stopDrawing = () => {
    if (!isDrawing || !startPoint || !lastPoint || !tool) {
      setIsDrawing(false);
      setLastPoint(null);
      setStartPoint(null);
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context || !canvas) {
      setIsDrawing(false);
      setLastPoint(null);
      setStartPoint(null);
      return;
    }

    // Draw shapes when the user stops drawing
    switch (tool) {
      case "rectangle":
        drawRectangle(context, startPoint, lastPoint);
        break;
      case "circle":
        drawCircle(context, startPoint, lastPoint);
        break;
      case "arrow":
        drawArrow(context, startPoint, lastPoint);
        break;
      default:
        break;
    }

    setIsDrawing(false);
    setLastPoint(null);
    setStartPoint(null);
  };

  // Shape drawing functions
  const drawRectangle = (
    context: CanvasRenderingContext2D,
    start: Point,
    end: Point
  ) => {
    const width = end.x - start.x;
    const height = end.y - start.y;
    
    context.beginPath();
    context.rect(start.x, start.y, width, height);
    context.stroke();
  };

  const drawCircle = (
    context: CanvasRenderingContext2D,
    start: Point,
    end: Point
  ) => {
    const radiusX = Math.abs(end.x - start.x) / 2;
    const radiusY = Math.abs(end.y - start.y) / 2;
    const centerX = Math.min(start.x, end.x) + radiusX;
    const centerY = Math.min(start.y, end.y) + radiusY;
    
    context.beginPath();
    context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    context.stroke();
  };

  const drawArrow = (
    context: CanvasRenderingContext2D,
    start: Point,
    end: Point
  ) => {
    const headLength = 15; // length of head in pixels
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);
    
    // Draw line
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
    
    // Draw arrowhead
    context.beginPath();
    context.moveTo(end.x, end.y);
    context.lineTo(
      end.x - headLength * Math.cos(angle - Math.PI / 7),
      end.y - headLength * Math.sin(angle - Math.PI / 7)
    );
    context.lineTo(
      end.x - headLength * Math.cos(angle + Math.PI / 7),
      end.y - headLength * Math.sin(angle + Math.PI / 7)
    );
    context.lineTo(end.x, end.y);
    context.lineTo(
      end.x - headLength * Math.cos(angle - Math.PI / 7),
      end.y - headLength * Math.sin(angle - Math.PI / 7)
    );
    
    // Fill the arrowhead
    context.fillStyle = context.strokeStyle;
    context.fill();
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute top-0 left-0 pointer-events-auto"
      style={{ touchAction: "none" }}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={stopDrawing}
    />
  );
};
