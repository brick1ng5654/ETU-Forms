import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

/**
 Для компонента элемента тулбокса (панели инструментов)
 
 type - уникальный тип поля (например: "text", "number", "email")
 
 icon - компонент иконки из библиотеки lucide-react
 
 label - отображаемое название элемента (например: "Текстовое поле")
 
 onAddField - функция-обработчик, вызываемая при клике на элемент
*/
interface ToolboxItemProps {
  type: string;
  icon: LucideIcon;
  label: string;
  onAddField: (type: string, label: string) => void;
}

/**
 Компонент элемента панели инструментов конструктора форм
 Представляет собой интерактивную кнопку для добавления нового поля в форму
 
 Используется в боковой панели инструментов конструктора форм
 Пользователь может кликнуть на элемент, чтобы добавить соответствующее поле в форму
*/
export function ToolboxItem({ type, icon: Icon, label, onAddField }: ToolboxItemProps) {
  return (
    <div
      onClick={() => onAddField(type, label)}
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


