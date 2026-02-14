import { 
  DndContext, 
  DragOverlay, 
  useSensor, 
  useSensors, 
  PointerSensor,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
  closestCenter,
  useDroppable
} from "@dnd-kit/core";
import { 
  SortableContext, 
  verticalListSortingStrategy,
  arrayMove 
} from "@dnd-kit/sortable";
import { useState, useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import type { FormElementModel, FormSchema, SemanticType, WidgetType } from "@/form/types";
import { SortableField } from "./SortableField";
import { nanoid } from "nanoid";
import { 
  Type, AlignLeft, Hash, Calendar, List, CheckSquare, CircleDot, Heading, Star, ListOrdered, Upload, User, Phone, FileText, CreditCard, Undo2, Redo2, ArrowUp, ArrowDown, Grid, Languages, IdCardLanyard, StickyNote, Building, BriefcaseBusiness, Globe, Repeat2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import React from "react";
import { useTranslation } from 'react-i18next';
import { Languages } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { isCountryField } from "@/lib/countries";
const widgetTypeLabelKey: Record<WidgetType, string> = {
  header: "header",
  text_input: "text",
  textarea: "text",
  number_input: "number",
  select: "select",
  checkbox: "checkbox",
  radio: "radio",
  datetime: "datetime",
  file_upload: "file",
  rating: "rating",
  ranking: "ranking",
  matrix: "matrix",
};

interface FormCanvasProps {
  form: FormSchema;
  setForm: (form: FormSchema) => void;
  selectedIds: string[];
  onSelectField: (id: string, event: MouseEvent<HTMLDivElement>) => void;
  clearSelection: () => void;
  updateField: (id: string, updates: Partial<FormElementModel>) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  fields: FormElementModel[];
  moveSelected: (direction: "up" | "down") => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * Возвращает иконку для типа поля формы
 * @param type - тип поля (text, number, email и т.д.)
 * @returns React-компонент иконки из библиотеки lucide-react
*/
export const getIconForElement = (
  widgetType: WidgetType,
  semanticType?: SemanticType,
  props?: Record<string, unknown>
) => {
  if (semanticType) {
    switch (semanticType) {
      case "full_name":
        return User;
      case "phone":
        return Phone;
      case "bank_account":
        return CreditCard;
      case "passport":
        return IdCardLanyard;
      case "inn":
        return FileText;
      case "snils":
        return StickyNote;
      case "ogrn":
        return Building;
      case "bik":
        return BriefcaseBusiness;
      default:
        return Type;
    }
  }
  switch (widgetType) {
    // ?????????????? ???????? ??????????
    case "text_input": return Type;
    case "textarea": return AlignLeft;
    case "number_input": return Hash;
    case "header": return Heading;
    
    // ???????? ?? ???????????????????????? ????????????
    case "select": return props?.optionsSource === "countries" ? Globe : List;
    case "checkbox": return CheckSquare;
    case "radio": return CircleDot;
    
    case "datetime": return Calendar;
    case "rating": return Star;
    case "ranking": return ListOrdered;
    case "matrix": return Grid;
    case "file_upload": return Upload;
    
    default: return Type;
  }
};

/**
 Компонент холста формы - область для редактирования и перетаскивания полей формы
 Отвечает за:
 1. Отображение полей формы
 2. Drag & Drop переупорядочивание полей
 3. Редактирование заголовка и описания формы
 4. Визуальную обратную связь при перетаскивании
*/
export function FormCanvas({
  form,
  setForm,
  selectedIds,
  onSelectField,
  clearSelection,
  updateField,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  fields,
  moveSelected,
  scrollContainerRef,
}: FormCanvasProps) {

  const { t, i18n } = useTranslation()  // Хук для локализации
  const [activeDragItem, setActiveDragItem] = useState<any>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { setNodeRef, isOver } = useDroppable({
    id: 'form-canvas-droppable',
  });

  /**
   Настройка сенсоров для перетаскивания
   PointerSensor активируется при перемещении мыши/таче
  */
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  /**
   Обработчик начала перетаскивания
   Сохраняет данные перетаскиваемого поля
  */
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const field = form.fields.find(f => f.id === active.id);
    setActiveDragItem(field);
  };

  /**
   Обработчик завершения перетаскивания
   Выполняет переупорядочивание полей в массиве формы
  */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    // Если элемент перетащен в новую позицию
    if (active.id !== over?.id) {
      const oldIndex = form.fields.findIndex(f => f.id === active.id);
      const newIndex = form.fields.findIndex(f => f.id === over?.id);
      
      // Перемещаем элемент в массиве
      const newFields = arrayMove(form.fields, oldIndex, newIndex).map((field, index) => ({
        ...field,
        sortIndex: index,
      }));
      setForm({ ...form, fields: newFields });
    }
    
    setActiveDragItem(null);
  };

  /**
   Функция для автоматического изменения высоты textarea
  */
  const adjustTextareaHeight = (textarea: HTMLTextAreaElement | null) => {
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  /**
   Обновление заголовка формы
  */
  const updateTitle = (title: string) => {
    setForm({ ...form, title });
  };

  /**
   Обновление описания формы
  */
  const updateDescription = (description: string) => {
    setForm({ ...form, description });
  };

  // Устанавливаем высоту при изменении значений
  useEffect(() => {
    adjustTextareaHeight(titleTextareaRef.current);
    adjustTextareaHeight(descriptionTextareaRef.current);
  }, [form.title, form.description]);

  const selectedSet = new Set(selectedIds);
  const canMoveUp = (() => {
    if (selectedIds.length === 0) return false;
    for (let i = 1; i < form.fields.length; i += 1) {
      if (selectedSet.has(form.fields[i].id) && !selectedSet.has(form.fields[i - 1].id)) {
        return true;
      }
    }
    return false;
  })();

  const canMoveDown = (() => {
    if (selectedIds.length === 0) return false;
    for (let i = form.fields.length - 2; i >= 0; i -= 1) {
      if (selectedSet.has(form.fields[i].id) && !selectedSet.has(form.fields[i + 1].id)) {
        return true;
      }
    }
    return false;
  })();

  const transformableWidgetTypes: WidgetType[] = ["select", "checkbox", "radio"];
  const selectedFields = fields.filter((field) => selectedSet.has(field.id));
  const isTransformableSelection =
    selectedFields.length > 0 &&
    selectedFields.every(
      (field) =>
        transformableWidgetTypes.includes(field.widgetType) &&
        !field.semanticType &&
        !isCountryField(field)
    );
  const excludedTypes = new Set(selectedFields.map((field) => field.widgetType));
  const transformTargets = transformableWidgetTypes.filter((type) => !excludedTypes.has(type));
  const canTransform = isTransformableSelection && transformTargets.length > 0;

  const handleTransform = (nextType: WidgetType) => {
    selectedFields.forEach((field) => {
      const nextProps: Record<string, unknown> = {};
      if (nextType !== "select") {
        nextProps.multiple = undefined;
      }
      const rawCorrectAnswers = (field.props as Record<string, unknown>).correctAnswers;
      const correctAnswers = Array.isArray(rawCorrectAnswers) ? rawCorrectAnswers : [];
      let normalizedCorrectAnswers = correctAnswers
        .map((answer) => String(answer ?? "").trim())
        .filter(Boolean);
      const isMultipleSelect =
        nextType === "select" &&
        ((field.props as Record<string, unknown>).multiple === true || nextProps.multiple === true);
      const shouldSingleCorrect = nextType === "radio" || (nextType === "select" && !isMultipleSelect);
      if (shouldSingleCorrect && normalizedCorrectAnswers.length > 1) {
        normalizedCorrectAnswers = normalizedCorrectAnswers.slice(0, 1);
      }
      if (correctAnswers.length > 0 || normalizedCorrectAnswers.length > 0) {
        nextProps.correctAnswers = normalizedCorrectAnswers;
      }
      updateField(field.id, { widgetType: nextType, props: nextProps });
    });
  };

  return (
    // DndContext - компонент для Drag & Drop функциональности
    <DndContext
      sensors={sensors} // Передаем сенсор
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
    {/* Основная область холста формы */}
      <div
        ref={scrollContainerRef}
        data-testid="builder-canvas"
        className="flex-1 bg-muted/30 px-8 pb-8 pt-0 overflow-y-auto h-full builder-scroll"
        onClick={() => { console.log('FormCanvas background click, clearing selection'); clearSelection(); }}
      >
        <div
          className="sticky top-0 z-20 -mx-8 mb-0 bg-white/95 backdrop-blur border-b border-border"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="h-[52px] px-4 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              data-testid="builder-undo"
              onClick={onUndo}
              disabled={!canUndo}
              className={cn("gap-2", !canUndo && "text-muted-foreground")}
            >
              <Undo2 className={cn("h-4 w-4", !canUndo && "text-muted-foreground")} />
              {t("builder.undo")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              data-testid="builder-redo"
              onClick={onRedo}
              disabled={!canRedo}
              className={cn("gap-2", !canRedo && "text-muted-foreground")}
            >
              <Redo2 className={cn("h-4 w-4", !canRedo && "text-muted-foreground")} />
              {t("builder.redo")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => moveSelected("up")}
              disabled={!canMoveUp}
              className={cn("gap-2", !canMoveUp && "text-muted-foreground")}
            >
              <ArrowUp className={cn("h-4 w-4", !canMoveUp && "text-muted-foreground")} />
              {t("builder.moveUp")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => moveSelected("down")}
              disabled={!canMoveDown}
              className={cn("gap-2", !canMoveDown && "text-muted-foreground")}
            >
              <ArrowDown className={cn("h-4 w-4", !canMoveDown && "text-muted-foreground")} />
              {t("builder.moveDown")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!canTransform}
                  className={cn("gap-2", !canTransform && "text-muted-foreground")}
                >
                  <Repeat2 className="h-4 w-4" />
                  {t("builder.transform")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {transformTargets.map((widgetType) => (
                  <DropdownMenuItem key={widgetType} onClick={() => handleTransform(widgetType)}>
                    {t(`fields.${widgetTypeLabelKey[widgetType]}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Контейнер формы (белая карточка) */}
        <div className="max-w-3xl mx-auto min-h-[800px] bg-white rounded-xl shadow-sm border border-border/50 flex flex-col">
          
          {/* Шапка формы с редактируемыми полями */}
          <div className="p-8 border-b border-border/50 bg-white rounded-t-xl group hover:bg-muted/10 transition-colors relative">
             <div className="space-y-2">
              
              {/* Редактируемое поле заголовка */}
               <Textarea 
                 ref={titleTextareaRef}
                 value={form.title} 
                 onChange={(e) => {
                  const value = e.target.value.slice(0, 120);
                  updateTitle(value);
                  setTimeout(() => adjustTextareaHeight(titleTextareaRef.current), 0);
                }}
                 maxLength={120}
                 className="text-3xl font-bold text-foreground tracking-tight border-transparent hover:border-border px-0 py-1 focus-visible:ring-0 shadow-none bg-transparent resize-none whitespace-pre-wrap break-words overflow-hidden min-h-[1.5em]"
                 placeholder={t("common.untitled")}
                 rows={1}
               />
               
               {/* Редактируемое поле описания */}
               <Textarea 
                 ref={descriptionTextareaRef}
                 value={form.description} 
                 onChange={(e) => {
                  const value = e.target.value.slice(0, 720);
                  updateDescription(value);
                  setTimeout(() => adjustTextareaHeight(descriptionTextareaRef.current), 0);
                }}
                 maxLength={720}
                 className="text-muted-foreground text-lg border-transparent hover:border-border px-0 py-1 focus-visible:ring-0 shadow-none bg-transparent resize-none whitespace-pre-wrap break-words overflow-hidden min-h-[1.5em]"
                 placeholder={t("common.descriptionf")}
                 rows={1}
               />
             </div>

             {/* Индикатор редактируемости (показывается при наведении) */}
             <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Добавить иконку редактирования */}
             </div>
          </div>

          {/* Область для полей формы с поддержкой DnD */}
          <div 
            ref={setNodeRef}
            className={`flex-1 p-8 bg-[#FAFBFC] transition-colors 
              ${isOver ? 'bg-primary/5' : ''}`} // Подсветка при перетаскивании
          >

            {/* SortableContext управляет сортируемыми элементами внутри */}
            <SortableContext 
            items={form.fields.map((field) => field.id)}   // Массив ID элементов для сортировки
            strategy={verticalListSortingStrategy}  // Стратегия вертикальной сортировки
            > 
              {form.fields.length === 0 ? (
                 <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/20 rounded-lg bg-muted/5">
                    <p className="text-muted-foreground font-medium">{t("back.bgFormCreate")}</p>
                    <p className="text-sm text-muted-foreground/60 mt-1">{t("back.drag")}</p>
                 </div>
              ) : (

                // Отображение всех полей формы как сортируемых элементов
                form.fields.map((field) => (
                  <SortableField
                    key={field.id}
                    field={field}
                    isSelected={selectedIds.includes(field.id)}
                    onSelect={onSelectField}
                    updateField={updateField}
                    fields={fields}
                  />
                ))
              )}
            </SortableContext>
          </div>
        </div>
      </div>
      
      {/* DragOverlay - элемент, который следует за курсором при перетаскивании */}
      <DragOverlay>
        {activeDragItem && (
          
          // Стилизованная миниатюра перетаскиваемого поля
          <div className="bg-white border-2 border-primary shadow-xl rounded-lg p-6 opacity-90">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-sm bg-primary/10 text-primary">

                {/* Динамическое отображение иконки типа поля */}
                {getIconForElement(activeDragItem.widgetType, activeDragItem.semanticType, activeDragItem.props) &&
                  React.createElement(getIconForElement(activeDragItem.widgetType, activeDragItem.semanticType, activeDragItem.props), { className: "h-4 w-4" })}
              </div>
              <span className="text-sm font-medium">{activeDragItem.label}</span>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
