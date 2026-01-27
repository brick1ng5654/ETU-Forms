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

interface AutoResizeTextareaProps extends React.ComponentProps<typeof Textarea> {}

function AutoResizeTextarea({ value, onChange, ...props }: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
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

interface LengthIndicatorProps {
  len: number;
  limit: number;
  isError: boolean;
  isComplete: boolean;
}

function LengthIndicator({ len, limit, isError, isComplete }: LengthIndicatorProps) {
  const progress = limit ? Math.min(len / limit, 1) : 0;
  const progressColor = isError ? "#ef4444" : isComplete ? "#22c55e" : "#94a3b8";
  const trackColor = "#e2e8f0";
  const ringRadius = 5;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
      <div
        className={cn(
          "text-xs font-medium",
          isError ? "text-destructive" : isComplete ? "text-green-600" : "text-muted-foreground"
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
  const matrixContainerRef = useRef<HTMLDivElement>(null);

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
      
      // Рассчитываем максимальное количество баллов для поля
      if (field.widgetType === "matrix") {
        const pointsPerCell = (props.pointsPerCell as Record<string, number> | undefined) || {};
        const pointsPerRow = (props.pointsPerRow as Record<string, number> | undefined) || {};
        const pointsPerColumn = (props.pointsPerColumn as Record<string, number> | undefined) || {};
        
        // Максимальные баллы для матрицы - сумма баллов за все правильные ячейки
        correctAnswers.forEach((cellKey) => {
          max += pointsPerCell[cellKey] !== undefined ? pointsPerCell[cellKey] : 0;
        });
        
        // Добавляем максимальные баллы за строки
        Object.values(pointsPerRow).forEach((points) => {
          max += points;
        });
        
        // Добавляем максимальные баллы за столбцы
        Object.values(pointsPerColumn).forEach((points) => {
          max += points;
        });
        
        // Добавляем максимальные баллы за всю матрицу
        const matrixTotalPoints = (props.matrixTotalPoints as number | undefined) || 0;
        if (matrixTotalPoints > 0) {
          max += matrixTotalPoints;
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
        const userAnswersArr = ((userAnswer as string[]) || []).sort();
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
        const multiplePerRow = Boolean(props.multiplePerRow);
        const matrixValidationMode = (props.matrixValidationMode || "all") as "any" | "all" | string; // "any" or "all"
        
        // Проверяем режим валидации с помощью switch
        switch (matrixValidationMode) {
          case "all": {
            // Для режима "все" проверяем, что все правильные ответы выбраны
            const allCorrectSelected = correctAnswersArr.every(correctCell =>
              userAnswersArr.includes(correctCell)
            );
            
            if (allCorrectSelected) {
              // Для режима "все" с множественным выбором проверяем точное совпадение
              let exactMatch = true;
              if (multiplePerRow) {
                // Группируем правильные ответы по строкам
                const correctAnswersByRow: Record<number, string[]> = {};
                correctAnswersArr.forEach((cellKey) => {
                  const [rowIdx] = cellKey.split(':').map(Number);
                  if (!correctAnswersByRow[rowIdx]) {
                    correctAnswersByRow[rowIdx] = [];
                  }
                  correctAnswersByRow[rowIdx].push(cellKey);
                });
                
                // Проверяем каждую строку на точное совпадение
                Object.entries(correctAnswersByRow).forEach(([rowIdx, rowCorrectAnswers]) => {
                  // Получаем выбранные ответы в этой строке
                  const selectedInRow = userAnswersArr.filter(cellKey =>
                    cellKey.startsWith(`${rowIdx}:`)
                  );
                  
                  // Проверяем, что выбраны только правильные ответы и все они
                  const isRowCorrect =
                    selectedInRow.length === rowCorrectAnswers.length &&
                    selectedInRow.every(cellKey => rowCorrectAnswers.includes(cellKey)) &&
                    rowCorrectAnswers.every(cellKey => selectedInRow.includes(cellKey));
                  
                  if (!isRowCorrect) {
                    exactMatch = false;
                  }
                });
              }
              
              if (exactMatch) {
                // Начисляем баллы за все правильные ответы
                const pointsPerCell = (props.pointsPerCell as Record<string, number> | undefined) || {};
                correctAnswersArr.forEach((correctCell) => {
                  const pointsForCell = pointsPerCell[correctCell] !== undefined ? pointsPerCell[correctCell] : 0;
                  // Только добавляем баллы, если они больше 0
                  if (pointsForCell > 0) {
                    score += pointsForCell;
                  }
                });
              
                // Начисляем баллы за строки, если все ячейки в строке выбраны правильно
                const pointsPerRow = (props.pointsPerRow as Record<string, number> | undefined) || {};
                if (Object.keys(pointsPerRow).length > 0) {
                  // Группируем правильные ответы по строкам
                  const correctAnswersByRow: Record<number, string[]> = {};
                  correctAnswersArr.forEach((cellKey) => {
                    const [rowIdx] = cellKey.split(':').map(Number);
                    if (!correctAnswersByRow[rowIdx]) {
                      correctAnswersByRow[rowIdx] = [];
                    }
                    correctAnswersByRow[rowIdx].push(cellKey);
                  });
                  
                  // Проверяем каждую строку
                  Object.entries(correctAnswersByRow).forEach(([rowIdx, rowCorrectAnswers]) => {
                    // Проверяем, что все правильные ответы в строке выбраны
                    const allRowCorrectSelected = rowCorrectAnswers.every(cellKey =>
                      userAnswersArr.includes(cellKey)
                    );
                    
                    if (allRowCorrectSelected && pointsPerRow.hasOwnProperty(rowIdx)) {
                      score += pointsPerRow[rowIdx];
                    }
                  });
                }
                
                // Начисляем баллы за столбцы, если все ячейки в столбце выбраны правильно
                const pointsPerColumn = (props.pointsPerColumn as Record<string, number> | undefined) || {};
                if (Object.keys(pointsPerColumn).length > 0) {
                  // Группируем правильные ответы по столбцам
                  const correctAnswersByColumn: Record<number, string[]> = {};
                  correctAnswersArr.forEach((cellKey) => {
                    const [, colIdx] = cellKey.split(':').map(Number);
                    if (!correctAnswersByColumn[colIdx]) {
                      correctAnswersByColumn[colIdx] = [];
                    }
                    correctAnswersByColumn[colIdx].push(cellKey);
                  });
                  
                  // Проверяем каждый столбец
                  Object.entries(correctAnswersByColumn).forEach(([colIdx, colCorrectAnswers]) => {
                    // Проверяем, что все правильные ответы в столбце выбраны
                    const allColumnCorrectSelected = colCorrectAnswers.every(cellKey =>
                      userAnswersArr.includes(cellKey)
                    );
                    
                    if (allColumnCorrectSelected && pointsPerColumn.hasOwnProperty(colIdx)) {
                      score += pointsPerColumn[colIdx];
                    }
                  });
                }
                
                isCorrect = true;
              } else {
                // Если не все правильные ответы выбраны, начисляем 0 баллов
                isCorrect = false;
              }
            } else {
              // Если не все правильные ответы выбраны, начисляем 0 баллов
              isCorrect = false;
            }
            break;
          }
          
          case "any": {
            // Для режима "хотя бы один" проверяем, что выбран хотя бы один правильный ответ
            let correctCount = 0;
            const pointsPerCell = (props.pointsPerCell as Record<string, number> | undefined) || {};
            const pointsPerRow = (props.pointsPerRow as Record<string, number> | undefined) || {};
            const pointsPerColumn = (props.pointsPerColumn as Record<string, number> | undefined) || {};
            
            // Для каждого правильного ответа проверяем, есть ли он в ответах пользователя
            correctAnswersArr.forEach((correctCell) => {
              if (userAnswersArr.includes(correctCell)) {
                correctCount++;
                // Добавляем баллы за этот правильный ответ
                const pointsForCell = pointsPerCell[correctCell] !== undefined ? pointsPerCell[correctCell] : 0;
                // Только добавляем баллы, если они больше 0
                if (pointsForCell > 0) {
                  score += pointsForCell;
                }
              }
            });
            
            // Начисляем баллы за строки, если все ячейки в строке выбраны правильно
            if (Object.keys(pointsPerRow).length > 0) {
              // Группируем правильные ответы по строкам
              const correctAnswersByRow: Record<number, string[]> = {};
              correctAnswersArr.forEach((cellKey) => {
                const [rowIdx] = cellKey.split(':').map(Number);
                if (!correctAnswersByRow[rowIdx]) {
                  correctAnswersByRow[rowIdx] = [];
                }
                correctAnswersByRow[rowIdx].push(cellKey);
              });
              
              // Проверяем каждую строку
              Object.entries(correctAnswersByRow).forEach(([rowIdx, rowCorrectAnswers]) => {
                // Проверяем, что все правильные ответы в строке выбраны
                const allRowCorrectSelected = rowCorrectAnswers.every(cellKey =>
                  userAnswersArr.includes(cellKey)
                );
                
                if (allRowCorrectSelected && pointsPerRow.hasOwnProperty(rowIdx)) {
                  score += pointsPerRow[rowIdx];
                }
              });
            }
            
            // Начисляем баллы за столбцы, если все ячейки в столбце выбраны правильно
            if (Object.keys(pointsPerColumn).length > 0) {
              // Группируем правильные ответы по столбцам
              const correctAnswersByColumn: Record<number, string[]> = {};
              correctAnswersArr.forEach((cellKey) => {
                const [, colIdx] = cellKey.split(':').map(Number);
                if (!correctAnswersByColumn[colIdx]) {
                  correctAnswersByColumn[colIdx] = [];
                }
                correctAnswersByColumn[colIdx].push(cellKey);
              });
              
              // Проверяем каждый столбец
              Object.entries(correctAnswersByColumn).forEach(([colIdx, colCorrectAnswers]) => {
                // Проверяем, что все правильные ответы в столбце выбраны
                const allColumnCorrectSelected = colCorrectAnswers.every(cellKey =>
                  userAnswersArr.includes(cellKey)
                );
                
                if (allColumnCorrectSelected && pointsPerColumn.hasOwnProperty(colIdx)) {
                  score += pointsPerColumn[colIdx];
                }
              });
            }
            
            // isCorrect logic based on validation mode
            // Для режима "хотя бы один" - true если выбран хотя бы один правильный ответ
            isCorrect = correctCount > 0;
            break;
          }
          
          default: {
            // По умолчанию (режим "все") для одиночного выбора
            // Проверяем каждый правильный ответ отдельно и начисляем баллы за каждый
            let correctCount = 0;
            const pointsPerCell = (props.pointsPerCell as Record<string, number> | undefined) || {};
            const pointsPerRow = (props.pointsPerRow as Record<string, number> | undefined) || {};
            const pointsPerColumn = (props.pointsPerColumn as Record<string, number> | undefined) || {};
            
            // Для каждого правильного ответа проверяем, есть ли он в ответах пользователя
            correctAnswersArr.forEach((correctCell) => {
              if (userAnswersArr.includes(correctCell)) {
                correctCount++;
                // Добавляем баллы за этот правильный ответ
                const pointsForCell = pointsPerCell[correctCell] !== undefined ? pointsPerCell[correctCell] : 0;
                // Только добавляем баллы, если они больше 0
                if (pointsForCell > 0) {
                  score += pointsForCell;
                }
              }
            });
            
            // Начисляем баллы за строки, если все ячейки в строке выбраны правильно
            if (Object.keys(pointsPerRow).length > 0) {
              // Группируем правильные ответы по строкам
              const correctAnswersByRow: Record<number, string[]> = {};
              correctAnswersArr.forEach((cellKey) => {
                const [rowIdx] = cellKey.split(':').map(Number);
                if (!correctAnswersByRow[rowIdx]) {
                  correctAnswersByRow[rowIdx] = [];
                }
                correctAnswersByRow[rowIdx].push(cellKey);
              });
              
              // Проверяем каждую строку
              Object.entries(correctAnswersByRow).forEach(([rowIdx, rowCorrectAnswers]) => {
                // Проверяем, что все правильные ответы в строке выбраны
                const allRowCorrectSelected = rowCorrectAnswers.every(cellKey =>
                  userAnswersArr.includes(cellKey)
                );
                
                if (allRowCorrectSelected && pointsPerRow.hasOwnProperty(rowIdx)) {
                  score += pointsPerRow[rowIdx];
                }
              });
            }
            
            // Начисляем баллы за столбцы, если все ячейки в столбце выбраны правильно
            if (Object.keys(pointsPerColumn).length > 0) {
              // Группируем правильные ответы по столбцам
              const correctAnswersByColumn: Record<number, string[]> = {};
              correctAnswersArr.forEach((cellKey) => {
                const [, colIdx] = cellKey.split(':').map(Number);
                if (!correctAnswersByColumn[colIdx]) {
                  correctAnswersByColumn[colIdx] = [];
                }
                correctAnswersByColumn[colIdx].push(cellKey);
              });
              
              // Проверяем каждый столбец
              Object.entries(correctAnswersByColumn).forEach(([colIdx, colCorrectAnswers]) => {
                // Проверяем, что все правильные ответы в столбце выбраны
                const allColumnCorrectSelected = colCorrectAnswers.every(cellKey =>
                  userAnswersArr.includes(cellKey)
                );
                
                if (allColumnCorrectSelected && pointsPerColumn.hasOwnProperty(colIdx)) {
                  score += pointsPerColumn[colIdx];
                }
              });
            }
            
            // По умолчанию (режим "все") для одиночного выбора
            isCorrect = correctCount === correctAnswersArr.length;
            break;
          }
        }
        
        // Даже если не все правильные ответы выбраны, но есть частичное совпадение,
        // баллы уже начислены выше
        
        // Проверяем, правильно ли заполнена вся матрица
        const matrixTotalPoints = (props.matrixTotalPoints as number | undefined) || 0;
        if (matrixTotalPoints > 0) {
          // Проверяем, что все правильные ответы выбраны и ничего лишнего не выбрано
          const isMatrixFullyCorrect =
            userAnswersArr.length === correctAnswersArr.length &&
            userAnswersArr.every(cellKey => correctAnswersArr.includes(cellKey)) &&
            correctAnswersArr.every(cellKey => userAnswersArr.includes(cellKey));
          
          if (isMatrixFullyCorrect) {
            score += matrixTotalPoints;
          }
        }
        
        // Для режима "все" с множественным выбором проверяем точное совпадение
        if (matrixValidationMode === "all" && multiplePerRow) {
          // Группируем правильные ответы по строкам
          const correctAnswersByRow: Record<number, string[]> = {};
          correctAnswersArr.forEach((cellKey) => {
            const [rowIdx] = cellKey.split(':').map(Number);
            if (!correctAnswersByRow[rowIdx]) {
              correctAnswersByRow[rowIdx] = [];
            }
            correctAnswersByRow[rowIdx].push(cellKey);
          });
          
          // Проверяем каждую строку на точное совпадение
          let allRowsCorrect = true;
          Object.entries(correctAnswersByRow).forEach(([rowIdx, rowCorrectAnswers]) => {
            // Получаем выбранные ответы в этой строке
            const selectedInRow = userAnswersArr.filter(cellKey =>
              cellKey.startsWith(`${rowIdx}:`)
            );
            
            // Проверяем, что выбраны только правильные ответы и все они
            const isRowCorrect =
              selectedInRow.length === rowCorrectAnswers.length &&
              selectedInRow.every(cellKey => rowCorrectAnswers.includes(cellKey)) &&
              rowCorrectAnswers.every(cellKey => selectedInRow.includes(cellKey));
            
            if (!isRowCorrect) {
              allRowsCorrect = false;
            }
          });
          
          // Если не все строки заполнены правильно, обнуляем флаг корректности
          if (!allRowsCorrect) {
            isCorrect = false;
          }
        }
      } else {
        const userAnswerStr = typeof userAnswer === "string" || typeof userAnswer === "number"
          ? String(userAnswer || "").toLowerCase().trim()
          : "";
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
    const maxLength =
      (preset?.maxChars as number | undefined) ?? (props.maxChars as number | undefined);
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
        className={cn(fieldWrapperClass, field.widgetType === "matrix" && "overflow-hidden max-w-full")}
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
              {field.widgetType === "matrix" && props.matrixTotalPoints && typeof props.matrixTotalPoints === "number" && props.matrixTotalPoints > 0 && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {props.matrixTotalPoints} pts (за всю матрицу)
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

        {field.widgetType === "textarea" && (
          <AutoResizeTextarea
            placeholder={(field.props as Record<string, unknown>).placeholder as string}
            value={(answers[field.id] as string) || ""}
            onChange={(e) => updateAnswer(field.id, e.target.value)}
            onBlur={() => markTouched(field.id)}
            disabled={results !== null}
          />
        )}

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
                      {timeValue ? <span>{timeValue}</span> : <span>{t("propert.selectTime")}</span>
        }</Button>
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
                type="button"
                key={value}
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

        {field.widgetType === "matrix" && (() => {
          const rows = (props.rows as string[]) || [];
          const columns = (props.columns as string[]) || [];
          const multiplePerRow = Boolean(props.multiplePerRow);
          const [isScrolling, setIsScrolling] = useState(false);
          const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
          const matrixAnswer = (answers[field.id] as string[]) || [];
          const isCellSelected = (rowIdx: number, colIdx: number) => {
            return matrixAnswer.includes(`${rowIdx + 1}:${colIdx + 1}`);
          };
          const toggleCell = (rowIdx: number, colIdx: number) => {
            const cellKey = `${rowIdx + 1}:${colIdx + 1}`;
            let newAnswer: string[];
            if (multiplePerRow) {
              if (isCellSelected(rowIdx, colIdx)) {
                newAnswer = matrixAnswer.filter((key) => key !== cellKey);
              } else {
                newAnswer = [...matrixAnswer, cellKey];
              }
            } else {
              // Single selection per row - remove all other selections in this row
              newAnswer = matrixAnswer.filter((key) => !key.startsWith(`${rowIdx + 1}:`));
              if (!isCellSelected(rowIdx, colIdx)) {
                newAnswer.push(cellKey);
              }
            }
            updateAnswer(field.id, newAnswer);
            markTouched(field.id);
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
                        return (
                          <td 
                            key={colIdx} 
                            className="border border-muted-foreground/20 p-2 text-center min-w-[100px]"
                          >
                            {multiplePerRow ? (
                              <Checkbox
                                id={`${field.id}-${rowIdx}-${colIdx}`}
                                checked={selected}
                                disabled={results !== null}
                                onCheckedChange={() => toggleCell(rowIdx, colIdx)}
                                className="mx-auto"
                                simplifiedAnimation
                                
                              />
                            ) : (
                              <button
                                type="button"
                                disabled={results !== null}
                                onClick={() => toggleCell(rowIdx, colIdx)}
                                className={cn(
                                  "w-5 h-5 rounded-full border-2 mx-auto transition-colors",
                                  selected
                                    ? "bg-primary border-primary"
                                    : "border-muted-foreground/40 hover:border-primary",
                                  results !== null && "cursor-not-allowed opacity-50"
                                )}
                              />
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
        })()}

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
        {(hasResult && !results[field.id] && (props.correctAnswers as string[] | undefined)?.length) ? (
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
    ) : field.widgetType === "matrix" ? (
      <div>
        <p className="font-medium">Правильные ячейки:</p>
        <div className="mt-1">
          {(props.correctAnswers as string[]).map((cellKey, idx) => {
            const [rowIdx, colIdx] = cellKey.split(':').map(Number);
            const row = ((props.rows as string[]) || [])[rowIdx - 1] || `Row ${rowIdx}`;
            const col = ((props.columns as string[]) || [])[colIdx - 1] || `Column ${colIdx}`;
            return (
              <p key={idx}>• Строка "{row}", Столбец "{col}"</p>
            );
          })}
        </div>
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
    <div 
      className="space-y-6 py-4"
      style={{ overflowX: 'hidden' }}
    >
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