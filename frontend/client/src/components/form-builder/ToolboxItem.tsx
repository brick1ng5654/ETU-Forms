import { cn } from "@/lib/utils";
import type { SemanticType, WidgetType } from "@/form/types";
import { LucideIcon } from "lucide-react";

export type ToolboxItemDefinition = {
  widgetType: WidgetType;
  semanticType?: SemanticType;
  props?: Record<string, unknown>;
  labelKey: string;
  category: string;
};

interface ToolboxItemProps {
  item: ToolboxItemDefinition;
  icon: LucideIcon;
  label: string;
  collapsed?: boolean;
  onAddField: (item: ToolboxItemDefinition, label: string) => void;
}

export function ToolboxItem({ item, icon: Icon, label, collapsed = false, onAddField }: ToolboxItemProps) {
  return (
    <div
      onClick={() => onAddField(item, label)}
      title={collapsed ? label : undefined}
      className={cn(
        "rounded-md border border-border bg-white cursor-pointer hover:border-primary/50 hover:shadow-sm transition-[padding,gap,border-color,box-shadow] duration-300 ease-out",
        collapsed ? "flex h-12 items-center justify-center p-0" : "flex items-center gap-3 p-3"
      )}
    >
      <div className={cn("rounded-sm bg-muted text-muted-foreground transition-[padding] duration-300 ease-out", collapsed ? "p-2.5" : "p-2")}>
        <Icon className="h-4 w-4" />
      </div>
      <span
        className={cn(
          "text-sm font-medium text-foreground whitespace-nowrap overflow-hidden transition-[max-width,opacity,margin] duration-300 ease-out",
          collapsed ? "max-w-0 opacity-0 ml-0" : "max-w-40 opacity-100 ml-0"
        )}
      >
        {label}
      </span>
    </div>
  );
}
