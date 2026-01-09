import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FormField } from "@/lib/form-types";
import { cn } from "@/lib/utils";
import { GripVertical, Star, Upload, GripHorizontal, CalendarDays, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { useTranslation } from 'react-i18next';
import { Languages } from "lucide-react";

const FULLNAME_MAX_CHARS = 50;

interface SortableFieldProps {
  field: FormField;
  isSelected: boolean;
  onSelect: (id: string) => void;
  fields: FormField[];
}

export function SortableField({ field, isSelected, onSelect, fields }: SortableFieldProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });
  const { t, i18n } = useTranslation()
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const renderFieldPreview = () => {
    switch (field.type) {
      case "text":
        if (field.multiline) {
          return (
            <Textarea 
              placeholder={field.placeholder} 
              disabled 
              className="bg-white/50 pointer-events-none resize-none"
            />
          );
        }
        return (
          <Input 
            placeholder={field.placeholder} 
            disabled 
            className="bg-white/50 pointer-events-none"
          />
        );
      case "email":
      case "number":
      case "phone":
      case "passport":
      case "inn":
      case "snils":
      case "ogrn":
      case "bik":
      case "account":
        return (
          <Input 
            placeholder={field.placeholder} 
            disabled 
            className="bg-white/50 pointer-events-none"
            type={field.type === "number" ? "number" : "text"}
          />
        );
      case "fullname": {
        const isRu = i18n.language.startsWith("ru");
        const labels = {
          lastName: isRu ? "Фамилия" : "Last name",
          firstName: isRu ? "Имя" : "First name",
          patronymic: isRu ? "Отчество (при наличии)" : "Middle name (if any)",
        };

        return (
          <div className="grid gap-2">
            <Input
              placeholder={labels.lastName}
              disabled
              maxLength={FULLNAME_MAX_CHARS}
              className="bg-white/50 pointer-events-none"
            />
            <Input
              placeholder={labels.firstName}
              disabled
              maxLength={FULLNAME_MAX_CHARS}
              className="bg-white/50 pointer-events-none"
            />
            <Input
              placeholder={labels.patronymic}
              disabled
              maxLength={FULLNAME_MAX_CHARS}
              className="bg-white/50 pointer-events-none"
            />
          </div>
        );
      }
      case "select":
      case "country":
      case "category":
        return (
          <Select disabled>
            <SelectTrigger className="bg-white/50">
              <SelectValue placeholder={t("common.selectopt")} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.filter(Boolean).map((opt, i) => (
                <SelectItem key={i} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "checkbox":
        return (
          <div className="space-y-2">
            {field.options?.map((opt, i) => (
              <div key={i} className="flex items-center space-x-2">
                <Checkbox id={`${field.id}-${i}`} disabled />
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {opt}
                </label>
              </div>
            ))}
          </div>
        );
      case "radio":
        return (
          <RadioGroup disabled>
            {field.options?.map((opt, i) => (
              <div key={i} className="flex items-center space-x-2">
                <RadioGroupItem value={opt} id={`${field.id}-${i}`} />
                <Label htmlFor={`${field.id}-${i}`}>{opt}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      case "rating":
        return (
          <div className="flex gap-2">
            {Array.from({ length: field.maxRating || 5 }).map((_, i) => (
              <Star key={i} className="h-6 w-6 text-muted-foreground/30" fill="currentColor" />
            ))}
          </div>
        );
      case "ranking":
        return (
          <div className="space-y-2">
            {field.options?.map((opt, i) => (
               <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-md border border-transparent">
                 <span className="text-sm font-medium">{opt}</span>
                 <GripHorizontal className="h-4 w-4 text-muted-foreground" />
               </div>
            ))}
          </div>
        );
      case "file":
        return (
           <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 flex flex-col items-center justify-center text-center bg-muted/5 hover:bg-muted/10 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground font-medium">{t("back.loaddrag")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("propert.sizefile")} {field.maxFileSize || 10}MB
                {field.acceptedFileTypes && field.acceptedFileTypes.length > 0 && ` (${field.acceptedFileTypes.join(", ")})`}
              </p>
           </div>
        );
      case "datetime":
        return (
          <div className="space-y-3">
            {!field.hideDate && (
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                <Input
                  type="date"
                  disabled
                  className="pl-10 h-10 bg-white/50 pointer-events-none text-muted-foreground"
                  placeholder={t("propert.selectDate")}
                />
              </div>
            )}
            {!field.hideTime && (
              <div className="relative">
                <Input
                  type="time"
                  disabled
                  className="pl-10 h-10 bg-white/50 pointer-events-none"
                  placeholder={t("propert.selectTime")}
                />
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            )}
          </div>
        );
      case "header":
        return null; // Rendered in header
      default:
        return <div className="text-sm text-muted-foreground">Select data-time</div>;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        console.log('SortableField onClick for field:', field.id);
        onSelect(field.id);
      }}
      className={cn(
        "group relative flex items-start gap-2 p-6 rounded-lg border border-transparent bg-white transition-all hover:shadow-md",
        isSelected ? "ring-2 ring-primary border-transparent shadow-md z-10" : "hover:border-border",
        isDragging ? "opacity-50 shadow-xl z-50" : "",
        "mb-4"
      )}
    >
      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners}
        className={cn(
          "absolute left-2 top-1/2 -translate-y-1/2 cursor-grab p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity",
          isSelected && "opacity-100"
        )}
      >
        <GripVertical className="h-5 w-5" />
      </div>

      <div className="flex-1 space-y-3 pl-6 w-full overflow-hidden">
        <div className="flex items-baseline justify-between">
            <Label className={cn(
              "text-base font-medium whitespace-normal break-words w-full",
              field.type === "header" ? "text-2xl font-bold" : ""
            )}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
        </div>
        
        {field.helperText && (
          <p className="text-sm text-muted-foreground -mt-1">{field.helperText}</p>
        )}

        {field.conditionalLogic?.dependsOn && (
          (() => {
            const dependsOnField = fields.find(f => f.id === field.conditionalLogic!.dependsOn);
            if (!dependsOnField) return null;
            const condition = field.conditionalLogic!.condition;
            const conditionText = condition === "equals" ? "Равно" :
                                 condition === "not_equals" ? "Не равно" :
                                 condition === "answered" ? "Дан ответ":
                                 "пусто"; 
            const expectedValue = field.conditionalLogic!.expectedValue;
            const valueText = Array.isArray(expectedValue) ? expectedValue.join(", ") : expectedValue || "";
            const showValue = condition === "equals";
return (
  <p className="text-xs text-muted-foreground italic -mt-1">
    Зависит от "{dependsOnField.label}", при "{conditionText}"{showValue && valueText ? ` "${valueText}"` : ""}
  </p>
);

          })()
        )}

        <div className="pointer-events-none">
          {renderFieldPreview()}
        </div>
      </div>
      
      {/* Selection Indicator */}
      {isSelected && (
        <div className="absolute -right-[1px] top-0 bottom-0 w-1 bg-primary rounded-r-lg" />
      )}
    </div>
  );
}
