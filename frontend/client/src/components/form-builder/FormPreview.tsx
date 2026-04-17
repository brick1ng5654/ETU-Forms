import React, { useState, useMemo, useEffect, useRef } from "react";
import type {
  AnswerValue,
  AnswersById,
  DateTimeAnswer,
  ElementAttachment,
  FormElementModel,
  FormPageModel,
  FormSchema,
  FullNameAnswer,
  PassportAnswer,
} from "@/form/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Clock, CheckCircle2, GripVertical, Upload, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { enUS, ru } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { presets } from "@/form/presets";
import { validateForm } from "@/form/validation";
import { buildAnswersPayload } from "@/form/answers";
import {
  CHOICE_OTHER_MAX_CHARS,
  CHOICE_OTHER_SENTINEL,
  getChoiceComparableValues,
  getChoiceMultiState,
  getChoiceSingleState,
  isChoiceAnswer,
} from "@/form/choice-answer";
import { ElementAttachments } from "@/components/form-builder/ElementAttachments";
import { toast } from "@/hooks/use-toast";
import { getCountryLabel, getCountryOptions, isCountryField, normalizeCountrySearch, resolveCountryCode } from "@/lib/countries";
import { formatPoints } from "@/lib/points-label";
import { authHeader } from "@/lib/auth";
import { DatePickerInput } from "@/components/ui/date-picker-input";

interface CollapsibleTextareaProps extends React.ComponentProps<typeof Textarea> {
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  collapsedLines?: number;
  indicator?: React.ReactNode;
}

const DEFAULT_TEXTAREA_LINE_HEIGHT = 20;
const MAX_UPLOAD_MB = 20;
const REQUIRED_WARNING_DURATION_MS = 6000;
const REQUIRED_WARNING_FADE_MS = 450;
const FOCUS_SCROLL_SETTLE_MS = 320;

const getTextareaMetrics = (textarea: HTMLTextAreaElement) => {
  const computed = window.getComputedStyle(textarea);
  const lineHeight = parseFloat(computed.lineHeight);
  const fontSize = parseFloat(computed.fontSize);
  const resolvedLineHeight = Number.isFinite(lineHeight)
    ? lineHeight
    : Number.isFinite(fontSize)
      ? fontSize * 1.5
      : DEFAULT_TEXTAREA_LINE_HEIGHT;
  const paddingTop = parseFloat(computed.paddingTop) || 0;
  const paddingBottom = parseFloat(computed.paddingBottom) || 0;

  return {
    lineHeight: resolvedLineHeight,
    paddingTop,
    paddingBottom,
    lineCount: Math.ceil(textarea.scrollHeight / resolvedLineHeight),
  };
};

function getPFromLocation(loc: string) {
  const qIndex = loc.indexOf("?");
  if (qIndex === -1) return null;
  const params = new URLSearchParams(loc.slice(qIndex));
  const raw = params.get("p");
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

function setPInLocation(loc: string, pageId: number) {
  const [path, query = ""] = loc.split("?");
  const params = new URLSearchParams(query);
  params.set("p", String(pageId));
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
function CollapsibleTextarea({
  value,
  onChange,
  className,
  textareaRef,
  collapsedLines = 10,
  indicator,
  onFocus,
  onBlur,
  disabled,
  ...props
}: CollapsibleTextareaProps) {
  const { t } = useTranslation();
  const localRef = useRef<HTMLTextAreaElement>(null);
  const resolvedRef = textareaRef ?? localRef;
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const hasOverflowRef = useRef(false);

  useEffect(() => {
    const textarea = resolvedRef.current;
    if (textarea) {
      const currentScrollTop = textarea.scrollTop;
      const prevHeight = textarea.offsetHeight;
      textarea.style.transition = "height 440ms ease";
      textarea.style.height = "auto";
      const { lineHeight, paddingTop, paddingBottom, lineCount } = getTextareaMetrics(textarea);
      const overflow = lineCount > collapsedLines;
      if (hasOverflowRef.current !== overflow) {
        hasOverflowRef.current = overflow;
        setHasOverflow(overflow);
      }
      const collapsedHeight = Math.ceil(lineHeight * collapsedLines + paddingTop + paddingBottom + 4);
      const targetHeight = overflow && !isExpanded ? collapsedHeight : textarea.scrollHeight;
      const startHeight = `${prevHeight}px`;
      const endHeight = `${targetHeight}px`;
      if (startHeight === endHeight) {
        textarea.style.height = endHeight;
        textarea.scrollTop = currentScrollTop;
        return;
      }
      textarea.style.height = startHeight;
      void textarea.offsetHeight;
      requestAnimationFrame(() => {
        textarea.style.height = endHeight;
        textarea.scrollTop = currentScrollTop;
      });
    }
  }, [value, resolvedRef, collapsedLines, isExpanded]);

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Textarea
          ref={resolvedRef}
          value={value}
          onChange={onChange}
          onFocus={(event) => {
            setIsExpanded(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsExpanded(false);
            onBlur?.(event);
          }}
          disabled={disabled}
          className={cn("resize-none overflow-hidden", className)}
          {...props}
        />
      </div>
      {(indicator || hasOverflow) && (
        <div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            {hasOverflow && (
              isExpanded ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-1 text-muted-foreground"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setIsExpanded(false);
                    resolvedRef.current?.blur();
                  }}
                >
                  {t("common.showLess")}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-1 text-muted-foreground"
                  onClick={() => {
                    setIsExpanded(true);
                  }}
                >
                  {t("common.showMore")}
                </Button>
              )
            )}
          </div>
          <div className="flex items-center gap-3">
            {indicator}
          </div>
        </div>
      )}
    </div>
  );
}

interface SortableItemProps {
  id: string;
  disabled?: boolean;
}

interface LengthIndicatorProps {
  len: number;
  limit: number;
  isError: boolean;
  isComplete: boolean;
}

interface CountrySelectProps {
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  onTouched: () => void;
}

function CountrySelect({ value, placeholder, disabled, onValueChange, onTouched }: CountrySelectProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const locale = i18n.language || "en";
  const options = useMemo(() => getCountryOptions(locale), [locale]);
  const normalizedValue = String(value ?? "").trim();
  const isCodeLikeValue = /^[A-Za-z]{2}$/.test(normalizedValue);
  const selectedCode = resolveCountryCode(value) || "";
  const selectedLabel = isCodeLikeValue
    ? (selectedCode ? getCountryLabel(selectedCode, locale) ?? normalizedValue : normalizedValue)
    : normalizedValue;
  const listMaxHeight = 5 * 36;
  const normalizedQuery = useMemo(() => normalizeCountrySearch(searchValue), [searchValue]);
  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options;
    return options.filter((option) => option.search.includes(normalizedQuery));
  }, [options, normalizedQuery]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!disabled) {
      setOpen(nextOpen);
    }
  };

  const getScrollParent = (node: HTMLElement | null) => {
    let current = node?.parentElement ?? null;
    while (current) {
      const style = window.getComputedStyle(current);
      const overflowY = style.overflowY;
      if ((overflowY === "auto" || overflowY === "scroll") && current.scrollHeight > current.clientHeight) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  };

  useEffect(() => {
    if (!open) return;
    const scrollParent = getScrollParent(triggerRef.current);
    const scrollTop = scrollParent?.scrollTop ?? 0;
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
      if (scrollParent) {
        scrollParent.scrollTop = scrollTop;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (open) return;
    setSearchValue("");
  }, [open]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between"
          ref={triggerRef}
        >
          <span className={cn(!selectedLabel && "text-muted-foreground dark:!text-slate-700")}>
            {selectedLabel || placeholder || t("common.selectopt")}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[--radix-popover-trigger-width]"
        align="start"
        side="bottom"
        sideOffset={8}
        portalled={false}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("placeholders.search")}
            disabled={disabled}
            ref={inputRef}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList style={{ maxHeight: listMaxHeight }}>
            <CommandEmpty>{t("common.noResults")}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.code}
                  value={option.search}
                  onSelect={() => {
                    // Persist full display label, not short ISO code.
                    onValueChange(option.label);
                    onTouched();
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedCode === option.code ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface MatrixAnswerProps {
  fieldId: string;
  rows: string[];
  columns: string[];
  multiplePerRow: boolean;
  matrixInputType?: "radio" | "checkbox" | "number" | "text";
  matrixNumberMin?: number;
  matrixNumberMax?: number;
  matrixTextMaxLength?: number;
  value: string[] | Record<string, string>;
  disabled: boolean;
  onChange: (value: string[] | Record<string, string>) => void;
  onTouched: () => void;
}

function MatrixAnswerInput({
  fieldId,
  rows,
  columns,
  multiplePerRow,
  matrixInputType = "radio",
  matrixNumberMin,
  matrixNumberMax,
  matrixTextMaxLength,
  value,
  disabled,
  onChange,
  onTouched,
}: MatrixAnswerProps) {
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  // Determine if value is array (for radio/checkbox) or object (for number/text)
  const isArrayValue = Array.isArray(value);
  const arrayValue = isArrayValue ? (value as string[]) : [];
  const objectValue = isArrayValue ? {} : (value as Record<string, string>);

  const isCellSelected = (rowIdx: number, colIdx: number) => {
    if (matrixInputType === "number" || matrixInputType === "text") {
      const cellKey = `${rowIdx + 1}:${colIdx + 1}`;
      return Boolean(objectValue[cellKey]);
    }
    return arrayValue.includes(`${rowIdx + 1}:${colIdx + 1}`);
  };

  const toggleCell = (rowIdx: number, colIdx: number) => {
    const cellKey = `${rowIdx + 1}:${colIdx + 1}`;
    if (matrixInputType === "number" || matrixInputType === "text") {
      return;
    }
    let newAnswer: string[];
    if (multiplePerRow) {
      if (isCellSelected(rowIdx, colIdx)) {
        newAnswer = arrayValue.filter((key) => key !== cellKey);
      } else {
        newAnswer = [...arrayValue, cellKey];
      }
    } else {
      newAnswer = arrayValue.filter((key) => !key.startsWith(`${rowIdx + 1}:`));
      if (!isCellSelected(rowIdx, colIdx)) {
        newAnswer.push(cellKey);
      }
    }
    onChange(newAnswer);
    onTouched();
  };

  const handleInputChange = (rowIdx: number, colIdx: number, inputValue: string) => {
    const cellKey = `${rowIdx + 1}:${colIdx + 1}`;
    const newValue = { ...objectValue };

    if (matrixInputType === "number") {
      const min = matrixNumberMin ?? MATRIX_NUMBER_MIN_LIMIT;
      const max = matrixNumberMax ?? MATRIX_NUMBER_MAX_LIMIT;
      if (inputValue.length > MATRIX_NUMBER_INPUT_MAX_LENGTH) return;
      const numValue = parseFloat(inputValue);
      if (inputValue === "" || (!isNaN(numValue) && numValue >= min && numValue <= max)) {
        newValue[cellKey] = inputValue;
      } else return;
    } else if (matrixInputType === "text") {
      const maxLength = matrixTextMaxLength ?? MATRIX_TEXT_MAX_LENGTH_LIMIT;
      if (inputValue.length <= maxLength) {
        newValue[cellKey] = inputValue;
      } else return;
    }

    onChange(newValue);
    onTouched();
  };

  const getCellValue = (rowIdx: number, colIdx: number): string => {
    const cellKey = `${rowIdx + 1}:${colIdx + 1}`;
    return objectValue[cellKey] || "";
  };

  return (
    <div
      className="matrix-scroll-container overflow-auto scroll-smooth relative"
      style={{
        maxHeight: '500px',
      }}
      onScroll={(e) => {
        const el = e.currentTarget;
        if (el.scrollLeft > 0) {
          setIsScrolling(true);
        }

        if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
        scrollTimeout.current = setTimeout(() => setIsScrolling(false), 150);
      }}
    >
      <table
        className="border-collapse border border-muted-foreground/20 text-sm min-w-full"
        aria-label={`matrix-${fieldId}`}
      >
        <thead>
          <tr>
            <th
              className={cn(
                "relative sticky left-0 z-20 w-[100px] whitespace-nowrap",
                "bg-white p-2 font-medium",
                "border border-muted-foreground/20",
                "after:absolute after:top-0 after:right-[-2px] after:h-full after:w-[4px]",
                "after:bg-white after:shadow-[2px_0_4px_rgba(0,0,0,0.12)]",
                isScrolling && "ring-2 ring-primary/40 shadow-lg"
              )}
            >
            </th>
            {columns.map((col, idx) => (
              <th
                key={idx}
                className={cn(
                  "border border-muted-foreground/20 p-2 text-center bg-muted/30 font-medium min-w-[100px] whitespace-nowrap",
                  "sticky top-0 z-10 bg-white",
                  "after:absolute after:left-0 after:bottom-[-2px] after:w-full after:h-[4px]",
                  "after:bg-white after:shadow-[0_2px_4px_rgba(0,0,0,0.12)]",
                  isScrolling && "ring-2 ring-primary/40 shadow-lg"
                )}
              >
                {col || `Column ${idx + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              <td
                className={cn(
                  "relative sticky left-0 z-20 min-w-[100px] whitespace-nowrap",
                  "bg-white p-2 font-medium",
                  "border border-muted-foreground/20",
                  "after:absolute after:top-0 after:right-[-2px] after:h-full after:w-[4px]",
                  "after:bg-white after:shadow-[2px_0_4px_rgba(0,0,0,0.12)]",
                  isScrolling && "before:opacity-100 after:opacity-100"
                )}
              >
                {row || `Row ${rowIdx + 1}`}
              </td>
              {columns.map((_, colIdx) => {
                const selected = isCellSelected(rowIdx, colIdx);
                const cellValue = getCellValue(rowIdx, colIdx);

                if (matrixInputType === "number") {
                  const min = matrixNumberMin ?? MATRIX_NUMBER_MIN_LIMIT;
                  const max = matrixNumberMax ?? MATRIX_NUMBER_MAX_LIMIT;
                  return (
                    <td
                      key={colIdx}
                      className="border border-muted-foreground/20 p-2 min-w-[100px]"
                    >
                      <Input
                        type="number"
                        value={cellValue}
                        disabled={disabled}
                        onChange={(e) => handleInputChange(rowIdx, colIdx, e.target.value)}
                        min={min}
                        max={max}
                        maxLength={MATRIX_NUMBER_INPUT_MAX_LENGTH}
                        className="w-full h-8 text-sm"
                        placeholder="-"
                      />
                    </td>
                  );
                }

                if (matrixInputType === "text") {
                  const maxLength = matrixTextMaxLength ?? MATRIX_TEXT_MAX_LENGTH_LIMIT;

                  return (
                    <td
                      key={colIdx}
                      className="border border-muted-foreground/20 p-2 min-w-[100px]"
                    >
                      <Input
                        type="text"
                        value={cellValue}
                        disabled={disabled}
                        onChange={(e) => handleInputChange(rowIdx, colIdx, e.target.value)}
                        maxLength={maxLength}
                        className="w-full h-8 text-sm"
                        placeholder="-"
                      />
                    </td>
                  );
                }

                return (
                  <td
                    key={colIdx}
                    className="border border-muted-foreground/20 p-2 text-center min-w-[100px]"
                  >
                    {multiplePerRow ? (
                      <Checkbox
                        id={`${fieldId}-${rowIdx}-${colIdx}`}
                        checked={selected}
                        disabled={disabled}
                        onCheckedChange={() => toggleCell(rowIdx, colIdx)}
                        className="mx-auto"
                        simplifiedAnimation
                      />
                    ) : (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleCell(rowIdx, colIdx)}
                        className={cn(
                          "mx-auto inline-flex aspect-square h-4 w-4 items-center justify-center align-middle rounded-full border border-primary text-primary shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors duration-200 leading-none p-0 disabled:cursor-not-allowed disabled:opacity-50 relative overflow-hidden",
                          disabled && "cursor-not-allowed opacity-50"
                        )}
                      >
                        {selected && (
                          <span className="absolute inset-0 rounded-full bg-primary animate-in zoom-in-50 duration-200 ease-out" />
                        )}
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface TextLengthIndicatorProps {
  len: number;
  limit: number;
  className?: string;
  staticPosition?: boolean;
}

const TEXT_SINGLELINE_MAX_CHARS = 255;
const TEXT_MULTILINE_MAX_CHARS = 10000;
const MAX_NUMBER_INPUT_CHARS = 36;
const MATRIX_NUMBER_MIN_LIMIT = -999999;
const MATRIX_NUMBER_MAX_LIMIT = 999999;
const MATRIX_NUMBER_INPUT_MAX_LENGTH = 7;
const MATRIX_TEXT_MAX_LENGTH_LIMIT = 256;

const getTextMaxLimit = (field: FormElementModel) =>
  field.widgetType === "textarea" ? TEXT_MULTILINE_MAX_CHARS : TEXT_SINGLELINE_MAX_CHARS;

const getTextMaxChars = (field: FormElementModel) => {
  const limit = getTextMaxLimit(field);
  const props = field.props as Record<string, unknown>;
  const rawMax = typeof props.maxChars === "number" ? props.maxChars : limit;
  const normalized = rawMax > 0 ? rawMax : 1;
  return Math.min(normalized, limit);
};

const sanitizeNumberInput = (raw: string, allowDecimals: boolean) => {
  let normalized = raw.replace(/[^\d.]/g, "");
  if (!allowDecimals) {
    normalized = normalized.replace(/\./g, "");
  } else {
    const dotIndex = normalized.indexOf(".");
    if (dotIndex !== -1) {
      normalized = `${normalized.slice(0, dotIndex + 1)}${normalized
        .slice(dotIndex + 1)
        .replace(/\./g, "")}`;
    }
  }
  if (normalized.length > MAX_NUMBER_INPUT_CHARS) {
    normalized = normalized.slice(0, MAX_NUMBER_INPUT_CHARS);
  }
  return normalized;
};
function LengthIndicator({ len, limit, isError, isComplete }: LengthIndicatorProps) {
  const progress = limit ? Math.min(len / limit, 1) : 0;
  const progressColor = isError ? "#ef4444" : "#94a3b8";
  const trackColor = "#e2e8f0";
  const ringRadius = 5;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
      <div
        className={cn(
          "text-xs font-medium",
          isError ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {`${len}/${limit}`}
      </div>
      <svg className="h-3 w-3" viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r={ringRadius} fill="none" stroke={trackColor} strokeWidth="2" />
        <circle
          cx="6"
          cy="6"
          r={ringRadius}
          fill="none"
          stroke={progressColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={ringCircumference}
          strokeDashoffset={ringCircumference * (1 - progress)}
          style={{ transition: "stroke-dashoffset 240ms ease-out" }}
          transform="rotate(-90 6 6)"
        />
      </svg>
    </div>
  );
}

function TextLengthIndicator({ len, limit, className, staticPosition }: TextLengthIndicatorProps) {
  const isOverLimit = len > limit;
  const progress = limit ? Math.min(len / limit, 1) : 0;
  const progressColor = isOverLimit ? "#ef4444" : "#94a3b8";
  const trackColor = "#e2e8f0";
  const ringRadius = 5;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <div className={cn(staticPosition ? "flex items-center gap-2" : "absolute flex items-center gap-2", className)}>
      <div className={cn("text-xs font-medium text-muted-foreground")}>
        {`${len}/${limit}`}
      </div>
      <svg className="h-3 w-3" viewBox="0 0 12 12" aria-hidden="true">
        <circle
          cx="6"
          cy="6"
          r={ringRadius}
          fill="none"
          stroke={trackColor}
          strokeWidth="2"
        />
        <circle
          cx="6"
          cy="6"
          r={ringRadius}
          fill="none"
          stroke={progressColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={ringCircumference}
          strokeDashoffset={ringCircumference * (1 - progress)}
          style={{ transition: "stroke-dashoffset 240ms ease-out" }}
          transform="rotate(-90 6 6)"
        />
      </svg>
    </div>
  );
}

function SortableItem({ id, disabled }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-3 bg-white border rounded-lg",
        isDragging && "shadow-lg opacity-90 z-10",
        disabled && "opacity-50"
      )}
    >
      <button
        type="button"
        className={cn("cursor-grab touch-none", disabled && "cursor-not-allowed")}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <span className="flex-1">{id}</span>
    </div>
  );
}

interface FormPreviewProps {
  form: FormSchema;
  mode?: "preview" | "respond";
  readOnly?: boolean;
  requireRequiredOnPage?: boolean;
  submitLabel?: string;
  submitting?: boolean;
  onSubmitAnswers?: (payload: ReturnType<typeof buildAnswersPayload>) => void | Promise<void>;
  onAnswersChange?: (answers: AnswersById) => void;
  initialAnswers?: AnswersById;
  initialPageId?: number;
  onActivePageChange?: (info: {
    pageId: number;
    pageIndex: number;
    allowBack: boolean;
    isFirst: boolean;
    isLast: boolean;
  }) => void;
}


type Results = Record<string, boolean>;

export function FormPreview({
  form,
  mode = "preview",
  readOnly = false,
  requireRequiredOnPage = true,
  submitLabel,
  submitting = false,
  onSubmitAnswers,
  onAnswersChange,
  initialAnswers,
  onActivePageChange,
  initialPageId,
}: FormPreviewProps) {
  const { t, i18n } = useTranslation();
  const calendarLocale = i18n.language.startsWith("ru") ? ru : enUS;
  const isRespondMode = mode === "respond";
  const [answers, setAnswers] = useState<AnswersById>(initialAnswers ?? {});
  const [results, setResults] = useState<Results | null>(null);
  const [, setTotalScore] = useState<number>(0);
  const [, setMaxScore] = useState<number>(0);
  const [errorsById, setErrorsById] = useState<Record<string, string[]>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [focusedFieldId, setFocusedFieldId] = useState<string | null>(null);
  const [uploadingById, setUploadingById] = useState<Record<string, boolean>>({});
  const [showRequiredWarning, setShowRequiredWarning] = useState(false);
  const [isRequiredWarningFading, setIsRequiredWarningFading] = useState(false);
  const [location, setLocation] = useLocation();
  const payloadRef = useRef<ReturnType<typeof buildAnswersPayload> | null>(null);
  const matrixContainerRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const requiredWarningHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requiredWarningFadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const normalizedPages = useMemo<FormPageModel[]>(() => {
    const pages = Array.isArray(form.pages) ? form.pages : [];
    if (pages.length === 0) {
      return [{ id: 1, title: t("pages.defaultTitle", { index: 1 }), pageIndex: 0, allowBack: true }];
    }
    return pages
      .map((page, index) => ({
        id: typeof page.id === "number" ? page.id : index + 1,
        title: typeof page.title === "string" ? page.title : t("pages.defaultTitle", { index: index + 1 }),
        pageIndex: typeof page.pageIndex === "number" ? page.pageIndex : index,
        allowBack: typeof page.allowBack === "boolean" ? page.allowBack : true,
      }))
      .sort((a, b) => a.pageIndex - b.pageIndex);
  }, [form.pages, t]);
  const pageIdSet = useMemo(() => new Set(normalizedPages.map((page) => page.id)), [normalizedPages]);
  const fallbackPageId = normalizedPages[0]?.id ?? 1;
  const urlPageId = useMemo(() => getPFromLocation(location), [location]);
  const [activePageId, setActivePageId] = useState<number | null>(null);

  useEffect(() => {
    if (!isRespondMode) return;

    setActivePageId((current) => {
      // 1) если в URL есть валидный pageId — он главный
      if (urlPageId && pageIdSet.has(urlPageId)) return urlPageId;

      // 2) иначе если текущий стейт валидный — оставляем
      if (current && pageIdSet.has(current)) return current;

      // 3) иначе initialPageId (если есть)
      if (initialPageId && pageIdSet.has(initialPageId)) return initialPageId;

      // 4) иначе первая
      return normalizedPages[0]?.id ?? null;
    });
  }, [isRespondMode, urlPageId, pageIdSet, initialPageId, normalizedPages]);
  const hasQuizFields = useMemo(() => {
    if (isRespondMode) return false;
    return form.fields.some((field) => {
      const props = field.props as Record<string, unknown>;
      const correctAnswers = props.correctAnswers as string[] | undefined;
      return Boolean(correctAnswers && correctAnswers.length > 0);
    });
  }, [form.fields, isRespondMode]);

  useEffect(() => {
    setErrorsById(validateForm(form.fields, answers));
  }, [form.fields, answers]);

  useEffect(() => {
    payloadRef.current = buildAnswersPayload(form.fields, answers);
  }, [form.fields, answers]);

  useEffect(() => {
    return () => {
      if (requiredWarningFadeTimeoutRef.current) {
        clearTimeout(requiredWarningFadeTimeoutRef.current);
      }
      if (requiredWarningHideTimeoutRef.current) {
        clearTimeout(requiredWarningHideTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (initialAnswers && Object.keys(initialAnswers).length > 0) {
      setAnswers((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        return { ...initialAnswers };
      });
    }
  }, [initialAnswers]);

  const updateAnswer = (fieldId: string, value: AnswerValue) => {
    setAnswers((prev) => {
      const next = { ...prev, [fieldId]: value };
      onAnswersChange?.(next);
      return next;
    });
    if (results) {
      setResults(null);
    }
  };

  const normalizeAcceptedTypes = (raw: unknown): string[] => {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => String(item).trim().toLowerCase())
      .filter(Boolean);
  };

  const isAcceptedFile = (file: File, accepted: string[]) => {
    if (accepted.length === 0) return true;
    const name = file.name.toLowerCase();
    const ext = name.includes(".") ? `.${name.split(".").pop()}` : "";
    const mime = (file.type || "").toLowerCase();
    return accepted.some((rule) => {
      if (rule.startsWith(".")) {
        return ext === rule;
      }
      if (rule.endsWith("/*")) {
        const prefix = rule.replace("/*", "/");
        return mime.startsWith(prefix);
      }
      return mime === rule;
    });
  };

  const uploadUserFile = async (file: File): Promise<ElementAttachment> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/v1/files/upload", {
      method: "POST",
      headers: authHeader(),
      body: formData,
    });

    if (!response.ok) {
      let detail: string | undefined;
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const err = await response.json().catch(() => ({}));
        detail = err?.detail;
      } else {
        const text = await response.text().catch(() => "");
        detail = text.trim() || undefined;
      }
      if (response.status === 413 && !detail) {
        throw new Error(t("propert.attachmentsTooLarge"));
      }
      throw new Error(detail ?? t("propert.attachmentsUploadError"));
    }

    const data = await response.json();
    return {
      file_id: data.file_id,
      name: data.name ?? file.name,
      mime_type: data.mime_type ?? file.type ?? "application/octet-stream",
      size_bytes: data.size_bytes ?? file.size ?? 0,
      url: data.url ?? `/api/v1/files/${data.file_id}/download`,
      content_hash: data.content_hash,
      status: data.status ?? "temp",
    };
  };

  const markTouched = (fieldId: string) => {
    setTouched((prev) => ({ ...prev, [fieldId]: true }));
  };

  const showRequiredFieldsWarning = () => {
    setShowRequiredWarning(true);
    setIsRequiredWarningFading(false);

    if (requiredWarningFadeTimeoutRef.current) {
      clearTimeout(requiredWarningFadeTimeoutRef.current);
    }
    if (requiredWarningHideTimeoutRef.current) {
      clearTimeout(requiredWarningHideTimeoutRef.current);
    }

    requiredWarningFadeTimeoutRef.current = setTimeout(() => {
      setIsRequiredWarningFading(true);
      requiredWarningFadeTimeoutRef.current = null;
    }, REQUIRED_WARNING_DURATION_MS - REQUIRED_WARNING_FADE_MS);

    requiredWarningHideTimeoutRef.current = setTimeout(() => {
      setShowRequiredWarning(false);
      setIsRequiredWarningFading(false);
      requiredWarningHideTimeoutRef.current = null;
    }, REQUIRED_WARNING_DURATION_MS);
  };

  const handleRankingDragEnd = (fieldId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const currentOrder = (answers[fieldId] as string[]) || [];
      const oldIndex = currentOrder.indexOf(active.id as string);
      const newIndex = currentOrder.indexOf(over.id as string);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
        updateAnswer(fieldId, newOrder);
        markTouched(fieldId);
      }
    }
  };

  useEffect(() => {
    const rankingFields = form.fields.filter(
      (field) => field.widgetType === "ranking" && Array.isArray((field.props as Record<string, unknown>).options)
    );
    const updates: Record<string, string[]> = {};

    rankingFields.forEach((field) => {
      const options = (field.props as Record<string, unknown>).options as string[];
      if (!answers[field.id] && options && options.length > 0) {
        updates[field.id] = [...options];
      }
    });

    if (Object.keys(updates).length > 0) {
      setAnswers((prev) => ({ ...prev, ...updates }));
    }
  }, [form.fields, answers]);

  const checkAnswers = () => {
    const payload = payloadRef.current ?? buildAnswersPayload(form.fields, answers);
    if (import.meta.env.DEV) {
      console.debug("Answers payload", payload);
    }

    const newResults: Results = {};
    let score = 0;
    let max = 0;

    form.fields.forEach((field) => {
      const props = field.props as Record<string, unknown>;
      const correctAnswers = props.correctAnswers as string[] | undefined;
      const points = (props.points as number | undefined) ?? 1;
      if (!correctAnswers || correctAnswers.length === 0) return;

      const userAnswer = answers[field.id];

      // Рассчитываем максимальное количество баллов для поля
      if (field.widgetType === "matrix") {
        const pointsPerCell = (props.pointsPerCell as Record<string, number> | undefined) || {};
        const pointsPerRow = (props.pointsPerRow as Record<string, number> | undefined) || {};
        const pointsPerColumn = (props.pointsPerColumn as Record<string, number> | undefined) || {};
        const matrixTotalPoints = (props.matrixTotalPoints as number | undefined) || 0;
        const pointsDistributionType =
          (props.pointsDistributionType as string | undefined) ||
          (Object.keys(pointsPerCell).length > 0
            ? "cell"
            : Object.keys(pointsPerRow).length > 0
              ? "row"
              : Object.keys(pointsPerColumn).length > 0
                ? "column"
                : matrixTotalPoints > 0
                  ? "total"
                  : "cell");

        const correctRowIds = new Set<number>();
        const correctColumnIds = new Set<number>();
        correctAnswers.forEach((cellKey) => {
          const [rowIdx, colIdx] = cellKey.split(":").map(Number);
          if (!Number.isNaN(rowIdx)) correctRowIds.add(rowIdx);
          if (!Number.isNaN(colIdx)) correctColumnIds.add(colIdx);
        });

        switch (pointsDistributionType) {
          case "row": {
            correctRowIds.forEach((rowIdx) => {
              const pointsForRow = pointsPerRow[String(rowIdx)] || 0;
              if (pointsForRow > 0) {
                max += pointsForRow;
              }
            });
            break;
          }
          case "column": {
            correctColumnIds.forEach((colIdx) => {
              const pointsForColumn = pointsPerColumn[String(colIdx)] || 0;
              if (pointsForColumn > 0) {
                max += pointsForColumn;
              }
            });
            break;
          }
          case "total": {
            if (matrixTotalPoints > 0) {
              max += matrixTotalPoints;
            }
            break;
          }
          case "cell":
          default: {
            correctAnswers.forEach((cellKey) => {
              const pointsForCell = pointsPerCell[cellKey] || 0;
              if (pointsForCell > 0) {
                max += pointsForCell;
              }
            });
            break;
          }
        }
      } else {
        max += points;
      }

      let isCorrect = false;

      if (field.widgetType === "ranking") {
        const userOrder = (userAnswer as string[]) || [];
        isCorrect =
          userOrder.length === correctAnswers.length &&
          userOrder.every((item, idx) => item === correctAnswers[idx]);
        if (isCorrect) {
          score += points;
        }
      } else if (field.widgetType === "checkbox") {
        const choiceState = getChoiceMultiState(userAnswer);
        const userAnswersArr = [
          ...choiceState.selected,
          ...(choiceState.otherSelected
            ? [`${CHOICE_OTHER_SENTINEL}:${choiceState.otherText.trim()}`]
            : []),
        ].sort();
        const correctAnswersArr = correctAnswers.slice().sort();
        isCorrect =
          userAnswersArr.length === correctAnswersArr.length &&
          userAnswersArr.every((ans, idx) => ans.toLowerCase() === correctAnswersArr[idx].toLowerCase());
        if (isCorrect) {
          score += points;
        }
      } else if (field.widgetType === "matrix") {
        const userAnswersArr = ((userAnswer as string[]) || []).sort();
        const correctAnswersArr = correctAnswers.slice().sort();
        const matrixValidationMode = (props.matrixValidationMode || "all") as "any" | "all" | string;
        const pointsPerCell = (props.pointsPerCell as Record<string, number> | undefined) || {};
        const pointsPerRow = (props.pointsPerRow as Record<string, number> | undefined) || {};
        const pointsPerColumn = (props.pointsPerColumn as Record<string, number> | undefined) || {};
        const matrixTotalPoints = (props.matrixTotalPoints as number | undefined) || 0;
        const pointsDistributionType =
          (props.pointsDistributionType as string | undefined) ||
          (Object.keys(pointsPerCell).length > 0
            ? "cell"
            : Object.keys(pointsPerRow).length > 0
              ? "row"
              : Object.keys(pointsPerColumn).length > 0
                ? "column"
                : matrixTotalPoints > 0
                  ? "total"
                  : "cell");

        const correctAnswersByRow: Record<number, string[]> = {};
        const correctAnswersByColumn: Record<number, string[]> = {};
        correctAnswersArr.forEach((cellKey) => {
          const [rowIdx, colIdx] = cellKey.split(":").map(Number);
          if (!Number.isNaN(rowIdx)) {
            if (!correctAnswersByRow[rowIdx]) {
              correctAnswersByRow[rowIdx] = [];
            }
            correctAnswersByRow[rowIdx].push(cellKey);
          }
          if (!Number.isNaN(colIdx)) {
            if (!correctAnswersByColumn[colIdx]) {
              correctAnswersByColumn[colIdx] = [];
            }
            correctAnswersByColumn[colIdx].push(cellKey);
          }
        });

        const selectedByRow: Record<number, string[]> = {};
        const selectedByColumn: Record<number, string[]> = {};
        userAnswersArr.forEach((cellKey) => {
          const [rowIdx, colIdx] = cellKey.split(":").map(Number);
          if (!Number.isNaN(rowIdx)) {
            if (!selectedByRow[rowIdx]) {
              selectedByRow[rowIdx] = [];
            }
            selectedByRow[rowIdx].push(cellKey);
          }
          if (!Number.isNaN(colIdx)) {
            if (!selectedByColumn[colIdx]) {
              selectedByColumn[colIdx] = [];
            }
            selectedByColumn[colIdx].push(cellKey);
          }
        });

        switch (pointsDistributionType) {
          case "row": {
            let allRowsCorrect = true;
            Object.entries(correctAnswersByRow).forEach(([rowKey, rowCorrectAnswers]) => {
              const rowIdx = Number(rowKey);
              const selectedInRow = selectedByRow[rowIdx] || [];
              const hasCorrectSelection = rowCorrectAnswers.some(cellKey => selectedInRow.includes(cellKey));
              const allCorrectSelected = rowCorrectAnswers.every(cellKey => selectedInRow.includes(cellKey));
              const noWrongSelected = selectedInRow.every(cellKey => rowCorrectAnswers.includes(cellKey));
              const rowIsCorrect = matrixValidationMode === "any"
                ? hasCorrectSelection && noWrongSelected
                : allCorrectSelected && noWrongSelected;

              if (rowIsCorrect) {
                const pointsForRow = pointsPerRow[rowKey] || 0;
                if (pointsForRow > 0) {
                  score += pointsForRow;
                }
              } else {
                allRowsCorrect = false;
              }
            });
            isCorrect = Object.keys(correctAnswersByRow).length > 0 && allRowsCorrect;
            break;
          }
          case "column": {
            let allColumnsCorrect = true;
            Object.entries(correctAnswersByColumn).forEach(([colKey, colCorrectAnswers]) => {
              const colIdx = Number(colKey);
              const selectedInColumn = selectedByColumn[colIdx] || [];
              const hasCorrectSelection = colCorrectAnswers.some(cellKey => selectedInColumn.includes(cellKey));
              const allCorrectSelected = colCorrectAnswers.every(cellKey => selectedInColumn.includes(cellKey));
              const noWrongSelected = selectedInColumn.every(cellKey => colCorrectAnswers.includes(cellKey));
              const columnIsCorrect = matrixValidationMode === "any"
                ? hasCorrectSelection && noWrongSelected
                : allCorrectSelected && noWrongSelected;

              if (columnIsCorrect) {
                const pointsForColumn = pointsPerColumn[colKey] || 0;
                if (pointsForColumn > 0) {
                  score += pointsForColumn;
                }
              } else {
                allColumnsCorrect = false;
              }
            });
            isCorrect = Object.keys(correctAnswersByColumn).length > 0 && allColumnsCorrect;
            break;
          }
          case "total": {
            const isMatrixFullyCorrect =
              userAnswersArr.length === correctAnswersArr.length &&
              correctAnswersArr.every(cellKey => userAnswersArr.includes(cellKey));

            if (isMatrixFullyCorrect && matrixTotalPoints > 0) {
              score += matrixTotalPoints;
            }
            isCorrect = isMatrixFullyCorrect;
            break;
          }
          case "cell":
          default: {
            correctAnswersArr.forEach((correctCell) => {
              if (userAnswersArr.includes(correctCell)) {
                const pointsForCell = pointsPerCell[correctCell] || 0;
                if (pointsForCell > 0) {
                  score += pointsForCell;
                }
              }
            });

            isCorrect =
              userAnswersArr.length === correctAnswersArr.length &&
              correctAnswersArr.every(cellKey => userAnswersArr.includes(cellKey));
            break;
          }
        }
      } else {
        const choiceAnswerText = (() => {
          if (field.widgetType !== "select" && field.widgetType !== "radio") return "";
          const state = getChoiceSingleState(userAnswer);
          if (state.otherSelected) return state.otherText.trim();
          return state.selected;
        })();
        const userAnswerStr = choiceAnswerText
          ? choiceAnswerText.toLowerCase().trim()
          : (typeof userAnswer === "string" || typeof userAnswer === "number"
            ? String(userAnswer || "").toLowerCase().trim()
            : "");
        isCorrect = correctAnswers.some(
          (correct) => correct.toLowerCase().trim() === userAnswerStr
        );
        if (isCorrect) {
          score += points;
        }
      }

      newResults[field.id] = isCorrect;
    }
    )
    setResults(newResults);
    setTotalScore(score);
    setMaxScore(max);
  };

  const isFieldVisible = (field: FormElementModel): boolean => {
    // In read-only preview (e.g. results page), show full form structure
    // regardless of conditional logic so dependent fields are visible.
    if (readOnly && !isRespondMode) {
      return true;
    }

    const hasAnswerValue = (value: unknown): boolean => {
      if (value == null) return false;
      if (typeof value === "string") return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      if (isChoiceAnswer(value)) {
        const selected = value.selected;
        if (Array.isArray(selected) && selected.length > 0) return true;
        if (typeof selected === "string" && selected.trim().length > 0) return true;
        if (value.otherSelected) {
          return String(value.otherText ?? "").trim().length > 0;
        }
        return false;
      }
      if (typeof value === "object") {
        const values = Object.values(value as Record<string, unknown>);
        if (values.length === 0) return false;
        return values.some((item) => hasAnswerValue(item));
      }
      return true;
    };

    try {
      const props = field.props as Record<string, unknown>;
      const conditionalLogic = props.conditionalLogic as {
        dependsOn?: string;
        condition?: "equals" | "not_equals" | "answered";
        expectedValue?: string | string[];
      } | undefined;
      if (!conditionalLogic || !conditionalLogic.dependsOn) return true;
      const { dependsOn, condition, expectedValue } = conditionalLogic;
      const dependencyId = String(dependsOn);
      const parentField = form.fields.find((item) => item.id === dependencyId);
      // Broken dependency should not hide fields forever in runtime.
      if (!parentField) return true;
      if (condition === "answered" && parentField.widgetType === "header") return true;
      const parentAnswer = answers[dependencyId];
      const parentChoiceValues =
        parentField.widgetType === "checkbox"
          ? getChoiceComparableValues(parentAnswer, true)
          : (parentField.widgetType === "select" || parentField.widgetType === "radio")
            ? getChoiceComparableValues(parentAnswer, false)
            : null;

      switch (condition) {
        case "equals":
          if (parentChoiceValues) {
            if (Array.isArray(expectedValue)) {
              return expectedValue.some((val) => parentChoiceValues.includes(String(val)));
            }
            return parentChoiceValues.includes(String(expectedValue ?? ""));
          }
          if (Array.isArray(expectedValue)) {
            return Array.isArray(parentAnswer)
              ? expectedValue.some((val) => (parentAnswer as string[]).includes(val))
              : expectedValue.includes(parentAnswer as string);
          }
          return Array.isArray(parentAnswer)
            ? (parentAnswer as string[]).includes(String(expectedValue ?? ""))
            : parentAnswer === expectedValue;
        case "not_equals":
          if (parentChoiceValues) {
            if (Array.isArray(expectedValue)) {
              return !expectedValue.some((val) => parentChoiceValues.includes(String(val)));
            }
            return !parentChoiceValues.includes(String(expectedValue ?? ""));
          }
          if (Array.isArray(expectedValue)) {
            return Array.isArray(parentAnswer)
              ? !expectedValue.some((val) => (parentAnswer as string[]).includes(val))
              : !expectedValue.includes(parentAnswer as string);
          }
          return Array.isArray(parentAnswer)
            ? !(parentAnswer as string[]).includes(String(expectedValue ?? ""))
            : parentAnswer !== expectedValue;
        case "answered":
          return hasAnswerValue(parentAnswer);
        default:
          return true;
      }
    } catch (error) {
      console.error("Error in isFieldVisible for field:", field.id, field.label, error);
      return true;
    }
  };

  const getErrorsForField = (fieldId: string) => {
    if (!touched[fieldId] || focusedFieldId === fieldId) return [];
    return errorsById[fieldId] || [];
  };

  const localizeError = (raw: string, field: FormElementModel) => {
    const preset = field.semanticType ? presets[field.semanticType] : undefined;
    let partLabel: string | null = null;
    let message = raw;

    if (raw.includes(":")) {
      const [partKey, ...rest] = raw.split(":");
      const part = preset?.parts?.find((item) => item.key === partKey.trim());
      if (part) {
        partLabel = part.labelKey ? t(part.labelKey) : part.key;
        message = rest.join(":").trim();
      }
    }

    const normalized = message.trim();
    let localized = normalized;

    if (normalized === "Required") {
      localized = t("errors.required");
    } else if (normalized === "Invalid selection") {
      localized = t("errors.invalidSelection");
    } else if (normalized === "Invalid number") {
      localized = t("errors.invalidNumber");
    } else if (normalized === "Invalid SNILS") {
      localized = t("errors.invalidSnils");
    } else if (normalized === "Invalid SNILS repeated digits") {
      localized = t("errors.invalidSnilsRepeatedDigits");
    } else if (normalized === "Invalid SNILS checksum") {
      localized = t("errors.invalidSnilsChecksum");
    } else if (normalized === "Invalid email") {
      localized = t("errors.invalidEmail");
    } else if (normalized.startsWith("Invalid email domain")) {
      const match = normalized.match(/^Invalid email domain(?::\s*(.+))?$/);
      const domains = match?.[1]?.trim();
      localized = domains
        ? t("errors.invalidEmailDomainList", { domains })
        : t("errors.invalidEmailDomain");
    } else {
      const digitsMatch = normalized.match(/(\d+)\s*digits/);
      if (digitsMatch) {
        localized = t("errors.digitsExact", { count: Number(digitsMatch[1]) });
      }
    }

    return partLabel ? `${partLabel}: ${localized}` : localized;
  };

  const isRequiredError = (error: string) => {
    const parts = error.split(":");
    const normalized = parts[parts.length - 1]?.trim();
    return normalized === "Required";
  };

  const focusField = (fieldId: string) => {
    const node = fieldRefs.current[fieldId];
    if (!node) return;

    node.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });

    const focusable = node.querySelector<HTMLElement>(
      "input:not([type='hidden']):not([disabled]), textarea:not([disabled]), [role='combobox']:not([aria-disabled='true']), button:not([disabled]), [tabindex]:not([tabindex='-1'])"
    );

    const applyFocus = () => {
      if (focusable) {
        focusable.focus({ preventScroll: true });
        return;
      }
      node.tabIndex = -1;
      node.focus({ preventScroll: true });
    };

    // Keep repeated attempts stable while preserving smooth scrolling motion.
    requestAnimationFrame(() => {
      setTimeout(applyFocus, FOCUS_SCROLL_SETTLE_MS);
    });
  };

  const renderTextInput = (field: FormElementModel, isDisabled: boolean) => {
    const props = field.props as Record<string, unknown>;
    const preset = field.semanticType ? presets[field.semanticType] : undefined;
    const fieldErrors = getErrorsForField(field.id);
    const hasError = fieldErrors.length > 0;

    if (preset?.parts) {
      const composite = (answers[field.id] as FullNameAnswer | PassportAnswer | undefined) || {};
      const compositeRecord = composite as Record<string, string | null>;
      return (
        <div className="grid gap-3">
          {preset.parts.map((part) => {
            if (part.hiddenProp && props[part.hiddenProp]) {
              return null;
            }
            const rawValue = compositeRecord[part.key] ?? "";
            const displayValue = part.format ? part.format(rawValue) : rawValue;
            const label = part.labelKey ? t(part.labelKey) : part.key;
            const placeholder = part.placeholderKey
              ? t(part.placeholderKey)
              : part.placeholder || "";
            const maxLength = part.maxChars ?? part.maxDigits;
            const len = part.maxDigits ? rawValue.replace(/\D/g, "").length : rawValue.length;
            const limit = part.maxDigits ?? part.maxChars;
            const showIndicator = Boolean(limit) && !part.hideLengthIndicator;
            const partError = fieldErrors.some((err) => err.startsWith(`${part.key}:`));
            const isDatePart = part.inputType === "date";
            const optionItems = part.options ?? [];
            const hasOptions = optionItems.length > 0;
            const optionValue = typeof rawValue === "string" ? rawValue : "";
            const suppressPlaceholders = field.semanticType === "passport" || field.semanticType === "full_name";

            return (
              <div key={part.key} className="space-y-1">
                <Label className="text-sm text-muted-foreground">
                  {label}
                  {(part.required ?? field.required) && <span className="text-destructive ml-1">*</span>}
                </Label>
                {hasOptions ? (
                  <RadioGroup
                    className="flex flex-row flex-wrap gap-6"
                    value={optionValue}
                    onValueChange={(value) => {
                      updateAnswer(field.id, { ...compositeRecord, [part.key]: value } as AnswerValue);
                      markTouched(field.id);
                    }}
                    disabled={isDisabled}
                  >
                    {optionItems.map((option) => {
                      const optionLabel = option.labelKey ? t(option.labelKey) : option.label || option.value;
                      const optionId = `${field.id}-${part.key}-${option.value}`;
                      return (
                        <div key={option.value} className="flex items-center space-x-2">
                          <RadioGroupItem value={option.value} id={optionId} />
                          <Label htmlFor={optionId} className="cursor-pointer">
                            {optionLabel}
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                ) : isDatePart ? (
                  <DatePickerInput
                    value={rawValue || ""}
                    onChange={(next) =>
                      updateAnswer(field.id, {
                        ...compositeRecord,
                        [part.key]: next || null,
                      } as AnswerValue)
                    }
                    onBlur={() => markTouched(field.id)}
                    disabled={isDisabled}
                    locale={calendarLocale}
                    placeholder={placeholder || t("propert.selectDate")}
                    popoverPortalled={false}
                    inputClassName={cn(
                      "h-10 text-muted-foreground",
                      partError ? "border-destructive focus-visible:ring-destructive/20" : ""
                    )}
                    buttonClassName="!left-0 !top-0 !h-10 !w-10 !translate-y-0 hover:bg-transparent z-10"
                  />
                ) : (
                  <div className="relative">
                    <Input
                      type={part.inputType || "text"}
                      inputMode={part.inputMode as React.InputHTMLAttributes<HTMLInputElement>["inputMode"]}
                      value={displayValue}
                      onChange={(e) => {
                        const normalized = part.normalize ? part.normalize(e.target.value) : e.target.value;
                        updateAnswer(field.id, { ...compositeRecord, [part.key]: normalized } as AnswerValue);
                      }}
                      onBlur={() => markTouched(field.id)}
                      disabled={isDisabled}
                      maxLength={maxLength}
                      placeholder={suppressPlaceholders ? "" : placeholder}
                      className={cn(
                        limit ? "pr-20" : "",
                        partError ? "border-destructive focus-visible:ring-destructive/20" : ""
                      )}
                    />
                    {showIndicator && (
                      <LengthIndicator
                        len={len}
                        limit={limit ?? 0}
                        isError={partError}
                        isComplete={len > 0 && len === (limit ?? 0)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    const canonicalValue = (answers[field.id] as string) || "";
    const displayValue = preset?.format ? preset.format(canonicalValue) : canonicalValue;
    const placeholderKey = preset?.getPlaceholderKey ? preset.getPlaceholderKey(props) : preset?.placeholderKey;
    const placeholder = placeholderKey
      ? t(placeholderKey)
      : preset?.placeholder || (props.placeholder as string) || "";
    const labelKey = preset?.getLabelKey ? preset.getLabelKey(props) : preset?.labelKey;
    const label = labelKey ? t(labelKey) : undefined;
    const maxLength =
      (preset?.maxChars as number | undefined) ?? (props.maxChars as number | undefined);
    const dynamicMaxDigits = preset?.getMaxDigits ? preset.getMaxDigits(props) : undefined;
    const maxDigits = (dynamicMaxDigits ?? preset?.maxDigits) as number | undefined;
    const len = maxDigits ? canonicalValue.replace(/\D/g, "").length : canonicalValue.length;
    const limit = maxDigits ?? maxLength;

    const inputNode = (
      <div className="relative">
        <Input
          type={(preset?.inputType as string) || (props.inputType as string) || "text"}
          inputMode={((preset?.inputMode ?? props.inputMode) as React.InputHTMLAttributes<HTMLInputElement>["inputMode"]) ?? undefined}
          placeholder={placeholder}
          value={displayValue}
          onChange={(e) => {
            const raw = e.target.value;
            const normalized = preset?.normalize
              ? preset.normalize(raw, { previous: canonicalValue, props })
              : raw;
            updateAnswer(field.id, normalized);
          }}
          onBlur={() => markTouched(field.id)}
          disabled={isDisabled}
          maxLength={maxLength}
          className={cn(
            limit ? "pr-20" : "",
            hasError ? "border-destructive focus-visible:ring-destructive/20" : ""
          )}
        />
        {limit != null && (
          <LengthIndicator
            len={len}
            limit={limit}
            isError={hasError}
            isComplete={len > 0 && len === limit}
          />
        )}
      </div>
    );

    if (!label) {
      return inputNode;
    }

    return (
      <div className="space-y-1">
        <Label className="text-sm text-muted-foreground">
          {label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {inputNode}
      </div>
    );
  };





  const renderField = (field: FormElementModel) => {
    const props = field.props as Record<string, unknown>;
    const options = props.options as string[] | undefined;
    const allowOtherOption =
      Boolean(props.allowOther) &&
      !isCountryField(field) &&
      (field.widgetType === "select" || field.widgetType === "radio" || field.widgetType === "checkbox");
    const otherOptionLabel = t("common.otherOption");
    const correctAnswers = Array.isArray(props.correctAnswers)
      ? props.correctAnswers.map((answer) => String(answer))
      : [];
    const hasCorrectAnswers = correctAnswers.length > 0;
    const isCountrySelect = isCountryField(field);
    const hideDate = Boolean(props.hideDate);
    const hideTime = Boolean(props.hideTime);
    const isFieldReadOnly = Boolean(props.readOnly);
    const isFieldDisabled = isInputsDisabled || isFieldReadOnly;
    const hasResult = results !== null && field.id in results;
    const isCorrect = hasResult && results[field.id];
    const fieldWrapperClass = cn(
      "space-y-2 p-3 rounded-lg transition-colors",
      isCorrect && "bg-green-50 border border-green-200"
    );
    const fieldErrors = getErrorsForField(field.id);

    return (
      <div
        key={field.id}
        ref={(node) => {
          if (node) {
            fieldRefs.current[field.id] = node;
            return;
          }
          delete fieldRefs.current[field.id];
        }}
        data-field-id={field.id}
        className={cn("scroll-mt-24", fieldWrapperClass, field.widgetType === "matrix" && "overflow-hidden max-w-full")}
        onFocusCapture={() => setFocusedFieldId(field.id)}
        onBlurCapture={(event) => {
          const nextTarget = event.relatedTarget as Node | null;
          if (nextTarget && event.currentTarget.contains(nextTarget)) {
            return;
          }
          setFocusedFieldId((prev) => (prev === field.id ? null : prev));
          markTouched(field.id);
        }}
      >
        {field.widgetType !== "header" && (
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
              {typeof props.points === "number" && props.points > 0 && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {formatPoints(props.points, i18n.language)}
                </span>
              )}
              {field.widgetType === "matrix" && typeof props.matrixTotalPoints === "number" && props.matrixTotalPoints > 0 && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {formatPoints(props.matrixTotalPoints, i18n.language)} ({t("propert.pointsForMatrix")})
                </span>
              )}
            </Label>
            {hasResult && (
              <div className="flex items-center gap-1">
                {isCorrect ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : null}
              </div>
            )}
          </div>
        )}

        {field.widgetType === "header" ? (
          <>
            <h2 className="text-xl font-bold pb-2 border-b">{field.label}</h2>
            {field.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap break-all">
                {field.description}
              </p>
            )}
          </>
        ) : field.description ? (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap break-all">
            {field.description}
          </p>
        ) : null}

        {field.widgetType === "text_input" && renderTextInput(field, isFieldDisabled)}

        {field.widgetType === "textarea" && (() => {
          const maxChars = getTextMaxChars(field);
          const value = (answers[field.id] as string) || "";

          return (
            <CollapsibleTextarea
              placeholder={(props.placeholder as string) || ""}
              value={value}
              onChange={(e) => {
                const nextValue = e.target.value.slice(0, maxChars);
                updateAnswer(field.id, nextValue);
              }}
              onBlur={() => markTouched(field.id)}
              disabled={isFieldDisabled}
              maxLength={maxChars}
              className="pb-6"
              indicator={(
                <TextLengthIndicator
                  len={value.length}
                  limit={maxChars}
                  staticPosition
                  className="bg-white px-1.5 py-0.5 rounded-sm"
                />
              )}
            />
          );
        })()}

        {field.widgetType === "number_input" && (() => {
          const allowDecimals = Boolean(props.allowDecimals);
          const rawValue = answers[field.id];
          const value = rawValue == null ? "" : String(rawValue);
          return (
            <Input
              type="text"
              inputMode={allowDecimals ? "decimal" : "numeric"}
              pattern={allowDecimals ? "[0-9.]*" : "[0-9]*"}
              placeholder={props.placeholder as string}
              value={value}
              maxLength={MAX_NUMBER_INPUT_CHARS}
              onChange={(e) => {
                const sanitized = sanitizeNumberInput(e.target.value, allowDecimals);
                updateAnswer(field.id, sanitized);
              }}
              onBlur={() => markTouched(field.id)}
              disabled={isFieldDisabled}
            />
          );
        })()}

        {field.widgetType === "datetime" && (() => {
          const dateTime = (answers[field.id] as DateTimeAnswer) || {};
          const dateValue = dateTime.date ?? null;
          const timeValue = dateTime.time ?? "";
          return (
            <div className="space-y-3">
              {!hideDate && (
                <DatePickerInput
                  value={dateValue ?? ""}
                  onChange={(next) => updateAnswer(field.id, { ...dateTime, date: next || null })}
                  onBlur={() => markTouched(field.id)}
                  disabled={isFieldDisabled}
                  locale={calendarLocale}
                  placeholder={t("propert.selectDate")}
                  popoverPortalled={false}
                  inputClassName="h-10 text-muted-foreground"
                  buttonClassName="!left-0 !top-0 !h-10 !w-10 !translate-y-0 hover:bg-transparent z-10"
                />
              )}
              {!hideTime && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-10",
                        !timeValue && "text-muted-foreground"
                      )}
                      disabled={isFieldDisabled}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      {timeValue ? <span>{timeValue}</span> : <span>{t("propert.selectTime")}</span>
                      }</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4" align="start" portalled={false}>
                    <Input
                      type="time"
                      value={timeValue}
                      onChange={(e) => updateAnswer(field.id, { ...dateTime, time: e.target.value })}
                      onBlur={() => markTouched(field.id)}
                      disabled={isFieldDisabled}
                      className="w-full"
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          );
        })()}

        {field.widgetType === "select" && (
          isCountrySelect ? (
            <CountrySelect
              value={(answers[field.id] as string) || ""}
              placeholder={(props.placeholder as string) || t("placeholders.selectCountry")}
              disabled={isFieldDisabled}
              onValueChange={(value) => {
                updateAnswer(field.id, value);
              }}
              onTouched={() => markTouched(field.id)}
            />
          ) : (
            (() => {
              const choiceState = getChoiceSingleState(answers[field.id]);
              const selectedValue =
                allowOtherOption && choiceState.otherSelected ? CHOICE_OTHER_SENTINEL : choiceState.selected;
              return (
                <div className="space-y-2">
                  <Select
                    value={selectedValue || ""}
                    onValueChange={(value) => {
                      if (value === CHOICE_OTHER_SENTINEL) {
                        updateAnswer(field.id, {
                          selected: "",
                          otherSelected: true,
                          otherText: choiceState.otherText.slice(0, CHOICE_OTHER_MAX_CHARS),
                        });
                      } else {
                        updateAnswer(field.id, value);
                      }
                      markTouched(field.id);
                    }}
                    disabled={isFieldDisabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={(props.placeholder as string) || t("common.selectopt")} />
                    </SelectTrigger>
                    <SelectContent>
                      {options?.filter(Boolean).map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                      {allowOtherOption && (
                        <SelectItem value={CHOICE_OTHER_SENTINEL}>
                          {otherOptionLabel}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {allowOtherOption && choiceState.otherSelected && (
                    <div className="relative">
                      <Input
                        value={choiceState.otherText}
                        maxLength={CHOICE_OTHER_MAX_CHARS}
                        placeholder={t("propert.otherValuePlaceholder")}
                        disabled={isFieldDisabled}
                        onChange={(event) => {
                          updateAnswer(field.id, {
                            selected: "",
                            otherSelected: true,
                            otherText: event.target.value.slice(0, CHOICE_OTHER_MAX_CHARS),
                          });
                        }}
                        onBlur={() => markTouched(field.id)}
                        className="pr-20"
                      />
                      <LengthIndicator
                        len={choiceState.otherText.length}
                        limit={CHOICE_OTHER_MAX_CHARS}
                        isError={fieldErrors.length > 0}
                        isComplete={choiceState.otherText.length === CHOICE_OTHER_MAX_CHARS}
                      />
                    </div>
                  )}
                </div>
              );
            })()
          )
        )}

        {field.widgetType === "radio" && (
          (() => {
            const choiceState = getChoiceSingleState(answers[field.id]);
            const selectedValue =
              allowOtherOption && choiceState.otherSelected ? CHOICE_OTHER_SENTINEL : choiceState.selected;
            return (
              <div className="space-y-2">
                <RadioGroup
                  value={selectedValue || ""}
                  onValueChange={(value) => {
                    if (value === CHOICE_OTHER_SENTINEL) {
                      updateAnswer(field.id, {
                        selected: "",
                        otherSelected: true,
                        otherText: choiceState.otherText.slice(0, CHOICE_OTHER_MAX_CHARS),
                      });
                    } else {
                      updateAnswer(field.id, value);
                    }
                    markTouched(field.id);
                  }}
                  disabled={isFieldDisabled}
                >
                  {options?.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                      <Label htmlFor={`${field.id}-${option}`} className="cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                  {allowOtherOption && (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value={CHOICE_OTHER_SENTINEL} id={`${field.id}-${CHOICE_OTHER_SENTINEL}`} />
                      <Label htmlFor={`${field.id}-${CHOICE_OTHER_SENTINEL}`} className="cursor-pointer">
                        {otherOptionLabel}
                      </Label>
                    </div>
                  )}
                </RadioGroup>
                {allowOtherOption && choiceState.otherSelected && (
                  <div className="relative">
                    <Input
                      value={choiceState.otherText}
                      maxLength={CHOICE_OTHER_MAX_CHARS}
                      placeholder={t("propert.otherValuePlaceholder")}
                      disabled={isFieldDisabled}
                      onChange={(event) => {
                        updateAnswer(field.id, {
                          selected: "",
                          otherSelected: true,
                          otherText: event.target.value.slice(0, CHOICE_OTHER_MAX_CHARS),
                        });
                      }}
                      onBlur={() => markTouched(field.id)}
                      className="pr-20"
                    />
                    <LengthIndicator
                      len={choiceState.otherText.length}
                      limit={CHOICE_OTHER_MAX_CHARS}
                      isError={fieldErrors.length > 0}
                      isComplete={choiceState.otherText.length === CHOICE_OTHER_MAX_CHARS}
                    />
                  </div>
                )}
              </div>
            );
          })()
        )}

        {field.widgetType === "checkbox" && (
          <div className="space-y-2">
            {(() => {
              const choiceState = getChoiceMultiState(answers[field.id]);
              const currentValues = choiceState.selected;
              const persistChoiceState = (nextSelected: string[]) => {
                if (choiceState.otherSelected || choiceState.otherText.trim().length > 0) {
                  updateAnswer(field.id, {
                    selected: nextSelected,
                    otherSelected: choiceState.otherSelected,
                    otherText: choiceState.otherText.slice(0, CHOICE_OTHER_MAX_CHARS),
                  });
                  return;
                }
                updateAnswer(field.id, nextSelected);
              };

              return (
                <>
                  {options?.map((option) => {
                    const isChecked = currentValues.includes(option);
                    return (
                      <div key={option} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${field.id}-${option}`}
                          checked={isChecked}
                          disabled={isFieldDisabled}
                          simplifiedAnimation
                          onCheckedChange={(checked) => {
                            const isNowChecked = checked === true;
                            const nextSelected = isNowChecked
                              ? [...currentValues, option]
                              : currentValues.filter((item) => item !== option);
                            persistChoiceState(nextSelected);
                            markTouched(field.id);
                          }}
                        />
                        <Label htmlFor={`${field.id}-${option}`} className="cursor-pointer">
                          {option}
                        </Label>
                      </div>
                    );
                  })}

                  {allowOtherOption && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`${field.id}-${CHOICE_OTHER_SENTINEL}`}
                          checked={choiceState.otherSelected}
                          disabled={isFieldDisabled}
                          simplifiedAnimation
                          onCheckedChange={(checked) => {
                            const isNowChecked = checked === true;
                            if (!isNowChecked) {
                              updateAnswer(field.id, currentValues);
                            } else {
                              updateAnswer(field.id, {
                                selected: currentValues,
                                otherSelected: true,
                                otherText: choiceState.otherText.slice(0, CHOICE_OTHER_MAX_CHARS),
                              });
                            }
                            markTouched(field.id);
                          }}
                        />
                        <Label htmlFor={`${field.id}-${CHOICE_OTHER_SENTINEL}`} className="cursor-pointer">
                          {otherOptionLabel}
                        </Label>
                      </div>
                      {choiceState.otherSelected && (
                        <div className="relative">
                          <Input
                            value={choiceState.otherText}
                            maxLength={CHOICE_OTHER_MAX_CHARS}
                            placeholder={t("propert.otherValuePlaceholder")}
                            disabled={isFieldDisabled}
                            onChange={(event) => {
                              updateAnswer(field.id, {
                                selected: currentValues,
                                otherSelected: true,
                                otherText: event.target.value.slice(0, CHOICE_OTHER_MAX_CHARS),
                              });
                            }}
                            onBlur={() => markTouched(field.id)}
                            className="pr-20"
                          />
                          <LengthIndicator
                            len={choiceState.otherText.length}
                            limit={CHOICE_OTHER_MAX_CHARS}
                            isError={fieldErrors.length > 0}
                            isComplete={choiceState.otherText.length === CHOICE_OTHER_MAX_CHARS}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {field.widgetType === "ranking" && options && options.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-2">
              {t("propert.dragToOrderRanking")}
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => handleRankingDragEnd(field.id, event)}
            >
              <SortableContext
                items={(answers[field.id] as string[]) || options}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {((answers[field.id] as string[]) || options).map((item) => (
                    <SortableItem key={item} id={item} disabled={isFieldDisabled} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {field.widgetType === "rating" && (
          <div className="flex flex-wrap items-center gap-2">
            {(() => {
              const maxR = Number(props.maxRating);
              const maxRating = Number.isFinite(maxR) ? Math.min(10, Math.max(1, maxR)) : 10;
              const values = Array.from(
                { length: Math.max(0, maxRating) },
                (_, i) => i + 1
              );
              const selectedValue = Number(answers[field.id] ?? 0);
              return values.map((value) => (
                <button
                  type="button"
                  key={value}
                  disabled={isFieldDisabled}
                  onClick={() => {
                    updateAnswer(field.id, value);
                    markTouched(field.id);
                  }}
                  aria-pressed={selectedValue === value}
                  className={cn(
                    "h-9 min-w-9 px-2 rounded-md border text-sm font-medium transition-colors disabled:cursor-not-allowed",
                    selectedValue === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-muted"
                  )}
                >
                  {value}
                </button>
              ));
            })()}
          </div>
        )}

        {field.widgetType === "matrix" && (
          <MatrixAnswerInput
            fieldId={field.id}
            rows={(props.rows as string[]) || []}
            columns={(props.columns as string[]) || []}
            multiplePerRow={Boolean(props.multiplePerRow)}
            matrixInputType={(props.matrixInputType as "radio" | "checkbox" | "number" | "text") || (props.multiplePerRow ? "checkbox" : "radio")}
            matrixNumberMin={props.matrixNumberMin as number | undefined}
            matrixNumberMax={props.matrixNumberMax as number | undefined}
            matrixTextMaxLength={props.matrixTextMaxLength as number | undefined}
            value={(answers[field.id] as string[] | Record<string, string>) || (props.matrixInputType === "number" || props.matrixInputType === "text" ? {} : [])}
            disabled={isFieldDisabled}
            onChange={(nextValue) => updateAnswer(field.id, nextValue)}
            onTouched={() => markTouched(field.id)}
          />
        )}

        {field.widgetType === "file_upload" && (
          (() => {
            const attachments = (answers[field.id] as ElementAttachment[]) || [];
            const maxFiles = Math.min(Math.max(Number((props as any).maxFiles) || 1, 1), 10);
            const maxFileSize = Math.max(
              1,
              Math.min(Number((props as any).maxFileSize) || MAX_UPLOAD_MB, MAX_UPLOAD_MB)
            );
            const acceptedTypes = normalizeAcceptedTypes((props as any).acceptedFileTypes);
            const acceptAttr = acceptedTypes.length > 0 ? acceptedTypes.join(", ") : undefined;
            const isUploading = Boolean(uploadingById[field.id]);
            const canAddMore = attachments.length < maxFiles && !isFieldDisabled;
            const removeAttachment = (fileId: number) => {
              const nextAttachments = attachments.filter((item) => item.file_id !== fileId);
              if (nextAttachments.length !== attachments.length) {
                updateAnswer(field.id, nextAttachments);
              }
            };

            const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (files.length === 0) return;

              const available = maxFiles - attachments.length;
              if (available <= 0) {
                toast({
                  title: t("builder.error"),
                  description: t("propert.fileUploadLimit", { max: maxFiles }),
                  variant: "destructive",
                });
                return;
              }

              const queue = files.slice(0, available);
              if (files.length > available) {
                toast({
                  title: t("builder.error"),
                  description: t("propert.fileUploadLimit", { max: maxFiles }),
                  variant: "destructive",
                });
              }

              setUploadingById((prev) => ({ ...prev, [field.id]: true }));
              const uploaded: ElementAttachment[] = [];
              for (const file of queue) {
                if (file.size > maxFileSize * 1024 * 1024) {
                  toast({
                    title: t("builder.error"),
                    description: t("propert.fileTooLarge", { max: maxFileSize }),
                    variant: "destructive",
                  });
                  continue;
                }
                if (!isAcceptedFile(file, acceptedTypes)) {
                  toast({
                    title: t("builder.error"),
                    description: t("propert.fileUploadTypeError"),
                    variant: "destructive",
                  });
                  continue;
                }
                try {
                  const item = await uploadUserFile(file);
                  uploaded.push(item);
                } catch (error: any) {
                  toast({
                    title: t("builder.error"),
                    description: error?.message ?? t("propert.attachmentsUploadError"),
                    variant: "destructive",
                  });
                }
              }
              setUploadingById((prev) => ({ ...prev, [field.id]: false }));
              if (uploaded.length > 0) {
                updateAnswer(field.id, [...attachments, ...uploaded]);
              }
            };

            return (
              <div className="space-y-3">
                {canAddMore && (
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 flex flex-col items-center justify-center text-center bg-muted/5">
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground font-medium">{t("back.loaddrag")}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("propert.sizefile")} {maxFileSize}MB • {t("propert.maxFiles")} {maxFiles}
                      {acceptedTypes.length > 0 ? ` (${acceptedTypes.join(", ")})` : ""}
                    </p>
                    <input
                      type="file"
                      className="hidden"
                      id={`file-upload-${field.id}`}
                      multiple={maxFiles > 1}
                      accept={acceptAttr}
                      onChange={handleFileChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      disabled={isUploading || isFieldDisabled}
                      onClick={() => document.getElementById(`file-upload-${field.id}`)?.click()}
                    >
                      {isUploading ? t("propert.attachmentsUploading") : t("propert.attachmentsAdd")}
                    </Button>
                  </div>
                )}
                <ElementAttachments
                  attachments={attachments}
                  displayMode="list"
                  listOnly
                  onRemove={isFieldDisabled ? undefined : removeAttachment}
                />
              </div>
            );
          })()
        )}

        <ElementAttachments
          attachments={(props.attachments as ElementAttachment[]) || []}
          displayMode={(() => {
            const mode = (props.attachmentsDisplay as "slider" | "list" | "grid") || "slider";
            // Type guard: проверяем, является ли mode допустимым значением
            if (mode === "slider" || mode === "list") {
              return mode;
            }
            // Fallback для "grid" или любых других значений
            return "list";
          })()}
        />

        {fieldErrors.length > 0 && (
          <div className="space-y-1">
            {fieldErrors.map((error) => (
              <p key={error} className="text-sm text-destructive">
                {localizeError(error, field)}
              </p>
            ))}
          </div>
        )}

        {hasCorrectAnswers && (!isRespondMode || (hasResult && results?.[field.id] === false)) && (
          <div className="text-sm text-green-700 mt-2">
            {field.widgetType === "ranking" ? (
              <div>
                <p className="font-medium">{t("propert.correctOrderLabel")}:</p>
                <ol className="list-decimal list-inside mt-1">
                  {correctAnswers.map((answer, idx) => (
                    <li key={idx}>{answer}</li>
                  ))}
                </ol>
              </div>
            ) : field.widgetType === "matrix" ? (
              <div>
                <p className="font-medium">{t("propert.correctCellsLabel")}:</p>
                <div className="mt-1">
                  {correctAnswers.map((cellKey, idx) => {
                    const [rowIdx, colIdx] = cellKey.split(':').map(Number);
                    const row = ((props.rows as string[]) || [])[rowIdx - 1] || `${t("propert.rowLabel")} ${rowIdx}`;
                    const col = ((props.columns as string[]) || [])[colIdx - 1] || `${t("propert.columnLabel")} ${colIdx}`;
                    return (
                      <p key={idx}>• {t("propert.rowColumnFormat", { row, col })}</p>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p>{t("propert.correctAnswerLabel")}: {correctAnswers.join(", ")}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  const visibleFields = form.fields.filter(isFieldVisible);
  const fieldsByPage = useMemo(() => {
    const grouped = new Map<number, FormElementModel[]>();
    normalizedPages.forEach((page) => grouped.set(page.id, []));
    visibleFields.forEach((field) => {
      const pageId = pageIdSet.has(field.pageId) ? field.pageId : fallbackPageId;
      const list = grouped.get(pageId) ?? [];
      list.push(field);
      grouped.set(pageId, list);
    });
    for (const [pageId, list] of grouped.entries()) {
      grouped.set(
        pageId,
        list.slice().sort((a, b) => a.sortIndex - b.sortIndex)
      );
    }
    return grouped;
  }, [visibleFields, normalizedPages, pageIdSet, fallbackPageId]);
  const currentPageId = activePageId ?? normalizedPages[0]?.id ?? fallbackPageId;
  const currentPageIndex = normalizedPages.findIndex((page) => page.id === currentPageId);
  const isFirstPage = currentPageIndex <= 0;
  const isLastPage = currentPageIndex >= normalizedPages.length - 1;
  const currentPage = normalizedPages[currentPageIndex];
  const canGoBack = !isFirstPage && Boolean(currentPage?.allowBack);

  useEffect(() => {
    if (!isRespondMode) return; // только в режиме прохождения
    if (!onActivePageChange) return;
    if (!currentPage) return;

    onActivePageChange({
      pageId: currentPage.id,
      pageIndex: currentPageIndex,
      allowBack: Boolean(currentPage.allowBack),
      isFirst: isFirstPage,
      isLast: isLastPage,
    });
  }, [
    isRespondMode,
    onActivePageChange,
    currentPage?.id,
    currentPage?.allowBack,
    currentPageIndex,
    isFirstPage,
    isLastPage,
  ]);

  const activePageFields = fieldsByPage.get(currentPageId) ?? [];
  const activePageErrors = useMemo(
    () => validateForm(activePageFields, answers),
    [activePageFields, answers]
  );
  const hasRequiredErrorsOnPage = useMemo(
    () => Object.values(activePageErrors).some((errors) => errors.some(isRequiredError)),
    [activePageErrors]
  );
  const renderedFields = isRespondMode ? activePageFields : visibleFields;
  const lastVisibleField = renderedFields[renderedFields.length - 1];
  const needsCountryPadding = Boolean(lastVisibleField && isCountryField(lastVisibleField));
  const isInputsDisabled = readOnly || submitting;

  const goToPage = (pageId: number, replace = false) => {
    setActivePageId(pageId);
    const nextLoc = setPInLocation(location, pageId);
    if (nextLoc !== location) {
      setLocation(nextLoc, { replace }); // replace=false => push => back/forward работают
    }
  };


  const handlePrevPage = () => {
    if (!canGoBack) return;
    const prevPage = normalizedPages[currentPageIndex - 1];
    if (prevPage) goToPage(prevPage.id); // push
  };

  const handleNextPage = () => {
    if (isLastPage) return;
    const pageFields = activePageFields;
    const pageFieldIds = new Set(pageFields.map((field) => field.id));
    setTouched((prev) => {
      const next = { ...prev };
      pageFieldIds.forEach((fieldId) => {
        next[fieldId] = true;
      });
      return next;
    });
    if (requireRequiredOnPage && hasRequiredErrorsOnPage) {
      const firstRequiredField = pageFields.find((field) => {
        if (field.widgetType === "header") return false;
        const fieldErrors = activePageErrors[field.id] || [];
        return fieldErrors.some(isRequiredError);
      });
      const targetField = firstRequiredField ?? pageFields.find((field) => Boolean(activePageErrors[field.id]));
      if (targetField) {
        focusField(targetField.id);
      }
      showRequiredFieldsWarning();
      return;
    }

    const nextPage = normalizedPages[currentPageIndex + 1];
    if (nextPage) {
      goToPage(nextPage.id);
    }
  };

  const renderPageSection = (page: FormPageModel, pageFields: FormElementModel[]) => {
    const pageIndexLabel = t("pages.defaultTitle", { index: page.pageIndex + 1 });
    const pageTitle = page.title?.trim();
    const shouldShowTitle = Boolean(pageTitle && pageTitle !== pageIndexLabel);
    return (
      <section key={page.id} className="rounded-xl border border-border/40 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-border/40 bg-muted/10">
          <p className="text-sm font-semibold text-foreground">{pageIndexLabel}</p>
          {shouldShowTitle ? (
            <p className="text-xs text-muted-foreground mt-1">{pageTitle}</p>
          ) : null}
        </div>
        <div className="px-6 py-6 space-y-6">
          {pageFields.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("pages.empty")}</p>
          ) : (
            pageFields.map(renderField)
          )}
        </div>
      </section>
    );
  };

  const handleSubmitAnswers = async () => {
    if (!onSubmitAnswers || submitting) return;

    const visibleFieldIds = new Set(visibleFields.map((field) => field.id));
    setTouched((prev) => {
      const next = { ...prev };
      visibleFieldIds.forEach((fieldId) => {
        next[fieldId] = true;
      });
      return next;
    });

    const visibleErrors = validateForm(visibleFields, answers);
    if (Object.keys(visibleErrors).length > 0) {
      const firstRequiredField = visibleFields.find((field) => {
        if (field.widgetType === "header") return false;
        const fieldErrors = visibleErrors[field.id] || [];
        return fieldErrors.some(isRequiredError);
      });
      const firstInvalidField = visibleFields.find((field) => {
        if (field.widgetType === "header") return false;
        return Boolean(visibleErrors[field.id]);
      });
      const anyInvalidField = visibleFields.find((field) => Boolean(visibleErrors[field.id]));
      const targetField = firstRequiredField ?? firstInvalidField ?? anyInvalidField;

      if (targetField) {
        focusField(targetField.id);
      }

      if (firstRequiredField) {
        showRequiredFieldsWarning();
      }
      return;
    }

    const payload = buildAnswersPayload(visibleFields, answers);
    await onSubmitAnswers(payload);
  };

  return (
    <div
      className={cn("space-y-6 py-4", needsCountryPadding && "pb-24")}
      style={{ overflowX: 'hidden' }}
    >

      {(normalizedPages.filter((page) => page.id === currentPageId)).map(
        (page) => renderPageSection(page, fieldsByPage.get(page.id) ?? [])
      )}

      {isRespondMode ? (
        <div className="flex items-center justify-between gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevPage}
            disabled={!canGoBack || submitting}
            className="transition-all duration-200 ease-out enabled:hover:-translate-x-0.5 enabled:active:translate-x-0 disabled:opacity-50"
          >
            {t("pages.prevButton")}
          </Button>
          {isLastPage ? (
            <Button
              type="button"
              onClick={() => void handleSubmitAnswers()}
              disabled={submitting}
            >
              {submitting ? t("respond.submitting") : submitLabel ?? t("respond.submit")}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleNextPage}
              disabled={submitting || (requireRequiredOnPage && hasRequiredErrorsOnPage)}
            >
              {t("pages.nextButton")}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevPage}
            disabled={!canGoBack}
            className="transition-all duration-200 ease-out enabled:hover:-translate-x-0.5 enabled:active:translate-x-0 disabled:opacity-50"
          >
            {t("pages.prevButton")}
          </Button>
          <Button
            type="button"
            onClick={handleNextPage}
            disabled={isLastPage}
          >
            {t("pages.nextButton")}
          </Button>
        </div>
      )}

      {showRequiredWarning && (
        <div className="fixed right-4 bottom-4 z-[110] pointer-events-none">
          <div
            className={cn(
              "w-[calc(100vw-2rem)] sm:w-auto sm:min-w-[320px] sm:max-w-[420px] rounded-md border border-destructive bg-destructive px-6 py-4 text-base sm:text-lg font-semibold text-destructive-foreground shadow-lg transition-all duration-500 ease-out animate-in fade-in-0 slide-in-from-bottom-full",
              isRequiredWarningFading ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"
            )}
          >
            {t("respond.requiredFieldsWarning")}
          </div>
        </div>
      )}
    </div>
  );
}

export default FormPreview;


