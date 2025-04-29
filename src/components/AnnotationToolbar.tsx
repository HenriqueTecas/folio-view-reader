
import React from "react";
import { Button } from "@/components/ui/button";
import {
  Brush,
  Eraser,
  Highlighter,
  RectangleHorizontal,
  Circle,
  ArrowRight,
  MessageSquare,
  StickyNote,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export type AnnotationTool =
  | "brush"
  | "eraser"
  | "highlighter"
  | "rectangle"
  | "circle"
  | "arrow"
  | "text"
  | "sticky-note"
  | null;

interface AnnotationToolbarProps {
  selectedTool: AnnotationTool;
  onToolSelect: (tool: AnnotationTool) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  brushColor: string;
  onBrushColorChange: (color: string) => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
}

const tools = [
  { name: "brush", icon: Brush, label: "Draw" },
  { name: "eraser", icon: Eraser, label: "Erase" },
  { name: "highlighter", icon: Highlighter, label: "Highlight" },
  { name: "rectangle", icon: RectangleHorizontal, label: "Rectangle" },
  { name: "circle", icon: Circle, label: "Circle" },
  { name: "arrow", icon: ArrowRight, label: "Arrow" },
  { name: "sticky-note", icon: StickyNote, label: "Sticky Note" },
  { name: "text", icon: MessageSquare, label: "Comment" },
] as const;

const colors = [
  "#8B5CF6", // Purple
  "#D946EF", // Pink
  "#F97316", // Orange
  "#0EA5E9", // Blue
  "#000000", // Black
  "#FF0000", // Red
];

export const AnnotationToolbar: React.FC<AnnotationToolbarProps> = ({
  selectedTool,
  onToolSelect,
  brushSize,
  onBrushSizeChange,
  brushColor,
  onBrushColorChange,
  opacity,
  onOpacityChange,
}) => {
  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-lg shadow-lg">
      <div className="grid grid-cols-4 gap-2">
        {tools.map(({ name, icon: Icon, label }) => (
          <Button
            key={name}
            variant="outline"
            size="icon"
            className={cn(
              "w-10 h-10",
              selectedTool === name && "bg-accent text-accent-foreground"
            )}
            onClick={() => onToolSelect(name as AnnotationTool)}
            title={label}
          >
            <Icon className="h-5 w-5" />
          </Button>
        ))}
      </div>

      {selectedTool && selectedTool !== "eraser" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => (
              <button
                key={color}
                className={cn(
                  "w-6 h-6 rounded-full border-2",
                  brushColor === color ? "border-gray-800" : "border-transparent"
                )}
                style={{ backgroundColor: color }}
                onClick={() => onBrushColorChange(color)}
              />
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Size</label>
            <Slider
              min={1}
              max={20}
              step={1}
              value={[brushSize]}
              onValueChange={(value) => onBrushSizeChange(value[0])}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Opacity</label>
            <Slider
              min={0.1}
              max={1}
              step={0.1}
              value={[opacity]}
              onValueChange={(value) => onOpacityChange(value[0])}
            />
          </div>
        </div>
      )}
    </div>
  );
};
