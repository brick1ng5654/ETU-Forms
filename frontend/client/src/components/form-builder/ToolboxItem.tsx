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
  const testId = item.semanticType
    ? `toolbox-item-${item.widgetType}-${item.semanticType}`
    : `toolbox-item-${item.widgetType}`;

  return (
    <div
      data-testid={testId}
      onClick={() => onAddField(item, label)}
      title={collapsed ? label : undefined}
      className={cn(
        "flex h-12 items-center rounded-md border border-border bg-white cursor-pointer hover:border-primary/50 hover:shadow-sm transition-[border-color,box-shadow,background-color] duration-200 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10 dark:hover:border-white/20",
        collapsed ? "justify-center px-0" : "justify-start gap-3 px-3"
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground dark:bg-white/10 dark:text-slate-100">
        <Icon className="h-4 w-4" />
      </div>
      {!collapsed ? <span className="text-sm font-medium text-foreground truncate dark:text-slate-100">{label}</span> : null}
    </div>
  );
}
