import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { KeyboardEvent, MouseEvent } from "react";
import { useState, useRef, useEffect, useMemo } from "react";
import type { FormElementModel } from "@/form/types";
import { presets } from "@/form/presets";
import { cn } from "@/lib/utils";
import { GripVertical, Upload, GripHorizontal, CalendarDays, Clock, ChevronDown, ChevronUp, X, Plus, Check } from "lucide-react";
import { ElementAttachments } from "@/components/form-builder/ElementAttachments";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { useTranslation } from "react-i18next";
import { MatrixCorrectAnswersModal } from "./MatrixCorrectAnswersModal";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getCountryOptions, isCountryField, normalizeCountrySearch } from "@/lib/countries";
import { t } from "i18next";
import { enUS, ru } from "date-fns/locale";

const MAX_UPLOAD_MB = 20;

interface CanvasSelectPreviewProps {
  options: string[];
  placeholder: string;
  allowOtherOption: boolean;
  otherOptionLabel: string;
}

function CanvasSelectPreview({
  options,
  placeholder,
  allowOtherOption,
  otherOptionLabel,
}: CanvasSelectPreviewProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const visibleOptions = options.filter(Boolean);

  const closePreview = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.blur());
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          requestAnimationFrame(() => triggerRef.current?.blur());
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-white/50 font-normal focus-visible:ring-0 focus-visible:ring-offset-0"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <span className="truncate text-muted-foreground dark:!text-slate-700">{placeholder}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-1 w-[var(--radix-popover-trigger-width)] max-h-72 overflow-y-auto"
        align="start"
        side="bottom"
        sideOffset={4}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {visibleOptions.map((opt, i) => (
          <button
            key={`${opt}-${i}`}
            type="button"
            className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
            onClick={closePreview}
          >
            {opt}
          </button>
        ))}
        {allowOtherOption && (
          <button
            type="button"
            className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
            onClick={closePreview}
          >
            {otherOptionLabel}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface CanvasCountrySelectPreviewProps {
  options: string[];
  placeholder: string;
}

function CanvasCountrySelectPreview({ options, placeholder }: CanvasCountrySelectPreviewProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const normalizedQuery = useMemo(() => normalizeCountrySearch(searchValue), [searchValue]);
  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options;
    return options.filter((option) => normalizeCountrySearch(option).includes(normalizedQuery));
  }, [options, normalizedQuery]);

  useEffect(() => {
    if (!open) {
      setSearchValue("");
      requestAnimationFrame(() => triggerRef.current?.blur());
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-white/50 font-normal focus-visible:ring-0 focus-visible:ring-offset-0"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <span className="truncate text-muted-foreground dark:!text-slate-700">{placeholder}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[var(--radix-popover-trigger-width)]"
        align="start"
        side="bottom"
        sideOffset={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("placeholders.search")}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList className="max-h-72">
            <CommandEmpty>{t("common.noResults")}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    setOpen(false);
                  }}
                >
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CanvasDatePreview({ placeholder }: { placeholder: string }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(new Date());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const calendarLocale = i18n.language?.startsWith("ru") ? ru : enUS;

  const closePreview = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.blur());
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          requestAnimationFrame(() => triggerRef.current?.blur());
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          className="w-full justify-start bg-white/50 text-left font-normal text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <CalendarDays className="mr-2 h-4 w-4" />
          <span>{placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        side="bottom"
        sideOffset={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <Calendar
          mode="single"
          month={month}
          onMonthChange={setMonth}
          locale={calendarLocale}
          selected={undefined}
          onSelect={closePreview}
        />
      </PopoverContent>
    </Popover>
  );
}

function CanvasTimePreview({ placeholder }: { placeholder: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const timeOptions = useMemo(
    () =>
      Array.from({ length: 48 }, (_, index) => {
        const hours = Math.floor(index / 2).toString().padStart(2, "0");
        const minutes = index % 2 === 0 ? "00" : "30";
        return `${hours}:${minutes}`;
      }),
    []
  );

  const closePreview = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.blur());
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          requestAnimationFrame(() => triggerRef.current?.blur());
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          className="w-full justify-start bg-white/50 text-left font-normal text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <Clock className="mr-2 h-4 w-4" />
          <span>{placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-1 w-[var(--radix-popover-trigger-width)] max-h-60 overflow-y-auto"
        align="start"
        side="bottom"
        sideOffset={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {timeOptions.map((time) => (
          <button
            key={time}
            type="button"
            className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
            onClick={closePreview}
          >
            {time}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

interface MatrixPreviewProps {
  fieldId: string;
  rows: string[];
  columns: string[];
  multiplePerRow: boolean;
  matrixInputType?: "radio" | "checkbox" | "number" | "text";
  correctAnswers: string[];
  onOpenModal: () => void;
}

function MatrixPreviewTable({
  fieldId,
  rows,
  columns,
  multiplePerRow,
  matrixInputType = "radio",
  correctAnswers,
  onOpenModal,
}: MatrixPreviewProps) {
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  return (
    <div className="space-y-3">
      <div
        className="matrix-scroll-container overflow-auto scroll-smooth relative"
        style={{ maxHeight: '500px' }}
        onScroll={(e) => {
          const el = e.currentTarget;

          if (el.scrollLeft > 0) {
            setIsScrolling(true);
          }

          if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
          scrollTimeout.current = setTimeout(() => setIsScrolling(false), 150);
        }}
      >
        <table className="table-fixed border-collapse border border-muted-foreground/20 text-sm min-w-[600px] relative">
          <thead className="relative">
            <tr>
              <th
                className={cn(
                  "sticky left-0 z-30 bg-white p-2 font-medium border border-muted-foreground/20",
                  "after:absolute after:top-0 after:right-0 after:h-full after:w-[4px] after:bg-white after:shadow-[2px_0_4px_rgba(0,0,0,0.12)]",
                  isScrolling && "ring-2 ring-primary/40 shadow-lg"
                )}
                style={{ minWidth: '80px', maxWidth: '80px' }}
              >
                <span className="sr-only">Rows</span>
              </th>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={cn(
                    "border border-muted-foreground/20 p-2 text-center bg-muted/30 font-medium whitespace-nowrap relative z-10",
                    "sticky top-0 z-20 bg-white",
                    "after:absolute after:left-0 after:bottom-[-0px] after:w-full after:h-[4px]",
                    "after:bg-white after:shadow-[0_2px_4px_rgba(0,0,0,0.12)]",
                    isScrolling && "ring-2 ring-primary/40 shadow-lg"
                  )}
                  style={{ minWidth: '100px' }}
                >
                  {col || `Column ${idx + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="relative group">
                <td
                  className={cn(
                    "sticky left-0 z-30 whitespace-nowrap",
                    "bg-white p-2 font-medium border border-muted-foreground/20",
                    "after:absolute after:top-0 after:right-0 after:h-full after:w-[4px] after:bg-white after:shadow-[2px_0_4px_rgba(0,0,0,0.12)]",
                    isScrolling && "ring-2 ring-primary/40 shadow-lg"
                  )}
                  style={{
                    minWidth: '80px',
                    maxWidth: '80px',
                    width: '80px'
                  }}
                >
                  <div className="truncate" title={row || `Row ${rowIdx + 1}`}>
                    {row || `Row ${rowIdx + 1}`}
                  </div>
                </td>
                {columns.map((_, colIdx) => (
                  <td
                    key={`${fieldId}-${rowIdx}-${colIdx}`}
                    className={cn(
                      "border border-muted-foreground/20 p-2 relative z-0",
                      (matrixInputType === "number" || matrixInputType === "text") ? "" : "text-center"
                    )}
                    style={{ minWidth: '100px' }}
                  >
                    <div className="relative">
                      {matrixInputType === "number" ? (
                        <Input disabled type="number" className="w-full h-8 text-sm" placeholder="-" />
                      ) : matrixInputType === "text" ? (
                        <Input disabled type="text" className="w-full h-8 text-sm" placeholder="-" />
                      ) : multiplePerRow ? (
                        <Checkbox disabled className="mx-auto relative z-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 mx-auto relative z-0"></div>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div
          className="absolute top-0 bottom-0 w-px bg-border pointer-events-none z-20"
          style={{ left: '80px' }}
        />
      </div>

      {correctAnswers.length > 0 && (
        <div className="text-xs text-green-600 font-medium flex items-center gap-1">
          <Check className="h-3 w-3" />
          {t("propert.correctAnswers")}: {correctAnswers.length}
        </div>
      )}

      <div className="mt-3">
        <Button
          size="sm"
          variant="outline"
          className="w-full border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
          onClick={(e) => {
            e.stopPropagation();
            onOpenModal();
          }}
        >
          <Check className="h-4 w-4 mr-2" />
          {t("propert.fixCorrectAnswers")}
        </Button>
      </div>
    </div>
  );
}

interface SortableFieldProps {
  field: FormElementModel;
  isSelected: boolean;
  onSelect: (id: string, event: MouseEvent<HTMLDivElement>) => void;
  updateField: (id: string, updates: Partial<FormElementModel>) => void;
  fields: FormElementModel[];
}

export function SortableField({ field, isSelected, onSelect, updateField, fields }: SortableFieldProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editingElement, setEditingElement] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [editingOptions, setEditingOptions] = useState<string[]>([]);
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if ((editingElement === "helperText" || editingElement === "label") && textareaRef.current) {
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
      textareaRef.current.focus();
    }
  }, [editingElement]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const { t, i18n } = useTranslation();
  const props = field.props as Record<string, any>;
  const isCountrySelect = isCountryField(field);
  const countryOptions = isCountrySelect ? getCountryOptions(i18n.language).map((option) => option.label) : [];
  const allowOtherOption =
    Boolean(props.allowOther) &&
    !isCountrySelect &&
    (field.widgetType === "select" || field.widgetType === "checkbox" || field.widgetType === "radio");
  const otherOptionLabel = t("common.otherOption");
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const startEditing = (element: string, initialValue?: string) => {
    if (element === "options" && isCountrySelect) {
      return;
    }
    setEditingElement(element);
    setEditingValue(initialValue || "");
    if (element === "options") {
      const options = (field.props as Record<string, unknown>).options as string[] | undefined;
      setEditingOptions(options ? [...options] : []);
    }
  };

  const saveEditing = () => {
    if (!editingElement) return;

    if (editingElement === "label") {
      updateField(field.id, { label: editingValue.slice(0, 120) });
    } else if (editingElement === "placeholder") {
      updateField(field.id, { props: { placeholder: editingValue.slice(0, 80) } });
    } else if (editingElement === "helperText") {
      updateField(field.id, { description: editingValue.slice(0, 1200) });
    } else if (editingElement === "options") {
      if (isCountrySelect) {
        setEditingElement(null);
        setEditingValue("");
        setEditingOptions([]);
        return;
      }
      updateField(field.id, { props: { options: editingOptions.filter(Boolean) } });
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
    if (e.key === "Delete" || e.key === "Backspace") {
      e.stopPropagation();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEditing();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  const renderTextInputPreview = () => {
    const preset = field.semanticType ? presets[field.semanticType] : undefined;

    if (preset?.parts) {
      return (
        <div className="grid gap-2">
          {preset.parts.map((part) => {
            if (part.hiddenProp && props[part.hiddenProp]) {
              return null;
            }
            const placeholder = part.placeholderKey ? t(part.placeholderKey) : part.placeholder || "";
            const optionItems = part.options ?? [];
            if (optionItems.length > 0) {
              return (
                <RadioGroup key={part.key} disabled className="flex flex-row flex-wrap gap-4">
                  {optionItems.map((option) => {
                    const optionLabel = option.labelKey ? t(option.labelKey) : option.label || option.value;
                    const optionId = `preview-${field.id}-${part.key}-${option.value}`;
                    return (
                      <div key={option.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={option.value} id={optionId} disabled />
                        <Label htmlFor={optionId} className="text-muted-foreground">
                          {optionLabel}
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              );
            }
            if (part.inputType === "date") {
              return (
                <div key={part.key} className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    type="text"
                    value=""
                    placeholder={placeholder || t("propert.dateFormatPlaceholder")}
                    disabled
                    className="pl-10 h-10 bg-white/50 pointer-events-none text-muted-foreground"
                  />
                </div>
              );
            }
            return (
              <Input
                key={part.key}
                placeholder={placeholder}
                disabled
                maxLength={part.maxChars}
                className="bg-white/50 pointer-events-none"
              />
            );
          })}
        </div>
      );
    }

    const labelKey = preset?.getLabelKey ? preset.getLabelKey(props) : preset?.labelKey;
    const placeholderKey = labelKey?.startsWith("inputLabels.")
      ? labelKey
      : preset?.getPlaceholderKey
        ? preset.getPlaceholderKey(props)
        : preset?.placeholderKey;
    const canEditPlaceholder = field.semanticType !== "inn" && field.semanticType !== "ogrn";
    const placeholder = placeholderKey
      ? t(placeholderKey)
      : preset?.placeholder || (canEditPlaceholder ? (props.placeholder as string) || "" : "");

    if (!canEditPlaceholder) {
      return (
        <Input
          placeholder={placeholder}
          disabled
          className="bg-white/50 pointer-events-none"
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
        placeholder={placeholder}
        disabled
        className="bg-white/50 pointer-events-none cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          startEditing("placeholder", placeholder);
        }}
      />
    );
  };

  const renderFieldPreview = () => {
    const options = isCountrySelect ? countryOptions : (props.options as string[]) || [];

    switch (field.widgetType) {
      case "text_input":
        return renderTextInputPreview();
      case "textarea":
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
          <Textarea
            placeholder={(props.placeholder as string) || ""}
            disabled
            className="bg-white/50 pointer-events-none resize-none cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              startEditing("placeholder", (props.placeholder as string) || "");
            }}
          />
        );
      case "number_input":
        return editingElement === "placeholder" ? (
          <Input
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={saveEditing}
            onKeyDown={handleKeyDown}
            className="bg-white border border-primary"
            type="number"
            autoFocus
          />
        ) : (
          <Input
            placeholder={(props.placeholder as string) || ""}
            disabled
            className="bg-white/50 pointer-events-none cursor-pointer"
            type="number"
            onClick={(e) => {
              e.stopPropagation();
              startEditing("placeholder", (props.placeholder as string) || "");
            }}
          />
        );
      case "select":
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
          isCountrySelect ? (
            <CanvasCountrySelectPreview
              options={countryOptions}
              placeholder={(props.placeholder as string) || t("placeholders.selectCountry")}
            />
          ) : (
            <CanvasSelectPreview
              options={options}
              placeholder={(props.placeholder as string) || t("common.selectopt")}
              allowOtherOption={allowOtherOption}
              otherOptionLabel={otherOptionLabel}
            />
          )
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
          <div
            className="space-y-2 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              startEditing("options");
            }}
          >
            {options.map((opt, i) => (
              <div key={i} className="flex items-center space-x-2">
                <Checkbox id={`${field.id}-${i}`} disabled />
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {opt}
                </label>
              </div>
            ))}
            {allowOtherOption && (
              <div className="flex items-center space-x-2">
                <Checkbox id={`${field.id}-other`} disabled />
                <label className="text-sm font-medium leading-none text-muted-foreground">
                  {otherOptionLabel}
                </label>
                <Input
                  defaultValue=""
                  disabled
                  maxLength={255}
                  placeholder={t("propert.otherValuePlaceholder")}
                  className="max-w-xs bg-white/50 pointer-events-none"
                />
              </div>
            )}
          </div>
        );
      case "radio":
        return editingElement === "options" ? (
          <div className="space-y-2 mb-4">
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
          <RadioGroup disabled className="space-y-3">
            <div
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                startEditing("options");
              }}
            >
              {options.map((opt, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt} id={`${field.id}-${i}`} />
                  <Label htmlFor={`${field.id}-${i}`} className="py-1" >{opt}</Label>
                </div>
              ))}
              {allowOtherOption && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="__other_preview__" id={`${field.id}-other`} />
                    <Label htmlFor={`${field.id}-other`} className="py-1">{otherOptionLabel}</Label>
                  </div>
                  <Input
                    defaultValue=""
                    disabled
                    maxLength={255}
                    placeholder={t("propert.otherValuePlaceholder")}
                    className="max-w-xs bg-white/50 pointer-events-none"
                  />
                </div>
              )}
            </div>
          </RadioGroup>
        );
      case "rating": {
        const maxR = Number(props.maxRating);
        const maxRating = Number.isFinite(maxR) ? Math.min(10, Math.max(1, maxR)) : 10;
        const values = Array.from({ length: Math.max(0, maxRating) }, (_, i) => i + 1);
        return (
          <div className="flex flex-wrap gap-2">
            {values.map((value) => (
              <div
                key={value}
                className="h-8 min-w-8 px-2 rounded-md border border-muted-foreground/30 bg-muted/20 text-sm text-muted-foreground flex items-center justify-center"
              >
                {value}
              </div>
            ))}
          </div>
        );
      }
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
          <div
            className="space-y-2 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              startEditing("options");
            }}
          >
            {options.map((opt, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-md border border-transparent">
                <span className="text-sm font-medium">{opt}</span>
                <GripHorizontal className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        );
      case "file_upload":
        return (
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 flex flex-col items-center justify-center text-center bg-muted/5 hover:bg-muted/10 transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground font-medium">{t("back.loaddrag")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("propert.sizefile")} {(props.maxFileSize as number) || MAX_UPLOAD_MB}MB
              {Array.isArray(props.acceptedFileTypes) && props.acceptedFileTypes.length > 0 && ` (${(props.acceptedFileTypes as string[]).join(", ")})`}
            </p>
          </div>
        );
      case "datetime":
        return (
          <div className="space-y-3">
            {!props.hideDate && (
              <CanvasDatePreview placeholder={t("propert.selectDate")} />
            )}
            {!props.hideTime && (
              <CanvasTimePreview placeholder={t("propert.selectTime")} />
            )}
          </div>
        );
      case "matrix": {
        const rows = (props.rows as string[]) || [];
        const columns = (props.columns as string[]) || [];
        const multiplePerRow = Boolean(props.multiplePerRow);
        const matrixInputType = (props.matrixInputType as "radio" | "checkbox" | "number" | "text") || (multiplePerRow ? "checkbox" : "radio");
        const matrixCorrectAnswers = (props.correctAnswers as string[]) || [];

        return (
          <>
            <MatrixPreviewTable
              fieldId={field.id}
              rows={rows}
              columns={columns}
              multiplePerRow={multiplePerRow}
              matrixInputType={matrixInputType}
              correctAnswers={matrixCorrectAnswers}
              onOpenModal={() => setIsMatrixModalOpen(true)}
            />
            <MatrixCorrectAnswersModal
              field={field}
              open={isMatrixModalOpen}
              onOpenChange={setIsMatrixModalOpen}
              updateField={updateField}
            />
          </>
        );
      }
      case "header":
        return null;
      default:
        return <div className="text-sm text-muted-foreground">Select data-time</div>;
    }
  };

  return (
    <div
      ref={setNodeRef}
      data-testid="canvas-field"
      data-field-id={field.id}
      style={style}
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(field.id, e);
      }}
      className={cn(
        "group relative flex items-start gap-2 rounded-lg border border-transparent bg-white transition-all hover:shadow-md",
        isSelected ? "ring-2 ring-primary border-transparent shadow-md z-10" : "hover:border-border",
        isDragging ? "opacity-50 shadow-xl z-50" : "",
        "mb-4",
        isCollapsed ? "p-4" : "p-6"
      )}
    >
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
        <div className={cn("flex items-baseline justify-between", isCollapsed && "py-2")}>
          {editingElement === "label" ? (
            <Textarea
              value={editingValue}
              ref={textareaRef}
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={saveEditing}
              onKeyDown={handleKeyDown}
              className={cn(
                "mt-1 text-base font-medium border border-primary bg-white resize-none min-h-[2rem] px-2 py-1",
                field.widgetType === "header" ? "text-2xl font-bold" : ""
              )}
              maxLength={120}
              autoFocus
              rows={1}
            />
          ) : (
            <Label
              className={cn(
                "mt-1 text-base font-medium whitespace-normal break-words w-full cursor-pointer hover:bg-muted/50 px-2 py-1 rounded transition-colors",
                field.widgetType === "header" ? "text-2xl font-bold" : ""
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
                placeholder={t("propert.helperPlaceholder")}
              />
            ) : field.description ? (
              <p
                className="text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 px-2 py-1 mr-8 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  startEditing("helperText", field.description || "");
                }}
              >
                {field.description}
              </p>
            ) : (
              <p
                className="mt-1 text-sm text-muted-foreground/50 -mt-1 cursor-pointer hover:bg-muted/50 px-2 py-1 mr-8 rounded transition-colors italic"
                onClick={(e) => {
                  e.stopPropagation();
                  startEditing("helperText", "");
                }}
              >
                {t("propert.addHelperText")}
              </p>
            )}

            {props.conditionalLogic?.dependsOn && (() => {
              const dependsOnField = fields.find((f) => f.id === props.conditionalLogic!.dependsOn);
              if (!dependsOnField) return null;
              const condition = props.conditionalLogic!.condition;
              const conditionText = condition === "equals" ? "Equals" :
                condition === "not_equals" ? "Not equals" :
                condition === "answered" ? "Answered" :
                "";
              const expectedValue = props.conditionalLogic!.expectedValue as string | string[] | undefined;
              const valueText = Array.isArray(expectedValue) ? expectedValue.join(", ") : expectedValue || "";
              const showValue = condition === "equals";
              return (
                <p className="text-xs text-muted-foreground italic -mt-1">
                  Depends on "{dependsOnField.label}", "{conditionText}"{showValue && valueText ? ` "${valueText}"` : ""}
                </p>
              );
            })()}

            <div className={cn(
              "pointer-events-none",
              (field.widgetType === "select" || field.widgetType === "datetime" || field.widgetType === "matrix") && "!pointer-events-auto"
            )}>
              {renderFieldPreview()}
            </div>
            <ElementAttachments
              attachments={(props.attachments as any) || []}
              displayMode={(props.attachmentsDisplay as any) || "slider"}
            />
          </>
        )}
      </div>

      {isSelected && (
        <div className={cn(
          "absolute -right-[1px] w-1 bg-primary rounded-r-lg",
          isCollapsed ? "top-0 bottom-0" : "top-0 bottom-0"
        )} />
      )}
    </div>
  );
}

