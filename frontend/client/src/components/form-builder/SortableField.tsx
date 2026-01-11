import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { KeyboardEvent, MouseEvent } from "react";
import { useState, useRef, useEffect } from "react";
import { FormField } from "@/lib/form-types";
import { cn } from "@/lib/utils";
import { GripVertical, Star, Upload, GripHorizontal, CalendarDays, Clock, ChevronDown, ChevronUp, X, Plus, Check } from "lucide-react";
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
const DEFAULT_PHONE_PLACEHOLDER = "+7 (000) 000-00-00";
const PASSPORT_SERIES_NUMBER_MAX_CHARS = 11;
const PASSPORT_ISSUED_BY_MAX_CHARS = 120;
const PASSPORT_DEPARTMENT_CODE_MAX_CHARS = 7;
const PASSPORT_BIRTH_PLACE_MAX_CHARS = 120;

interface SortableFieldProps {
  field: FormField;
  isSelected: boolean;
  onSelect: (id: string, event: MouseEvent<HTMLDivElement>) => void;
  onDelete: (id: string) => void;
  updateField: (id: string, updates: Partial<FormField>) => void;
  fields: FormField[];
}

export function SortableField({ field, isSelected, onSelect, onDelete, updateField, fields }: SortableFieldProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editingElement, setEditingElement] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [editingOptions, setEditingOptions] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if  ((editingElement === "helperText" || editingElement === "label") 
      && textareaRef.current) {
      const len = editingValue.length;
      textareaRef.current.setSelectionRange(len, len);
      textareaRef.current.focus();
    }
  }, [editingElement, editingValue]);

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

  const startEditing = (element: string, initialValue?: string) => {
    setEditingElement(element);
    setEditingValue(initialValue || "");
    if (element === "options") {
      setEditingOptions(field.options ? [...field.options] : []);
    }
  };

  const saveEditing = () => {
    if (!editingElement) return;

    if (editingElement === "label") {
      updateField(field.id, { label: editingValue.slice(0, 120) });
    } else if (editingElement === "placeholder") {
      updateField(field.id, { placeholder: editingValue.slice(0, 80) });
    } else if (editingElement === "helperText") {
      updateField(field.id, { helperText: editingValue.slice(0, 1200) });
    } else if (editingElement === "options") {
      updateField(field.id, { options: editingOptions.filter(Boolean) });
    }

    setEditingElement(null);
    setEditingValue("");
    setEditingOptions([]);
  };

  const cancelEditing = () => {
    setEditingElement(null);
    setEditingValue("");
    setEditingOptions([]);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEditing();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
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
        return editingElement === "placeholder" ? (
          <Input
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={saveEditing}
            onKeyDown={handleKeyDown}
            className="bg-white border border-primary"
            autoFocus
          />
        ) : (
          <Input
            placeholder={field.placeholder}
            disabled
            className="bg-white/50 pointer-events-none cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              startEditing("placeholder", field.placeholder || "");
            }}
          />
        );
      case "email":
      case "number":
      case "snils":
      case "ogrn":
      case "bik":
      case "account":
        return editingElement === "placeholder" ? (
          <Input
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={saveEditing}
            onKeyDown={handleKeyDown}
            className="bg-white border border-primary"
            type={field.type === "number" ? "number" : "text"}
            autoFocus
          />
        ) : (
          <Input
            placeholder={field.placeholder}
            disabled
            className="bg-white/50 pointer-events-none cursor-pointer"
            type={field.type === "number" ? "number" : "text"}
            onClick={(e) => {
              e.stopPropagation();
              startEditing("placeholder", field.placeholder || "");
            }}
          />
        );
      case "inn": {
        const innMaxLength = field.innLegalEntity ? 10 : 12;
        return (
          <Input
            placeholder={t("placeholders.inn")}
            disabled
            className="bg-white/50 pointer-events-none"
            type="text"
            inputMode="numeric"
            maxLength={innMaxLength}
          />
        );
      }
      case "phone":
        return (
          <Input
            placeholder={field.placeholder || DEFAULT_PHONE_PLACEHOLDER}
            disabled
            className="bg-white/50 pointer-events-none"
            type="tel"
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
      case "passport": {
        const isRu = i18n.language.startsWith("ru");
        const placeholders = {
          seriesNumber: isRu ? "\u0421\u0435\u0440\u0438\u044f \u0438 \u043d\u043e\u043c\u0435\u0440" : "Series and number",
          issuedBy: isRu ? "\u041a\u0435\u043c \u0432\u044b\u0434\u0430\u043d" : "Issued by",
          issueDate: isRu ? "\u0414\u0430\u0442\u0430 \u0432\u044b\u0434\u0430\u0447\u0438" : "Issue date",
          departmentCode: isRu ? "\u041a\u043e\u0434 \u043f\u043e\u0434\u0440\u0430\u0437\u0434\u0435\u043b\u0435\u043d\u0438\u044f" : "Department code",
          birthPlace: isRu ? "\u041c\u0435\u0441\u0442\u043e \u0440\u043e\u0436\u0434\u0435\u043d\u0438\u044f" : "Place of birth",
        };
        const hidden = {
          seriesNumber: field.hidePassportSeriesNumber,
          issuedBy: field.hidePassportIssuedBy,
          issueDate: field.hidePassportIssueDate,
          departmentCode: field.hidePassportDepartmentCode,
          birthPlace: field.hidePassportBirthPlace,
        };

        return (
          <div className="grid gap-2">
            {!hidden.seriesNumber && (
              <Input
                placeholder={placeholders.seriesNumber}
                disabled
                maxLength={PASSPORT_SERIES_NUMBER_MAX_CHARS}
                className="bg-white/50 pointer-events-none"
              />
            )}
            {!hidden.issuedBy && (
              <Input
                placeholder={placeholders.issuedBy}
                disabled
                maxLength={PASSPORT_ISSUED_BY_MAX_CHARS}
                className="bg-white/50 pointer-events-none"
              />
            )}
            {!hidden.issueDate && (
              <Input
                type="date"
                placeholder={placeholders.issueDate}
                disabled
                className="bg-white/50 pointer-events-none text-muted-foreground"
              />
            )}
            {!hidden.departmentCode && (
              <Input
                placeholder={placeholders.departmentCode}
                disabled
                maxLength={PASSPORT_DEPARTMENT_CODE_MAX_CHARS}
                className="bg-white/50 pointer-events-none"
              />
            )}
            {!hidden.birthPlace && (
              <Input
                placeholder={placeholders.birthPlace}
                disabled
                maxLength={PASSPORT_BIRTH_PLACE_MAX_CHARS}
                className="bg-white/50 pointer-events-none"
              />
            )}
          </div>
        );
      }
      case "select":
      case "country":
      case "category":
        return editingElement === "options" ? (
          <div className="space-y-2">
            {editingOptions.map((opt, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={opt}
                  onChange={(e) => {
                    const newOptions = [...editingOptions];
                    newOptions[index] = e.target.value;
                    setEditingOptions(newOptions);
                  }}
                  className="flex-1 border border-primary"
                  autoFocus={index === 0}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    const newOptions = editingOptions.filter((_, i) => i !== index);
                    setEditingOptions(newOptions);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                setEditingOptions([...editingOptions, `Option ${editingOptions.length + 1}`]);
              }}
            >
              <Plus className="h-4 w-4 mr-2" /> {t("propert.addopti")}
            </Button>
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={saveEditing}>
                <Check className="h-4 w-4 mr-2" /> Save
              </Button>
              <Button variant="outline" size="sm" onClick={cancelEditing}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Select disabled>
            <SelectTrigger className="bg-white/50 cursor-pointer" onClick={(e) => {
              e.stopPropagation();
              startEditing("options");
            }}>
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
        return editingElement === "options" ? (
          <div className="space-y-2">
            {editingOptions.map((opt, index) => (
              <div key={index} className="flex items-center gap-2">
                <Checkbox disabled />
                <Input
                  value={opt}
                  onChange={(e) => {
                    const newOptions = [...editingOptions];
                    newOptions[index] = e.target.value;
                    setEditingOptions(newOptions);
                  }}
                  className="flex-1 border border-primary"
                  autoFocus={index === 0}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    const newOptions = editingOptions.filter((_, i) => i !== index);
                    setEditingOptions(newOptions);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                setEditingOptions([...editingOptions, `Option ${editingOptions.length + 1}`]);
              }}
            >
              <Plus className="h-4 w-4 mr-2" /> {t("propert.addopti")}
            </Button>
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={saveEditing}>
                <Check className="h-4 w-4 mr-2" /> Save
              </Button>
              <Button variant="outline" size="sm" onClick={cancelEditing}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 cursor-pointer" onClick={(e) => {
            e.stopPropagation();
            startEditing("options");
          }}>
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
        return editingElement === "options" ? (
          <div className="space-y-2">
            {editingOptions.map((opt, index) => (
              <div key={index} className="flex items-center gap-2">
                <RadioGroupItem value={opt} disabled />
                <Input
                  value={opt}
                  onChange={(e) => {
                    const newOptions = [...editingOptions];
                    newOptions[index] = e.target.value;
                    setEditingOptions(newOptions);
                  }}
                  className="flex-1 border border-primary"
                  autoFocus={index === 0}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    const newOptions = editingOptions.filter((_, i) => i !== index);
                    setEditingOptions(newOptions);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                setEditingOptions([...editingOptions, `Option ${editingOptions.length + 1}`]);
              }}
            >
              <Plus className="h-4 w-4 mr-2" /> {t("propert.addopti")}
            </Button>
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={saveEditing}>
                <Check className="h-4 w-4 mr-2" /> Save
              </Button>
              <Button variant="outline" size="sm" onClick={cancelEditing}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <RadioGroup disabled>
            <div className="cursor-pointer" onClick={(e) => {
              e.stopPropagation();
              startEditing("options");
            }}>
              {field.options?.map((opt, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt} id={`${field.id}-${i}`} />
                  <Label htmlFor={`${field.id}-${i}`}>{opt}</Label>
                </div>
              ))}
            </div>
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
        return editingElement === "options" ? (
          <div className="space-y-2">
            {editingOptions.map((opt, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-md border border-transparent">
                <Input
                  value={opt}
                  onChange={(e) => {
                    const newOptions = [...editingOptions];
                    newOptions[index] = e.target.value;
                    setEditingOptions(newOptions);
                  }}
                  className="flex-1 border border-primary bg-white"
                  autoFocus={index === 0}
                />
                <div className="flex items-center gap-2">
                  <GripHorizontal className="h-4 w-4 text-muted-foreground" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      const newOptions = editingOptions.filter((_, i) => i !== index);
                      setEditingOptions(newOptions);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                setEditingOptions([...editingOptions, `Option ${editingOptions.length + 1}`]);
              }}
            >
              <Plus className="h-4 w-4 mr-2" /> {t("propert.addopti")}
            </Button>
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={saveEditing}>
                <Check className="h-4 w-4 mr-2" /> Save
              </Button>
              <Button variant="outline" size="sm" onClick={cancelEditing}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 cursor-pointer" onClick={(e) => {
            e.stopPropagation();
            startEditing("options");
          }}>
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
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        console.log('SortableField onClick for field:', field.id);
        onSelect(field.id, e);
      }}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Delete") {
          e.preventDefault();
          onDelete(field.id);
        }
      }}
      className={cn(
        "group relative flex items-start gap-2 rounded-lg border border-transparent bg-white transition-all hover:shadow-md",
        isSelected ? "ring-2 ring-primary border-transparent shadow-md z-10" : "hover:border-border",
        isDragging ? "opacity-50 shadow-xl z-50" : "",
        "mb-4",
        isCollapsed ? "p-4" : "p-6"
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
        <div className={cn(
          "flex items-baseline justify-between",
          isCollapsed && "py-2"
        )}>
          {editingElement === "label" ? (
            <Textarea
              value={editingValue}
              ref={textareaRef}
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={saveEditing}
              onKeyDown={handleKeyDown}
              className={cn(
                "mt-1 text-base font-medium border border-primary bg-white resize-none min-h-[2rem] px-2 py-1",
                field.type === "header" ? "text-2xl font-bold" : ""
              )}
              maxLength={120}
              autoFocus
              rows={1}
            />
          ) : (
            <Label
              className={cn(
                "mt-1 text-base font-medium whitespace-normal break-words w-full cursor-pointer hover:bg-muted/50 px-2 py-1 rounded transition-colors",
                field.type === "header" ? "text-2xl font-bold" : ""
              )}
              onClick={(e) => {
                e.stopPropagation();
                startEditing("label", field.label);
              }}
            >
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
          )}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(!isCollapsed);
              }}
              className="p-1 ml-2 h-6 w-6 hover:bg-muted"
            >
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
        </div>
        
        {!isCollapsed && (
          <>
            {editingElement === "helperText" ? (
              <Textarea
                ref={textareaRef}
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onBlur={saveEditing}
                onKeyDown={handleKeyDown}
                className="mt-1 text-sm w-115 text-muted-foreground border border-primary bg-white resize-none min-h-[2rem] px-2 py-1 -mt-1"
                maxLength={1200}
                autoFocus
                rows={1}
                placeholder="Введите вспомогательный текст..."
              />
            ) : field.helperText ? (
              <p
                className="text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 px-2 py-1 mr-8 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  startEditing("helperText", field.helperText);
                }}
              >
                {field.helperText}
              </p>
            ) : (
              <p
                className="mt-1 text-sm text-muted-foreground/50 -mt-1 cursor-pointer hover:bg-muted/50 px-2 py-1 mr-8 rounded transition-colors italic"
                onClick={(e) => {
                  e.stopPropagation();
                  startEditing("helperText", "");
                }}
              >
                + Добавить вспомогательный текст
              </p>
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
          </>
        )}
      </div>
      
      {/* Selection Indicator */}
      {isSelected && (
        <div className={cn(
          "absolute -right-[1px] w-1 bg-primary rounded-r-lg",
          isCollapsed ? "top-0 bottom-0" : "top-0 bottom-0"
        )} />
      )}
    </div>
  );
}

