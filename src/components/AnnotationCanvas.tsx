
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = color;
    context.lineWidth = size;
    context.globalAlpha = opacity;
  }, [color, size, opacity]);

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

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const point = getPoint(e);
    if (!point) return;

    setIsDrawing(true);
    setLastPoint(point);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !lastPoint) return;

    const newPoint = getPoint(e);
    if (!newPoint) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context || !canvas) return;

    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(newPoint.x, newPoint.y);
    context.stroke();

    setLastPoint(newPoint);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    setLastPoint(null);
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
