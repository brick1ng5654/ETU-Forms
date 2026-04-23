import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  DragStartEvent,
  DragEndEvent,
  closestCenter,
  useDroppable
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useState, useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import type { FormElementModel, FormPageModel, FormSchema, SemanticType, WidgetType } from "@/form/types";
import { SortableField } from "./SortableField";
import {
  Type, AlignLeft, Hash, Calendar, List, CheckSquare, CircleDot, Heading, Star, ListOrdered, Upload, User, Phone, FileText, CreditCard, Undo2, Redo2, ArrowUp, ArrowDown, Grid, IdCardLanyard, StickyNote, Building, BriefcaseBusiness, Globe, Repeat2, Blocks
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import React from "react";
import { useTranslation } from 'react-i18next';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { isCountryField } from "@/lib/countries";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  repeatable_block: "repeatableBlock",
};

const getParentBlockId = (field: FormElementModel): string | null => {
  const raw = (field.props as Record<string, unknown> | undefined)?.parentBlockId;
  if (typeof raw !== "string") return null;
  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : null;
};

const AUTO_PAGE_TITLE = /^(Страница|Page)\s+\d+$/;

interface FormCanvasProps {
  form: FormSchema;
  setForm: (form: FormSchema) => void;
  pages: FormPageModel[];
  activePageId: number;
  onSelectPage: (pageId: number, event?: MouseEvent<HTMLDivElement>) => void;
  onAddPage: () => void;
  onMovePage: (pageId: number, targetIndex: number) => void;
  selectedPageIds: number[];
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
  moveSelectedPages: (direction: "up" | "down") => void;
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
    case "text_input": return Type;
    case "textarea": return AlignLeft;
    case "number_input": return Hash;
    case "header": return Heading;

    case "select": return props?.optionsSource === "countries" ? Globe : List;
    case "checkbox": return CheckSquare;
    case "radio": return CircleDot;

    case "datetime": return Calendar;
    case "rating": return Star;
    case "ranking": return ListOrdered;
    case "matrix": return Grid;
    case "file_upload": return Upload;
    case "repeatable_block": return Blocks;

    default: return Type;
  }
};

type PageSectionProps = {
  page: FormPageModel;
  isActive: boolean;
  pageLabel: string;
  pageFields: FormElementModel[];
  onSelectPage: (pageId: number, event?: MouseEvent<HTMLDivElement>) => void;
  t: (key: string, opts?: any) => string;
  selectedIds: string[];
  onSelectField: (id: string, event: MouseEvent<HTMLDivElement>) => void;
  updateField: (id: string, updates: Partial<FormElementModel>) => void;
  fields: FormElementModel[];
};

const PageSection = React.memo(function PageSection({
  page,
  isActive,
  pageLabel,
  pageFields,
  onSelectPage,
  t,
  selectedIds,
  onSelectField,
  updateField,
  fields,
}: PageSectionProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `page-${page.id}` });

  return (
    <div
      className={cn(
        "border border-transparent border-t border-border/40 rounded-lg transition-shadow my-3 first:mt-4 last:mb-4 relative",
        isActive && "ring-2 ring-primary border-transparent shadow-md z-10"
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          onSelectPage(page.id, event);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectPage(page.id);
          }
        }}
        className={cn(
          "w-full px-6 py-3 flex items-center justify-between text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isActive ? "bg-primary/10" : "bg-muted/10 hover:bg-muted/20"
        )}
      >
        <div>
          <p className="text-sm font-semibold text-foreground">{pageLabel}</p>
        </div>

        <div className="flex items-center gap-3" />
      </div>

      <div
        ref={setDropRef}
        className={cn("p-6 bg-[#FAFBFC] transition-colors rounded-b-lg", isOver && "bg-primary/5")}
      >
        <SortableContext items={pageFields.map((field) => field.id)} strategy={verticalListSortingStrategy}>
          {pageFields.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/20 rounded-lg bg-muted/5">
              <p className="text-muted-foreground font-medium">{t("back.bgFormCreate")}</p>
              <p className="text-sm text-muted-foreground/90 mt-1">{t("back.drag")}</p>
            </div>
          ) : (
            pageFields.map((field) => (
              <SortableField
                key={field.id}
                field={field}
                isSelected={selectedIds.includes(field.id)}
                selectedIds={selectedIds}
                onSelect={onSelectField}
                updateField={updateField}
                fields={fields}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
});

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
  pages,
  activePageId,
  onSelectPage,
  onAddPage,
  onMovePage,
  selectedPageIds,
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
  moveSelectedPages,
  scrollContainerRef,
}: FormCanvasProps) {

  const { t } = useTranslation()  // Хук для локализации
  const [activeDragItem, setActiveDragItem] = useState<any>(null);
  const [moveDialogPageId, setMoveDialogPageId] = useState<number | null>(null);
  const [moveTargetIndex, setMoveTargetIndex] = useState<number | null>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const pageOrder = pages.slice().sort((a, b) => a.pageIndex - b.pageIndex);



  const fieldsByPage = pageOrder.reduce((acc, page) => {
    const pageFields = fields
      .filter((field) => field.pageId === page.id)
      .slice()
      .sort((a, b) => a.sortIndex - b.sortIndex);
    const idsOnPage = new Set(pageFields.map((field) => field.id));
    const childrenByParent = new Map<string, FormElementModel[]>();

    pageFields.forEach((field) => {
      const parentBlockId = getParentBlockId(field);
      if (!parentBlockId || !idsOnPage.has(parentBlockId)) return;
      const bucket = childrenByParent.get(parentBlockId) ?? [];
      bucket.push(field);
      childrenByParent.set(parentBlockId, bucket);
    });

    const topLevelFields = pageFields
      .filter((field) => {
        const parentBlockId = getParentBlockId(field);
        return !parentBlockId || !idsOnPage.has(parentBlockId);
      })
      .map((field) => {
        const children = childrenByParent.get(field.id);
        if (!children || field.widgetType !== "repeatable_block") return field;
        return {
          ...field,
          children: children.slice().sort((a, b) => a.sortIndex - b.sortIndex),
        };
      });

    acc.set(page.id, topLevelFields);
    return acc;
  }, new Map<number, FormElementModel[]>());

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
    const field = fields.find(f => f.id === active.id);
    setActiveDragItem(field);
  };

  /**
   Обработчик завершения перетаскивания
   Выполняет переупорядочивание полей в массиве формы
  */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveDragItem(null);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) {
      setActiveDragItem(null);
      return;
    }

    const fieldById = new Map(fields.map((field) => [field.id, field]));
    const activeField = fieldById.get(activeId);
    if (!activeField) {
      setActiveDragItem(null);
      return;
    }

    const topLevelByPage = new Map<number, FormElementModel[]>();
    for (const page of pageOrder) {
      topLevelByPage.set(page.id, (fieldsByPage.get(page.id) ?? []).slice());
    }

    const childrenByParent = new Map<string, FormElementModel[]>();
    fields.forEach((field) => {
      const parentBlockId = getParentBlockId(field);
      if (!parentBlockId || !fieldById.has(parentBlockId)) return;
      const bucket = childrenByParent.get(parentBlockId) ?? [];
      bucket.push(field);
      childrenByParent.set(parentBlockId, bucket);
    });
    childrenByParent.forEach((bucket, parentId) => {
      childrenByParent.set(parentId, bucket.slice().sort((a, b) => a.sortIndex - b.sortIndex));
    });

    let targetParentId: string | null = null;
    let targetPageId: number | null = null;
    let insertIndex = 0;

    if (overId.startsWith("page-")) {
      const rawPage = Number(overId.replace("page-", ""));
      targetPageId = Number.isFinite(rawPage) ? rawPage : null;
      const targetTop = targetPageId != null ? (topLevelByPage.get(targetPageId) ?? []) : [];
      insertIndex = targetTop.length;
    } else {
      const overField = fieldById.get(overId);
      if (!overField) {
        setActiveDragItem(null);
        return;
      }
      const overParentId = getParentBlockId(overField);

      if (overField.widgetType === "repeatable_block" && activeField.widgetType !== "repeatable_block") {
        targetParentId = overField.id;
        targetPageId = overField.pageId;
        insertIndex = (childrenByParent.get(overField.id) ?? []).length;
      } else if (overParentId && fieldById.has(overParentId)) {
        targetParentId = overParentId;
        const parentField = fieldById.get(overParentId);
        targetPageId = parentField?.pageId ?? overField.pageId;
        const targetChildren = childrenByParent.get(overParentId) ?? [];
        insertIndex = targetChildren.findIndex((field) => field.id === overId);
        if (insertIndex < 0) insertIndex = targetChildren.length;
      } else {
        targetParentId = null;
        targetPageId = overField.pageId;
        const targetTop = topLevelByPage.get(targetPageId) ?? [];
        insertIndex = targetTop.findIndex((field) => field.id === overId);
        if (insertIndex < 0) insertIndex = targetTop.length;
      }
    }

    if (targetPageId == null) {
      setActiveDragItem(null);
      return;
    }
    if (activeField.widgetType === "repeatable_block" && targetParentId) {
      setActiveDragItem(null);
      return;
    }
    if (targetParentId === activeField.id) {
      setActiveDragItem(null);
      return;
    }

    const sourceParentId = getParentBlockId(activeField);
    const sourcePageId = activeField.pageId;
    const sourceList = sourceParentId
      ? (childrenByParent.get(sourceParentId) ?? [])
      : (topLevelByPage.get(sourcePageId) ?? []);
    const sourceIndex = sourceList.findIndex((field) => field.id === activeId);
    if (sourceIndex < 0) {
      setActiveDragItem(null);
      return;
    }

    const movedField = sourceList.splice(sourceIndex, 1)[0];
    const targetList = targetParentId
      ? (childrenByParent.get(targetParentId) ?? [])
      : (topLevelByPage.get(targetPageId) ?? []);

    let effectiveInsertIndex = Math.min(Math.max(insertIndex, 0), targetList.length);
    if (sourceList === targetList && sourceIndex < effectiveInsertIndex) {
      effectiveInsertIndex -= 1;
    }
    targetList.splice(effectiveInsertIndex, 0, movedField);

    if (sourceParentId) {
      childrenByParent.set(sourceParentId, sourceList);
    } else {
      topLevelByPage.set(sourcePageId, sourceList);
    }
    if (targetParentId) {
      childrenByParent.set(targetParentId, targetList);
    } else {
      topLevelByPage.set(targetPageId, targetList);
    }

    const updatesById = new Map<string, { pageId: number; sortIndex: number; parentBlockId: string | null }>();
    for (const page of pageOrder) {
      const topLevel = topLevelByPage.get(page.id) ?? [];
      topLevel.forEach((field, index) => {
        updatesById.set(field.id, { pageId: page.id, sortIndex: index, parentBlockId: null });
      });
    }
    childrenByParent.forEach((children, parentId) => {
      const parentField = fieldById.get(parentId);
      if (!parentField) return;
      children.forEach((field, index) => {
        updatesById.set(field.id, {
          pageId: parentField.pageId,
          sortIndex: index,
          parentBlockId: parentId,
        });
      });
    });

    const nextFields = fields.map((field) => {
      const update = updatesById.get(field.id);
      if (!update) return field;
      const nextProps = { ...((field.props as Record<string, unknown>) ?? {}) };
      if (update.parentBlockId) {
        nextProps.parentBlockId = update.parentBlockId;
      } else {
        delete nextProps.parentBlockId;
      }
      return {
        ...field,
        pageId: update.pageId,
        sortIndex: update.sortIndex,
        props: nextProps,
      };
    });
    setForm({ ...form, fields: nextFields });
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

  const activePage = pageOrder.find((page) => page.id === activePageId);
  const selectedSet = new Set(selectedIds);
  const canMoveUp = (() => {
    if (selectedIds.length === 0 && selectedPageIds.length === 0) {
      return activePage != null && activePage.pageIndex > 0;
    }
    if (selectedIds.length === 0 && selectedPageIds.length > 0) {
      const selectedPageSet = new Set(selectedPageIds);
      for (let i = 1; i < pageOrder.length; i += 1) {
        if (selectedPageSet.has(pageOrder[i].id) && !selectedPageSet.has(pageOrder[i - 1].id)) {
          return true;
        }
      }
      return false;
    }
    for (const page of pageOrder) {
      const pageFields = fieldsByPage.get(page.id) ?? [];
      for (let i = 1; i < pageFields.length; i += 1) {
        if (selectedSet.has(pageFields[i].id) && !selectedSet.has(pageFields[i - 1].id)) {
          return true;
        }
      }
    }
    return false;
  })();

  const canMoveDown = (() => {
    if (selectedIds.length === 0 && selectedPageIds.length === 0) {
      return activePage != null && activePage.pageIndex < pageOrder.length - 1;
    }
    if (selectedIds.length === 0 && selectedPageIds.length > 0) {
      const selectedPageSet = new Set(selectedPageIds);
      for (let i = pageOrder.length - 2; i >= 0; i -= 1) {
        if (selectedPageSet.has(pageOrder[i].id) && !selectedPageSet.has(pageOrder[i + 1].id)) {
          return true;
        }
      }
      return false;
    }
    for (const page of pageOrder) {
      const pageFields = fieldsByPage.get(page.id) ?? [];
      for (let i = pageFields.length - 2; i >= 0; i -= 1) {
        if (selectedSet.has(pageFields[i].id) && !selectedSet.has(pageFields[i + 1].id)) {
          return true;
        }
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
        className="flex-1 bg-muted/30 px-4 sm:px-6 md:px-8 pb-6 md:pb-8 pt-0 overflow-y-auto h-full builder-scroll"
        onClick={() => { console.log('FormCanvas background click, clearing selection'); clearSelection(); }}
      >
        <div
          className="sticky top-0 z-20 -mx-4 sm:-mx-6 md:-mx-8 mb-0 bg-white/95 backdrop-blur border-b border-border"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="h-12 sm:h-[52px] px-2 sm:px-4 flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar min-w-0">
            <Button
              variant="ghost"
              size="sm"
              data-testid="builder-undo"
              onClick={onUndo}
              disabled={!canUndo}
              className={cn(
                "shrink-0 gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3 disabled:opacity-95",
                !canUndo && "text-muted-foreground"
              )}
              title={t("builder.undo")}
            >
              <Undo2 className={cn("h-4 w-4", !canUndo && "text-muted-foreground")} />
              <span className="hidden sm:inline">{t("builder.undo")}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              data-testid="builder-redo"
              onClick={onRedo}
              disabled={!canRedo}
              className={cn(
                "shrink-0 gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3 disabled:opacity-95",
                !canRedo && "text-muted-foreground"
              )}
              title={t("builder.redo")}
            >
              <Redo2 className={cn("h-4 w-4", !canRedo && "text-muted-foreground")} />
              <span className="hidden sm:inline">{t("builder.redo")}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (selectedIds.length > 0) {
                  moveSelected("up");
                  return;
                }
                if (selectedPageIds.length > 0) {
                  moveSelectedPages("up");
                  return;
                }
                if (!activePage || activePage.pageIndex === 0) return;
                onMovePage(activePage.id, activePage.pageIndex);
              }}
              disabled={!canMoveUp}
              className={cn(
                "shrink-0 gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3 disabled:opacity-95",
                !canMoveUp && "text-muted-foreground"
              )}
              title={t("builder.moveUp")}
            >
              <ArrowUp className={cn("h-4 w-4", !canMoveUp && "text-muted-foreground")} />
              <span className="hidden sm:inline">{t("builder.moveUp")}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (selectedIds.length > 0) {
                  moveSelected("down");
                  return;
                }
                if (selectedPageIds.length > 0) {
                  moveSelectedPages("down");
                  return;
                }
                if (!activePage || activePage.pageIndex >= pageOrder.length - 1) return;
                onMovePage(activePage.id, activePage.pageIndex + 2);
              }}
              disabled={!canMoveDown}
              className={cn(
                "shrink-0 gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3 disabled:opacity-95",
                !canMoveDown && "text-muted-foreground"
              )}
              title={t("builder.moveDown")}
            >
              <ArrowDown className={cn("h-4 w-4", !canMoveDown && "text-muted-foreground")} />
              <span className="hidden sm:inline">{t("builder.moveDown")}</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!canTransform}
                  className={cn(
                    "shrink-0 gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3 disabled:opacity-95",
                    !canTransform && "text-muted-foreground"
                  )}
                  title={t("builder.transform")}
                >
                  <Repeat2 className={cn("h-4 w-4", !canTransform && "text-muted-foreground")} />
                  <span className="hidden sm:inline">{t("builder.transform")}</span>
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

          {pageOrder.map((page) => {
            const pageFields = fieldsByPage.get(page.id) ?? [];
            const rawTitle = typeof page.title === "string" ? page.title.trim() : "";
            const pageLabel = !rawTitle || AUTO_PAGE_TITLE.test(rawTitle)
              ? t("pages.defaultTitle", { index: page.pageIndex + 1 })
              : rawTitle;
            const isActive = selectedPageIds.includes(page.id);

            return (
              <PageSection
                key={page.id}
                page={page}
                isActive={isActive}
                pageLabel={pageLabel}
                pageFields={pageFields}
                onSelectPage={onSelectPage}
                t={t}
                selectedIds={selectedIds}
                onSelectField={onSelectField}
                updateField={updateField}
                fields={fields}
              />
            );
          })}

          <div className="p-6 border-t border-border/40 bg-white/95">
            <Button
              variant="outline"
              size="sm"
              onClick={onAddPage}
              className="w-full justify-center"
            >
              + {t("pages.addPage")}
            </Button>
          </div>

        </div>
      </div>

      <Dialog
        open={moveDialogPageId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMoveDialogPageId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pages.moveTitle")}</DialogTitle>
            <DialogDescription>{t("pages.moveDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select
              value={moveTargetIndex != null ? String(moveTargetIndex) : ""}
              onValueChange={(value) => setMoveTargetIndex(Number(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("pages.movePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {pageOrder.map((page) => (
                  <SelectItem key={page.id} value={String(page.pageIndex + 1)}>
                    {t("pages.positionLabel", { index: page.pageIndex + 1 })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMoveDialogPageId(null)}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="button"
              disabled={moveDialogPageId == null || moveTargetIndex == null}
              onClick={() => {
                if (moveDialogPageId == null || moveTargetIndex == null) return;
                onMovePage(moveDialogPageId, moveTargetIndex);
                setMoveDialogPageId(null);
              }}
            >
              {t("pages.moveConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
