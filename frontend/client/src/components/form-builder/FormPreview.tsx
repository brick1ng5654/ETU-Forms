import React, { useState, useMemo, useEffect, useRef } from "react";
import type {
  AnswerValue,
  AnswersById,
  DateTimeAnswer,
  FormElementModel,
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, Clock, CheckCircle2, XCircle, Star, RotateCcw, GripVertical, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useTranslation } from "react-i18next";
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

interface CollapsibleTextareaProps extends React.ComponentProps<typeof Textarea> {
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  collapsedLines?: number;
  indicator?: React.ReactNode;
}

const DEFAULT_TEXTAREA_LINE_HEIGHT = 20;

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
    const textarea = resolvedRef.current;
    if (textarea) {
      const currentScrollTop = textarea.scrollTop;
      const prevHeight = textarea.offsetHeight;
      textarea.style.transition = "height 440ms ease";
<<<<<<< HEAD
      textarea.style.height = 'auto';
=======
      textarea.style.height = "auto";
>>>>>>> 33b2739 (удален легаси код, фикс скобки)
      const { lineHeight, paddingTop, paddingBottom, lineCount } = getTextareaMetrics(textarea);
      const overflow = lineCount > collapsedLines;
      if (hasOverflowRef.current !== overflow) {
        hasOverflowRef.current = overflow;
        setHasOverflow(overflow);
      }
      const collapsedHeight = Math.ceil(lineHeight * collapsedLines + paddingTop + paddingBottom + 4);
<<<<<<< HEAD
      const targetHeight = overflow && !isExpanded
        ? collapsedHeight
        : textarea.scrollHeight;
=======
      const targetHeight = overflow && !isExpanded ? collapsedHeight : textarea.scrollHeight;
>>>>>>> 33b2739 (удален легаси код, фикс скобки)
      const startHeight = `${prevHeight}px`;
      const endHeight = `${targetHeight}px`;
      if (startHeight === endHeight) {
        textarea.style.height = endHeight;
        textarea.scrollTop = currentScrollTop;
        return;
      }
      textarea.style.height = startHeight;
<<<<<<< HEAD
      // Force reflow before applying the target height to trigger transition
=======
>>>>>>> 33b2739 (удален легаси код, фикс скобки)
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
<<<<<<< HEAD
                  {i18n.language.startsWith("ru") ? "Скрыть" : "Hide"}
=======
                  {t("common.showLess")}
>>>>>>> 33b2739 (удален легаси код, фикс скобки)
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
<<<<<<< HEAD
                  {i18n.language.startsWith("ru") ? "Показать полностью" : "Show full text"}
=======
                  {t("common.showMore")}
>>>>>>> 33b2739 (удален легаси код, фикс скобки)
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

interface TextLengthIndicatorProps {
  len: number;
  limit: number;
  className?: string;
  staticPosition?: boolean;
}

<<<<<<< HEAD
const FULLNAME_MAX_CHARS = 50;
const DEFAULT_PHONE_PLACEHOLDER = "+7 (000) 000-00-00";
const PHONE_MAX_DIGITS = 15;
const INN_INDIVIDUAL_LENGTH = 12;
const INN_LEGAL_ENTITY_LENGTH = 10;
const OGRN_LEGAL_ENTITY_LENGTH = 13;
const OGRN_IP_LENGTH = 15;
const SNILS_REQUIRED_DIGITS = 11;
const SNILS_MAX_CHARS = 14;
const BIK_REQUIRED_DIGITS = 9;
const PHONE_REQUIRED_DIGITS = 11;
const DEFAULT_SNILS_PLACEHOLDER = "000-000-000 00";
const DEFAULT_BIK_PLACEHOLDER = "000000000";
const TEXT_SINGLELINE_MAX_CHARS = 255;
const TEXT_MULTILINE_MAX_CHARS = 10000;

const getTextMaxChars = (field: FormField) => {
  const limit = field.multiline ? TEXT_MULTILINE_MAX_CHARS : TEXT_SINGLELINE_MAX_CHARS;
  const rawMax = typeof field.maxChars === "number" ? field.maxChars : limit;
  const normalized = rawMax > 0 ? rawMax : 1;
  return Math.min(normalized, limit);
};
=======
const TEXT_SINGLELINE_MAX_CHARS = 255;
const TEXT_MULTILINE_MAX_CHARS = 10000;
>>>>>>> 33b2739 (удален легаси код, фикс скобки)

const getTextMaxLimit = (field: FormElementModel) =>
  field.widgetType === "textarea" ? TEXT_MULTILINE_MAX_CHARS : TEXT_SINGLELINE_MAX_CHARS;

const getTextMaxChars = (field: FormElementModel) => {
  const limit = getTextMaxLimit(field);
  const props = field.props as Record<string, unknown>;
  const rawMax = typeof props.maxChars === "number" ? props.maxChars : limit;
  const normalized = rawMax > 0 ? rawMax : 1;
  return Math.min(normalized, limit);
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

<<<<<<< HEAD
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

const formatPhoneInput = (value: string, previousValue: string) => {
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith("+");
  const previousDigits = previousValue.replace(/\D/g, "");
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  const isDeleting = value.length < previousValue.length;
  if (isDeleting && digits.length === previousDigits.length) {
    digits = digits.slice(0, -1);
    if (!digits) return "";
  }

  const startsWithAllowed =
    digits.startsWith("7") ||
    digits.startsWith("8") ||
    (hasPlus && digits.startsWith("7"));
  if (!startsWithAllowed) {
    return previousValue;
  }
  return formatRuPhoneDigits(digits);
};
const PASSPORT_SERIES_NUMBER_MAX_CHARS = 11;
const PASSPORT_ISSUED_BY_MAX_CHARS = 60;
const PASSPORT_DEPARTMENT_CODE_MAX_CHARS = 7;
const PASSPORT_BIRTH_PLACE_MAX_CHARS = 60;
const PASSPORT_SERIES_REQUIRED_DIGITS = 10;
const PASSPORT_DEPARTMENT_REQUIRED_DIGITS = 6;

const getInnMaxLength = (field: FormField) =>
  field.innLegalEntity ? INN_LEGAL_ENTITY_LENGTH : INN_INDIVIDUAL_LENGTH;

const getInnPlaceholder = (field: FormField) => "0".repeat(getInnMaxLength(field));

const sanitizeInnValue = (value: string, maxLength: number) =>
  value.replace(/\D/g, "").slice(0, maxLength);

const sanitizeBikValue = (value: string) =>
  value.replace(/\D/g, "").slice(0, BIK_REQUIRED_DIGITS);

const getOgrnMaxLength = (field: FormField) =>
  field.ogrnIp ? OGRN_IP_LENGTH : OGRN_LEGAL_ENTITY_LENGTH;

const getOgrnLabelKey = (field: FormField) =>
  field.ogrnIp ? "placeholders.ogrnIp" : "placeholders.ogrn";

const getOgrnPlaceholder = (field: FormField) => "0".repeat(getOgrnMaxLength(field));

const sanitizeOgrnValue = (value: string, maxLength: number) =>
  value.replace(/\D/g, "").slice(0, maxLength);

=======
>>>>>>> 33b2739 (удален легаси код, фикс скобки)
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
}

type Results = Record<string, boolean>;

export function FormPreview({ form }: FormPreviewProps) {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<AnswersById>({});
  const [results, setResults] = useState<Results | null>(null);
  const [totalScore, setTotalScore] = useState<number>(0);
  const [maxScore, setMaxScore] = useState<number>(0);
  const [errorsById, setErrorsById] = useState<Record<string, string[]>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [focusedFieldId, setFocusedFieldId] = useState<string | null>(null);
  const payloadRef = useRef<ReturnType<typeof buildAnswersPayload> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const hasQuizFields = useMemo(() => {
    return form.fields.some((field) => {
      const props = field.props as Record<string, unknown>;
      const correctAnswers = props.correctAnswers as string[] | undefined;
      return Boolean(correctAnswers && correctAnswers.length > 0);
    });
  }, [form.fields]);

  useEffect(() => {
    setErrorsById(validateForm(form.fields, answers));
  }, [form.fields, answers]);

  useEffect(() => {
    payloadRef.current = buildAnswersPayload(form.fields, answers);
  }, [form.fields, answers]);

  const updateAnswer = (fieldId: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    if (results) {
      setResults(null);
    }
  };

  const markTouched = (fieldId: string) => {
    setTouched((prev) => ({ ...prev, [fieldId]: true }));
  };

  const formatDateInput = (value: string | null | undefined) => {
    if (!value) return "";
    return value;
  };

  const isValidDateString = (value: string) => {
    if (value.length !== 10) return false;
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return false;
    if (m < 1 || m > 12) return false;
    const parsed = new Date(y, m - 1, d);
    return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d;
  };

  const parseDateFromString = (value: string) => {
    if (!isValidDateString(value)) return undefined;
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
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
      max += points;

      let isCorrect = false;

      if (field.widgetType === "ranking") {
        const userOrder = (userAnswer as string[]) || [];
        isCorrect =
          userOrder.length === correctAnswers.length &&
          userOrder.every((item, idx) => item === correctAnswers[idx]);
      } else if (field.widgetType === "checkbox") {
        const userAnswersArr = ((userAnswer as string[]) || []).sort();
        const correctAnswersArr = correctAnswers.slice().sort();
        isCorrect =
          userAnswersArr.length === correctAnswersArr.length &&
          userAnswersArr.every((ans, idx) => ans.toLowerCase() === correctAnswersArr[idx].toLowerCase());
      } else {
        const userAnswerStr = typeof userAnswer === "string" || typeof userAnswer === "number"
          ? String(userAnswer || "").toLowerCase().trim()
          : "";
        isCorrect = correctAnswers.some(
          (correct) => correct.toLowerCase().trim() === userAnswerStr
        );
      }

      newResults[field.id] = isCorrect;
      if (isCorrect) {
        score += points;
      }
    });

    setResults(newResults);
    setTotalScore(score);
    setMaxScore(max);
  };

  const resetQuiz = () => {
    setAnswers({});
    setResults(null);
    setTotalScore(0);
    setMaxScore(0);
    setTouched({});
  };

  const isFieldVisible = (field: FormElementModel): boolean => {
    try {
      const props = field.props as Record<string, unknown>;
      const conditionalLogic = props.conditionalLogic as {
        dependsOn?: string;
        condition?: "equals" | "not_equals" | "answered";
        expectedValue?: string | string[];
      } | undefined;
      if (!conditionalLogic || !conditionalLogic.dependsOn) return true;
      const { dependsOn, condition, expectedValue } = conditionalLogic;
      const parentAnswer = answers[dependsOn];

      switch (condition) {
        case "equals":
          if (Array.isArray(expectedValue)) {
            return Array.isArray(parentAnswer)
              ? expectedValue.some((val) => (parentAnswer as string[]).includes(val))
              : expectedValue.includes(parentAnswer as string);
          }
          return parentAnswer === expectedValue;
        case "not_equals":
          return parentAnswer !== expectedValue;
        case "answered":
          return parentAnswer != null && parentAnswer !== "";
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
    } else {
      const digitsMatch = normalized.match(/(\d+)\s*digits/);
      if (digitsMatch) {
        localized = t("errors.digitsExact", { count: Number(digitsMatch[1]) });
      }
    }

    return partLabel ? `${partLabel}: ${localized}` : localized;
  };

  const renderTextInput = (field: FormElementModel, isDisabled: boolean) => {
    const props = field.props as Record<string, unknown>;
    const preset = field.semanticType ? presets[field.semanticType] : undefined;
    const fieldErrors = getErrorsForField(field.id);
    const hasError = fieldErrors.length > 0;

<<<<<<< HEAD
        {field.type === "header" && (
          <h2 className="text-xl font-bold pb-2 border-b">{field.label}</h2>
        )}

        {field.type === "text" && (() => {
          const maxChars = getTextMaxChars(field);
          const value = (answers[field.id] as string) || "";
          const handleChange = (nextValue: string) => {
            const trimmedValue = nextValue.slice(0, maxChars);
            updateAnswer(field.id, trimmedValue);
          };

          return field.multiline ? (
            <CollapsibleTextarea
              placeholder={field.placeholder}
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              disabled={results !== null}
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
          ) : (
            <div className="relative">
              <Input
                placeholder={field.placeholder}
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                disabled={results !== null}
                maxLength={maxChars}
                className="pr-20"
              />
              <TextLengthIndicator
                len={value.length}
                limit={maxChars}
                className="right-3 top-1/2 -translate-y-1/2"
              />
            </div>
          );
        })()}

        {field.type === "fullname" && (() => {
          const lastNameKey = `${field.id}_lastName`;
          const firstNameKey = `${field.id}_firstName`;
          const patronymicKey = `${field.id}_patronymic`;
          const isRu = i18n.language.startsWith("ru");
          const labels = {
            lastName: isRu ? "Фамилия" : "Last name",
            firstName: isRu ? "Имя" : "First name",
            patronymic: isRu ? "Отчество (при наличии)" : "Middle name (if any)",
          };

          return (
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">
                  {labels.lastName}
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Input
                  value={(answers[lastNameKey] as string) || ""}
                  onChange={(e) => updateAnswer(lastNameKey, e.target.value.slice(0, FULLNAME_MAX_CHARS))}
                  disabled={results !== null}
                  required
                  maxLength={FULLNAME_MAX_CHARS}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">
                  {labels.firstName}
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Input
                  value={(answers[firstNameKey] as string) || ""}
                  onChange={(e) => updateAnswer(firstNameKey, e.target.value.slice(0, FULLNAME_MAX_CHARS))}
                  disabled={results !== null}
                  required
                  maxLength={FULLNAME_MAX_CHARS}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">{labels.patronymic}</Label>
                <Input
                  value={(answers[patronymicKey] as string) || ""}
                  onChange={(e) => updateAnswer(patronymicKey, e.target.value.slice(0, FULLNAME_MAX_CHARS))}
                  disabled={results !== null}
                  maxLength={FULLNAME_MAX_CHARS}
                />
              </div>
            </div>
          );
        })()}

        {field.type === "phone" && (() => {
          const value = (answers[field.id] as string) || "";
          const len = value.replace(/\D/g, "").length;
          const limit = PHONE_REQUIRED_DIGITS;
          const isComplete = len > 0 && len === limit;
          const isError = phoneErrors[field.id];
=======
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
>>>>>>> 33b2739 (удален легаси код, фикс скобки)

            return (
              <div key={part.key} className="space-y-1">
                <Label className="text-sm text-muted-foreground">
                  {label}
                  {(part.required ?? field.required) && <span className="text-destructive ml-1">*</span>}
                </Label>
                <div className="relative">
                  <Input
                    type={part.inputType || "text"}
                    inputMode={part.inputMode}
                    value={displayValue}
                    onChange={(e) => {
                      const normalized = part.normalize ? part.normalize(e.target.value) : e.target.value;
                      updateAnswer(field.id, { ...compositeRecord, [part.key]: normalized } as AnswerValue);
                    }}
                    onBlur={() => markTouched(field.id)}
                    disabled={isDisabled}
                    maxLength={maxLength}
                    placeholder={placeholder}
                    className={cn(
                      limit ? "pr-20" : "",
                      partError ? "border-destructive focus-visible:ring-destructive/20" : ""
                    )}
                  />
                  {showIndicator && (
                    <LengthIndicator
                      len={len}
                      limit={limit}
                      isError={partError}
                      isComplete={len > 0 && len === limit}
                    />
                  )}
                </div>
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
    const maxLength = (preset?.maxChars as number | undefined) ?? getTextMaxChars(field);
    const dynamicMaxDigits = preset?.getMaxDigits ? preset.getMaxDigits(props) : undefined;
    const maxDigits = (dynamicMaxDigits ?? preset?.maxDigits) as number | undefined;
    const len = maxDigits ? canonicalValue.replace(/\D/g, "").length : canonicalValue.length;
    const limit = maxDigits ?? maxLength;

    return (
      <div className="relative">
        <Input
          type={(preset?.inputType as string) || (props.inputType as string) || "text"}
          inputMode={(preset?.inputMode as string) || (props.inputMode as string) || undefined}
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
        {limit && (
          <LengthIndicator
            len={len}
            limit={limit}
            isError={hasError}
            isComplete={len > 0 && len === limit}
          />
        )}
      </div>
    );
  };









  const renderField = (field: FormElementModel) => {
    const props = field.props as Record<string, unknown>;
    const options = props.options as string[] | undefined;
    const hideDate = Boolean(props.hideDate);
    const hideTime = Boolean(props.hideTime);
    const hasResult = results !== null && field.id in results;
    const isCorrect = hasResult && results[field.id];
    const isIncorrect = hasResult && !results[field.id];
    const fieldWrapperClass = cn(
      "space-y-2 p-3 rounded-lg transition-colors",
      isCorrect && "bg-green-50 border border-green-200",
      isIncorrect && "bg-red-50 border border-red-200"
    );
    const fieldErrors = getErrorsForField(field.id);

    return (
      <div
        key={field.id}
        className={fieldWrapperClass}
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
              {props.points && typeof props.points === "number" && props.points > 0 && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {props.points} pts
                </span>
              )}
            </Label>
            {hasResult && (
              <div className="flex items-center gap-1">
                {isCorrect ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
              </div>
            )}
          </div>
        )}

        {field.description && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap break-all">
            {field.description}
          </p>
        )}

        {field.widgetType === "header" && <h2 className="text-xl font-bold pb-2 border-b">{field.label}</h2>}

        {field.widgetType === "text_input" && renderTextInput(field, results !== null)}

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
              disabled={results !== null}
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

        {field.widgetType === "number_input" && (
          <Input
            type="number"
            step={(props.allowDecimals as boolean) ? "any" : "1"}
            placeholder={props.placeholder as string}
            value={(answers[field.id] as string) || ""}
            onChange={(e) => updateAnswer(field.id, e.target.value)}
            onBlur={() => markTouched(field.id)}
            disabled={results !== null}
          />
        )}

        {field.widgetType === "datetime" && (() => {
          const dateTime = (answers[field.id] as DateTimeAnswer) || {};
          const dateValue = dateTime.date ?? null;
          const timeValue = dateTime.time ?? "";
          return (
            <div className="space-y-3">
              {!hideDate && (
                <div className="relative">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-0 top-0 h-10 w-10 hover:bg-transparent z-10"
                        disabled={results !== null}
                        type="button"
                      >
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateValue ? parseDateFromString(dateValue) : undefined}
                        onSelect={(date) => {
                          updateAnswer(field.id, {
                            ...dateTime,
                            date: date ? format(date, "yyyy-MM-dd") : null,
                          });
                        }}
                        locale={ru}
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="date"
                    value={formatDateInput(dateValue)}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        updateAnswer(field.id, { ...dateTime, date: null });
                        return;
                      }
                      if (isValidDateString(val)) {
                        updateAnswer(field.id, { ...dateTime, date: val });
                      }
                    }}
                    onBlur={() => markTouched(field.id)}
                    disabled={results !== null}
                    className="pl-10 h-10 text-muted-foreground"
                    placeholder={t("propert.selectDate")}
                  />
                </div>
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
                      disabled={results !== null}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      {timeValue ? <span>{timeValue}</span> : <span>{t("propert.selectTime")}</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4" align="start">
                    <Input
                      type="time"
                      value={timeValue}
                      onChange={(e) => updateAnswer(field.id, { ...dateTime, time: e.target.value })}
                      onBlur={() => markTouched(field.id)}
                      disabled={results !== null}
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
          <Select
            value={(answers[field.id] as string) || ""}
            onValueChange={(value) => {
              updateAnswer(field.id, value);
              markTouched(field.id);
            }}
            disabled={results !== null}
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
            </SelectContent>
          </Select>
        )}

        {field.widgetType === "radio" && (
          <RadioGroup
            value={(answers[field.id] as string) || ""}
            onValueChange={(value) => {
              updateAnswer(field.id, value);
              markTouched(field.id);
            }}
            disabled={results !== null}
          >
            {options?.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                <Label htmlFor={`${field.id}-${option}`} className="cursor-pointer">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        {field.widgetType === "checkbox" && (
          <div className="space-y-2">
            {options?.map((option) => {
              const currentValues = (answers[field.id] as string[]) || [];
              const isChecked = currentValues.includes(option);
              return (
                <div key={option} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field.id}-${option}`}
                    checked={isChecked}
                    disabled={results !== null}
                    simplifiedAnimation
                    onCheckedChange={(checked) => {
                      if (checked) {
                        updateAnswer(field.id, [...currentValues, option]);
                      } else {
                        updateAnswer(field.id, currentValues.filter((v) => v !== option));
                      }
                      markTouched(field.id);
                    }}
                  />
                  <Label htmlFor={`${field.id}-${option}`} className="cursor-pointer">
                    {option}
                  </Label>
                </div>
              );
            })}
          </div>
        )}

        {field.widgetType === "ranking" && options && options.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-2">
              Перетащите элементы, чтобы расположить их в правильном порядке
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
                    <SortableItem key={item} id={item} disabled={results !== null} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {field.widgetType === "rating" && (
          <div className="flex items-center gap-1">
            {Array.from({ length: (props.maxRating as number) || 5 }, (_, i) => i + 1).map((value) => (
              <button
                key={value}
                type="button"
                disabled={results !== null}
                onClick={() => {
                  updateAnswer(field.id, value);
                  markTouched(field.id);
                }}
                className="p-1 hover:scale-110 transition-transform disabled:cursor-not-allowed"
              >
                <Star
                  className={cn(
                    "h-6 w-6 transition-colors",
                    (answers[field.id] as number) >= value
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  )}
                />
              </button>
            ))}
          </div>
        )}

        {field.widgetType === "file_upload" && (
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 flex flex-col items-center justify-center text-center bg-muted/5">
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground font-medium">{t("back.loaddrag")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("propert.sizefile")} {(props.maxFileSize as number) || 10}MB
              {Array.isArray(props.acceptedFileTypes) && props.acceptedFileTypes.length > 0
                ? ` (${(props.acceptedFileTypes as string[]).join(", ")})`
                : ""}
            </p>
          </div>
        )}

        {fieldErrors.length > 0 && (
          <div className="space-y-1">
            {fieldErrors.map((error) => (
              <p key={error} className="text-sm text-destructive">
                {localizeError(error, field)}
              </p>
            ))}
          </div>
        )}

        {isIncorrect && (props.correctAnswers as string[] | undefined)?.length ? (
          <div className="text-sm text-green-700 mt-2">
            {field.widgetType === "ranking" ? (
              <div>
                <p className="font-medium">Правильный порядок:</p>
                <ol className="list-decimal list-inside mt-1">
                  {(props.correctAnswers as string[]).map((answer, idx) => (
                    <li key={idx}>{answer}</li>
                  ))}
                </ol>
              </div>
            ) : (
              <p>Правильный ответ: {(props.correctAnswers as string[]).join(", ")}</p>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6 py-4">
      {results !== null && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Результаты</h3>
              <p className="text-2xl font-bold text-primary">
                {totalScore} / {maxScore} баллов
              </p>
              <p className="text-sm text-muted-foreground">
                {Math.round((totalScore / maxScore) * 100)}% правильных ответов
              </p>
            </div>
            <Button variant="outline" onClick={resetQuiz} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Пройти заново
            </Button>
          </div>
        </div>
      )}

      {form.fields.filter(isFieldVisible).map(renderField)}

      {hasQuizFields && results === null && (
        <div className="pt-4 border-t">
          <Button onClick={checkAnswers} className="w-full">
            Проверить ответы
          </Button>
        </div>
      )}
    </div>
  );
}

export default FormPreview;
