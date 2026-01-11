import React, { useState, useMemo, useEffect, useRef } from "react";
import { FormField, FormSchema } from "@/lib/form-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, Clock, CheckCircle2, XCircle, Star, RotateCcw, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useTranslation } from 'react-i18next';
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

interface AutoResizeTextareaProps extends React.ComponentProps<typeof Textarea> {}

function AutoResizeTextarea({ value, onChange, ...props }: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      className="resize-none overflow-hidden"
      {...props}
    />
  );
}

interface SortableItemProps {
  id: string;
  disabled?: boolean;
}

const FULLNAME_MAX_CHARS = 50;
const PASSPORT_SERIES_NUMBER_MAX_CHARS = 11;
const PASSPORT_ISSUED_BY_MAX_CHARS = 60;
const PASSPORT_DEPARTMENT_CODE_MAX_CHARS = 7;
const PASSPORT_BIRTH_PLACE_MAX_CHARS = 60;
const PASSPORT_SERIES_REQUIRED_DIGITS = 10;
const PASSPORT_DEPARTMENT_REQUIRED_DIGITS = 6;

function SortableItem({ id, disabled }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

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
        className={cn(
          "cursor-grab touch-none",
          disabled && "cursor-not-allowed"
        )}
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

type AnswerValue = string | string[] | number | Date | null;
type Answers = Record<string, AnswerValue>;
type Results = Record<string, boolean>;

export function FormPreview({ form }: FormPreviewProps) {
  const { t, i18n } = useTranslation();
  const [answers, setAnswers] = useState<Answers>({});
  const [results, setResults] = useState<Results | null>(null);
  const [totalScore, setTotalScore] = useState<number>(0);
  const [maxScore, setMaxScore] = useState<number>(0);
  const [passportErrors, setPassportErrors] = useState<Record<string, boolean>>({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const hasQuizFields = useMemo(() => {
    return form.fields.some(f => f.correctAnswers && f.correctAnswers.length > 0);
  }, [form.fields]);

  const updateAnswer = (fieldId: string, value: AnswerValue) => {
    setAnswers(prev => ({ ...prev, [fieldId]: value }));
    if (results) {
      setResults(null);
    }
  };

  const formatDateInput = (date: Date | null) => {
    if (!date || Number.isNaN(date.getTime())) return ""
    return format(date, "yyyy-MM-dd")
  }

  const isValidDateString = (value: string) => {
    if (value.length !== 10) return false
    const [y, m, d] = value.split("-").map(Number)
    if (!y || !m || !d) return false
    if (m < 1 || m > 12) return false
    const parsed = new Date(y, m - 1, d)
    return (
      parsed.getFullYear() === y &&
      parsed.getMonth() === m - 1 &&
      parsed.getDate() === d
    )
  }

  const formatPassportSeriesNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    const part1 = digits.slice(0, 4);
    const part2 = digits.slice(4, 10);
    return part2 ? `${part1} ${part2}` : part1;
  };

  const formatPassportDepartmentCode = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    const part1 = digits.slice(0, 3);
    const part2 = digits.slice(3, 6);
    return part2 ? `${part1}-${part2}` : part1;
  };

  const parseDateFromString = (value: string) => {
    if (!isValidDateString(value)) return null;
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
      }
    }
  };

  useEffect(() => {
    const rankingFields = form.fields.filter(f => f.type === "ranking" && f.options && f.options.length > 0);
    const updates: Record<string, string[]> = {};
    
    rankingFields.forEach(field => {
      if (!answers[field.id] && field.options) {
        updates[field.id] = [...field.options];
      }
    });
    
    if (Object.keys(updates).length > 0) {
      setAnswers(prev => ({ ...prev, ...updates }));
    }
  }, [form.fields]);

  const checkAnswers = () => {
    const newResults: Results = {};
    let score = 0;
    let max = 0;

    form.fields.forEach(field => {
      if (field.correctAnswers && field.correctAnswers.length > 0) {
        const userAnswer = answers[field.id];
        const points = field.points || 1;
        max += points;

        let isCorrect = false;

        if (field.type === "ranking") {
          const userOrder = userAnswer as string[] || [];
          isCorrect = userOrder.length === field.correctAnswers.length &&
            userOrder.every((item, idx) => item === field.correctAnswers![idx]);
        } else if (field.type === "checkbox") {
          const userAnswersArr = (userAnswer as string[] || []).sort();
          const correctAnswersArr = field.correctAnswers.slice().sort();
          isCorrect = userAnswersArr.length === correctAnswersArr.length &&
            userAnswersArr.every((ans, idx) => ans.toLowerCase() === correctAnswersArr[idx].toLowerCase());
        } else {
          const userAnswerStr = String(userAnswer || "").toLowerCase().trim();
          isCorrect = field.correctAnswers.some(
            correct => correct.toLowerCase().trim() === userAnswerStr
          );
        }

        newResults[field.id] = isCorrect;
        if (isCorrect) {
          score += points;
        }
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
  };

  const isFieldVisible = (field: FormField): boolean => {
    try {
      if (!field.conditionalLogic || !field.conditionalLogic.dependsOn) return true;
      const { dependsOn, condition, expectedValue } = field.conditionalLogic;
  const parentAnswer = answers[dependsOn!];
  
  switch (condition) {
    case "equals":
      if (Array.isArray(expectedValue)) {
        return Array.isArray(parentAnswer) 
          ? expectedValue.some(val => parentAnswer.includes(val))
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
      console.error('Error in isFieldVisible for field:', field.id, field.label, error);
      return true;
    }
  };





  const renderField = (field: FormField) => {
    const hasResult = results !== null && field.id in results;
    const isCorrect = hasResult && results[field.id];
    const isIncorrect = hasResult && !results[field.id];

    const fieldWrapperClass = cn(
      "space-y-2 p-3 rounded-lg transition-colors",
      isCorrect && "bg-green-50 border border-green-200",
      isIncorrect && "bg-red-50 border border-red-200"
    );

    return (
      <div key={field.id} className={fieldWrapperClass}>
        {field.type !== "header" && (
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
              {field.points && field.points > 0 && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {field.points} pts
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

        {field.helperText && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap break-all">
            {field.helperText}
          </p>
        )}

        {field.type === "header" && (
          <h2 className="text-xl font-bold pb-2 border-b">{field.label}</h2>
        )}

        {field.type === "text" && (
          field.multiline ? (
            <AutoResizeTextarea
              placeholder={field.placeholder}
              value={(answers[field.id] as string) || ""}
              onChange={(e) => updateAnswer(field.id, e.target.value)}
              disabled={results !== null}
            />
          ) : (
            <Input
              placeholder={field.placeholder}
              value={(answers[field.id] as string) || ""}
              onChange={(e) => updateAnswer(field.id, e.target.value)}
              disabled={results !== null}
            />
          )
        )}

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

        {["email", "phone", "inn", "snils", "ogrn", "bik", "account"].includes(field.type) && (
          <Input
            placeholder={field.placeholder}
            value={(answers[field.id] as string) || ""}
            onChange={(e) => updateAnswer(field.id, e.target.value)}
            disabled={results !== null}
          />
        )}

        {field.type === "passport" && (() => {
          const isRu = i18n.language.startsWith("ru");
          const keys = {
            seriesNumber: `${field.id}_seriesNumber`,
            issuedBy: `${field.id}_issuedBy`,
            issueDate: `${field.id}_issueDate`,
            departmentCode: `${field.id}_departmentCode`,
            birthPlace: `${field.id}_birthPlace`,
          };
          const labels = {
            seriesNumber: isRu ? "Серия и номер" : "Series and number",
            issuedBy: isRu ? "Кем выдан" : "Issued by",
            issueDate: isRu ? "Дата выдачи" : "Issue date",
            departmentCode: isRu ? "Код подразделения" : "Department code",
            birthPlace: isRu ? "Место рождения" : "Place of birth",
          };
          const placeholders = {
            seriesNumber: "1234 567890",
            issuedBy: isRu ? "ГУ МВД России по г. Санкт-Петербургу и Ленинградской области" : "GU MVD of Russia, St. Petersburg and Leningrad Region",
            issueDate: "2001-01-01",
            departmentCode: "123-456",
            birthPlace: isRu ? "г. Санкт-Петербург" : "St. Petersburg, Russia",
          };
          const hidden = {
            seriesNumber: field.hidePassportSeriesNumber,
            issuedBy: field.hidePassportIssuedBy,
            issueDate: field.hidePassportIssueDate,
            departmentCode: field.hidePassportDepartmentCode,
            birthPlace: field.hidePassportBirthPlace,
          };
          const issueDateAnswer = answers[keys.issueDate];
          const issueDateValue = issueDateAnswer instanceof Date
            ? issueDateAnswer
            : (typeof issueDateAnswer === "string" ? parseDateFromString(issueDateAnswer) : null);

          return (
            <div className="grid gap-3">
            {!hidden.seriesNumber && (
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">
                  {labels.seriesNumber}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {(() => {
                  const value = (answers[keys.seriesNumber] as string) || "";
                  const len = value.replace(/\D/g, "").length;
                  const limit = PASSPORT_SERIES_REQUIRED_DIGITS;
                  const progress = limit ? Math.min(len / limit, 1) : 0;
                  const isComplete = len > 0 && len === limit;
                  const isError = passportErrors[keys.seriesNumber];
                  const progressColor = isError ? "#ef4444" : isComplete ? "#22c55e" : "#94a3b8";
                  const trackColor = "#e2e8f0";
                  const ringRadius = 5;
                  const ringCircumference = 2 * Math.PI * ringRadius;

                  return (
                    <div className="relative">
                      <Input
                        value={value}
                        onChange={(e) => updateAnswer(keys.seriesNumber, formatPassportSeriesNumber(e.target.value))}
                        onBlur={(e) => {
                          const nextLen = e.target.value.replace(/\D/g, "").length;
                          const isInvalid = nextLen > 0 && nextLen !== limit;
                          setPassportErrors((prev) => ({ ...prev, [keys.seriesNumber]: isInvalid }));
                        }}
                        onFocus={() => {
                          setPassportErrors((prev) => ({ ...prev, [keys.seriesNumber]: false }));
                        }}
                        disabled={results !== null}
                        required={field.required}
                        maxLength={PASSPORT_SERIES_NUMBER_MAX_CHARS}
                        inputMode="numeric"
                        pattern="\\d{4} \\d{6}"
                        placeholder={placeholders.seriesNumber}
                        className={cn(
                          "pr-20",
                          isError ? "border-destructive focus-visible:ring-destructive/20" : ""
                        )}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <div
                          className={cn(
                            "text-xs font-medium",
                            isError ? "text-destructive" : isComplete ? "text-green-600" : "text-muted-foreground"
                          )}
                        >
                          {`${len}/${limit}`}
                        </div>
                        <svg
                          className="h-3 w-3"
                          viewBox="0 0 12 12"
                          aria-hidden="true"
                        >
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
                    </div>
                  );
                })()}
              </div>
            )}
            {!hidden.issuedBy && (
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">
                  {labels.issuedBy}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                <Input
                  value={(answers[keys.issuedBy] as string) || ""}
                  onChange={(e) => updateAnswer(keys.issuedBy, e.target.value.slice(0, PASSPORT_ISSUED_BY_MAX_CHARS))}
                  disabled={results !== null}
                  required={field.required}
                  maxLength={PASSPORT_ISSUED_BY_MAX_CHARS}
                  placeholder={placeholders.issuedBy}
                />
              </div>
            )}
            {!hidden.issueDate && (
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">
                  {labels.issueDate}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
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
                        selected={issueDateValue || undefined}
                        onSelect={(date) => {
                          updateAnswer(keys.issueDate, date || null)
                        }}
                        locale={ru}
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="date"
                    value={formatDateInput(issueDateValue)}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === "") {
                        updateAnswer(keys.issueDate, null)
                        return
                      }
                      const parsed = parseDateFromString(val)
                      if (parsed) {
                        updateAnswer(keys.issueDate, parsed)
                      }
                    }}
                    disabled={results !== null}
                    className="pl-10 h-10 text-muted-foreground"
                    placeholder={placeholders.issueDate}
                    required={field.required}
                  />
                </div>
              </div>
            )}
            {!hidden.departmentCode && (
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">
                  {labels.departmentCode}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {(() => {
                  const value = (answers[keys.departmentCode] as string) || "";
                  const len = value.replace(/\D/g, "").length;
                  const limit = PASSPORT_DEPARTMENT_REQUIRED_DIGITS;
                  const progress = limit ? Math.min(len / limit, 1) : 0;
                  const isComplete = len > 0 && len === limit;
                  const isError = passportErrors[keys.departmentCode];
                  const progressColor = isError ? "#ef4444" : isComplete ? "#22c55e" : "#94a3b8";
                  const trackColor = "#e2e8f0";
                  const ringRadius = 5;
                  const ringCircumference = 2 * Math.PI * ringRadius;

                  return (
                    <div className="relative">
                      <Input
                        value={value}
                        onChange={(e) => updateAnswer(keys.departmentCode, formatPassportDepartmentCode(e.target.value))}
                        onBlur={(e) => {
                          const nextLen = e.target.value.replace(/\D/g, "").length;
                          const isInvalid = nextLen > 0 && nextLen !== limit;
                          setPassportErrors((prev) => ({ ...prev, [keys.departmentCode]: isInvalid }));
                        }}
                        onFocus={() => {
                          setPassportErrors((prev) => ({ ...prev, [keys.departmentCode]: false }));
                        }}
                        disabled={results !== null}
                        required={field.required}
                        maxLength={PASSPORT_DEPARTMENT_CODE_MAX_CHARS}
                        inputMode="numeric"
                        pattern="\\d{3}-\\d{3}"
                        placeholder={placeholders.departmentCode}
                        className={cn(
                          "pr-20",
                          isError ? "border-destructive focus-visible:ring-destructive/20" : ""
                        )}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <div
                          className={cn(
                            "text-xs font-medium",
                            isError ? "text-destructive" : isComplete ? "text-green-600" : "text-muted-foreground"
                          )}
                        >
                          {`${len}/${limit}`}
                        </div>
                        <svg
                          className="h-3 w-3"
                          viewBox="0 0 12 12"
                          aria-hidden="true"
                        >
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
                    </div>
                  );
                })()}
              </div>
            )}
            {!hidden.birthPlace && (
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">
                  {labels.birthPlace}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                <Input
                  value={(answers[keys.birthPlace] as string) || ""}
                  onChange={(e) => updateAnswer(keys.birthPlace, e.target.value.slice(0, PASSPORT_BIRTH_PLACE_MAX_CHARS))}
                  disabled={results !== null}
                  required={field.required}
                  maxLength={PASSPORT_BIRTH_PLACE_MAX_CHARS}
                  placeholder={placeholders.birthPlace}
                />
              </div>
            )}
            </div>
          );
        })()}

        {field.type === "number" && (
          <Input
            type="number"
            step={field.allowDecimals ? "any" : "1"}
            placeholder={field.placeholder}
            value={(answers[field.id] as string) || ""}
            onChange={(e) => updateAnswer(field.id, e.target.value)}
            disabled={results !== null}
          />
        )}

        {field.type === "datetime" && (
          <div className="space-y-3">
            {!field.hideDate && (
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
                      selected={answers[field.id] as Date | undefined}
                      onSelect={(date) => {
                        updateAnswer(field.id, date || null)
                      }}
                      locale={ru}
                    />
                  </PopoverContent>
                </Popover>
                <Input
                  type="date"
                  value={formatDateInput(
                    answers[field.id] instanceof Date
                      ? (answers[field.id] as Date)
                      : null
                  )}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === "") {
                      updateAnswer(field.id, null)
                      return
                    }
                    if (isValidDateString(val)) {
                      const [y, m, d] = val.split("-").map(Number)
                      const parsed = new Date(y, m - 1, d)
                      updateAnswer(field.id, parsed)
                    }
                  }}
                  disabled={results !== null}
                  className="pl-10 h-10 text-muted-foreground"
                  placeholder={t("propert.selectDate")}
                />
              </div>
            )}
            {!field.hideTime && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-10",
                      !answers[field.id + "_time"] && "text-muted-foreground"
                    )}
                    disabled={results !== null}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    {answers[field.id + "_time"] ? (
                      <span>{answers[field.id + "_time"] as string}</span>
                    ) : (
                      <span>{t("propert.selectTime")}</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="start">
                  <Input
                    type="time"
                    value={(answers[field.id + "_time"] as string) || ""}
                    onChange={(e) => updateAnswer(field.id + "_time", e.target.value)}
                    disabled={results !== null}
                    className="w-full"
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}

        {field.type === "select" && (
          <Select
            value={(answers[field.id] as string) || ""}
            onValueChange={(value) => updateAnswer(field.id, value)}
            disabled={results !== null}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || "Выберите..."} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.filter(Boolean).map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {field.type === "country" && (
          <Select
            value={(answers[field.id] as string) || ""}
            onValueChange={(value) => updateAnswer(field.id, value)}
            disabled={results !== null}
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите страну..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.filter(Boolean).map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {field.type === "radio" && (
          <RadioGroup
            value={(answers[field.id] as string) || ""}
            onValueChange={(value) => updateAnswer(field.id, value)}
            disabled={results !== null}
          >
            {field.options?.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                <Label htmlFor={`${field.id}-${option}`} className="cursor-pointer">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        {field.type === "checkbox" && (
          <div className="space-y-2">
            {field.options?.map((option) => {
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
                        updateAnswer(field.id, currentValues.filter(v => v !== option));
                      }
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

        {field.type === "ranking" && field.options && field.options.length > 0 && (
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
                items={(answers[field.id] as string[]) || field.options}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {((answers[field.id] as string[]) || field.options).map((item) => (
                    <SortableItem
                      key={item}
                      id={item}
                      disabled={results !== null}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {field.type === "rating" && (
          <div className="flex items-center gap-1">
            {Array.from({ length: field.maxRating || 5 }, (_, i) => i + 1).map((value) => (
              <button
                key={value}
                type="button"
                disabled={results !== null}
                onClick={() => updateAnswer(field.id, value)}
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

        {isIncorrect && field.correctAnswers && field.correctAnswers.length > 0 && (
          <div className="text-sm text-green-700 mt-2">
            {field.type === "ranking" ? (
              <div>
                <p className="font-medium">Правильный порядок:</p>
                <ol className="list-decimal list-inside mt-1">
                  {field.correctAnswers.map((answer, idx) => (
                    <li key={idx}>{answer}</li>
                  ))}
                </ol>
              </div>
            ) : (
              <p>Правильный ответ: {field.correctAnswers.join(", ")}</p>
            )}
          </div>
        )}
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

