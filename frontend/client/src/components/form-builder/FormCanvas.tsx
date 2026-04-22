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
  Type, AlignLeft, Hash, Calendar, List, CheckSquare, CircleDot, Heading, Star, ListOrdered, Upload, User, Phone, FileText, CreditCard, Undo2, Redo2, ArrowUp, ArrowDown, Grid, IdCardLanyard, StickyNote, Building, BriefcaseBusiness, Globe, Repeat2
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
};

const AUTO_PAGE_TITLE = /^(Р РЋРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ Р В°|Page)\s+\d+$/;

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
 * Р вЂ™Р С•Р В·Р Р†РЎР‚Р В°РЎвЂ°Р В°Р ВµРЎвЂљ Р С‘Р С”Р С•Р Р…Р С”РЎС“ Р Т‘Р В»РЎРЏ РЎвЂљР С‘Р С—Р В° Р С—Р С•Р В»РЎРЏ РЎвЂћР С•РЎР‚Р СРЎвЂ№
 * @param type - РЎвЂљР С‘Р С— Р С—Р С•Р В»РЎРЏ (text, number, email Р С‘ РЎвЂљ.Р Т‘.)
 * @returns React-Р С”Р С•Р СР С—Р С•Р Р…Р ВµР Р…РЎвЂљ Р С‘Р С”Р С•Р Р…Р С”Р С‘ Р С‘Р В· Р В±Р С‘Р В±Р В»Р С‘Р С•РЎвЂљР ВµР С”Р С‘ lucide-react
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
        className={cn("p-6 bg-muted/20 dark:bg-muted/10 transition-colors rounded-b-lg", isOver && "bg-primary/5")}
      >
        <SortableContext items={pageFields.map((field) => field.id)} strategy={verticalListSortingStrategy}>
          {pageFields.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/20 rounded-lg bg-muted/5">
              <p className="text-muted-foreground font-medium">{t("back.bgFormCreate")}</p>
              <p className="text-sm mt-1 text-muted-foreground dark:text-foreground/80">
                {t("back.drag")}
              </p>
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
 Р С™Р С•Р СР С—Р С•Р Р…Р ВµР Р…РЎвЂљ РЎвЂ¦Р С•Р В»РЎРѓРЎвЂљР В° РЎвЂћР С•РЎР‚Р СРЎвЂ№ - Р С•Р В±Р В»Р В°РЎРѓРЎвЂљРЎРЉ Р Т‘Р В»РЎРЏ РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ Р С‘ Р С—Р ВµРЎР‚Р ВµРЎвЂљР В°РЎРѓР С”Р С‘Р Р†Р В°Р Р…Р С‘РЎРЏ Р С—Р С•Р В»Р ВµР в„– РЎвЂћР С•РЎР‚Р СРЎвЂ№
 Р С›РЎвЂљР Р†Р ВµРЎвЂЎР В°Р ВµРЎвЂљ Р В·Р В°:
 1. Р С›РЎвЂљР С•Р В±РЎР‚Р В°Р В¶Р ВµР Р…Р С‘Р Вµ Р С—Р С•Р В»Р ВµР в„– РЎвЂћР С•РЎР‚Р СРЎвЂ№
 2. Drag & Drop Р С—Р ВµРЎР‚Р ВµРЎС“Р С—Р С•РЎР‚РЎРЏР Т‘Р С•РЎвЂЎР С‘Р Р†Р В°Р Р…Р С‘Р Вµ Р С—Р С•Р В»Р ВµР в„–
 3. Р В Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ Р В·Р В°Р С–Р С•Р В»Р С•Р Р†Р С”Р В° Р С‘ Р С•Р С—Р С‘РЎРѓР В°Р Р…Р С‘РЎРЏ РЎвЂћР С•РЎР‚Р СРЎвЂ№
 4. Р вЂ™Р С‘Р В·РЎС“Р В°Р В»РЎРЉР Р…РЎС“РЎР‹ Р С•Р В±РЎР‚Р В°РЎвЂљР Р…РЎС“РЎР‹ РЎРѓР Р†РЎРЏР В·РЎРЉ Р С—РЎР‚Р С‘ Р С—Р ВµРЎР‚Р ВµРЎвЂљР В°РЎРѓР С”Р С‘Р Р†Р В°Р Р…Р С‘Р С‘
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

  const { t } = useTranslation()  // Р ТђРЎС“Р С” Р Т‘Р В»РЎРЏ Р В»Р С•Р С”Р В°Р В»Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘
  const [activeDragItem, setActiveDragItem] = useState<any>(null);
  const [moveDialogPageId, setMoveDialogPageId] = useState<number | null>(null);
  const [moveTargetIndex, setMoveTargetIndex] = useState<number | null>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const pageOrder = pages.slice().sort((a, b) => a.pageIndex - b.pageIndex);



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
  /**
   Р СњР В°РЎРѓРЎвЂљРЎР‚Р С•Р в„–Р С”Р В° РЎРѓР ВµР Р…РЎРѓР С•РЎР‚Р С•Р Р† Р Т‘Р В»РЎРЏ Р С—Р ВµРЎР‚Р ВµРЎвЂљР В°РЎРѓР С”Р С‘Р Р†Р В°Р Р…Р С‘РЎРЏ
   PointerSensor Р В°Р С”РЎвЂљР С‘Р Р†Р С‘РЎР‚РЎС“Р ВµРЎвЂљРЎРѓРЎРЏ Р С—РЎР‚Р С‘ Р С—Р ВµРЎР‚Р ВµР СР ВµРЎвЂ°Р ВµР Р…Р С‘Р С‘ Р СРЎвЂ№РЎв‚¬Р С‘/РЎвЂљР В°РЎвЂЎР Вµ
  */
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  /**
   Р С›Р В±РЎР‚Р В°Р В±Р С•РЎвЂљРЎвЂЎР С‘Р С” Р Р…Р В°РЎвЂЎР В°Р В»Р В° Р С—Р ВµРЎР‚Р ВµРЎвЂљР В°РЎРѓР С”Р С‘Р Р†Р В°Р Р…Р С‘РЎРЏ
   Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµРЎвЂљ Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ Р С—Р ВµРЎР‚Р ВµРЎвЂљР В°РЎРѓР С”Р С‘Р Р†Р В°Р ВµР СР С•Р С–Р С• Р С—Р С•Р В»РЎРЏ
  */
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const field = fields.find(f => f.id === active.id);
    setActiveDragItem(field);
  };

  /**
   Р С›Р В±РЎР‚Р В°Р В±Р С•РЎвЂљРЎвЂЎР С‘Р С” Р В·Р В°Р Р†Р ВµРЎР‚РЎв‚¬Р ВµР Р…Р С‘РЎРЏ Р С—Р ВµРЎР‚Р ВµРЎвЂљР В°РЎРѓР С”Р С‘Р Р†Р В°Р Р…Р С‘РЎРЏ
   Р вЂ™РЎвЂ№Р С—Р С•Р В»Р Р…РЎРЏР ВµРЎвЂљ Р С—Р ВµРЎР‚Р ВµРЎС“Р С—Р С•РЎР‚РЎРЏР Т‘Р С•РЎвЂЎР С‘Р Р†Р В°Р Р…Р С‘Р Вµ Р С—Р С•Р В»Р ВµР в„– Р Р† Р СР В°РЎРѓРЎРѓР С‘Р Р†Р Вµ РЎвЂћР С•РЎР‚Р СРЎвЂ№
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
   Р В¤РЎС“Р Р…Р С”РЎвЂ Р С‘РЎРЏ Р Т‘Р В»РЎРЏ Р В°Р Р†РЎвЂљР С•Р СР В°РЎвЂљР С‘РЎвЂЎР ВµРЎРѓР С”Р С•Р С–Р С• Р С‘Р В·Р СР ВµР Р…Р ВµР Р…Р С‘РЎРЏ Р Р†РЎвЂ№РЎРѓР С•РЎвЂљРЎвЂ№ textarea
  */
  const adjustTextareaHeight = (textarea: HTMLTextAreaElement | null) => {
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  /**
   Р С›Р В±Р Р…Р С•Р Р†Р В»Р ВµР Р…Р С‘Р Вµ Р В·Р В°Р С–Р С•Р В»Р С•Р Р†Р С”Р В° РЎвЂћР С•РЎР‚Р СРЎвЂ№
  */
  const updateTitle = (title: string) => {
    setForm({ ...form, title });
  };

  /**
   Р С›Р В±Р Р…Р С•Р Р†Р В»Р ВµР Р…Р С‘Р Вµ Р С•Р С—Р С‘РЎРѓР В°Р Р…Р С‘РЎРЏ РЎвЂћР С•РЎР‚Р СРЎвЂ№
  */
  const updateDescription = (description: string) => {
    setForm({ ...form, description });
  };

  // Р Р€РЎРѓРЎвЂљР В°Р Р…Р В°Р Р†Р В»Р С‘Р Р†Р В°Р ВµР С Р Р†РЎвЂ№РЎРѓР С•РЎвЂљРЎС“ Р С—РЎР‚Р С‘ Р С‘Р В·Р СР ВµР Р…Р ВµР Р…Р С‘Р С‘ Р В·Р Р…Р В°РЎвЂЎР ВµР Р…Р С‘Р в„–
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
    // DndContext - Р С”Р С•Р СР С—Р С•Р Р…Р ВµР Р…РЎвЂљ Р Т‘Р В»РЎРЏ Drag & Drop РЎвЂћРЎС“Р Р…Р С”РЎвЂ Р С‘Р С•Р Р…Р В°Р В»РЎРЉР Р…Р С•РЎРѓРЎвЂљР С‘
    <DndContext
      sensors={sensors} // Р СџР ВµРЎР‚Р ВµР Т‘Р В°Р ВµР С РЎРѓР ВµР Р…РЎРѓР С•РЎР‚
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Р С›РЎРѓР Р…Р С•Р Р†Р Р…Р В°РЎРЏ Р С•Р В±Р В»Р В°РЎРѓРЎвЂљРЎРЉ РЎвЂ¦Р С•Р В»РЎРѓРЎвЂљР В° РЎвЂћР С•РЎР‚Р СРЎвЂ№ */}
      <div
        ref={scrollContainerRef}
        data-testid="builder-canvas"
        className="flex-1 bg-muted/30 dark:bg-[var(--color-background)] px-4 sm:px-6 md:px-8 pb-6 md:pb-8 pt-0 overflow-y-auto h-full builder-scroll"
        onClick={() => { console.log('FormCanvas background click, clearing selection'); clearSelection(); }}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          className="sticky top-0 z-20 -mx-4 sm:-mx-6 md:-mx-8 mb-0 bg-white/95 dark:bg-white/10 backdrop-blur border-b border-border"
        >
          <div className="h-12 sm:h-[52px] px-2 sm:px-4 flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar min-w-0">
            <Button
              variant="ghost"
              size="sm"
              data-testid="builder-undo"
              onClick={onUndo}
              disabled={!canUndo}
              className={cn("shrink-0 gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3 dark:!bg-white/60 dark:hover:!bg-white/50", !canUndo && "text-muted-foreground")}
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
              className={cn("shrink-0 gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3 dark:!bg-white/60 dark:hover:!bg-white/50", !canRedo && "text-muted-foreground")}
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
              className={cn("shrink-0 gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3 dark:!bg-white/60 dark:hover:!bg-white/50", !canMoveUp && "text-muted-foreground")}
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
              className={cn("shrink-0 gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3 dark:!bg-white/60 dark:hover:!bg-white/50", !canMoveDown && "text-muted-foreground")}
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
                  className={cn("shrink-0 gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3 dark:!bg-white/60 dark:hover:!bg-white/50", !canTransform && "text-muted-foreground")}
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

        {/* Р С™Р С•Р Р…РЎвЂљР ВµР в„–Р Р…Р ВµРЎР‚ РЎвЂћР С•РЎР‚Р СРЎвЂ№ (Р В±Р ВµР В»Р В°РЎРЏ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р В°) */}
        <div className="max-w-3xl mx-auto min-h-[800px] bg-white dark:bg-white/5 rounded-xl shadow-sm border border-border dark:border-white/10 flex flex-col">

          {/* Р РЃР В°Р С—Р С”Р В° РЎвЂћР С•РЎР‚Р СРЎвЂ№ РЎРѓ РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚РЎС“Р ВµР СРЎвЂ№Р СР С‘ Р С—Р С•Р В»РЎРЏР СР С‘ */}
          <div className="p-8 border-b border-border dark:border-white/10 bg-white dark:bg-white/5 rounded-t-xl group hover:bg-muted/30 transition-colors relative">
            <div className="space-y-2">

              {/* Р В Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚РЎС“Р ВµР СР С•Р Вµ Р С—Р С•Р В»Р Вµ Р В·Р В°Р С–Р С•Р В»Р С•Р Р†Р С”Р В° */}
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

              {/* Р В Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚РЎС“Р ВµР СР С•Р Вµ Р С—Р С•Р В»Р Вµ Р С•Р С—Р С‘РЎРѓР В°Р Р…Р С‘РЎРЏ */}
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

            {/* Р ВР Р…Р Т‘Р С‘Р С”Р В°РЎвЂљР С•РЎР‚ РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚РЎС“Р ВµР СР С•РЎРѓРЎвЂљР С‘ (Р С—Р С•Р С”Р В°Р В·РЎвЂ№Р Р†Р В°Р ВµРЎвЂљРЎРѓРЎРЏ Р С—РЎР‚Р С‘ Р Р…Р В°Р Р†Р ВµР Т‘Р ВµР Р…Р С‘Р С‘) */}
            <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Р вЂќР С•Р В±Р В°Р Р†Р С‘РЎвЂљРЎРЉ Р С‘Р С”Р С•Р Р…Р С”РЎС“ РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ */}
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

          <div className="p-6 border-t border-border dark:border-white/10 bg-white dark:bg-white/5">
            <Button
              variant="outline"
              size="sm"
              onClick={onAddPage}
              className="w-full justify-center dark:!border-white/20 dark:!bg-white/10 dark:hover:!bg-white/20 dark:!text-white dark:hover:!text-white"
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

      {/* DragOverlay - РЎРЊР В»Р ВµР СР ВµР Р…РЎвЂљ, Р С”Р С•РЎвЂљР С•РЎР‚РЎвЂ№Р в„– РЎРѓР В»Р ВµР Т‘РЎС“Р ВµРЎвЂљ Р В·Р В° Р С”РЎС“РЎР‚РЎРѓР С•РЎР‚Р С•Р С Р С—РЎР‚Р С‘ Р С—Р ВµРЎР‚Р ВµРЎвЂљР В°РЎРѓР С”Р С‘Р Р†Р В°Р Р…Р С‘Р С‘ */}
      <DragOverlay>
        {activeDragItem && (

          // Р РЋРЎвЂљР С‘Р В»Р С‘Р В·Р С•Р Р†Р В°Р Р…Р Р…Р В°РЎРЏ Р СР С‘Р Р…Р С‘Р В°РЎвЂљРЎР‹РЎР‚Р В° Р С—Р ВµРЎР‚Р ВµРЎвЂљР В°РЎРѓР С”Р С‘Р Р†Р В°Р ВµР СР С•Р С–Р С• Р С—Р С•Р В»РЎРЏ
          <div className="bg-white dark:bg-white/10 border-2 border-primary shadow-xl rounded-lg p-6 opacity-90">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-sm bg-primary/10 text-primary">

                {/* Р вЂќР С‘Р Р…Р В°Р СР С‘РЎвЂЎР ВµРЎРѓР С”Р С•Р Вµ Р С•РЎвЂљР С•Р В±РЎР‚Р В°Р В¶Р ВµР Р…Р С‘Р Вµ Р С‘Р С”Р С•Р Р…Р С”Р С‘ РЎвЂљР С‘Р С—Р В° Р С—Р С•Р В»РЎРЏ */}
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
