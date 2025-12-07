import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface ToolboxItemProps {
  type: string;
  icon: LucideIcon;
  label: string;
}

export function ToolboxItem({ type, icon: Icon, label }: ToolboxItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `toolbox-${type}`,
    data: {
      type: "toolbox-item",
      fieldType: type,
      label,
    },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-3 p-3 rounded-md border border-border bg-white cursor-grab hover:border-primary/50 hover:shadow-sm transition-all",
        isDragging ? "opacity-50 ring-2 ring-primary/20" : ""
      )}
    >
      <div className="p-2 rounded-sm bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
  );
}

export function ToolboxItemOverlay({ icon: Icon, label }: Omit<ToolboxItemProps, "type">) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-md border border-primary bg-white shadow-xl cursor-grabbing opacity-90 w-[200px]">
      <div className="p-2 rounded-sm bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
  );
}
