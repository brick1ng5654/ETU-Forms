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
  arrayMove
} from "@dnd-kit/sortable";
import { useState, useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import type { FormElementModel, FormPageModel, FormSchema, SemanticType, WidgetType } from "@/form/types";
import { SortableField } from "./SortableField";
import {
  Type, AlignLeft, Hash, Calendar, List, CheckSquare, CircleDot, Heading, Star, ListOrdered, Upload, User, Phone, FileText, CreditCard, Undo2, Redo2, ArrowUp, ArrowDown, ArrowUpDown, Grid, IdCardLanyard, StickyNote, Building, BriefcaseBusiness, Globe, Repeat2, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import React from "react";
import { useTranslation } from 'react-i18next';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { isCountryField } from "@/lib/countries";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
};

interface FormCanvasProps {
  form: FormSchema;
  setForm: (form: FormSchema) => void;
  pages: FormPageModel[];
  activePageId: number;
  onSelectPage: (pageId: number) => void;
  onAddPage: () => void;
  onDeletePage: (pageId: number, options: { mode: "delete" | "move"; targetPageId?: number }) => void;
  onTogglePageBack: (pageId: number, allowBack: boolean) => void;
  onMovePage: (pageId: number, targetIndex: number) => void;
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

type PageSectionProps = {
  page: FormPageModel;
  isActive: boolean;
  pageLabel: string;
  pageFields: FormElementModel[];
  canDelete: boolean;
  localAllowBack: Record<number, boolean>;
  setLocalAllowBack: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  onTogglePageBack: (pageId: number, allowBack: boolean) => void;
  onSelectPage: (pageId: number) => void;
  onOpenMove: () => void;
  onOpenDelete: () => void;
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
  canDelete,
  localAllowBack,
  setLocalAllowBack,
  onTogglePageBack,
  onSelectPage,
  onOpenMove,
  onOpenDelete,
  t,
  selectedIds,
  onSelectField,
  updateField,
  fields,
}: PageSectionProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `page-${page.id}` });

  return (
    <div className={cn("border-t border-border/40", isActive && "bg-primary/5")}>
      <div
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          onSelectPage(page.id);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectPage(page.id);
          }
        }}
        className={cn(
          "w-full px-6 py-3 flex items-center justify-between text-left transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          isActive ? "bg-primary/10" : "bg-muted/10 hover:bg-muted/20"
        )}
      >
        <div>
          <p className="text-sm font-semibold text-foreground">{pageLabel}</p>
          <p className="text-xs text-muted-foreground">
            {t("pages.elementsCount", { count: pageFields.length })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={(e) => { e.stopPropagation(); onOpenMove(); }}>
            <ArrowUpDown className="h-4 w-4" />
            {t("pages.movePage")}
          </Button>

          <div className="flex items-center gap-2" title={t("pages.backToggleTooltip")}>
            <span className="text-xs text-muted-foreground">{t("pages.backToggle")}</span>
            <Switch
              checked={localAllowBack[page.id] ?? page.allowBack}
              onCheckedChange={(checked) => {
                setLocalAllowBack((prev) => ({ ...prev, [page.id]: checked }));
                onTogglePageBack(page.id, checked);
              }}
              onClick={(event) => event.stopPropagation()}
              aria-label={t("pages.backToggleAria")}
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!canDelete}
            onClick={(e) => { e.stopPropagation(); if (canDelete) onOpenDelete(); }}
            className="text-destructive hover:text-destructive"
            aria-label={t("pages.deleteTitle")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          <span className={cn("text-xs font-medium", isActive ? "text-primary" : "text-muted-foreground")}>
            {isActive ? t("pages.active") : ""}
          </span>
        </div>
      </div>

      <div
        ref={setDropRef}
        className={cn("p-6 bg-[#FAFBFC] transition-colors", isOver && "bg-primary/5")}
      >
        <SortableContext items={pageFields.map((field) => field.id)} strategy={verticalListSortingStrategy}>
          {pageFields.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/20 rounded-lg bg-muted/5">
              <p className="text-muted-foreground font-medium">{t("back.bgFormCreate")}</p>
              <p className="text-sm text-muted-foreground/60 mt-1">{t("back.drag")}</p>
            </div>
          ) : (
            pageFields.map((field) => (
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
  onDeletePage,
  onTogglePageBack,
  onMovePage,
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

  const { t } = useTranslation()  // Хук для локализации
  const [activeDragItem, setActiveDragItem] = useState<any>(null);
  const [deleteDialogPageId, setDeleteDialogPageId] = useState<number | null>(null);
  const [deleteMode, setDeleteMode] = useState<"delete" | "move">("delete");
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [moveDialogPageId, setMoveDialogPageId] = useState<number | null>(null);
  const [moveTargetIndex, setMoveTargetIndex] = useState<number | null>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const pageOrder = pages.slice().sort((a, b) => a.pageIndex - b.pageIndex);
  const [localAllowBack, setLocalAllowBack] = useState<Record<number, boolean>>({});

  useEffect(() => {
    // держим локальное состояние в синхроне с pages
    setLocalAllowBack((prev) => {
      const next = { ...prev };
      for (const p of pages) next[p.id] = p.allowBack;
      return next;
    });
  }, [pages]);



  const fieldsByPage = pageOrder.reduce((acc, page) => {
    acc.set(
      page.id,
      fields
        .filter((field) => field.pageId === page.id)
        .slice()
        .sort((a, b) => a.sortIndex - b.sortIndex)
    );
    return acc;
  }, new Map<number, FormElementModel[]>());

  const getPageIdForField = (fieldId: string) => {
    for (const [pageId, pageFields] of fieldsByPage.entries()) {
      if (pageFields.some((field) => field.id === fieldId)) {
        return pageId;
      }
    }
    return pageOrder[0]?.id ?? 1;
  };

  const getPageIdForOver = (overId: string) => {
    if (overId.startsWith("page-")) {
      const raw = Number(overId.replace("page-", ""));
      if (Number.isFinite(raw)) return raw;
    }
    return getPageIdForField(overId);
  };
  const availableDeleteTargets = deleteDialogPageId
    ? pageOrder.filter((page) => page.id !== deleteDialogPageId)
    : [];

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

    const sourcePageId = getPageIdForField(activeId);
    const targetPageId = getPageIdForOver(overId);
    if (!targetPageId) {
      setActiveDragItem(null);
      return;
    }

    const nextByPage = new Map<number, FormElementModel[]>();
    for (const page of pageOrder) {
      nextByPage.set(page.id, (fieldsByPage.get(page.id) ?? []).slice());
    }

    const sourceFields = nextByPage.get(sourcePageId) ?? [];
    const targetFields = nextByPage.get(targetPageId) ?? [];
    const activeIndex = sourceFields.findIndex((field) => field.id === activeId);
    if (activeIndex === -1) {
      setActiveDragItem(null);
      return;
    }

    if (sourcePageId === targetPageId) {
      const overIndex = targetFields.findIndex((field) => field.id === overId);
      if (overIndex !== -1) {
        nextByPage.set(targetPageId, arrayMove(targetFields, activeIndex, overIndex));
      }
    } else {
      const moved = sourceFields.splice(activeIndex, 1)[0];
      const nextMoved = { ...moved, pageId: targetPageId };
      let insertIndex = targetFields.length;
      if (!overId.startsWith("page-")) {
        const overIndex = targetFields.findIndex((field) => field.id === overId);
        if (overIndex !== -1) {
          insertIndex = overIndex;
        }
      }
      const nextTarget = targetFields.slice();
      nextTarget.splice(insertIndex, 0, nextMoved);
      nextByPage.set(sourcePageId, sourceFields);
      nextByPage.set(targetPageId, nextTarget);
    }

    const nextFields: FormElementModel[] = [];
    for (const page of pageOrder) {
      const pageFields = (nextByPage.get(page.id) ?? []).map((field, index) => ({
        ...field,
        sortIndex: index,
      }));
      nextFields.push(...pageFields);
    }

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

  const selectedSet = new Set(selectedIds);
  const canMoveUp = (() => {
    if (selectedIds.length === 0) return false;
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
    if (selectedIds.length === 0) return false;
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

          {pageOrder.map((page) => {
            const pageFields = fieldsByPage.get(page.id) ?? [];
            const pageLabel = page.title?.trim() || t("pages.defaultTitle", { index: page.pageIndex + 1 });
            const isActive = page.id === activePageId;
            const canDelete = pageOrder.length > 1;

            return (
              <PageSection
                key={page.id}
                page={page}
                isActive={isActive}
                pageLabel={pageLabel}
                pageFields={pageFields}
                canDelete={canDelete}
                localAllowBack={localAllowBack}
                setLocalAllowBack={setLocalAllowBack}
                onTogglePageBack={onTogglePageBack}
                onSelectPage={onSelectPage}
                onOpenMove={() => {
                  setMoveDialogPageId(page.id);
                  setMoveTargetIndex(page.pageIndex + 1);
                }}
                onOpenDelete={() => {
                  const targets = pageOrder.filter((item) => item.id !== page.id);
                  setDeleteDialogPageId(page.id);
                  setDeleteMode("delete");
                  setDeleteTargetId(targets[0]?.id ?? null);
                }}
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
        open={deleteDialogPageId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogPageId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pages.deleteTitle")}</DialogTitle>
            <DialogDescription>{t("pages.deleteDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup
              value={deleteMode}
              onValueChange={(value) => setDeleteMode(value as "delete" | "move")}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="delete" id="delete-page-elements" />
                <label htmlFor="delete-page-elements" className="text-sm">
                  {t("pages.deleteWithElements")}
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="move" id="move-page-elements" />
                <label htmlFor="move-page-elements" className="text-sm">
                  {t("pages.moveElements")}
                </label>
              </div>
            </RadioGroup>
            {deleteMode === "move" && (
              <Select
                value={deleteTargetId != null ? String(deleteTargetId) : ""}
                onValueChange={(value) => setDeleteTargetId(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("pages.selectTargetPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {availableDeleteTargets.map((page) => (
                    <SelectItem key={page.id} value={String(page.id)}>
                      {page.title?.trim() || t("pages.defaultTitle", { index: page.pageIndex + 1 })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteDialogPageId(null)}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                deleteDialogPageId == null ||
                (deleteMode === "move" && deleteTargetId == null)
              }
              onClick={() => {
                if (deleteDialogPageId == null) return;
                onDeletePage(deleteDialogPageId, {
                  mode: deleteMode,
                  targetPageId: deleteMode === "move" ? deleteTargetId ?? undefined : undefined,
                });
                setDeleteDialogPageId(null);
              }}
            >
              {t("actions.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
