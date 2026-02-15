import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import type { MouseEvent } from "react";
import { nanoid } from "nanoid";
import type { FormAccessMode, FormElementModel, FormSchema } from "@/form/types";
import { FormCanvas, getIconForElement } from "@/components/form-builder/FormCanvas";
import { PropertiesPanel } from "@/components/form-builder/PropertiesPanel";
import FormPreview from "@/components/form-builder/FormPreview";
import { ToolboxItem, ToolboxItemDefinition } from "@/components/form-builder/ToolboxItem";
import { CustomLoader } from "@/components/ui/custom-loader";
import { Button } from "@/components/ui/button";
import {
  Eye,
  BarChart3,
  Share2,
  Save,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  X,
  CalendarDays,
  Clock,
  List,
  Languages,
  Diamond,
  Copy,
  Hexagon,
  SquareAsterisk,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { storage } from "@/lib/storage";
import { useLocation } from "wouter";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { UserMenu } from "@/components/user-menu";
import {
  createForm,
  fetchFormDetail,
  fetchForms,
  publishForm,
  saveForm,
  deleteForm as deleteFormApi,
} from "@/lib/forms-api";
import { useAuth } from "@/lib/auth";

import { useTranslation } from 'react-i18next';
import { AppBrand } from "@/components/app-brand";

const TOOLBOX_ITEMS: ToolboxItemDefinition[] = [
  // Basic
  { widgetType: "header", labelKey: "header", category: "Basic" },
  { widgetType: "text_input", labelKey: "text", category: "Basic" },
  { widgetType: "number_input", labelKey: "number", category: "Basic" },

  // Choice
  { widgetType: "select", labelKey: "select", category: "Choice" },
  { widgetType: "checkbox", labelKey: "checkbox", category: "Choice" },
  { widgetType: "radio", labelKey: "radio", category: "Choice" },

  // Advanced
  { widgetType: "datetime", labelKey: "datetime", category: "Advanced" },
  { widgetType: "text_input", semanticType: "email", labelKey: "email", category: "Advanced" },
  { widgetType: "rating", labelKey: "rating", category: "Advanced" },
  { widgetType: "ranking", labelKey: "ranking", category: "Advanced" },
  { widgetType: "matrix", labelKey: "matrix", category: "Advanced" },
  { widgetType: "file_upload", labelKey: "file", category: "Advanced" },

  // Specialized
  { widgetType: "text_input", semanticType: "full_name", labelKey: "fullname", category: "Specialized" },
  { widgetType: "text_input", semanticType: "phone", labelKey: "phone", category: "Specialized" },
  { widgetType: "text_input", semanticType: "passport", labelKey: "passport", category: "Specialized" },
  { widgetType: "text_input", semanticType: "inn", labelKey: "inn", category: "Specialized" },
  { widgetType: "text_input", semanticType: "snils", labelKey: "snils", category: "Specialized" },
  { widgetType: "text_input", semanticType: "bank_account", labelKey: "account", category: "Specialized" },
  { widgetType: "select", labelKey: "country", category: "Specialized", props: { optionsSource: "countries" } },
  { widgetType: "text_input", semanticType: "ogrn", labelKey: "ogrn", category: "Specialized" },
  { widgetType: "text_input", semanticType: "bik", labelKey: "bik", category: "Specialized" },
];

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Basic: Diamond,
  Choice: Copy,
  Advanced: Hexagon,
  Specialized: SquareAsterisk,
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

const getLocalDatePart = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "yyyy-MM-dd");
};

const getLocalTimePart = (value: string | null | undefined) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return format(parsed, "HH:mm");
};

const isEditableElement = (element: Element | null) => {
  if (!element) return false;
  if (element instanceof HTMLInputElement) return true;
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLSelectElement) return true;
  return (element as HTMLElement).isContentEditable === true;
};

const toIsoFromParts = (dateValue: string | null, timeValue: string) => {
  if (!dateValue || !isValidDateString(dateValue)) return null;
  const [y, m, d] = dateValue.split("-").map(Number);
  let hours = 0;
  let minutes = 0;
  if (timeValue) {
    const [rawHours, rawMinutes] = timeValue.split(":").map(Number);
    if (!Number.isNaN(rawHours)) hours = rawHours;
    if (!Number.isNaN(rawMinutes)) minutes = rawMinutes;
  }
  const parsed = new Date(y, m - 1, d, hours, minutes);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

export default function Builder({ params }: { params: { id?: string } }) {
  const [location, setLocation] = useLocation();
  const [forms, setForms] = useState<FormSchema[]>([]);
  const [activeFormId, setActiveFormId] = useState<string | null>(null);
  const { accessToken, isLoading } = useAuth();
  const activeFormIdRef = useRef<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<FormSchema[]>([]);
  const [redoHistory, setRedoHistory] = useState<FormSchema[]>([]);
  const isUndoingRef = useRef(false);
  const isRedoingRef = useRef(false);
  const lastHistoryKeyRef = useRef<string | null>(null);
  const lastHistoryAtRef = useRef(0);
  const MAX_HISTORY = 50;
  const HISTORY_MERGE_WINDOW_MS = 2000;
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [publishStartDate, setPublishStartDate] = useState<string | null>(null);
  const [publishStartTime, setPublishStartTime] = useState("");
  const [publishEndDate, setPublishEndDate] = useState<string | null>(null);
  const [publishEndTime, setPublishEndTime] = useState("");
  const [publishAccessMode, setPublishAccessMode] = useState<FormAccessMode>("private");
  const [publishNoStart, setPublishNoStart] = useState(false);
  const [publishNoEnd, setPublishNoEnd] = useState(false);
  const canvasScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingCanvasScrollTopRef = useRef<number | null>(null);

  const handleSelectField = (id: string, event: MouseEvent<HTMLDivElement>) => {
    console.log('Selecting field:', id);
    if (event.shiftKey && lastSelectedId) {
      const currentIndex = fields.findIndex(f => f.id === id);
      const lastIndex = fields.findIndex(f => f.id === lastSelectedId);
      if (currentIndex !== -1 && lastIndex !== -1) {
        const [start, end] = currentIndex < lastIndex ? [currentIndex, lastIndex] : [lastIndex, currentIndex];
        const rangeIds = fields.slice(start, end + 1).map(f => f.id);
        setSelectedIds(rangeIds);
        setLastSelectedId(id);
        return;
      }
    }

    if (event.metaKey || event.ctrlKey) {
      setSelectedIds(prev => {
        if (prev.includes(id)) {
          return prev.filter(existingId => existingId !== id);
        }
        return [...prev, id];
      });
      setLastSelectedId(id);
      return;
    }

    setSelectedIds([id]);
    setLastSelectedId(id);
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setLastSelectedId(null);
  };
  const [isToolboxOpen, setIsToolboxOpen] = useState(true);
  const { t, i18n } = useTranslation();

  // Initialize

  useEffect(() => {
    if (isLoading || !accessToken) return;
    if (!params.id) return;
    setActiveFormId(params.id);
    const load = async () => {
      try {
        const remoteForms = await fetchForms();
        const merged = storage.mergeRemoteForms(remoteForms);
        setForms(merged);
      } catch (error) {
        console.error("Failed to load forms:", error);
        setForms(storage.getForms());
      }
    };
    void load();
  }, [params.id, isLoading, accessToken]);

  useEffect(() => {
    activeFormIdRef.current = activeFormId;
  }, [activeFormId]);

  useEffect(() => {
    if (isLoading || !accessToken) return;
    if (!activeFormId) return;
    const loadDetail = async () => {
      try {
        const detail = await fetchFormDetail(activeFormId);
        const localDraft = storage.getForms().find((form) => form.id === detail.id);
        const preferLocalId = localStorage.getItem("etu_prefer_local_form_id");
        const forcePreferLocal = Boolean(preferLocalId && preferLocalId === detail.id);
        const shouldPreferLocal =
          localDraft &&
          (forcePreferLocal ||
            (localDraft.version === detail.version &&
              typeof localDraft.updatedAt === "number" &&
              localDraft.updatedAt > detail.updatedAt));
        const mergedDetail = shouldPreferLocal
          ? {
            ...detail,
            title: localDraft?.title ?? detail.title,
            description: localDraft?.description ?? detail.description,
            fields: localDraft?.fields ?? detail.fields,
            fieldCount: localDraft?.fieldCount ?? localDraft?.fields?.length ?? detail.fieldCount,
            accessMode: localDraft?.accessMode ?? detail.accessMode,
            startAt: localDraft?.startAt ?? detail.startAt,
            endAt: localDraft?.endAt ?? detail.endAt,
            settings_json: localDraft?.settings_json ?? detail.settings_json,
            updatedAt: localDraft?.updatedAt ?? detail.updatedAt,
          }
          : detail;
        if (preferLocalId && preferLocalId === detail.id) {
          localStorage.removeItem("etu_prefer_local_form_id");
        }
        storage.saveForm(mergedDetail);
        setForms((prev) => {
          const existing = prev.find((form) => form.id === mergedDetail.id);
          const merged = existing ? { ...mergedDetail, folderId: existing.folderId } : mergedDetail;
          const exists = Boolean(existing);
          if (exists) {
            return prev.map((form) => (form.id === mergedDetail.id ? merged : form));
          }
          return [merged, ...prev];
        });
      } catch (error) {
        console.error("Failed to load form detail:", error);
        toast({ title: t("builder.error"), description: "Form load failed", variant: "destructive" });
      }
    };
    void loadDetail();
  }, [activeFormId, t]);

  const activeForm = forms.find(f => f.id === activeFormId) || forms[0] || null;
  const tabForms = useMemo(() => {
    const prevIds = new Set(
      forms
        .filter((form) => form.prevFormId)
        .map((form) => form.prevFormId)
    );
    return forms.filter((form) => !prevIds.has(form.id));
  }, [forms]);
  const fields = activeForm?.fields || [];

  const rememberCanvasScrollPosition = useCallback(() => {
    if (!canvasScrollRef.current) return;
    pendingCanvasScrollTopRef.current = canvasScrollRef.current.scrollTop;
  }, []);

  useLayoutEffect(() => {
    const pendingScrollTop = pendingCanvasScrollTopRef.current;
    if (pendingScrollTop == null) return;
    if (canvasScrollRef.current) {
      canvasScrollRef.current.scrollTop = pendingScrollTop;
    }
    pendingCanvasScrollTopRef.current = null;
  }, [forms, activeFormId]);

  useEffect(() => {
    if (!isPublishOpen || !activeForm) return;
    setPublishAccessMode(activeForm.accessMode ?? "private");
    const startDate = getLocalDatePart(activeForm.startAt);
    const startTime = getLocalTimePart(activeForm.startAt);
    const endDate = getLocalDatePart(activeForm.endAt);
    const endTime = getLocalTimePart(activeForm.endAt);
    const noStart = !startDate;
    const noEnd = noStart ? true : !endDate;
    setPublishStartDate(startDate);
    setPublishStartTime(startTime);
    setPublishEndDate(endDate);
    setPublishEndTime(endTime);
    setPublishNoStart(noStart);
    setPublishNoEnd(noEnd);
  }, [activeForm, isPublishOpen]);

  // Auto-save effect
  useEffect(() => {
    if (activeForm) {
      storage.saveForm(activeForm);
    }
  }, [activeForm]);

  useEffect(() => {
    setHistory([]);
    setRedoHistory([]);
    isUndoingRef.current = false;
    isRedoingRef.current = false;
    lastHistoryKeyRef.current = null;
    lastHistoryAtRef.current = 0;
  }, [activeFormId]);

  const cloneForm = (form: FormSchema): FormSchema => {
    return JSON.parse(JSON.stringify(form)) as FormSchema;
  };

  const pushHistory = (form: FormSchema) => {
    setHistory(prev => {
      const next = [...prev, cloneForm(form)];
      if (next.length > MAX_HISTORY) {
        next.shift();
      }
      return next;
    });
  };

  const setForm = (updatedForm: FormSchema, options?: { historyKey?: string | null }) => {
    if (activeForm && updatedForm.id === activeForm.id && !isUndoingRef.current) {
      const historyKey = options?.historyKey ?? null;
      const now = Date.now();
      const canMerge =
        historyKey &&
        historyKey === lastHistoryKeyRef.current &&
        now - lastHistoryAtRef.current < HISTORY_MERGE_WINDOW_MS;

      if (!canMerge) {
        pushHistory(activeForm);
      }

      if (!isRedoingRef.current) {
        setRedoHistory([]);
      }
      lastHistoryKeyRef.current = historyKey;
      lastHistoryAtRef.current = now;
    }
    const newForms = forms.map(f => f.id === updatedForm.id ? updatedForm : f);
    setForms(newForms);
    storage.saveForm(updatedForm);
  };

  const normalizeFields = (elements: FormElementModel[]) =>
    elements.map((element, index) => ({
      ...element,
      props: element.props ?? {},
      sortIndex: index,
    }));

  const setFields = (newFields: FormElementModel[], options?: { historyKey?: string | null }) => {
    if (activeForm) {
      setForm({ ...activeForm, fields: normalizeFields(newFields) }, options);
    }
  };

  // Form Management
  const addNewForm = async () => {
    try {
      const created = await createForm({
        title: t("common.untitled"),
        description: "",
      });
      storage.saveForm({ ...created, fields: created.fields ?? [] });
      const activeFormIndex = forms.findIndex(f => f.id === activeFormId);
      const nextForms =
        activeFormIndex >= 0
          ? [...forms.slice(0, activeFormIndex + 1), created, ...forms.slice(activeFormIndex + 1)]
          : [...forms, created];
      setForms(nextForms);
      setActiveFormId(created.id);
      setLocation(`/builder/${created.id}`);
    } catch (error) {
      console.error("Failed to create form:", error);
      toast({ title: t("builder.error"), description: "Create form failed", variant: "destructive" });
    }
  };

  const closeForm = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (forms.length === 1) {
      toast({ title: t('builder.cannotCloseLastForm'), variant: "destructive" });
      return;
    }
    try {
      await deleteFormApi(id);
    } catch (error) {
      console.error("Failed to delete form:", error);
    }
    const newForms = forms.filter(f => f.id !== id);
    setForms(newForms);
    storage.deleteForm(id);

    // If closed form was active, switch to another
    if (activeFormId === id) {
      const newActiveId = newForms[0]?.id || null;
      setActiveFormId(newActiveId);
      if (newActiveId) {
        setLocation(`/builder/${newActiveId}`);
      }
    }
  };

  const addField = (item: ToolboxItemDefinition, label: string) => {
    const defaultProps: Record<string, unknown> = { ...(item.props ?? {}) };
    const widgetDefaults: Record<string, unknown> = {};

    const usesCountryOptions = (item.props as Record<string, unknown> | undefined)?.optionsSource === "countries";
    if (["select", "radio", "checkbox", "ranking"].includes(item.widgetType) && !usesCountryOptions) {
      widgetDefaults.options = ["Option 1", "Option 2"];
    }
    if (item.widgetType === "rating") {
      widgetDefaults.maxRating = 10;
    }
    if (item.widgetType === "matrix") {
      widgetDefaults.rows = ["Row 1", "Row 2"];
      widgetDefaults.columns = ["Column 1", "Column 2"];
      widgetDefaults.multiplePerRow = false;
    }
    if (item.widgetType === "file_upload") {
      widgetDefaults.maxFileSize = 20;
      widgetDefaults.maxFiles = 1;
    }

    const newField: FormElementModel = {
      id: nanoid(),
      widgetType: item.widgetType,
      semanticType: item.semanticType,
      label,
      description: "",
      required: false,
      props: { ...widgetDefaults, ...defaultProps },
      sortIndex: fields.length,
    };

    const anchorId = lastSelectedId ?? (selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null);
    const anchorIndex = anchorId ? fields.findIndex((field) => field.id === anchorId) : -1;
    const insertIndex = anchorIndex >= 0 ? anchorIndex + 1 : fields.length;
    const nextFields = [...fields];
    nextFields.splice(insertIndex, 0, newField);
    setFields(nextFields);
    setSelectedIds([newField.id]);
    setLastSelectedId(newField.id);
  };

  const updateField = (id: string, updates: Partial<FormElementModel>) => {
    const activeElement = document.activeElement;
    const isTextInput =
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement;
    const updateKeys = Object.keys(updates);
    const historyKey = isTextInput && updateKeys.length === 1
      ? `input:${id}:${updateKeys[0]}`
      : null;
    setFields(fields.map(field => {
      if (field.id !== id) return field;
      const nextProps = updates.props
        ? { ...field.props, ...updates.props }
        : field.props;
      return { ...field, ...updates, props: nextProps };
    }), { historyKey });
  };
  const updateFields = (ids: string[], updates: Partial<FormElementModel>) => {
    if (ids.length == 0) return;
    const idSet = new Set(ids);
    setFields(fields.map(field => {
      if (!idSet.has(field.id)) return field;
      const nextProps = updates.props
        ? { ...field.props, ...updates.props }
        : field.props;
      return { ...field, ...updates, props: nextProps };
    }));
  };
  const deleteField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
    setSelectedIds(prev => prev.filter(existingId => existingId !== id));
    if (lastSelectedId === id) setLastSelectedId(null);
  };

  const deleteSelected = () => {
    if (selectedIds.length === 0) return;
    const selectedSet = new Set(selectedIds);
    setFields(fields.filter(f => !selectedSet.has(f.id)));
    clearSelection();
  };

  const undoLast = useCallback(() => {
    if (!activeForm || history.length === 0) return;
    const previousForm = history[history.length - 1];
    const currentForm = activeForm;
    setHistory(prev => prev.slice(0, -1));
    setRedoHistory(prev => [...prev, cloneForm(currentForm)]);
    isUndoingRef.current = true;
    setForm(previousForm);
    isUndoingRef.current = false;
    lastHistoryKeyRef.current = null;
    lastHistoryAtRef.current = 0;

    const previousIds = new Set(previousForm.fields.map(field => field.id));
    setSelectedIds(prev => prev.filter(id => previousIds.has(id)));
    setLastSelectedId(prev => (prev && previousIds.has(prev)) ? prev : null);
  }, [activeForm, history]);

  const redoLast = useCallback(() => {
    if (!activeForm || redoHistory.length === 0) return;
    const nextForm = redoHistory[redoHistory.length - 1];
    const currentForm = activeForm;
    setRedoHistory(prev => prev.slice(0, -1));
    setHistory(prev => [...prev, cloneForm(currentForm)]);
    isRedoingRef.current = true;
    setForm(nextForm);
    isRedoingRef.current = false;
    lastHistoryKeyRef.current = null;
    lastHistoryAtRef.current = 0;

    const nextIds = new Set(nextForm.fields.map(field => field.id));
    setSelectedIds(prev => prev.filter(id => nextIds.has(id)));
    setLastSelectedId(prev => (prev && nextIds.has(prev)) ? prev : null);
  }, [activeForm, redoHistory]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isDeleteKey = event.key === "Delete" || event.key === "Backspace";
      if (isDeleteKey) {
        if (isEditableElement(document.activeElement)) return;
        if (selectedIds.length === 0) return;
        event.preventDefault();
        deleteSelected();
        return;
      }

      const isUndo =
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        (event.code === "KeyZ" || event.key.toLowerCase() === "z");
      const isRedo =
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        (event.code === "KeyZ" || event.key.toLowerCase() === "z");
      if (!isUndo && !isRedo) return;

      if (isUndo && history.length === 0) {
        return;
      }
      if (isRedo && redoHistory.length === 0) {
        return;
      }

      event.preventDefault();
      if (isUndo) {
        undoLast();
      } else {
        redoLast();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history.length, redoHistory.length, undoLast, redoLast, selectedIds, deleteSelected]);

  useEffect(() => {
    const pendingLang = localStorage.getItem("etu_pending_lang");
    if (!pendingLang) return;
    localStorage.removeItem("etu_pending_lang");
    if (i18n.language !== pendingLang) {
      i18n.changeLanguage(pendingLang);
    }
  }, [i18n]);

  const moveSelected = (direction: "up" | "down") => {
    if (selectedIds.length === 0) return;
    const selectedSet = new Set(selectedIds);
    const newFields = [...fields];

    if (direction === "up") {
      for (let i = 1; i < newFields.length; i += 1) {
        const current = newFields[i];
        const previous = newFields[i - 1];
        if (selectedSet.has(current.id) && !selectedSet.has(previous.id)) {
          newFields[i - 1] = current;
          newFields[i] = previous;
        }
      }
    } else {
      for (let i = newFields.length - 2; i >= 0; i -= 1) {
        const current = newFields[i];
        const next = newFields[i + 1];
        if (selectedSet.has(current.id) && !selectedSet.has(next.id)) {
          newFields[i + 1] = current;
          newFields[i] = next;
        }
      }
    }

    setFields(newFields);
  };

  const mapWidgetTypeForPublish = (widgetType: FormElementModel["widgetType"]) => {
    if (widgetType === "header") return "heading";
    if (widgetType === "textarea") return "text_input";
    return widgetType;
  };

  type PublishCondition = {
    source_client_id: string;
    target_client_id: string;
    operator: "equals" | "not_equals" | "in" | "not_in" | "greater_than" | "less_than" | "contains" | "answered";
    value: any;
  };

  const extractConditionsFromFields = (publishFields: FormElementModel[]): PublishCondition[] => {
    const out: PublishCondition[] = [];

    for (const target of publishFields) {
      const logic = (target.props as any)?.conditionalLogic as
        | { dependsOn?: string; condition?: "equals" | "not_equals" | "answered"; expectedValue?: string | string[] }
        | undefined;
      if (!logic?.dependsOn || !logic.condition) continue;

      let operator: PublishCondition["operator"] | null = null;
      let value: any = null;

      if (logic.condition === "equals") {
        operator = "equals";
        if (logic.expectedValue === undefined) continue;
        value = Array.isArray(logic.expectedValue)
          ? { values: logic.expectedValue }
          : { value: logic.expectedValue };
      } else if (logic.condition === "not_equals") {
        operator = "not_equals";
        if (logic.expectedValue === undefined) continue;
        value = Array.isArray(logic.expectedValue)
          ? { values: logic.expectedValue }
          : { value: logic.expectedValue };
      } else if (logic.condition === "answered") {
        operator = "answered";
        value = { value: true };
      }

      if (!operator) continue;

      out.push({
        source_client_id: String(logic.dependsOn),
        target_client_id: target.id,
        operator,
        value,
      });
    }

    return out;
  };

  const resolvePublishFields = (): FormElementModel[] => {
    if (!activeForm) return [];
    return Array.isArray(activeForm.fields) ? activeForm.fields : [];
  };

  const buildBuilderPayload = (
    publishFields: FormElementModel[],
    overrides?: {
      accessMode?: FormAccessMode;
      startAt?: string | null;
      endAt?: string | null;
    }
  ) => {
    if (!activeForm) return null;
    const accessMode = overrides?.accessMode ?? activeForm.accessMode ?? "private";
    const startAt = overrides?.startAt ?? activeForm.startAt ?? null;
    const endAt = overrides?.endAt ?? activeForm.endAt ?? null;

    return {
      title: activeForm.title,
      description: activeForm.description,
      access_mode: accessMode,
      start_at: startAt,
      end_at: endAt,
      settings_json: activeForm.settings_json ?? { client_form_id: activeForm.id },
      elements: publishFields.map((f, index) => {
        const props = (f.props ?? {}) as Record<string, unknown>;
        const { placeholder, correctAnswer, correctAnswers, points, conditionalLogic, attachments, ...otherSettings } = props;
        const fileIds = Array.isArray(attachments)
          ? Array.from(
            new Set(
              attachments
                .map((item: any) => Number(item?.file_id))
                .filter((id: number) => Number.isFinite(id) && id > 0)
            )
          )
          : [];
        const cleanedOtherSettings: Record<string, unknown> = { ...otherSettings };
        if (points !== undefined) cleanedOtherSettings.points = points;
        const inputType = typeof props.inputType === "string" ? props.inputType : undefined;
        const isEmailField = f.semanticType === "email" || inputType === "email";
        if (isEmailField) {
          delete cleanedOtherSettings.multiline;
        }
        if (f.semanticType === "passport") {
          const passportFlags = [
            "hidePassportFullName",
            "hidePassportGender",
            "hidePassportBirthDate",
            "hidePassportSeriesNumber",
            "hidePassportIssuedBy",
            "hidePassportIssueDate",
            "hidePassportDepartmentCode",
            "hidePassportBirthPlace",
          ] as const;
          for (const key of passportFlags) {
            cleanedOtherSettings[key] = Boolean((f.props as Record<string, unknown> | undefined)?.[key]);
          }
        }
        const rawCorrectAnswer = correctAnswer ?? correctAnswers;
        const normalizedCorrectAnswer = (() => {
          if (rawCorrectAnswer == null) return null;
          if (Array.isArray(rawCorrectAnswer)) return { values: rawCorrectAnswer };
          if (typeof rawCorrectAnswer === "object") return rawCorrectAnswer;
          return { value: rawCorrectAnswer };
        })();
        return {
          client_id: f.id,
          widget: mapWidgetTypeForPublish(f.widgetType),
          semantic: f.semanticType ?? null,
          label: f.label,
          description: f.description ?? null,
          supportive_text: f.description ?? null,
          text_hint: typeof placeholder === "string" ? placeholder : null,
          correct_answer: normalizedCorrectAnswer,
          required_field: !!f.required && !Boolean(props.readOnly),
          other_settings: cleanedOtherSettings,
          file_ids: fileIds,
          sort_index: typeof f.sortIndex === "number" ? f.sortIndex : index,
        };
      }),
      conditions: extractConditionsFromFields(publishFields),
    };
  };

  const saveToServer = async () => {
    if (!activeForm) return;
    const publishFields = resolvePublishFields();
    const payload = buildBuilderPayload(publishFields, {
      accessMode: activeForm.accessMode ?? "private",
      startAt: activeForm.startAt ?? null,
      endAt: activeForm.endAt ?? null,
    });
    if (!payload) return;
    const saved = await saveForm(activeForm.id, payload);
    storage.saveForm(saved);
    setForms((prev) => {
      const existing = prev.find((form) => form.id === saved.id);
      const merged = existing ? { ...saved, folderId: existing.folderId } : saved;
      const activeIndex = prev.findIndex((form) => form.id === activeForm.id);
      let next = prev;

      if (activeForm.id !== saved.id) {
        next = next.filter((form) => form.id !== activeForm.id);
      }

      if (existing) {
        next = next.map((form) => (form.id === saved.id ? merged : form));
      } else {
        const insertAt = activeIndex >= 0 ? Math.min(activeIndex, next.length) : next.length;
        next = [...next.slice(0, insertAt), merged, ...next.slice(insertAt)];
      }

      const seen = new Set<string>();
      return next.filter((form) => {
        if (seen.has(form.id)) return false;
        seen.add(form.id);
        return true;
      });
    });
    if (saved.id !== activeForm.id) {
      storage.deleteForm(activeForm.id);
      if (activeFormIdRef.current === activeForm.id) {
        setActiveFormId(saved.id);
        setLocation(`/builder/${saved.id}`);
      }
    }
    toast({ title: t("builder.formSaved"), description: "Saved to DB" });
  };

  const publishToServer = async () => {
    if (!activeForm) return;
    const publishFields = resolvePublishFields();
    const payload = buildBuilderPayload(publishFields, {
      accessMode: publishAccessMode,
      startAt: publishNoStart ? null : toIsoFromParts(publishStartDate, publishStartTime),
      endAt: publishNoStart || publishNoEnd ? null : toIsoFromParts(publishEndDate, publishEndTime),
    });
    if (!payload) return;
    return publishForm(activeForm.id, payload);
  };

  const handleSave = async () => {
    rememberCanvasScrollPosition();
    try {
      await saveToServer();
    } catch (e: any) {
      pendingCanvasScrollTopRef.current = null;
      toast({ title: t("builder.error"), description: e.message ?? "Save error", variant: "destructive" });
    }
  };

  const handlePublish = async () => {
    try {
      const result = await publishToServer();
      if (!result) return;
      storage.saveForm(result);
      setForms((prev) => {
        const existing = prev.find((form) => form.id === result.id);
        const merged = existing ? { ...result, folderId: existing.folderId } : result;
        if (existing) {
          return prev.map((form) => (form.id === result.id ? merged : form));
        }
        return [...prev, merged];
      });
      toast({ title: t("builder.published") });
      setIsPublishOpen(false);
    } catch (e: any) {
      toast({ title: t("builder.error"), description: e.message ?? "Publish error", variant: "destructive" });
    }
  };

  const selectedField = selectedIds.length === 1 ? fields.find(f => f.id === selectedIds[0]) || null : null;

  const groupedToolbox = TOOLBOX_ITEMS.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ToolboxItemDefinition[]>);

  if (!activeForm) return (
    <div className="flex items-center justify-center h-screen">
      <CustomLoader size="lg" variant="logo-with-dots" text={t("common.loading")} />
    </div>
  );

  console.log('Rendering Builder, activeForm:', activeForm, 'selectedIds:', selectedIds);

  return (
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
      {/* Navbar */}
      <header className="h-19 border-b border-border bg-white flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <AppBrand onClick={() => setLocation('/')} />

          <div className="h-8 w-px bg-border mx-2 hidden md:block" />
          <div className="flex-1 flex items-center overflow-x-auto no-scrollbar max-w-xl">
            <div className="flex items-center gap-1">
              {tabForms.map(form => (
                <div
                  key={form.id}
                  onClick={() => {
                    setActiveFormId(form.id);
                    setLocation(`/builder/${form.id}`);
                  }}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors min-w-[100px] max-w-[160px]",
                    activeFormId === form.id
                      ? "bg-secondary text-secondary-foreground font-medium"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  <span className="truncate">{form.title || t("common.untitled")}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => closeForm(e, form.id)}
                    title="Close form"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={addNewForm}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 h-9 px-3"
              onClick={() => {
                const newLang = i18n.language.startsWith('ru') ? 'en' : 'ru';
                if (activeForm) {
                  storage.saveForm(activeForm);
                  localStorage.setItem("etu_prefer_local_form_id", activeForm.id);
                }
                localStorage.setItem("etu_pending_lang", newLang);
                window.location.reload();
              }}
              title={i18n.language.startsWith('ru') ? 'Переключить на Английский' : 'Switch to Russian'}>
              <Languages className="h-4 w-4" />
              <span className="hidden sm:inline text-sm font-medium">
                {i18n.language.startsWith('ru') ? 'RU' : 'EN'}
              </span>
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button data-testid="builder-preview-open" variant="outline" size="sm" className="gap-2">
                  <Eye className="h-4 w-4" /> <span className="hidden sm:inline">{t('builder.preview')}</span>
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="preview-dialog" className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{activeForm.title || t('common.untitled')}</DialogTitle>
                  {activeForm.description && (
                    <p className="text-sm text-muted-foreground">{activeForm.description}</p>
                  )}
                </DialogHeader>
                <FormPreview form={activeForm} />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary">{t('builder.closePreview')}</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={activeForm.status !== "submitted"}
              onClick={() => {
                if (activeForm.status !== "submitted") {
                  toast({
                    title: t("results.openResults"),
                    description: t("results.onlyPublishedShort"),
                    variant: "destructive",
                  });
                  return;
                }
                setLocation(`/forms/${activeForm.id}/results`);
              }}
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">{t("results.openResults")}</span>
            </Button>

            <Button data-testid="builder-save" variant="outline" size="sm" className="gap-2" onClick={handleSave}>
              <Save className="h-4 w-4" /> <span className="hidden sm:inline">{t('builder.save')}</span>
            </Button>
            <Popover open={isPublishOpen} onOpenChange={setIsPublishOpen}>
              <PopoverTrigger asChild>
                <Button data-testid="builder-publish-open" size="sm" className="gap-2">
                  <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">{t("builder.publish")}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent data-testid="builder-publish-popover" align="end" className="w-[360px] p-4">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold">{t("builder.publishTitle")}</h4>
                    <p className="text-xs text-muted-foreground">{t("builder.publishHint")}</p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("builder.accessMode")}</Label>
                    <RadioGroup
                      value={publishAccessMode}
                      onValueChange={(value) => setPublishAccessMode(value as FormAccessMode)}
                      className="space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="private" id="access-private" />
                        <Label htmlFor="access-private" className="cursor-pointer">
                          {t("builder.accessModePrivate")}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="unauthenticated" id="access-unauthenticated" />
                        <Label htmlFor="access-unauthenticated" className="cursor-pointer">
                          {t("builder.accessModeUnauthenticated")}
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{t("builder.publishStart")}</Label>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="publish-no-start"
                          checked={publishNoStart}
                          simplifiedAnimation
                          onCheckedChange={(checked) => {
                            const isChecked = checked === true;
                            setPublishNoStart(isChecked);
                            if (isChecked) {
                              setPublishStartDate(null);
                              setPublishStartTime("");
                              setPublishNoEnd(true);
                            } else {
                              setPublishNoEnd(!publishEndDate);
                            }
                          }}
                        />
                        <Label htmlFor="publish-no-start" className="text-xs text-muted-foreground cursor-pointer">
                          {t("builder.publishNoStart")}
                        </Label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="relative">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute left-0 top-0 h-10 w-10 hover:bg-transparent z-10"
                              disabled={publishNoStart}
                              type="button"
                            >
                              <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={publishStartDate ? parseDateFromString(publishStartDate) : undefined}
                              onSelect={(date) => {
                                setPublishStartDate(date ? format(date, "yyyy-MM-dd") : null);
                              }}
                              locale={ru}
                            />
                          </PopoverContent>
                        </Popover>
                        <Input
                          type="date"
                          value={formatDateInput(publishStartDate)}
                          onChange={(event) => {
                            const val = event.target.value;
                            if (val === "") {
                              setPublishStartDate(null);
                              return;
                            }
                            if (isValidDateString(val)) {
                              setPublishStartDate(val);
                            }
                          }}
                          disabled={publishNoStart}
                          className="pl-10 h-10 text-muted-foreground"
                          placeholder={t("propert.selectDate")}
                        />
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-10",
                              !publishStartTime && "text-muted-foreground"
                            )}
                            disabled={publishNoStart}
                            type="button"
                          >
                            <Clock className="mr-2 h-4 w-4" />
                            {publishStartTime ? <span>{publishStartTime}</span> : <span>{t("propert.selectTime")}</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-4" align="start">
                          <Input
                            type="time"
                            value={publishStartTime}
                            onChange={(event) => setPublishStartTime(event.target.value)}
                            disabled={publishNoStart}
                            className="w-full"
                            autoFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{t("builder.publishEnd")}</Label>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="publish-no-end"
                          checked={publishNoEnd}
                          simplifiedAnimation
                          disabled={publishNoStart}
                          onCheckedChange={(checked) => {
                            if (publishNoStart) return;
                            const isChecked = checked === true;
                            setPublishNoEnd(isChecked);
                            if (isChecked) {
                              setPublishEndDate(null);
                              setPublishEndTime("");
                            }
                          }}
                        />
                        <Label htmlFor="publish-no-end" className="text-xs text-muted-foreground cursor-pointer">
                          {t("builder.publishNoEnd")}
                        </Label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="relative">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute left-0 top-0 h-10 w-10 hover:bg-transparent z-10"
                              disabled={publishNoEnd || publishNoStart}
                              type="button"
                            >
                              <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={publishEndDate ? parseDateFromString(publishEndDate) : undefined}
                              onSelect={(date) => {
                                setPublishEndDate(date ? format(date, "yyyy-MM-dd") : null);
                              }}
                              locale={ru}
                            />
                          </PopoverContent>
                        </Popover>
                        <Input
                          type="date"
                          value={formatDateInput(publishEndDate)}
                          onChange={(event) => {
                            const val = event.target.value;
                            if (val === "") {
                              setPublishEndDate(null);
                              return;
                            }
                            if (isValidDateString(val)) {
                              setPublishEndDate(val);
                            }
                          }}
                          disabled={publishNoEnd || publishNoStart}
                          className="pl-10 h-10 text-muted-foreground"
                          placeholder={t("propert.selectDate")}
                        />
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-10",
                              !publishEndTime && "text-muted-foreground"
                            )}
                            disabled={publishNoEnd || publishNoStart}
                            type="button"
                          >
                            <Clock className="mr-2 h-4 w-4" />
                            {publishEndTime ? <span>{publishEndTime}</span> : <span>{t("propert.selectTime")}</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-4" align="start">
                          <Input
                            type="time"
                            value={publishEndTime}
                            onChange={(event) => setPublishEndTime(event.target.value)}
                            disabled={publishNoEnd || publishNoStart}
                            className="w-full"
                            autoFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setIsPublishOpen(false)}>
                      {t("actions.cancel")}
                    </Button>
                    <Button size="sm" onClick={handlePublish}>
                      {t("builder.publish")}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <UserMenu />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div
          className={cn(
            "border-r border-border bg-white flex flex-col shrink-0 z-10 overflow-hidden transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            isToolboxOpen ? "w-64" : "w-24"
          )}
        >
          <div className="border-b border-border">
            <div className="h-[52px] px-6 flex items-center">
              <div className={cn("flex w-full items-center", isToolboxOpen ? "justify-start gap-2" : "justify-start")}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setIsToolboxOpen(!isToolboxOpen)}
                  title={isToolboxOpen ? t("builder.collapseToolbox") : t("builder.expandToolbox")}
                  aria-label={isToolboxOpen ? t("builder.collapseToolbox") : t("builder.expandToolbox")}
                >
                  {isToolboxOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                </Button>
                {isToolboxOpen ? (
                  <h2 className="font-semibold text-sm text-foreground uppercase tracking-wider whitespace-nowrap overflow-hidden">
                    {t('builder.toolbox')}
                  </h2>
                ) : null}
              </div>
            </div>
          </div>
          <div
            className="flex-1 overflow-y-auto px-3 py-4 space-y-6"
          >
            {Object.entries(groupedToolbox).map(([category, items]) => {
              const CategoryIcon = CATEGORY_ICONS[category] ?? List;
              const categoryLabel = t(`categories.${category}`);

              return (
                <div key={category} className="space-y-1">
                  <p
                    className="text-xs font-medium text-muted-foreground uppercase flex items-center mb-3 pl-5 gap-2"
                    title={!isToolboxOpen ? categoryLabel : undefined}
                  >
                    <CategoryIcon className="h-4 w-4 shrink-0" />
                    {isToolboxOpen ? <span className="whitespace-nowrap overflow-hidden">{categoryLabel}</span> : null}
                  </p>
                  {items.map((item) => (
                    <ToolboxItem
                      key={`${item.category}-${item.labelKey}`}
                      item={item}
                      label={t(`fields.${item.labelKey}`)}
                      icon={getIconForElement(item.widgetType, item.semanticType, item.props)}
                      collapsed={!isToolboxOpen}
                      onAddField={addField}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <FormCanvas
          key={activeForm.id}
          scrollContainerRef={canvasScrollRef}
          form={activeForm}
          setForm={setForm}
          selectedIds={selectedIds}
          moveSelected={moveSelected}
          onSelectField={handleSelectField}
          clearSelection={clearSelection}
          updateField={updateField}
          onUndo={undoLast}
          onRedo={redoLast}
          canUndo={history.length > 0}
          canRedo={redoHistory.length > 0}
          fields={fields}
        />

        <div className="w-80 border-l border-border bg-white flex flex-col shrink-0 z-10">
          <PropertiesPanel
            key={selectedField?.id || selectedIds.join("-") || 'none'}
            selectedField={selectedField}
            selectedIds={selectedIds}
            updateField={updateField}
            updateFields={updateFields}
            deleteField={deleteField}
            deleteSelected={deleteSelected}
            fields={fields}
          />
        </div>
      </div>
    </div>
  );
}
