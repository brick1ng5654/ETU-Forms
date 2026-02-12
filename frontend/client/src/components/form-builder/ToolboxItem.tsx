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
  onAddField: (item: ToolboxItemDefinition, label: string) => void;
}

export function ToolboxItem({ item, icon: Icon, label, onAddField }: ToolboxItemProps) {
  const testId = `toolbox-item-${item.category}-${item.widgetType}${item.semanticType ? `-${item.semanticType}` : ""}`
    .toLowerCase()
    .replace(/\s+/g, "-");

  return (
    <div
      data-testid={testId}
      onClick={() => onAddField(item, label)}
      className={cn(
        "flex items-center gap-3 p-3 rounded-md border border-border bg-white cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
      )}
    >
      <div className="p-2 rounded-sm bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
  );
}
