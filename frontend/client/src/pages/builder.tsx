import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import type { MouseEvent } from "react";
import { nanoid } from "nanoid";
import type { FormAccessMode, FormElementModel, FormPageModel, FormSchema } from "@/form/types";
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
  Clock,
  List,
  Languages,
  Diamond,
  Copy,
  Hexagon,
  SquareAsterisk,
  SlidersHorizontal,
  MoreVertical,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { storage } from "@/lib/storage";
import { useLocation } from "wouter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { enUS, ru } from "date-fns/locale";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
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
import { t as i18nT } from "i18next";

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

const isValidDateString = (value: string) => {
  if (value.length !== 10) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return false;
  if (m < 1 || m > 12) return false;
  const parsed = new Date(y, m - 1, d);
  return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d;
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

const normalizePages = (pages: FormPageModel[] | undefined | null): FormPageModel[] => {
  if (!Array.isArray(pages) || pages.length === 0) {
    return [{ id: 1, title: i18nT("pages.defaultTitle", { index: 1 }), pageIndex: 0, allowBack: true }];
  }
  return pages
    .map((page, index) => ({
      id: typeof page.id === "number" ? page.id : index + 1,
      title: typeof page.title === "string" ? page.title : i18nT("pages.defaultTitle", { index: index + 1 }),
      pageIndex: typeof page.pageIndex === "number" ? page.pageIndex : index,
      allowBack: typeof page.allowBack === "boolean" ? page.allowBack : true,
    }))
    .sort((a, b) => a.pageIndex - b.pageIndex);
};

const AUTO_PAGE_TITLE = /^(РЎС‚СЂР°РЅРёС†Р°|Page) \d+$/;

const reindexPages = (pages: FormPageModel[]): FormPageModel[] => {
  return pages
    .slice()
    .sort((a, b) => a.pageIndex - b.pageIndex)
    .map((page, index) => {
      const rawTitle = typeof page.title === "string" ? page.title : "";
      const trimmedTitle = rawTitle.trim();
      const shouldAutoTitle = !trimmedTitle || AUTO_PAGE_TITLE.test(trimmedTitle);
      return {
        ...page,
        pageIndex: index,
        title: shouldAutoTitle ? i18nT("pages.defaultTitle", { index: index + 1 }) : rawTitle,
        allowBack: typeof page.allowBack === "boolean" ? page.allowBack : true,
      };
    });
};

const reindexPagesInOrder = (pages: FormPageModel[]): FormPageModel[] => {
  return pages.map((page, index) => {
    const rawTitle = typeof page.title === "string" ? page.title : "";
    const trimmedTitle = rawTitle.trim();
    const shouldAutoTitle = !trimmedTitle || AUTO_PAGE_TITLE.test(trimmedTitle);
    return {
      ...page,
      pageIndex: index,
      title: shouldAutoTitle ? i18nT("pages.defaultTitle", { index: index + 1 }) : rawTitle,
      allowBack: typeof page.allowBack === "boolean" ? page.allowBack : true,
    };
  });
};

const normalizeFieldsByPage = (elements: FormElementModel[], pages: FormPageModel[]) => {
  const pageOrder = pages.slice().sort((a, b) => a.pageIndex - b.pageIndex);
  const pageIdSet = new Set(pageOrder.map((page) => page.id));
  const fallbackPageId = pageOrder[0]?.id ?? 1;
  const grouped = new Map<number, FormElementModel[]>();

  for (const element of elements) {
    const pageId = pageIdSet.has(element.pageId) ? element.pageId : fallbackPageId;
    const entry = grouped.get(pageId) ?? [];
    entry.push({ ...element, pageId });
    grouped.set(pageId, entry);
  }

  const normalized: FormElementModel[] = [];
  for (const page of pageOrder) {
    const items = (grouped.get(page.id) ?? [])
      .slice()
      .sort((a, b) => a.sortIndex - b.sortIndex)
      .map((item, index) => ({ ...item, sortIndex: index }));
    normalized.push(...items);
  }

  return normalized;
};

const sortForSignature = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortForSignature);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, sortForSignature(nested)] as const);
    return Object.fromEntries(entries);
  }
  return value;
};

export default function Builder({ params }: { params: { id?: string } }) {
  const [location, setLocation] = useLocation();
  const [forms, setForms] = useState<FormSchema[]>([]);
  const [activeFormId, setActiveFormId] = useState<string | null>(null);
  const { accessToken, isLoading } = useAuth();
  const activeFormIdRef = useRef<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<number[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [lastSelectedPageId, setLastSelectedPageId] = useState<number | null>(null);
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
  const [publishAllowRevoke, setPublishAllowRevoke] = useState(false);
  const [publishRevokeCountsAsAttempt, setPublishRevokeCountsAsAttempt] = useState(false);
  const [publishAttemptLimitType, setPublishAttemptLimitType] = useState<"unlimited" | "limited">("unlimited");
  const [publishAttemptLimit, setPublishAttemptLimit] = useState<number>(1);
  const [publishAttemptLimitInput, setPublishAttemptLimitInput] = useState("1");
  const [activePageId, setActivePageId] = useState<number | null>(null);
  const nextPageIdRef = useRef(-1);
  const [syncedPayloadSignatures, setSyncedPayloadSignatures] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const canvasScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingCanvasScrollTopRef = useRef<number | null>(null);

  const handleSelectField = (id: string, event: MouseEvent<HTMLDivElement>) => {
    console.log('Selecting field:', id);
    if (selectedPageIds.length > 0) {
      setSelectedPageIds([]);
      setLastSelectedPageId(null);
    }
    const selectedField = fields.find((field) => field.id === id);
    if (selectedField) {
      setActivePageId(selectedField.pageId);
    }
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
    setSelectedPageIds([]);
    setLastSelectedPageId(null);
  };
  const handleSelectPage = (pageId: number, event?: MouseEvent<HTMLDivElement>) => {
    setActivePageId(pageId);
    setSelectedIds([]);
    setLastSelectedId(null);
    if (event?.shiftKey && lastSelectedPageId != null) {
      const orderedPages = pages.slice().sort((a, b) => a.pageIndex - b.pageIndex);
      const currentIndex = orderedPages.findIndex((page) => page.id === pageId);
      const lastIndex = orderedPages.findIndex((page) => page.id === lastSelectedPageId);
      if (currentIndex !== -1 && lastIndex !== -1) {
        const [start, end] = currentIndex < lastIndex ? [currentIndex, lastIndex] : [lastIndex, currentIndex];
        const rangeIds = orderedPages.slice(start, end + 1).map((page) => page.id);
        setSelectedPageIds(rangeIds);
        setLastSelectedPageId(pageId);
        return;
      }
    }
    if (event?.metaKey || event?.ctrlKey) {
      setSelectedPageIds((prev) => {
        if (prev.includes(pageId)) {
          return prev.filter((existingId) => existingId !== pageId);
        }
        return [...prev, pageId];
      });
      setLastSelectedPageId(pageId);
      return;
    }
    setSelectedPageIds([pageId]);
    setLastSelectedPageId(pageId);
  };
  const [isToolboxOpen, setIsToolboxOpen] = useState(true);
  const [isToolboxSheetOpen, setIsToolboxSheetOpen] = useState(false);
  const [isPropertiesSheetOpen, setIsPropertiesSheetOpen] = useState(false);
  const [isLgUp, setIsLgUp] = useState(typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsLgUp(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!isLgUp && (selectedIds.length > 0 || selectedPageIds.length > 0)) {
      setIsPropertiesSheetOpen(true);
    }
  }, [isLgUp, selectedIds.length, selectedPageIds.length]);
  const { t, i18n } = useTranslation();
  const calendarLocale = i18n.language.startsWith("ru") ? ru : enUS;

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
            pages: localDraft?.pages ?? detail.pages,
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
        const normalizedPages = normalizePages(mergedDetail.pages);
        const normalizedFields = normalizeFieldsByPage(
          Array.isArray(mergedDetail.fields) ? mergedDetail.fields : [],
          normalizedPages
        );
        const normalizedDetail = {
          ...mergedDetail,
          pages: normalizedPages,
          fields: normalizedFields,
          fieldCount: mergedDetail.fieldCount ?? normalizedFields.length,
        };

        storage.saveForm(normalizedDetail);
        setForms((prev) => {
          const existing = prev.find((form) => form.id === normalizedDetail.id);
          const merged = existing ? { ...normalizedDetail, folderId: existing.folderId } : normalizedDetail;
          const exists = Boolean(existing);
          if (exists) {
            return prev.map((form) => (form.id === normalizedDetail.id ? merged : form));
          }
          return [merged, ...prev];
        });
      } catch (error) {
        console.error("Failed to load form detail:", error);
        toast({ title: t("builder.error"), description: "Form load failed", variant: "destructive" });
      }
    };
    void loadDetail();
  }, [activeFormId, isLoading, accessToken, t]);

  const activeForm = forms.find(f => f.id === activeFormId) || forms[0] || null;
  const tabForms = useMemo(() => {
    const prevIds = new Set(
      forms
        .filter((form) => form.prevFormId)
        .map((form) => form.prevFormId)
    );
    return forms.filter((form) => !prevIds.has(form.id));
  }, [forms]);
  const pages = normalizePages(activeForm?.pages);
  const fields = normalizeFieldsByPage(activeForm?.fields ?? [], pages);

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
    if (!activeForm) return;
    const normalizedPages = normalizePages(activeForm.pages);
    setActivePageId((current) => {
      if (current && normalizedPages.some((page) => page.id === current)) {
        return current;
      }
      return normalizedPages[0]?.id ?? null;
    });
  }, [activeForm, activeFormId]);

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
    const settings = activeForm.settings_json ?? {};
    setPublishAllowRevoke(Boolean(settings.allowRevoke));
    setPublishRevokeCountsAsAttempt(Boolean(settings.revokeCountsAsAttempt));
    setPublishAttemptLimitType(settings.attemptLimitType === "limited" ? "limited" : "unlimited");
    const limit = typeof settings.attemptLimit === "number" && settings.attemptLimit > 0
      ? settings.attemptLimit
      : 1;
    setPublishAttemptLimit(limit);
    if (settings.attemptLimitType === "limited") {
      setPublishAttemptLimitInput(String(limit));
    }
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

  const normalizeFields = (elements: FormElementModel[], nextPages = pages) =>
    normalizeFieldsByPage(
      elements.map((element) => ({
        ...element,
        props: element.props ?? {},
      })),
      nextPages
    );

  const setFields = (newFields: FormElementModel[], options?: { historyKey?: string | null }) => {
    if (activeForm) {
      setForm({ ...activeForm, pages, fields: normalizeFields(newFields) }, options);
    }
  };

  // Form Management
  const addNewForm = async () => {
    try {
      const created = await createForm({
        title: t("common.untitled"),
        description: "",
      });
      const normalizedPages = normalizePages(created.pages);
      const normalizedFields = normalizeFieldsByPage(created.fields ?? [], normalizedPages);
      storage.saveForm({ ...created, pages: normalizedPages, fields: normalizedFields });
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
    setSyncedPayloadSignatures((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });

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

    const currentPageId = activePageId ?? pages[0]?.id ?? 1;
    const pageFields = fields
      .filter((field) => field.pageId === currentPageId)
      .slice()
      .sort((a, b) => a.sortIndex - b.sortIndex);
    const selectedOnPage = selectedIds.filter((id) => pageFields.some((field) => field.id === id));

    const newField: FormElementModel = {
      id: nanoid(),
      pageId: currentPageId,
      widgetType: item.widgetType,
      semanticType: item.semanticType,
      label,
      description: "",
      required: false,
      props: { ...widgetDefaults, ...defaultProps },
      sortIndex: pageFields.length,
    };

    const anchorId = lastSelectedId ?? (selectedOnPage.length > 0 ? selectedOnPage[selectedOnPage.length - 1] : null);
    const anchorIndex = anchorId ? pageFields.findIndex((field) => field.id === anchorId) : -1;
    const insertIndex = anchorIndex >= 0 ? anchorIndex + 1 : pageFields.length;
    const nextPageFields = [...pageFields];
    nextPageFields.splice(insertIndex, 0, newField);
    const nextFields = [
      ...fields.filter((field) => field.pageId !== currentPageId),
      ...nextPageFields,
    ];
    setFields(nextFields);
    setSelectedIds([newField.id]);
    setLastSelectedId(newField.id);
    setSelectedPageIds([]);
    setLastSelectedPageId(null);
  };

  const addPage = () => {
    if (!activeForm) return;
    const existingIds = pages.map((page) => page.id);
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    let nextId = maxId + 1;
    if (existingIds.some((id) => id < 0)) {
      nextId = nextPageIdRef.current;
      nextPageIdRef.current -= 1;
    }
    const nextIndex = pages.length;
    const newPage: FormPageModel = {
      id: nextId,
      title: i18nT("pages.defaultTitle", { index: nextIndex + 1 }),
      pageIndex: nextIndex,
      allowBack: true,
    };
    const nextPages = [...pages, newPage];
    const nextFields = normalizeFieldsByPage(fields, nextPages);
    setForm({ ...activeForm, pages: nextPages, fields: nextFields });
    setActivePageId(newPage.id);
  };

  const deletePage = (
    pageId: number,
    options: { mode: "delete" | "move"; targetPageId?: number }
  ) => {
    if (!activeForm) return;
    if (pages.length <= 1) return;

    const orderedPages = reindexPages(pages);
    const deleteIndex = orderedPages.findIndex((page) => page.id === pageId);
    if (deleteIndex === -1) return;

    const remainingPages = reindexPages(orderedPages.filter((page) => page.id !== pageId));
    if (remainingPages.length === 0) return;

    const remainingIds = new Set(remainingPages.map((page) => page.id));
    let targetPageId = options.targetPageId;
    if (options.mode === "move") {
      if (targetPageId == null || !remainingIds.has(targetPageId)) {
        targetPageId = remainingPages[0].id;
      }
    }

    let nextFields: FormElementModel[];
    if (options.mode === "move" && targetPageId != null) {
      const targetCount = fields.filter((field) => field.pageId === targetPageId).length;
      const movedFields = fields
        .filter((field) => field.pageId === pageId)
        .slice()
        .sort((a, b) => a.sortIndex - b.sortIndex);
      const movedIndexById = new Map(
        movedFields.map((field, index) => [field.id, targetCount + index])
      );
      nextFields = fields.map((field) => {
        if (field.pageId !== pageId) return field;
        return {
          ...field,
          pageId: targetPageId,
          sortIndex: movedIndexById.get(field.id) ?? field.sortIndex,
        };
      });
    } else {
      nextFields = fields.filter((field) => field.pageId !== pageId);
    }

    nextFields = normalizeFieldsByPage(nextFields, remainingPages);

    let nextActive = activePageId;
    if (!nextActive || nextActive === pageId || !remainingIds.has(nextActive)) {
      if (options.mode === "move" && targetPageId != null) {
        nextActive = targetPageId;
      } else {
        const fallbackIndex = Math.max(0, deleteIndex - 1);
        nextActive = remainingPages[fallbackIndex]?.id ?? remainingPages[0].id;
      }
    }

    setForm({ ...activeForm, pages: remainingPages, fields: nextFields });
    setActivePageId(nextActive);
  };
  const deletePages = (
    pageIds: number[],
    options: { mode: "delete" | "move"; targetPageId?: number }
  ) => {
    if (!activeForm) return;
    if (pageIds.length === 0) return;
    const deleteSet = new Set(pageIds);
    if (pages.length <= deleteSet.size) return;

    const orderedPages = reindexPages(pages);
    const remainingPages = reindexPages(orderedPages.filter((page) => !deleteSet.has(page.id)));
    if (remainingPages.length === 0) return;

    const remainingIds = new Set(remainingPages.map((page) => page.id));
    let targetPageId = options.targetPageId;
    if (options.mode === "move") {
      if (targetPageId == null || !remainingIds.has(targetPageId)) {
        targetPageId = remainingPages[0].id;
      }
    }

    let nextFields: FormElementModel[];
    if (options.mode === "move" && targetPageId != null) {
      const targetCount = fields.filter((field) => field.pageId === targetPageId).length;
      const movedFields = orderedPages
        .filter((page) => deleteSet.has(page.id))
        .flatMap((page) =>
          fields
            .filter((field) => field.pageId === page.id)
            .slice()
            .sort((a, b) => a.sortIndex - b.sortIndex)
        );
      const movedIndexById = new Map(
        movedFields.map((field, index) => [field.id, targetCount + index])
      );
      nextFields = fields.map((field) => {
        if (!deleteSet.has(field.pageId)) return field;
        return {
          ...field,
          pageId: targetPageId,
          sortIndex: movedIndexById.get(field.id) ?? field.sortIndex,
        };
      });
    } else {
      nextFields = fields.filter((field) => !deleteSet.has(field.pageId));
    }

    nextFields = normalizeFieldsByPage(nextFields, remainingPages);

    let nextActive = activePageId;
    if (!nextActive || deleteSet.has(nextActive) || !remainingIds.has(nextActive)) {
      if (options.mode === "move" && targetPageId != null) {
        nextActive = targetPageId;
      } else {
        nextActive = remainingPages[0]?.id ?? null;
      }
    }

    setForm({ ...activeForm, pages: remainingPages, fields: nextFields });
    setActivePageId(nextActive);
    setSelectedPageIds([]);
    setLastSelectedPageId(null);
  };

  const movePageToIndex = (pageId: number, targetIndex: number) => {
    if (!activeForm) return;
    const orderedPages = pages.slice().sort((a, b) => a.pageIndex - b.pageIndex);
    const currentIndex = orderedPages.findIndex((page) => page.id === pageId);
    if (currentIndex === -1) return;

    const normalizedTarget = Math.min(
      Math.max(1, Math.floor(targetIndex)),
      orderedPages.length
    );
    const nextPages = orderedPages.slice();
    const [moved] = nextPages.splice(currentIndex, 1);
    nextPages.splice(normalizedTarget - 1, 0, moved);

    const reindexed = reindexPagesInOrder(nextPages);
    const nextFields = normalizeFieldsByPage(fields, reindexed);
    setForm({ ...activeForm, pages: reindexed, fields: nextFields });
  };

  const togglePageBack = (pageId: number, allowBack: boolean) => {
    if (!activeForm) return;
    const nextPages = pages.map((page) =>
      page.id === pageId ? { ...page, allowBack } : page
    );
    setForm({ ...activeForm, pages: nextPages, fields });
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
    const pageOrder = pages.slice().sort((a, b) => a.pageIndex - b.pageIndex);
    const byPage = new Map<number, FormElementModel[]>();
    fields.forEach((field) => {
      const list = byPage.get(field.pageId) ?? [];
      list.push(field);
      byPage.set(field.pageId, list);
    });

    const nextFields: FormElementModel[] = [];
    for (const page of pageOrder) {
      const pageFields = (byPage.get(page.id) ?? [])
        .slice()
        .sort((a, b) => a.sortIndex - b.sortIndex);
      if (direction === "up") {
        for (let i = 1; i < pageFields.length; i += 1) {
          const current = pageFields[i];
          const previous = pageFields[i - 1];
          if (selectedSet.has(current.id) && !selectedSet.has(previous.id)) {
            pageFields[i - 1] = current;
            pageFields[i] = previous;
          }
        }
      } else {
        for (let i = pageFields.length - 2; i >= 0; i -= 1) {
          const current = pageFields[i];
          const next = pageFields[i + 1];
          if (selectedSet.has(current.id) && !selectedSet.has(next.id)) {
            pageFields[i + 1] = current;
            pageFields[i] = next;
          }
        }
      }
      nextFields.push(
        ...pageFields.map((field, index) => ({
          ...field,
          sortIndex: index,
        }))
      );
    }

    setFields(nextFields);
  };
  const moveSelectedPages = (direction: "up" | "down") => {
    if (!activeForm) return;
    if (selectedPageIds.length === 0) return;
    const selectedSet = new Set(selectedPageIds);
    const orderedPages = pages.slice().sort((a, b) => a.pageIndex - b.pageIndex);
    const nextPages = orderedPages.slice();
    if (direction === "up") {
      for (let i = 1; i < nextPages.length; i += 1) {
        if (selectedSet.has(nextPages[i].id) && !selectedSet.has(nextPages[i - 1].id)) {
          const current = nextPages[i];
          nextPages[i] = nextPages[i - 1];
          nextPages[i - 1] = current;
        }
      }
    } else {
      for (let i = nextPages.length - 2; i >= 0; i -= 1) {
        if (selectedSet.has(nextPages[i].id) && !selectedSet.has(nextPages[i + 1].id)) {
          const current = nextPages[i];
          nextPages[i] = nextPages[i + 1];
          nextPages[i + 1] = current;
        }
      }
    }
    const reindexed = reindexPagesInOrder(nextPages);
    const nextFields = normalizeFieldsByPage(fields, reindexed);
    setForm({ ...activeForm, pages: reindexed, fields: nextFields });
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

  const resolvePublishFields = (sourceForm?: FormSchema | null): FormElementModel[] => {
    const form = sourceForm ?? activeForm;
    if (!form) return [];
    return Array.isArray(form.fields) ? form.fields : [];
  };

  const buildBuilderPayload = (
    publishFields: FormElementModel[],
    overrides?: {
      accessMode?: FormAccessMode;
      startAt?: string | null;
      endAt?: string | null;
      allowRevoke?: boolean;
      revokeCountsAsAttempt?: boolean;
      attemptLimitType?: "unlimited" | "limited";
      attemptLimit?: number | null;
    },
    sourceForm?: FormSchema | null
  ) => {
    const form = sourceForm ?? activeForm;
    if (!form) return null;
    const normalizedPages = normalizePages(form.pages);
    const accessMode = overrides?.accessMode ?? form.accessMode ?? "private";
    const startAt = overrides?.startAt ?? form.startAt ?? null;
    const endAt = overrides?.endAt ?? form.endAt ?? null;
    const baseSettings = form.settings_json ?? { client_form_id: form.id };
    const baseObj = typeof baseSettings === "object" && baseSettings !== null ? baseSettings : {};
    const settings_json = {
      ...baseObj,
      ...(overrides?.allowRevoke !== undefined && { allowRevoke: overrides.allowRevoke }),
      ...(overrides?.revokeCountsAsAttempt !== undefined && { revokeCountsAsAttempt: overrides.revokeCountsAsAttempt }),
      ...(overrides?.attemptLimitType !== undefined && { attemptLimitType: overrides.attemptLimitType }),
      ...(overrides?.attemptLimitType === "limited" && overrides?.attemptLimit !== undefined && { attemptLimit: overrides.attemptLimit }),
      ...(overrides?.attemptLimitType === "unlimited" && { attemptLimit: null }),
    };

    return {
      title: form.title,
      description: form.description,
      access_mode: accessMode,
      start_at: startAt,
      end_at: endAt,
      settings_json,
      
      pages: normalizedPages.map((page, index) => ({
        page_id: page.id,
        page_index: typeof page.pageIndex === "number" ? page.pageIndex : index,
        allow_back: page.allowBack,
      })),
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
        const normalizedCorrectAnswer: Record<string, unknown> | null = (() => {
          if (rawCorrectAnswer == null) return null;
          if (Array.isArray(rawCorrectAnswer)) return { values: rawCorrectAnswer };
          if (typeof rawCorrectAnswer === "object") return rawCorrectAnswer as Record<string, unknown>;
          return { value: rawCorrectAnswer };
        })();
        return {
          client_id: f.id,
          page_id: typeof f.pageId === "number" ? f.pageId : (normalizedPages[0]?.id ?? 1),
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

  const normalizePayloadForSignature = (payload: NonNullable<ReturnType<typeof buildBuilderPayload>>) => {
    const pages = payload.pages.slice().sort((a, b) => {
      const indexDiff = (a.page_index ?? 0) - (b.page_index ?? 0);
      if (indexDiff !== 0) return indexDiff;
      return (a.page_id ?? 0) - (b.page_id ?? 0);
    });
    const elements = payload.elements.slice().sort((a, b) => {
      const pageDiff = (a.page_id ?? 0) - (b.page_id ?? 0);
      if (pageDiff !== 0) return pageDiff;
      const sortDiff = (a.sort_index ?? 0) - (b.sort_index ?? 0);
      if (sortDiff !== 0) return sortDiff;
      return String(a.client_id).localeCompare(String(b.client_id));
    });
    const conditions = payload.conditions.slice().sort((a, b) => {
      const sourceDiff = String(a.source_client_id).localeCompare(String(b.source_client_id));
      if (sourceDiff !== 0) return sourceDiff;
      const targetDiff = String(a.target_client_id).localeCompare(String(b.target_client_id));
      if (targetDiff !== 0) return targetDiff;
      const operatorDiff = String(a.operator).localeCompare(String(b.operator));
      if (operatorDiff !== 0) return operatorDiff;
      return JSON.stringify(a.value ?? {}).localeCompare(JSON.stringify(b.value ?? {}));
    });
    return { ...payload, pages, elements, conditions };
  };

  const buildPayloadSignature = useCallback(
    (
      overrides?: { accessMode?: FormAccessMode; startAt?: string | null; endAt?: string | null },
      sourceForm?: FormSchema | null
    ) => {
      const form = sourceForm ?? activeForm;
      if (!form) return null;
      const publishFields = resolvePublishFields(form);
      const payload = buildBuilderPayload(publishFields, overrides, form);
      if (!payload) return null;
      const normalizedPayload = normalizePayloadForSignature(payload);
      return JSON.stringify(sortForSignature(normalizedPayload));
    },
    [activeForm]
  );

  useEffect(() => {
    if (!activeForm) return;
    if (syncedPayloadSignatures[activeForm.id]) return;
    const signature = buildPayloadSignature({
      accessMode: activeForm.accessMode ?? "private",
      startAt: activeForm.startAt ?? null,
      endAt: activeForm.endAt ?? null,
    });
    if (!signature) return;
    setSyncedPayloadSignatures((prev) => {
      if (prev[activeForm.id]) return prev;
      return { ...prev, [activeForm.id]: signature };
    });
  }, [activeForm, syncedPayloadSignatures, buildPayloadSignature]);

  const syncedPayloadSignature = activeForm ? syncedPayloadSignatures[activeForm.id] ?? null : null;
  const savePayloadSignature = useMemo(() => {
    if (!activeForm) return null;
    return buildPayloadSignature({
      accessMode: activeForm.accessMode ?? "private",
      startAt: activeForm.startAt ?? null,
      endAt: activeForm.endAt ?? null,
    });
  }, [activeForm, buildPayloadSignature]);
  const hasSaveChanges = Boolean(!syncedPayloadSignature || (savePayloadSignature && savePayloadSignature !== syncedPayloadSignature));

  const activeFormStatus = activeForm?.status ?? "temp";
  const isPublishDisabledByStatus = activeFormStatus !== "temp";
  const isPublishDisabledByUnsavedChanges = hasSaveChanges;
  const isPublishDisabledByEmptyForm = fields.length === 0;
  const isPublishDisabled =
    isPublishDisabledByStatus || isPublishDisabledByUnsavedChanges || isPublishDisabledByEmptyForm || isPublishing;
  const publishDisabledHint = isPublishDisabledByUnsavedChanges
    ? t("builder.publishDisabledNeedSave")
    : isPublishDisabledByEmptyForm
      ? t("builder.publishDisabledNeedContent")
      : t("builder.publishDisabledNeedDraft");
  const publishedVersionsForActiveForm = useMemo(() => {
    if (!activeForm) return [] as FormSchema[];

    const byId = new Map(forms.map((item) => [item.id, item]));
    const childrenByPrevId = new Map<string, string[]>();
    for (const item of forms) {
      if (!item.prevFormId) continue;
      const prevId = String(item.prevFormId);
      const bucket = childrenByPrevId.get(prevId);
      if (bucket) {
        bucket.push(item.id);
      } else {
        childrenByPrevId.set(prevId, [item.id]);
      }
    }

    const queue: string[] = [activeForm.id];
    const relatedIds = new Set<string>();
    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId || relatedIds.has(currentId)) continue;
      relatedIds.add(currentId);

      const node = byId.get(currentId);
      const prevId = node?.prevFormId ? String(node.prevFormId) : null;
      if (prevId && !relatedIds.has(prevId)) {
        queue.push(prevId);
      }

      const children = childrenByPrevId.get(currentId) ?? [];
      for (const childId of children) {
        if (!relatedIds.has(childId)) {
          queue.push(childId);
        }
      }
    }

    return forms
      .filter((item) => relatedIds.has(item.id) && item.status === "submitted")
      .sort((a, b) => {
        const versionA = typeof a.version === "number" ? a.version : -1;
        const versionB = typeof b.version === "number" ? b.version : -1;
        if (versionA !== versionB) return versionB - versionA;
        const updatedA = typeof a.updatedAt === "number" ? a.updatedAt : 0;
        const updatedB = typeof b.updatedAt === "number" ? b.updatedAt : 0;
        return updatedB - updatedA;
      });
  }, [forms, activeForm]);
  const hasPublishedVersion = publishedVersionsForActiveForm.length > 0;
  const resultsTargetFormId = publishedVersionsForActiveForm[0]?.id ?? activeForm?.id ?? "";
  const isResultsDisabled = !hasPublishedVersion;
  const resultsDisabledHint = isResultsDisabled ? t("results.onlyPublishedShort") : undefined;
  const saveDisabledHint = !hasSaveChanges ? t("builder.saveDisabledNoChanges") : undefined;

  useEffect(() => {
    if (isPublishDisabled && isPublishOpen) {
      setIsPublishOpen(false);
    }
  }, [isPublishDisabled, isPublishOpen]);

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
    const savedSignature =
      buildPayloadSignature(
        {
          accessMode: saved.accessMode ?? "private",
          startAt: saved.startAt ?? null,
          endAt: saved.endAt ?? null,
        },
        saved
      ) ?? JSON.stringify(sortForSignature(payload));
    setSyncedPayloadSignatures((prev) => {
      const next = { ...prev, [saved.id]: savedSignature };
      if (saved.id !== activeForm.id && activeForm.id in next) {
        delete next[activeForm.id];
      }
      return next;
    });
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
      setActiveFormId(saved.id);
      setLocation(`/builder/${saved.id}`);
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
      allowRevoke: publishAccessMode === "unauthenticated" ? false : publishAllowRevoke,
      revokeCountsAsAttempt: publishAccessMode === "unauthenticated" ? false : (publishAllowRevoke ? publishRevokeCountsAsAttempt : false),
      attemptLimitType: publishAccessMode === "unauthenticated" ? "unlimited" : publishAttemptLimitType,
      attemptLimit: publishAccessMode === "unauthenticated" ? null : (publishAttemptLimitType === "limited" ? publishAttemptLimit : null),
    });
    if (!payload) return;
    const result = await publishForm(activeForm.id, payload);
    const resultSignature =
      buildPayloadSignature(
        {
          accessMode: result.accessMode ?? "private",
          startAt: result.startAt ?? null,
          endAt: result.endAt ?? null,
        },
        result
      ) ?? JSON.stringify(sortForSignature(payload));
    setSyncedPayloadSignatures((prev) => ({ ...prev, [result.id]: resultSignature }));
    return result;
  };

  const handleSave = async () => {
    if (!hasSaveChanges || isSaving) return;
    rememberCanvasScrollPosition();
    setIsSaving(true);
    try {
      await saveToServer();
    } catch (e: any) {
      pendingCanvasScrollTopRef.current = null;
      toast({ title: t("builder.error"), description: e.message ?? "Save error", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (isPublishDisabled) return;
    setIsPublishing(true);
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
    } finally {
      setIsPublishing(false);
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
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden min-h-0">
      {/* Navbar: grid РёР· 3 РєРѕР»РѕРЅРѕРє вЂ” Р»РѕРіРѕС‚РёРї+СЌР»РµРјРµРЅС‚С‹ | РІРєР»Р°РґРєРё | РґРµР№СЃС‚РІРёСЏ (РёР»Рё РјРµРЅСЋ РЅР° СѓР·РєРёС… СЌРєСЂР°РЅР°С…) */}
      <header className="h-19 border-b border-border bg-white grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3 sm:px-8 shrink-0 z-20 min-h-0">
        {/* Р›РµРІР°СЏ РєРѕР»РѕРЅРєР°: С‚РѕР»СЊРєРѕ Р»РѕРіРѕС‚РёРї Рё СЂР°Р·РґРµР»РёС‚РµР»СЊ */}
        <div className="flex items-center gap-2 shrink-0">
          <AppBrand href="/" onClick={() => setLocation('/')} className="shrink-0" />
          <div className="h-5 sm:h-6 w-px bg-border shrink-0 hidden sm:block" />
        </div>

        {/* Р¦РµРЅС‚СЂ: РІРєР»Р°РґРєРё С„РѕСЂРј вЂ” Р·Р°РЅРёРјР°РµС‚ РѕСЃС‚Р°РІС€РµРµСЃСЏ РјРµСЃС‚Рѕ, РїСЂРѕРєСЂСѓС‚РєР° РїРѕ РіРѕСЂРёР·РѕРЅС‚Р°Р»Рё */}
        <div className="min-w-0 overflow-x-auto no-scrollbar flex items-center">
          <div className="flex items-center gap-1 py-1">
            {tabForms.map(form => (
              <div
                key={form.id}
                onClick={() => {
                  setActiveFormId(form.id);
                  setLocation(`/builder/${form.id}`);
                }}
                className={cn(
                  "group flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors min-w-[80px] max-w-[140px] shrink-0",
                  activeFormId === form.id
                    ? "bg-secondary text-secondary-foreground font-medium dark:!bg-white/70 dark:!text-slate-950"
                    : "hover:bg-muted text-muted-foreground dark:text-slate-200 dark:hover:!bg-white/60 dark:hover:!text-slate-950"
                )}
              >
                <span className="truncate">{form.title || t("common.untitled")}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive shrink-0"
                  onClick={(e) => closeForm(e, form.id)}
                  title="Close form"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={addNewForm}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* РџСЂР°РІР°СЏ РєРѕР»РѕРЅРєР°: РЅР° СѓР·РєРёС… СЌРєСЂР°РЅР°С… вЂ” РєРЅРѕРїРєР° В«Р­Р»РµРјРµРЅС‚С‹В» + РјРµРЅСЋ В«Р•С‰С‘В», РЅР° Р±РѕР»СЊС€РёС… вЂ” РІСЃРµ РєРЅРѕРїРєРё */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 justify-end">
          {/* РљРЅРѕРїРєР° СЂР°СЃРєСЂС‹С‚РёСЏ РїР°РЅРµР»Рё СЌР»РµРјРµРЅС‚РѕРІ (С‚РѕР»СЊРєРѕ РЅР° СЌРєСЂР°РЅР°С… < md, РІ РѕРґРЅРѕРј СЂСЏРґСѓ СЃ РґРµР№СЃС‚РІРёСЏРјРё) */}
          <Sheet open={isToolboxSheetOpen} onOpenChange={setIsToolboxSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 md:hidden shrink-0 h-8 px-2 sm:px-2.5" aria-label={t("builder.toolbox")}>
                <PanelLeftOpen className="h-4 w-4" /> <span className="hidden sm:inline text-xs">{t("builder.toolbox")}</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0 flex flex-col">
              <SheetHeader className="px-4 pt-4 pb-2 border-b border-border">
                <SheetTitle>{t("builder.toolbox")}</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
                {Object.entries(groupedToolbox).map(([category, items]) => {
                  const CategoryIcon = CATEGORY_ICONS[category] ?? List;
                  const categoryLabel = t(`categories.${category}`);
                  return (
                    <div key={category} className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase flex items-center mb-3 pl-1 gap-2">
                        <CategoryIcon className="h-4 w-4 shrink-0" />
                        <span>{categoryLabel}</span>
                      </p>
                      {items.map((item) => (
                        <ToolboxItem
                          key={`${item.category}-${item.labelKey}`}
                          item={item}
                          label={t(`fields.${item.labelKey}`)}
                          icon={getIconForElement(item.widgetType, item.semanticType, item.props)}
                          collapsed={false}
                          onAddField={(it, label) => {
                            addField(it, label);
                            setIsToolboxSheetOpen(false);
                          }}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>

          {/* РќР° СЌРєСЂР°РЅР°С… < lg: РІС‹РїР°РґР°СЋС‰РµРµ РјРµРЅСЋ СЃ РґРµР№СЃС‚РІРёСЏРјРё */}
          <div className="flex items-center gap-1 lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" aria-label={t("actions.act")}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => {
                    const newLang = i18n.language.startsWith('ru') ? 'en' : 'ru';
                    if (activeForm) {
                      storage.saveForm(activeForm);
                      localStorage.setItem("etu_prefer_local_form_id", activeForm.id);
                    }
                    localStorage.setItem("etu_pending_lang", newLang);
                    window.location.reload();
                  }}
                >
                  <Languages className="mr-2 h-4 w-4" /> {i18n.language.startsWith('ru') ? 'EN' : 'RU'}
                </DropdownMenuItem>
                {(selectedIds.length > 0 || selectedPageIds.length > 0) && (
                  <DropdownMenuItem onClick={() => setIsPropertiesSheetOpen(true)}>
                    <SlidersHorizontal className="mr-2 h-4 w-4" /> {t("builder.properties")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => document.querySelector<HTMLButtonElement>('[data-testid="builder-preview-open"]')?.click()}>
                  <Eye className="mr-2 h-4 w-4" /> {t('builder.preview')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isResultsDisabled}
                  onClick={() => !isResultsDisabled && setLocation(`/forms/${resultsTargetFormId}/results`)}
                >
                  <BarChart3 className="mr-2 h-4 w-4" /> {t("results.openResults")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={!hasSaveChanges || isSaving} onClick={handleSave}>
                  <Save className="mr-2 h-4 w-4" /> {t('builder.save')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isPublishDisabled}
                  onClick={() => !isPublishDisabled && setIsPublishOpen(true)}
                >
                  <Share2 className="mr-2 h-4 w-4" /> {t("builder.publish")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {(selectedIds.length > 0 || selectedPageIds.length > 0) && (
              <Sheet open={isPropertiesSheetOpen} onOpenChange={setIsPropertiesSheetOpen}>
                <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col overflow-hidden">
                  <SheetHeader className="px-4 pt-4 pb-2 border-b border-border shrink-0">
                    <SheetTitle>{t("builder.properties")}</SheetTitle>
                  </SheetHeader>
                  <div className="flex-1 overflow-y-auto min-h-0">
                    <PropertiesPanel
                      key={selectedField?.id || selectedIds.join("-") || "none"}
                      pages={pages}
                      selectedPageIds={selectedPageIds}
                      onDeletePages={deletePages}
                      onTogglePageBack={togglePageBack}
                      selectedField={selectedField}
                      selectedIds={selectedIds}
                      updateField={updateField}
                      updateFields={updateFields}
                      deleteField={deleteField}
                      deleteSelected={deleteSelected}
                      fields={fields}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>

          {/* РќР° СЌРєСЂР°РЅР°С… lg+: РІСЃРµ РєРЅРѕРїРєРё РІ СЂСЏРґ */}
          <div className="hidden lg:flex items-center gap-1.5 flex-nowrap">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 h-9 px-2.5 dark:!bg-white/60 dark:hover:!bg-white/50 dark:!text-slate-950 dark:hover:!text-slate-950"
              onClick={() => {
                const newLang = i18n.language.startsWith('ru') ? 'en' : 'ru';
                if (activeForm) {
                  storage.saveForm(activeForm);
                  localStorage.setItem("etu_prefer_local_form_id", activeForm.id);
                }
                localStorage.setItem("etu_pending_lang", newLang);
                window.location.reload();
              }}
              title={i18n.language.startsWith('ru') ? 'English' : 'Р СѓСЃСЃРєРёР№'}
            >
              <Languages className="h-4 w-4" />
              <span className="text-sm font-medium">{i18n.language.startsWith('ru') ? 'RU' : 'EN'}</span>
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button data-testid="builder-preview-open" variant="outline" size="sm" className="gap-1.5 h-9 px-2.5">
                  <Eye className="h-4 w-4" /> <span>{t('builder.preview')}</span>
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="preview-dialog" className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{activeForm.title || t('common.untitled')}</DialogTitle>
                  {activeForm.description ? (
                    <DialogDescription>{activeForm.description}</DialogDescription>
                  ) : (
                    <DialogDescription className="sr-only">{t("builder.preview")}</DialogDescription>
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
              className="gap-1.5 h-9 px-2.5"
              disabled={isResultsDisabled}
              onClick={() => {
                if (isResultsDisabled) return;
                setLocation(`/forms/${resultsTargetFormId}/results`);
              }}
            >
              <BarChart3 className="h-4 w-4" /> <span>{t("results.openResults")}</span>
            </Button>
            <Button
              data-testid="builder-save"
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 px-2.5"
              onClick={handleSave}
              disabled={!hasSaveChanges || isSaving}
            >
              <Save className="h-4 w-4" /> <span>{t('builder.save')}</span>
            </Button>
            <Dialog open={isPublishOpen} onOpenChange={setIsPublishOpen}>
              {isPublishDisabled ? (
                <Button data-testid="builder-publish-open" size="sm" className="gap-1.5 h-9 px-2.5" disabled title={publishDisabledHint}>
                  <Share2 className="h-4 w-4" /> <span>{t("builder.publish")}</span>
                </Button>
              ) : (
                <Button
                  data-testid="builder-publish-open"
                  size="sm"
                  className="gap-1.5 h-9 px-2.5"
                  onClick={() => setIsPublishOpen(true)}
                >
                  <Share2 className="h-4 w-4" /> <span>{t("builder.publish")}</span>
                </Button>
              )}
              <DialogContent
                data-testid="builder-publish-popover"
                className="max-w-[min(480px,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto p-4 sm:p-6"
              >
                <DialogHeader className="space-y-1">
                  <DialogTitle className="text-sm font-semibold">{t("builder.publishTitle")}</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground ">{t("builder.publishHint")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
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
                      <DatePickerInput
                        value={publishStartDate ?? ""}
                        onChange={(next) => setPublishStartDate(next || null)}
                        disabled={publishNoStart}
                        locale={calendarLocale}
                        placeholder={t("propert.selectDate")}
                        inputClassName="h-10"
                        buttonClassName="!left-0 !top-0 !h-10 !w-10 !translate-y-0 hover:bg-transparent z-10"
                      />
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-10",
                              !publishStartTime && "text-foreground"
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
                      <DatePickerInput
                        value={publishEndDate ?? ""}
                        onChange={(next) => setPublishEndDate(next || null)}
                        disabled={publishNoEnd || publishNoStart}
                        locale={calendarLocale}
                        placeholder={t("propert.selectDate")}
                        inputClassName="h-10"
                        buttonClassName="!left-0 !top-0 !h-10 !w-10 !translate-y-0 hover:bg-transparent z-10"
                      />
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-10",
                              !publishEndTime && "text-foreground"
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

                  <div className={cn("space-y-4 pt-2 border-t border-border")}>
                    {publishAccessMode !== "unauthenticated" && (
                    <>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="publish-allow-revoke"
                          checked={publishAllowRevoke}
                          onCheckedChange={(checked) => setPublishAllowRevoke(Boolean(checked))}
                          simplifiedAnimation
                        />
                        <label
                          htmlFor="publish-allow-revoke"
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {t("results.allowRevoke")}
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground pl-6">
                        {t("results.allowRevokeHint")}
                      </p>
                    </div>

                    {publishAllowRevoke && (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="publish-revoke-counts"
                            checked={publishRevokeCountsAsAttempt}
                            onCheckedChange={(checked) => setPublishRevokeCountsAsAttempt(Boolean(checked))}
                            simplifiedAnimation
                          />
                          <label
                            htmlFor="publish-revoke-counts"
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {t("results.revokeCountsAsAttempt")}
                          </label>
                        </div>
                        <p className="text-xs text-muted-foreground pl-6">
                          {t("results.revokeCountsAsAttemptHint")}
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{t("results.attemptLimitType")}</Label>
                      <Select
                        value={publishAttemptLimitType}
                        onValueChange={(value) => {
                          setPublishAttemptLimitType(value as "unlimited" | "limited");
                          if (value === "limited") {
                            setPublishAttemptLimitInput(String(publishAttemptLimit));
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unlimited">{t("results.unlimitedAttempts")}</SelectItem>
                          <SelectItem value="limited">{t("results.limitedAttempts")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {publishAttemptLimitType === "limited" && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium" htmlFor="publish-attempt-limit">
                          {t("results.attemptLimit")}
                        </Label>
                        <Input
                          id="publish-attempt-limit"
                          type="number"
                          min={1}
                          max={9999}
                          value={publishAttemptLimitInput}
                          onKeyDown={(e) => {
                            if (["+", "-", ".", "e", "E"].includes(e.key)) e.preventDefault();
                          }}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, "");
                            if (raw === "") {
                              setPublishAttemptLimitInput("");
                              return;
                            }
                            const n = parseInt(raw, 10);
                            if (n > 9999) {
                              setPublishAttemptLimit(9999);
                              setPublishAttemptLimitInput("9999");
                            } else {
                              setPublishAttemptLimit(n);
                              setPublishAttemptLimitInput(raw);
                            }
                          }}
                          onBlur={() => {
                            const n = parseInt(publishAttemptLimitInput.trim(), 10);
                            if (Number.isNaN(n) || n < 1) {
                              setPublishAttemptLimit(1);
                              setPublishAttemptLimitInput("1");
                            } else if (n > 9999) {
                              setPublishAttemptLimit(9999);
                              setPublishAttemptLimitInput("9999");
                            } else {
                              setPublishAttemptLimit(n);
                              setPublishAttemptLimitInput(String(n));
                            }
                          }}
                          className="[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
                        />
                        <p className="text-xs text-muted-foreground">
                          {t("results.attemptLimitHint")}
                        </p>
                      </div>
                    )}
                    </>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setIsPublishOpen(false)}>
                      {t("actions.cancel")}
                    </Button>
                    <Button size="sm" onClick={handlePublish} disabled={isPublishDisabled}>
                      {t("builder.publish")}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Р‘РѕРєРѕРІР°СЏ РїР°РЅРµР»СЊ СЌР»РµРјРµРЅС‚РѕРІ: СЃРєСЂС‹С‚Р° РЅР° СѓР·РєРёС… СЌРєСЂР°РЅР°С… (< md), С‚Р°Рј РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ Sheet */}
        <div
          className={cn(
            "hidden md:flex border-r border-border bg-white flex-col shrink-0 z-10 overflow-hidden transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            isToolboxOpen ? "w-56 sm:w-64" : "w-14 sm:w-24"
          )}
        >
          <div className="border-b border-border">
            <div className="h-[52px] px-6 flex items-center">
              <div className={cn("flex w-full items-center", isToolboxOpen ? "justify-start gap-2" : "justify-start")}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 bg-transparent hover:bg-transparent dark:!bg-transparent dark:hover:!bg-transparent"
                  onClick={() => setIsToolboxOpen(!isToolboxOpen)}
                  title={isToolboxOpen ? t("builder.collapseToolbox") : t("builder.expandToolbox")}
                  aria-label={isToolboxOpen ? t("builder.collapseToolbox") : t("builder.expandToolbox")}
                >
                  {isToolboxOpen ? (
                    <PanelLeftClose className="h-4 w-4 text-muted-foreground dark:!text-white" />
                  ) : (
                    <PanelLeftOpen className="h-4 w-4 text-muted-foreground dark:!text-white" />
                  )}
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
                    className="text-xs font-medium text-muted-foreground uppercase flex items-center mb-3 pl-5 gap-2 dark:text-slate-200"
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

        <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        <FormCanvas
          key={activeForm.id}
          scrollContainerRef={canvasScrollRef}
          form={activeForm}
          setForm={setForm}
          pages={pages}
          activePageId={activePageId ?? pages[0]?.id ?? 1}
          onSelectPage={handleSelectPage}
          onAddPage={addPage}
          onMovePage={movePageToIndex}
          selectedPageIds={selectedPageIds}
          selectedIds={selectedIds}
          moveSelected={moveSelected}
          moveSelectedPages={moveSelectedPages}
          onSelectField={handleSelectField}
          clearSelection={clearSelection}
          updateField={updateField}
          onUndo={undoLast}
          onRedo={redoLast}
          canUndo={history.length > 0}
          canRedo={redoHistory.length > 0}
          fields={fields}
        />
        </div>

        {/* РџР°РЅРµР»СЊ СЃРІРѕР№СЃС‚РІ: СЃРєСЂС‹С‚Р° РЅР° СѓР·РєРёС… СЌРєСЂР°РЅР°С… (< lg), С‚Р°Рј РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ Sheet */}
        <div className="hidden lg:flex w-80 border-l border-border bg-white flex-col shrink-0 z-10 overflow-hidden">
          <PropertiesPanel
            key={selectedField?.id || selectedIds.join("-") || 'none'}
            pages={pages}
            selectedPageIds={selectedPageIds}
            onDeletePages={deletePages}
            onTogglePageBack={togglePageBack}
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

