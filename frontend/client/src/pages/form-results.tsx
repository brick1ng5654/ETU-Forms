import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { format, formatDistanceToNow } from "date-fns";
import type { Locale } from "date-fns";
import { enUS, ru } from "date-fns/locale";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  Clock,
  Copy,
  FileText,
  Languages,
  Link as LinkIcon,
  PencilLine,
  Search,
  User,
  Users,
} from "lucide-react";
import type {
  AnswersById,
  DateTimeAnswer,
  ElementAttachment,
  FormAccessMode,
  FormElementModel,
  FormSchema,
} from "@/form/types";
import {
  getChoiceMultiState,
  getChoiceSingleState,
  isChoiceAnswer,
} from "@/form/choice-answer";
import { fetchFormDetail, fetchFormResponses, fetchForms, fetchFormsCatalog, saveFormInPlace } from "@/lib/forms-api";
import { storage } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { formatScoreRange } from "@/lib/points-label";
import FormPreview from "@/components/form-builder/FormPreview";
import { ElementAttachments } from "@/components/form-builder/ElementAttachments";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { AppBrand } from "@/components/app-brand";
import { CustomLoader } from "@/components/ui/custom-loader";
import { FormAccessDialog } from "@/components/form-access-dialog";

type ResponseEntry = {
  id: string;
  formId: string;
  userId: number;
  name: string;
  status: "draft" | "submitted" | "cancelled";
  submittedAt: string;
  durationMinutes: number;
  answers: AnswersById;
  version: number;
};

type SummaryMetric = {
  label: string;
  value: string;
};

type SummaryRow = {
  id: string;
  label: string;
  metrics: SummaryMetric[];
};

type Selection =
  | { type: "source" }
  | { type: "summary" }
  | { type: "response"; responseId: string };

type ResponseSortField = "name" | "duration" | "time" | "score";
type SortDirection = "asc" | "desc";

type PublishCondition = {
  source_client_id: string;
  target_client_id: string;
  operator: "equals" | "not_equals" | "in" | "not_in" | "greater_than" | "less_than" | "contains" | "answered";
  value: Record<string, unknown> | null;
};

type FormBuilderPayload = {
  title: string;
  description?: string | null;
  settings_json?: Record<string, unknown> | null;
  start_at?: string | null;
  end_at?: string | null;
  access_mode?: FormAccessMode | null;
  pages: { page_id: number; page_index: number; allow_back: boolean }[];
  elements: {
    client_id: string;
    page_id: number;
    widget: string;
    semantic?: string | null;
    label: string;
    description?: string | null;
    required_field: boolean;
    correct_answer?: Record<string, unknown> | null;
    text_hint?: string | null;
    supportive_text?: string | null;
    other_settings?: Record<string, unknown> | null;
    file_ids: number[];
    sort_index: number;
  }[];
  conditions: PublishCondition[];
};

const getDateInputValue = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return format(parsed, "yyyy-MM-dd");
};

const parseServerDate = (value?: string | null): Date => {
  if (!value) return new Date(Number.NaN);
  const raw = value.trim();
  if (!raw) return new Date(Number.NaN);
  const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(raw);
  return new Date(hasTimezone ? raw : `${raw}Z`);
};

const toTimestampSafe = (value?: string | null): number => parseServerDate(value).getTime();

const toIsoDate = (value: string, fallbackTime: string) => {
  if (!value) return null;
  return new Date(`${value}T${fallbackTime}`).toISOString();
};

const isValidDateString = (value: string) => {
  if (value.length !== 10) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return false;
  if (month < 1 || month > 12) return false;
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
};

const parseDateFromString = (value: string) => {
  if (!isValidDateString(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const getStableDate = (value: string) => parseDateFromString(value);

const createPrivateLinkKey = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  const random = Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}${random}`;
};

const formatDuration = (minutes: number, useRussianUnits = false) => {
  if (!Number.isFinite(minutes)) return useRussianUnits ? "0м 00с" : "0m 00s";
  const totalSeconds = Math.max(0, Math.round(minutes * 60));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const minuteUnit = useRussianUnits ? "м" : "m";
  const secondUnit = useRussianUnits ? "с" : "s";
  return `${mins}${minuteUnit} ${secs.toString().padStart(2, "0")}${secondUnit}`;
};

const getLinkViews = (form: FormSchema | null | undefined): number => {
  const raw = form?.settings_json && typeof form.settings_json === "object"
    ? (form.settings_json as Record<string, unknown>).linkViews
    : undefined;
  const value = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("") || "U";

const getMatrixLabels = (field: FormElementModel) => {
  const props = field.props as Record<string, unknown>;
  const rows = Array.isArray(props.rows) ? props.rows.map((row) => String(row)) : [];
  const columns = Array.isArray(props.columns) ? props.columns.map((col) => String(col)) : [];
  return { rows, columns };
};

const formatMatrixCell = (field: FormElementModel, key: string) => {
  const { rows, columns } = getMatrixLabels(field);
  const [rowIdx, colIdx] = key.split(":").map((val) => Number(val));
  const rowLabel = rows[rowIdx - 1] || `Row ${rowIdx}`;
  const colLabel = columns[colIdx - 1] || `Column ${colIdx}`;
  return `${rowLabel} / ${colLabel}`;
};

const mapWidgetTypeForPublish = (widgetType: FormElementModel["widgetType"]) => {
  if (widgetType === "header") return "heading";
  if (widgetType === "textarea") return "text_input";
  return widgetType;
};

const extractConditionsFromFields = (publishFields: FormElementModel[]): PublishCondition[] => {
  const out: PublishCondition[] = [];

  for (const target of publishFields) {
    const logic = (target.props as any)?.conditionalLogic as
      | { dependsOn?: string; condition?: "equals" | "not_equals" | "answered"; expectedValue?: string | string[] }
      | undefined;
    if (!logic?.dependsOn || !logic.condition) continue;

    let operator: PublishCondition["operator"] | null = null;
    let value: Record<string, unknown> | null = null;

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

const buildFormPayload = (
  form: FormSchema,
  overrides?: {
    accessMode?: FormAccessMode;
    startAt?: string | null;
    endAt?: string | null;
    settingsJson?: Record<string, unknown> | null;
  }
): FormBuilderPayload => {
  const accessMode = overrides?.accessMode ?? form.accessMode ?? "private";
  const startAt = overrides?.startAt ?? form.startAt ?? null;
  const endAt = overrides?.endAt ?? form.endAt ?? null;
  const settingsJson = overrides?.settingsJson ?? form.settings_json ?? { client_form_id: form.id };

  return {
    title: form.title,
    description: form.description,
    access_mode: accessMode,
    start_at: startAt,
    end_at: endAt,
    settings_json: settingsJson,
    pages: (form.pages ?? []).map((p) => ({
      page_id: p.id,
      page_index: p.pageIndex ?? 0,
      allow_back: p.allowBack ?? true,
    })),
    elements: form.fields.map((field, index) => {
      const props = (field.props ?? {}) as Record<string, unknown>;
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
      const isEmailField = field.semanticType === "email" || inputType === "email";
      if (isEmailField) {
        delete cleanedOtherSettings.multiline;
      }
      if (field.semanticType === "passport") {
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
          cleanedOtherSettings[key] = Boolean((field.props as Record<string, unknown> | undefined)?.[key]);
        }
      }
      const rawCorrectAnswer = correctAnswer ?? correctAnswers;
      const normalizedCorrectAnswer = (() => {
        if (rawCorrectAnswer == null) return null;
        if (Array.isArray(rawCorrectAnswer)) return { values: rawCorrectAnswer };
        if (typeof rawCorrectAnswer === "object") return rawCorrectAnswer as Record<string, unknown>;
        return { value: rawCorrectAnswer };
      })();

      return {
        client_id: field.id,
        page_id: field.pageId ?? (form.pages?.[0]?.id ?? 1),
        widget: mapWidgetTypeForPublish(field.widgetType),
        semantic: field.semanticType ?? null,
        label: field.label,
        description: field.description ?? null,
        supportive_text: field.description ?? null,
        text_hint: typeof placeholder === "string" ? placeholder : null,
        correct_answer: normalizedCorrectAnswer,
        required_field: !!field.required,
        other_settings: cleanedOtherSettings,
        file_ids: fileIds,
        sort_index: typeof field.sortIndex === "number" ? field.sortIndex : index,
      };
    }),
    conditions: extractConditionsFromFields(form.fields),
  };
};

const getCorrectAnswerValues = (field: FormElementModel): string[] => {
  const props = field.props as Record<string, unknown>;
  const raw = props.correctAnswers ?? props.correctAnswer;
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(String);
  return [String(raw)];
};

const normalizeAnswerValues = (field: FormElementModel, value: AnswersById[string]): string[] => {
  if (value == null) return [];
  if (field.widgetType === "checkbox") {
    const state = getChoiceMultiState(value);
    const values = [...state.selected];
    if (state.otherSelected) {
      const otherText = state.otherText.trim();
      values.push(otherText ? `Other: ${otherText}` : "Other");
    }
    return values;
  }
  if (field.widgetType === "select" || field.widgetType === "radio") {
    const state = getChoiceSingleState(value);
    if (state.otherSelected) {
      const otherText = state.otherText.trim();
      return otherText ? [`Other: ${otherText}`] : ["Other"];
    }
    return state.selected ? [state.selected] : [];
  }
  if (Array.isArray(value)) return value.map(String);
  if (field.widgetType === "datetime" && typeof value === "object") {
    const dateTime = value as DateTimeAnswer;
    const combined = `${dateTime?.date ?? ""} ${dateTime?.time ?? ""}`.trim();
    return combined ? [combined] : [];
  }
  return [String(value)];
};

const isCorrectAnswer = (
  field: FormElementModel,
  value: AnswersById[string],
  correctValues: string[]
): boolean => {
  if (correctValues.length === 0) return false;
  const answerValues = normalizeAnswerValues(field, value);
  if (answerValues.length === 0) return false;

  if (field.widgetType === "checkbox" || field.widgetType === "matrix") {
    const sortedAnswer = [...answerValues].sort();
    const sortedCorrect = [...correctValues].sort();
    return (
      sortedAnswer.length === sortedCorrect.length &&
      sortedAnswer.every((item, index) => item === sortedCorrect[index])
    );
  }

  if (field.widgetType === "ranking") {
    return (
      answerValues.length === correctValues.length &&
      answerValues.every((item, index) => item === correctValues[index])
    );
  }

  return correctValues.includes(answerValues[0]);
};

const getFieldPoints = (field: FormElementModel) => {
  const props = field.props as Record<string, unknown>;
  const points = Number(props.points);
  return Number.isFinite(points) && points > 0 ? points : 1;
};

const calculateMaxScore = (fields: FormElementModel[]) =>
  fields.reduce((sum, field) => {
    const correctValues = getCorrectAnswerValues(field);
    if (correctValues.length === 0) return sum;
    return sum + getFieldPoints(field);
  }, 0);

const calculateResponseScore = (fields: FormElementModel[], answers: AnswersById) =>
  fields.reduce((sum, field) => {
    const correctValues = getCorrectAnswerValues(field);
    if (correctValues.length === 0) return sum;
    const isCorrect = isCorrectAnswer(field, answers[field.id], correctValues);
    return sum + (isCorrect ? getFieldPoints(field) : 0);
  }, 0);

const calculateMedian = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
};

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  title: string;
  locale?: Locale;
};

const formatDateDisplay = (yyyyMmDd: string) => {
  if (!yyyyMmDd || yyyyMmDd.length !== 10) return "";
  const [y, m, d] = yyyyMmDd.split("-");
  return `${d}.${m}.${y}`;
};

const DateField = ({ label, value, onChange, title, locale }: DateFieldProps) => {
  const { t } = useTranslation();
  const [month, setMonth] = useState<Date>(() => getStableDate(value) ?? new Date());
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    const parsed = getStableDate(value);
    if (parsed) {
      setMonth(parsed);
    }
  }, [value]);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <div className="relative">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8"
              title={title}
            >
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" portalled={false}>
            <Calendar
              mode="single"
              selected={getStableDate(value)}
              month={month}
              onMonthChange={setMonth}
              onSelect={(date) => {
                if (!date) {
                  onChange("");
                  setPopoverOpen(false);
                  return;
                }
                setMonth(date);
                onChange(format(date, "yyyy-MM-dd"));
                setPopoverOpen(false);
              }}
              locale={locale}
            />
          </PopoverContent>
        </Popover>
        <Input
          type="text"
          readOnly
          value={value ? formatDateDisplay(value) : ""}
          placeholder={t("propert.dateFormatPlaceholder")}
          onClick={() => setPopoverOpen(true)}
          className="pl-10 cursor-pointer"
        />
      </div>
    </div>
  );
};
const formatAnswerValue = (
  field: FormElementModel,
  value: AnswersById[string],
  t: (key: string, options?: Record<string, unknown>) => string
): ReactNode => {
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
    return <span className="text-muted-foreground">{t("results.noAnswer")}</span>;
  }

  if (field.widgetType === "checkbox" && (Array.isArray(value) || isChoiceAnswer(value))) {
    const state = getChoiceMultiState(value);
    const items = [...state.selected];
    const otherText = state.otherText.trim();
    if (state.otherSelected && otherText.length > 0) {
      items.push(`${t("common.otherOption")}: ${otherText}`);
    }
    if (items.length === 0) {
      return <span className="text-muted-foreground">{t("results.noAnswer")}</span>;
    }
    return (
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={String(item)} variant="secondary">
            {String(item)}
          </Badge>
        ))}
      </div>
    );
  }

  if (field.widgetType === "ranking" && Array.isArray(value)) {
    return (
      <div className="space-y-2">
        {value.map((item, idx) => (
          <div key={String(item)} className="flex items-center gap-2 text-sm">
            <Badge variant="outline">{idx + 1}</Badge>
            <span>{String(item)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (field.widgetType === "matrix" && Array.isArray(value)) {
    return (
      <div className="space-y-2">
        {value.map((cell) => (
          <div key={String(cell)} className="text-sm text-muted-foreground">
            {formatMatrixCell(field, String(cell))}
          </div>
        ))}
      </div>
    );
  }

  if (field.widgetType === "file_upload" && Array.isArray(value)) {
    const files = (value as ElementAttachment[]).filter(
      (file) => file && typeof file === "object" && Number.isFinite(Number(file.file_id))
    );
    if (files.length === 0) {
      return <span className="text-muted-foreground">{t("results.noAnswer")}</span>;
    }
    return (
      <ElementAttachments attachments={files} displayMode="list" listOnly className="pt-0" />
    );
  }

  if (field.widgetType === "datetime") {
    const dateTime = value as DateTimeAnswer;
    const date = dateTime?.date ?? "";
    const time = dateTime?.time ?? "";
    return <span>{[date, time].filter(Boolean).join(" ")}</span>;
  }

  if ((field.widgetType === "select" || field.widgetType === "radio") && isChoiceAnswer(value)) {
    const state = getChoiceSingleState(value);
    if (state.otherSelected) {
      const otherText = state.otherText.trim();
      return otherText
        ? <span>{`${t("common.otherOption")}: ${otherText}`}</span>
        : <span className="text-muted-foreground">{t("results.noAnswer")}</span>;
    }
    return state.selected
      ? <span>{state.selected}</span>
      : <span className="text-muted-foreground">{t("results.noAnswer")}</span>;
  }

  if (typeof value === "object") {
    return <span>{JSON.stringify(value)}</span>;
  }

  return <span>{String(value)}</span>;
};

export default function FormResults({ params }: { params: { id: string } }) {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<FormSchema | null>(null);
  const [versions, setVersions] = useState<FormSchema[]>([]);
  const [versionDetailsById, setVersionDetailsById] = useState<Record<string, FormSchema>>({});
  const [activeVersionId, setActiveVersionId] = useState(params.id);
  const [isLoading, setIsLoading] = useState(true);
  const [responses, setResponses] = useState<ResponseEntry[]>([]);
  const [selection, setSelection] = useState<Selection>({ type: "source" });
  const [searchQuery, setSearchQuery] = useState("");
  const [responsesSortField, setResponsesSortField] = useState<ResponseSortField>("time");
  const [responsesSortDirection, setResponsesSortDirection] = useState<SortDirection>("desc");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [accessMode, setAccessMode] = useState<FormAccessMode>("private");
  const [privateLinkKey, setPrivateLinkKey] = useState("");
  const [allowRevoke, setAllowRevoke] = useState(false);
  const [attemptLimitType, setAttemptLimitType] = useState<"unlimited" | "limited">("unlimited");
  const [attemptLimit, setAttemptLimit] = useState<number>(1);
  const [attemptLimitInput, setAttemptLimitInput] = useState("1");
  const [revokeCountsAsAttempt, setRevokeCountsAsAttempt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const isRussianLocale = i18n.language.startsWith("ru");
  const canEditCurrentForm = form?.canEdit === true;

  useEffect(() => {
    setActiveVersionId(params.id);
  }, [params.id]);

  useEffect(() => {
    if (versions.length === 0) return;
    if (versions.some((item) => item.id === activeVersionId)) return;
    setActiveVersionId(versions[versions.length - 1].id);
  }, [activeVersionId, versions]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setResponses([]);
    (async () => {
      try {
        const current = await fetchFormDetail(params.id);
        if (!active) return;

        const summaries = await fetchFormsCatalog().catch(async () => {
          return await fetchForms().catch(() => [current]);
        });
        const formsById = new Map<string, FormSchema>(summaries.map((item) => [item.id, item]));
        const currentSummary = formsById.get(current.id);
        const currentWithPermissions: FormSchema = {
          ...current,
          ownerName: current.ownerName ?? currentSummary?.ownerName,
          canEdit: typeof current.canEdit === "boolean" ? current.canEdit : currentSummary?.canEdit,
          canViewResponses:
            typeof current.canViewResponses === "boolean"
              ? current.canViewResponses
              : currentSummary?.canViewResponses,
          canContinuePassage:
            typeof current.canContinuePassage === "boolean"
              ? current.canContinuePassage
              : currentSummary?.canContinuePassage,
        };
        setForm(currentWithPermissions);
        formsById.set(current.id, currentWithPermissions);

        let rootId = current.id;
        const guard = new Set<string>();
        while (!guard.has(rootId)) {
          guard.add(rootId);
          const node = formsById.get(rootId);
          if (!node?.prevFormId) break;
          if (!formsById.has(node.prevFormId)) break;
          rootId = node.prevFormId;
        }

        const childrenById = new Map<string, string[]>();
        formsById.forEach((item) => {
          if (!item.prevFormId) return;
          const prev = String(item.prevFormId);
          childrenById.set(prev, [...(childrenById.get(prev) ?? []), item.id]);
        });

        const lineageIds: string[] = [];
        const stack = [rootId];
        const visited = new Set<string>();
        while (stack.length > 0) {
          const id = stack.pop()!;
          if (visited.has(id)) continue;
          visited.add(id);
          lineageIds.push(id);
          (childrenById.get(id) ?? []).forEach((child) => stack.push(child));
        }

        const lineage = lineageIds
          .map((id) => formsById.get(id))
          .filter((item): item is FormSchema => Boolean(item))
          .filter((item) => item.status === "submitted")
          .sort((a, b) => {
            const av = a.version ?? 0;
            const bv = b.version ?? 0;
            if (av !== bv) return av - bv;
            return a.updatedAt - b.updatedAt;
          });

        const detailsEntries = await Promise.all(
          lineage.map(async (item) => {
            try {
              const detail = await fetchFormDetail(item.id);
              return [item.id, detail] as const;
            } catch {
              return [item.id, item] as const;
            }
          })
        );

        if (!active) return;
        setVersions(lineage);
        setVersionDetailsById(Object.fromEntries(detailsEntries));

        const fetchedResponses = await Promise.all(
          lineage.map(async (item) => {
            try {
              return await fetchFormResponses(item.id);
            } catch {
              return [];
            }
          })
        );

        if (!active) return;
        const responseEntries = fetchedResponses
          .flat()
          .map<ResponseEntry>((response) => {
            const createdAtMs = toTimestampSafe(response.createdAt);
            const completedAtMs = toTimestampSafe(response.completedAt ?? undefined);
            const durationMinutes = Number.isFinite(createdAtMs) && Number.isFinite(completedAtMs)
              ? Math.max(0, (completedAtMs - createdAtMs) / 60000)
              : 0;
            return {
              id: String(response.responseId),
              formId: response.formId,
              userId: response.userId,
              name: response.responderName,
              status: response.status,
              submittedAt: response.completedAt ?? response.createdAt,
              durationMinutes,
              answers: response.answers,
              version: response.version,
            };
          })
          .sort((a, b) => toTimestampSafe(b.submittedAt) - toTimestampSafe(a.submittedAt));

        setResponses(responseEntries);
      } catch {
        if (!active) return;
        const local = storage.getForms().find((item) => item.id === params.id) ?? null;
        setForm(local);
        setVersions(local ? [local] : []);
        setVersionDetailsById(local ? { [local.id]: local } : {});
        setResponses([]);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [params.id]);

  useEffect(() => {
    if (!form) return;
    setStartAt(getDateInputValue(form.startAt));
    setEndAt(getDateInputValue(form.endAt));
    setAccessMode(form.accessMode ?? "private");
    const savedKey = typeof form.settings_json?.privateLinkKey === "string"
      ? form.settings_json.privateLinkKey
      : "";
    setPrivateLinkKey(savedKey || createPrivateLinkKey());
    
    // Инициализация настроек попыток
    const settings = form.settings_json ?? {};
    setAllowRevoke(Boolean(settings.allowRevoke));
    setAttemptLimitType(
      settings.attemptLimitType === "limited" ? "limited" : "unlimited"
    );
    const limit = typeof settings.attemptLimit === "number" && settings.attemptLimit > 0
      ? settings.attemptLimit
      : 1;
    setAttemptLimit(limit);
    if (settings.attemptLimitType === "limited") {
      setAttemptLimitInput(String(limit));
    }
    setRevokeCountsAsAttempt(Boolean(settings.revokeCountsAsAttempt));
  }, [form]);

  const activeVersionForm = useMemo(
    () => versionDetailsById[activeVersionId] ?? versions.find((item) => item.id === activeVersionId) ?? form,
    [activeVersionId, form, versionDetailsById, versions]
  );
  const responsesForVersion = useMemo(
    () => responses.filter((response) => response.formId === activeVersionId),
    [activeVersionId, responses]
  );
  const attemptNumberByResponseId = useMemo(() => {
    const map = new Map<string, number>();
    const byFormUser = new Map<string, ResponseEntry[]>();
    for (const r of responses) {
      const key = `${r.formId}:${r.userId}`;
      const list = byFormUser.get(key) ?? [];
      list.push(r);
      byFormUser.set(key, list);
    }
    byFormUser.forEach((list) => {
      const sorted = [...list].sort(
        (a, b) => toTimestampSafe(a.submittedAt) - toTimestampSafe(b.submittedAt)
      );
      sorted.forEach((r, i) => map.set(r.id, i + 1));
    });
    return map;
  }, [responses]);
  const sortFieldsByPage = (schema: FormSchema): FormElementModel[] => {
    const pages = schema.pages ?? [];
    const pageIndexById = new Map<number, number>(
      pages.map((page) => [Number(page.id), Number(page.pageIndex ?? 0)])
    );
    return (schema.fields ?? [])
      .filter((field) => field.widgetType !== "header")
      .slice()
      .sort((a, b) => {
        const pageA = pageIndexById.get(Number(a.pageId)) ?? Number.MAX_SAFE_INTEGER;
        const pageB = pageIndexById.get(Number(b.pageId)) ?? Number.MAX_SAFE_INTEGER;
        if (pageA !== pageB) return pageA - pageB;
        return (a.sortIndex ?? 0) - (b.sortIndex ?? 0);
      });
  };

  const answerableFieldsByFormId = useMemo(() => {
    const mapped = new Map<string, FormElementModel[]>();
    const put = (schema: FormSchema | null | undefined) => {
      if (!schema) return;
      mapped.set(schema.id, sortFieldsByPage(schema));
    };

    put(form);
    versions.forEach(put);
    Object.values(versionDetailsById).forEach(put);
    return mapped;
  }, [form, versionDetailsById, versions]);

  const responseScoreById = useMemo(() => {
    const scoreMap = new Map<string, number>();
    responses.forEach((response) => {
      const fields = answerableFieldsByFormId.get(response.formId) ?? [];
      scoreMap.set(response.id, calculateResponseScore(fields, response.answers));
    });
    return scoreMap;
  }, [answerableFieldsByFormId, responses]);

  const filteredResponses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const searched = query
      ? responses.filter((response) => response.name.toLowerCase().includes(query))
      : responses;
    const collator = new Intl.Collator(isRussianLocale ? "ru" : "en", { sensitivity: "base" });

    const directionFactor = responsesSortDirection === "asc" ? 1 : -1;
    return [...searched].sort((a, b) => {
      let comparison = 0;
      switch (responsesSortField) {
        case "name":
          comparison = collator.compare(a.name, b.name);
          break;
        case "time":
          comparison = toTimestampSafe(a.submittedAt) - toTimestampSafe(b.submittedAt);
          break;
        case "duration":
          comparison = a.durationMinutes - b.durationMinutes;
          break;
        case "score":
          comparison = (responseScoreById.get(a.id) ?? 0) - (responseScoreById.get(b.id) ?? 0);
          break;
        default:
          comparison = 0;
      }
      return comparison * directionFactor;
    });
  }, [
    isRussianLocale,
    responses,
    responsesSortDirection,
    responsesSortField,
    responseScoreById,
    searchQuery,
  ]);

  const answerableFields = useMemo(
    () => (activeVersionForm ? sortFieldsByPage(activeVersionForm) : []),
    [activeVersionForm]
  );

  const summaryRows = useMemo<SummaryRow[]>(() => {
    if (!activeVersionForm || responsesForVersion.length === 0) return [];

    const numericMedian = (values: number[]) => {
      if (values.length === 0) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    };

    const mostFrequent = (values: string[]) => {
      const counts = new Map<string, number>();
      values.forEach((value) => {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      });
      let winner = "";
      let max = 0;
      counts.forEach((count, value) => {
        if (count > max) {
          winner = value;
          max = count;
        }
      });
      return { value: winner, count: max };
    };

    return answerableFields.map((field) => {
      const values = responsesForVersion
        .map((response) => response.answers[field.id])
        .filter((value) => value !== undefined && value !== null);

      if (field.widgetType === "number_input" || field.widgetType === "rating" || field.widgetType === "file_upload") {
        const numbers = values
          .map((value) => {
            if (field.widgetType === "file_upload" && Array.isArray(value)) {
              return value.length;
            }
            return typeof value === "number" ? value : Number(value);
          })
          .filter((val) => Number.isFinite(val));
        const average = numbers.length ? numbers.reduce((sum, val) => sum + val, 0) / numbers.length : 0;
        const median = numericMedian(numbers);
        return {
          id: field.id,
          label: field.label,
          metrics: [
            { label: t("results.average"), value: average.toFixed(1) },
            { label: t("results.median"), value: median.toFixed(1) },
          ],
        };
      }

      const flatValues = values.flatMap((value) => normalizeAnswerValues(field, value));

      if (field.widgetType === "matrix") {
        const normalized = flatValues.map((value) => formatMatrixCell(field, value));
        const { value, count } = mostFrequent(normalized);
        return {
          id: field.id,
          label: field.label,
          metrics: [
            {
              label: t("results.mostFrequent"),
              value: value ? `${value} (${count})` : t("results.noResponses"),
            },
          ],
        };
      }

      const { value, count } = mostFrequent(flatValues);
      return {
        id: field.id,
        label: field.label,
        metrics: [
          {
            label: t("results.mostFrequent"),
            value: value ? `${value} (${count})` : t("results.noResponses"),
          },
        ],
      };
    });
  }, [activeVersionForm, answerableFields, responsesForVersion, t]);

  const activeResponse = useMemo(() => {
    if (selection.type !== "response") return null;
    return responses.find((response) => response.id === selection.responseId) ?? null;
  }, [responses, selection]);

  const stats = useMemo(() => {
    const totalViews = getLinkViews(activeVersionForm);
    const completed = responsesForVersion.length;
    const durationValues = responsesForVersion.map((item) => item.durationMinutes);
    const avgMinutes = durationValues.length
      ? durationValues.reduce((sum, value) => sum + value, 0) / durationValues.length
      : 0;
    const medianMinutes = calculateMedian(durationValues);
    return {
      totalViews,
      completed,
      avgTime: formatDuration(avgMinutes, isRussianLocale),
      medianTime: formatDuration(medianMinutes, isRussianLocale),
    };
  }, [activeVersionForm, isRussianLocale, responsesForVersion]);

  const scoreStats = useMemo(() => {
    const maxScore = calculateMaxScore(answerableFields);
    if (maxScore <= 0) {
      return {
        hasScore: false,
        hasScoredQuestions: false,
        hasResponses: responsesForVersion.length > 0,
        avgScore: 0,
        medianScore: 0,
        maxScore: 0,
      };
    }
    if (responsesForVersion.length === 0) {
      return {
        hasScore: false,
        hasScoredQuestions: true,
        hasResponses: false,
        avgScore: 0,
        medianScore: 0,
        maxScore,
      };
    }
    const scoreValues = responsesForVersion.map((response) =>
      calculateResponseScore(answerableFields, response.answers)
    );
    const totalScore = scoreValues.reduce((sum, value) => sum + value, 0);
    return {
      hasScore: true,
      hasScoredQuestions: true,
      hasResponses: true,
      avgScore: totalScore / responsesForVersion.length,
      medianScore: calculateMedian(scoreValues),
      maxScore,
    };
  }, [answerableFields, responsesForVersion]);

  const scoreFallbackLabel = scoreStats.hasScoredQuestions && !scoreStats.hasResponses
    ? t("results.noResponses")
    : t("results.noScore");

  const activeResponseScore = useMemo(() => {
    if (!activeResponse) return null;
    const fields = answerableFieldsByFormId.get(activeResponse.formId) ?? answerableFields;
    const maxScore = calculateMaxScore(fields);
    if (maxScore <= 0) return null;
    return {
      score: calculateResponseScore(fields, activeResponse.answers),
      maxScore,
    };
  }, [activeResponse, answerableFields, answerableFieldsByFormId]);

  const activeVersionLabel = activeVersionForm
    ? t("results.version", { version: activeVersionForm.version ?? 1 })
    : "";

  const selectionTitle = (() => {
    if (selection.type === "source") return t("results.originalForm");
    if (selection.type === "summary") return t("results.summary");
    return t("results.response");
  })();

  const selectionSubtitle = (() => {
    if (selection.type === "source") {
      return [activeVersionLabel, t("results.readOnlyHint")].filter(Boolean).join(" | ");
    }
    if (selection.type === "summary") {
      return [activeVersionLabel, t("results.summaryHint")].filter(Boolean).join(" | ");
    }
    if (!activeResponse) return "";
    const locale: Locale = i18n.language.startsWith("ru") ? ru : enUS;
    const attemptNum = attemptNumberByResponseId.get(activeResponse.id);
    return [
      attemptNum != null ? t("results.attemptNumber", { number: attemptNum }) : null,
      t("results.version", { version: activeResponse.version }),
      t("results.submitted", {
        time: formatDistanceToNow(parseServerDate(activeResponse.submittedAt), { addSuffix: true, locale }),
      }),
      t("results.duration", { time: formatDuration(activeResponse.durationMinutes, isRussianLocale) }),
    ]
      .filter(Boolean)
      .join(" | ");
  })();

  const formLink = useMemo(() => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const formId = form?.id ?? params.id;
    return `${base}/form/${formId}?key=${privateLinkKey}`;
  }, [accessMode, form?.id, params.id, privateLinkKey]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(formLink);
      toast({ title: t("results.copied") });
    } catch (error) {
      toast({ title: t("builder.error"), description: t("results.copyFailed"), variant: "destructive" });
    }
  };

  const isDirty = form
    ? (() => {
        const storedKey = typeof form.settings_json?.privateLinkKey === "string"
          ? form.settings_json.privateLinkKey
          : "";
        const keyChanged = privateLinkKey !== storedKey;
        
        const settings = form.settings_json ?? {};
        const storedAllowRevoke = Boolean(settings.allowRevoke);
        const storedAttemptLimitType = settings.attemptLimitType === "limited" ? "limited" : "unlimited";
        const storedAttemptLimit = typeof settings.attemptLimit === "number" && settings.attemptLimit > 0
          ? settings.attemptLimit
          : 1;
        const storedRevokeCountsAsAttempt = Boolean(settings.revokeCountsAsAttempt);
        
        const attemptsChanged = 
          accessMode === "unauthenticated"
            ? (allowRevoke !== storedAllowRevoke)
            : (allowRevoke !== storedAllowRevoke ||
              attemptLimitType !== storedAttemptLimitType ||
              (attemptLimitType === "limited" && attemptLimit !== storedAttemptLimit) ||
              (allowRevoke && revokeCountsAsAttempt !== storedRevokeCountsAsAttempt));
        
        return (
          startAt !== getDateInputValue(form.startAt) ||
          endAt !== getDateInputValue(form.endAt) ||
          accessMode !== (form.accessMode ?? "private") ||
          keyChanged ||
          attemptsChanged
        );
      })()
    : false;

  const handleSaveSettings = async () => {
    if (!form || !canEditCurrentForm) return;
    setIsSaving(true);
    const payload = buildFormPayload(form, {
      accessMode,
      startAt: toIsoDate(startAt, "00:00:00"),
      endAt: toIsoDate(endAt, "23:59:59"),
      settingsJson: {
        ...(form.settings_json ?? {}),
        privateLinkKey,
        allowRevoke: accessMode === "unauthenticated" ? false : allowRevoke,
        attemptLimitType: accessMode === "unauthenticated" ? "unlimited" : attemptLimitType,
        attemptLimit: accessMode === "unauthenticated" ? null : (attemptLimitType === "limited" ? attemptLimit : null),
        revokeCountsAsAttempt: accessMode === "unauthenticated" ? false : (allowRevoke ? revokeCountsAsAttempt : false),
      },
    });
    try {
      const saved = await saveFormInPlace(form.id, payload);
      storage.saveForm(saved);
      // Сохраняем права доступа: ответ PUT не содержит canEdit/canViewResponses/canContinuePassage
      setForm({
        ...saved,
        canEdit: form.canEdit,
        canViewResponses: form.canViewResponses,
        canContinuePassage: form.canContinuePassage,
        ownerName: form.ownerName,
      });
      setStartAt(getDateInputValue(saved.startAt));
      setEndAt(getDateInputValue(saved.endAt));
      setAccessMode(saved.accessMode ?? "private");
      
      // Обновляем настройки попыток из сохраненной формы
      const settings = saved.settings_json ?? {};
      setAllowRevoke(Boolean(settings.allowRevoke));
      setAttemptLimitType(
        settings.attemptLimitType === "limited" ? "limited" : "unlimited"
      );
      const limit = typeof settings.attemptLimit === "number" && settings.attemptLimit > 0
        ? settings.attemptLimit
        : 1;
      setAttemptLimit(limit);
      setAttemptLimitInput(String(limit));
      setRevokeCountsAsAttempt(Boolean(settings.revokeCountsAsAttempt));
      
      toast({ title: t("results.settingsSaved") });
    } catch (error: any) {
      toast({
        title: t("results.settingsSaveError"),
        description: error?.message ?? t("builder.error"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const calendarLocale = i18n.language.startsWith("ru") ? ru : enUS;

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="h-19 border-b border-border bg-white flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <AppBrand onClick={() => setLocation("/")} />
          <div className="h-8 w-px bg-border hidden sm:block" />
          <div>
            <h1 className="text-lg font-semibold">{form?.title || t("common.untitled")}</h1>
            <p className="text-sm text-muted-foreground">{t("results.title")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEditCurrentForm ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setLocation(`/builder/${params.id}`)}
            >
              <PencilLine className="h-4 w-4" />
              <span className="hidden sm:inline">{t("results.editForm")}</span>
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setIsAccessDialogOpen(true)}
            disabled={!canEditCurrentForm}
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{t("access.manageAccessToForm")}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 h-9 px-3"
            onClick={() => {
              const newLang = i18n.language.startsWith("ru") ? "en" : "ru";
              i18n.changeLanguage(newLang);
            }}
            title={i18n.language.startsWith("ru") ? "Переключить на Английский" : "Switch to Russian"}
          >
            <Languages className="h-4 w-4" />
            <span className="hidden sm:inline text-sm font-medium">{i18n.language.startsWith("ru") ? "RU" : "EN"}</span>
          </Button>
          <UserMenu />
        </div>
      </header>

      {!isLoading && form && form.status !== "submitted" ? (
        <div className="flex-1 px-6 py-6">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-10 pb-10">
              <Empty className="border-none p-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BarChart3 className="h-5 w-5" />
                  </EmptyMedia>
                  <EmptyTitle>{t("results.onlyPublishedTitle")}</EmptyTitle>
                  <EmptyDescription>{t("results.onlyPublishedDesc")}</EmptyDescription>
                </EmptyHeader>
              </Empty>
              {canEditCurrentForm ? (
                <div className="mt-6 flex justify-center">
                  <Button onClick={() => setLocation(`/builder/${params.id}`)}>
                    {t("results.openBuilder")}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : (
      <div className="flex-1 flex flex-col lg:flex-row gap-6 px-6 py-6 min-h-0">
        <aside className="lg:w-72 w-full flex flex-col gap-4 min-h-0">
          <Card className="flex flex-col min-h-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{t("results.versions")}</span>
                <Badge variant="secondary">{versions.length}</Badge>
              </CardTitle>
              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t("results.searchResponses")}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Select value={responsesSortField} onValueChange={(value) => setResponsesSortField(value as ResponseSortField)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t("results.sortBy")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">{t("results.sortName")}</SelectItem>
                    <SelectItem value="duration">{t("results.sortDuration")}</SelectItem>
                    <SelectItem value="time">{t("results.sortTime")}</SelectItem>
                    <SelectItem value="score">{t("results.sortScore")}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  title={responsesSortDirection === "asc" ? t("results.sortAsc") : t("results.sortDesc")}
                  onClick={() =>
                    setResponsesSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
                  }
                >
                  {responsesSortDirection === "asc" ? (
                    <ArrowUp className="h-4 w-4" />
                  ) : (
                    <ArrowDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>

            {isLoading ? (
              <CardContent className="flex flex-col min-h-0">
                <div className="flex-1 flex items-center justify-center py-10">
                  <CustomLoader variant="dots" text={t("common.loadingversion")} />
                </div>
              </CardContent>
            ):(

            <CardContent className="space-y-3 overflow-y-auto pr-2">
              <div className="space-y-1">
                {versions.length === 0 && (
                  <div className="text-sm text-muted-foreground px-3">{t("results.noVersions")}</div>
                )}
                {versions.map((versionForm) => (
                  <button
                    key={versionForm.id}
                    type="button"
                    className={cn(
                      "w-full flex items-start gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      activeVersionId === versionForm.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                    )}
                    onClick={() => {
                      setActiveVersionId(versionForm.id);
                      setSelection({ type: "source" });
                    }}
                  >
                    <FileText className="h-4 w-4 mt-0.5" />
                    <div className="flex-1 text-left">
                      <div className="font-medium">{t("results.version", { version: versionForm.version ?? 1 })}</div>
                      <div className="text-xs text-muted-foreground truncate">{versionForm.title || t("common.untitled")}</div>
                    </div>
                  </button>
                ))}
              </div>

              <Separator />

              <div className="space-y-1">
                <button
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    selection.type === "source" ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  )}
                  onClick={() => setSelection({ type: "source" })}
                >
                  <FileText className="h-4 w-4" />
                  <span className="flex-1 text-left">
                    {t("results.originalForm")}
                    {activeVersionForm ? ` (${t("results.version", { version: activeVersionForm.version ?? 1 })})` : ""}
                  </span>
                </button>
                <button
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    selection.type === "summary" ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  )}
                  onClick={() => setSelection({ type: "summary" })}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="flex-1 text-left">
                    {t("results.summary")}
                    {activeVersionForm ? ` (${t("results.version", { version: activeVersionForm.version ?? 1 })})` : ""}
                  </span>
                </button>
              </div>

              <Separator />

              <div className="flex items-center justify-between px-3 text-xs uppercase tracking-wide text-muted-foreground">
                <span>{t("results.responses")}</span>
                <span>{filteredResponses.length}</span>
              </div>
              <div className="space-y-1">
                {filteredResponses.length === 0 && (
                  <div className="text-sm text-muted-foreground px-3">{t("results.noResponses")}</div>
                )}
                {filteredResponses.map((response) => (
                  <button
                    key={response.id}
                    type="button"
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg pl-3 pr-7 py-2 text-sm transition-colors",
                      selection.type === "response" && selection.responseId === response.id
                        ? "bg-primary/10 text-primary"
                        : response.status === "cancelled"
                    )}
                    onClick={() => {
                      setActiveVersionId(response.formId);
                      setSelection({ type: "response", responseId: response.id });
                    }}
                  >
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback>{getInitials(response.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left min-w-0 overflow-hidden space-y-1.5">
                      <div className="flex items-center justify-between gap-2 min-h-5">
                        <span className="font-medium truncate min-w-0 text-foreground">{response.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0 truncate max-w-[8.5rem] text-right">
                          {formatDistanceToNow(parseServerDate(response.submittedAt), {
                            addSuffix: true,
                            locale: i18n.language.startsWith("ru") ? ru : enUS,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="h-5 font-normal text-xs">
                          {t("results.version", { version: response.version })}
                        </Badge>
                        {attemptNumberByResponseId.get(response.id) != null && (
                          <Badge variant="outline" className="h-5 font-normal text-xs">
                            {t("results.attemptNumber", { number: attemptNumberByResponseId.get(response.id) })}
                          </Badge>
                        )}
                        {response.status === "cancelled" && (
                          <Badge variant="destructive" className="h-5 font-normal text-xs pointer-events-none">
                            {t("home.revoked")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
            )}
          </Card>
        </aside>

        <section className="flex-1 min-h-0">
          {isLoading ? (
              <Card className="flex flex-col min-h-0">
                <div className="flex-1 flex items-center justify-center py-10">
                  <CustomLoader variant="dots" text={t("navigation.loadingForms")} />
                </div>
              </Card>
            ):(

          <Card className="h-full flex flex-col">
            <CardHeader className="pb-4 border-b">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">{selectionTitle}</CardTitle>
                  <CardDescription>{selectionSubtitle}</CardDescription>
                </div>
                <Badge variant="outline" className="gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {t("results.responsesCount", { count: responsesForVersion.length })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto pr-2 pt-6 space-y-6">
              {!isLoading && selection.type === "source" && (
                activeVersionForm ? (
                  <div className="space-y-4">
                    {activeVersionForm.description && (
                      <div className="text-sm text-muted-foreground">{activeVersionForm.description}</div>
                    )}
                    <div className="opacity-95">
                      <FormPreview form={activeVersionForm} readOnly />
                    </div>
                  </div>
                ) : (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <FileText className="h-5 w-5" />
                      </EmptyMedia>
                      <EmptyTitle>{t("results.formUnavailable")}</EmptyTitle>
                      <EmptyDescription>{t("results.formUnavailableDesc")}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )
              )}

              {!isLoading && selection.type === "summary" && (
                responsesForVersion.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <BarChart3 className="h-5 w-5" />
                      </EmptyMedia>
                      <EmptyTitle>{t("results.noResponses")}</EmptyTitle>
                      <EmptyDescription>{t("results.summaryHint")}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[45%]">{t("results.question")}</TableHead>
                        <TableHead>{t("results.answer")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summaryRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.label}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-3 text-sm">
                              {row.metrics.map((metric) => (
                                <div key={metric.label} className="flex items-center gap-2">
                                  <span className="text-muted-foreground">{metric.label}:</span>
                                  <span className="font-medium">{metric.value}</span>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              )}

              {!isLoading && selection.type === "response" && (
                activeResponse ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">{activeResponse.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{formatDuration(activeResponse.durationMinutes, isRussianLocale)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="h-5 font-normal">{t("results.version", { version: activeResponse.version })}</Badge>
                        {attemptNumberByResponseId.get(activeResponse.id) != null && (
                          <Badge variant="outline" className="h-5 font-normal">{t("results.attemptNumber", { number: attemptNumberByResponseId.get(activeResponse.id) })}</Badge>
                        )}
                        {activeResponse.status === "cancelled" && (
                          <Badge variant="destructive" className="h-5 font-normal pointer-events-none">{t("home.revoked")}</Badge>
                        )}
                      </div>
                      {activeResponseScore && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground pt-0.5">
                          <BarChart3 className="h-4 w-4" />
                          <span>{t("results.correctScore", { scoreText: formatScoreRange(activeResponseScore.score, activeResponseScore.maxScore, i18n.language) })}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      {answerableFields.map((field) => (
                        <Card key={field.id} className="border border-border/60 shadow-sm">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">{field.label}</CardTitle>
                            {field.description && (
                              <CardDescription>{field.description}</CardDescription>
                            )}
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {Array.isArray((field.props as Record<string, unknown>)?.attachments) && (
                              <ElementAttachments
                                attachments={(field.props as Record<string, unknown>).attachments as ElementAttachment[]}
                                displayMode={
                                  (field.props as Record<string, unknown>).attachmentsDisplay === "list"
                                    ? "list"
                                    : "slider"
                                }
                              />
                            )}
                            {formatAnswerValue(field, activeResponse.answers[field.id], t)}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Users className="h-5 w-5" />
                      </EmptyMedia>
                      <EmptyTitle>{t("results.noResponses")}</EmptyTitle>
                      <EmptyDescription>{t("results.summaryHint")}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )
              )}
            </CardContent>
          </Card>
          )}
        </section>

        <aside className="lg:w-80 w-full flex flex-col gap-4 min-h-0">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">{t("results.accessSettings")}</CardTitle>
              <CardDescription>{t("results.linkHint")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DateField
                label={t("results.openDate")}
                value={startAt}
                onChange={setStartAt}
                title={t("results.openCalendar")}
                locale={calendarLocale}
              />
              <DateField
                label={t("results.closeDate")}
                value={endAt}
                onChange={setEndAt}
                title={t("results.openCalendar")}
                locale={calendarLocale}
              />
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("builder.accessMode")}</label>
                <Select value={accessMode} onValueChange={(value) => setAccessMode(value as FormAccessMode)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("builder.accessModePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">{t("builder.accessModePrivate")}</SelectItem>
                    <SelectItem value="unauthenticated">{t("builder.accessModeUnauthenticated")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("results.formLink")}</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input value={formLink} readOnly className="pl-9" />
                  </div>
                  <Button variant="outline" size="icon" onClick={handleCopyLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {accessMode === "private" ? t("results.privateLinkHint") : t("results.publicLinkHint")}
                </p>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                {accessMode !== "unauthenticated" && (
                <>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="allowRevoke"
                      checked={allowRevoke}
                      onCheckedChange={(checked) => setAllowRevoke(Boolean(checked))}
                      disabled={!canEditCurrentForm}
                      simplifiedAnimation
                    />
                    <label
                      htmlFor="allowRevoke"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {t("results.allowRevoke")}
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">
                    {t("results.allowRevokeHint")}
                  </p>
                </div>
                
                {allowRevoke && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="revokeCountsAsAttempt"
                        checked={revokeCountsAsAttempt}
                        onCheckedChange={(checked) => setRevokeCountsAsAttempt(Boolean(checked))}
                        disabled={!canEditCurrentForm}
                        simplifiedAnimation
                      />
                      <label
                        htmlFor="revokeCountsAsAttempt"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
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
                  <label className="text-sm font-medium">{t("results.attemptLimitType")}</label>
                  <Select
                    value={attemptLimitType}
                    onValueChange={(value) => {
                      setAttemptLimitType(value as "unlimited" | "limited");
                      if (value === "limited") {
                        setAttemptLimitInput(String(attemptLimit));
                      }
                    }}
                    disabled={!canEditCurrentForm}
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
                
                {attemptLimitType === "limited" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="attemptLimit">
                      {t("results.attemptLimit")}
                    </label>
                    <Input
                      id="attemptLimit"
                      type="number"
                      min={1}
                      max={9999}
                      value={attemptLimitInput}
                      onKeyDown={(e) => {
                        if (["+", "-", ".", "e", "E"].includes(e.key)) e.preventDefault();
                      }}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        if (raw === "") {
                          setAttemptLimitInput("");
                          return;
                        }
                        const n = parseInt(raw, 10);
                        if (n > 9999) {
                          setAttemptLimit(9999);
                          setAttemptLimitInput("9999");
                        } else {
                          setAttemptLimit(n);
                          setAttemptLimitInput(raw);
                        }
                      }}
                      onBlur={() => {
                        const n = parseInt(attemptLimitInput.trim(), 10);
                        if (Number.isNaN(n) || n < 1) {
                          setAttemptLimit(1);
                          setAttemptLimitInput("1");
                        } else if (n > 9999) {
                          setAttemptLimit(9999);
                          setAttemptLimitInput("9999");
                        } else {
                          setAttemptLimit(n);
                          setAttemptLimitInput(String(n));
                        }
                      }}
                      disabled={!canEditCurrentForm}
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
              
              <Button
                onClick={handleSaveSettings}
                disabled={!canEditCurrentForm || !isDirty || isSaving}
                className="w-full"
              >
                {isSaving ? t("results.saving") : t("results.saveSettings")}
              </Button>
            </CardContent>
          </Card>

          {isLoading ? (
              <Card className="flex flex-col min-h-0">
                <div className="flex-1 flex items-center justify-center py-10">
                  <CustomLoader variant="dots" text={t("common.loadingstats")} />
                </div>
              </Card>
          ) : (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">{t("results.stats")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border/60 p-3 min-h-24 flex flex-col">
                  <div className="text-muted-foreground">{t("results.linkClicks")}</div>
                  <div className="mt-auto text-xl font-semibold">{stats.totalViews}</div>
                </div>
                <div className="rounded-lg border border-border/60 p-3 min-h-24 flex flex-col">
                  <div className="text-muted-foreground">{t("results.completed")}</div>
                  <div className="mt-auto text-xl font-semibold">{stats.completed}</div>
                </div>
                <div className="rounded-lg border border-border/60 p-3 min-h-24 flex flex-col">
                  <div className="text-muted-foreground">{t("results.avgTime")}</div>
                  <div className="mt-auto text-xl font-semibold">{stats.avgTime}</div>
                </div>
                <div className="rounded-lg border border-border/60 p-3 min-h-24 flex flex-col">
                  <div className="text-muted-foreground">{t("results.medianTime")}</div>
                  <div className="mt-auto text-xl font-semibold">{stats.medianTime}</div>
                </div>
                <div className="rounded-lg border border-border/60 p-3 min-h-24 flex flex-col">
                  <div className="text-muted-foreground">{t("results.averageScore")}</div>
                  <div className="mt-auto text-xl font-semibold">
                    {scoreStats.hasScore
                      ? `${scoreStats.avgScore.toFixed(1)} / ${scoreStats.maxScore}`
                      : scoreFallbackLabel}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 p-3 min-h-24 flex flex-col">
                  <div className="text-muted-foreground">{t("results.medianScore")}</div>
                  <div className="mt-auto text-xl font-semibold">
                    {scoreStats.hasScore
                      ? `${scoreStats.medianScore.toFixed(1)} / ${scoreStats.maxScore}`
                      : scoreFallbackLabel}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          )}
        </aside>
      </div>
      )}
      <FormAccessDialog
        form={form ? { id: form.id, title: form.title } : null}
        open={isAccessDialogOpen}
        onOpenChange={setIsAccessDialogOpen}
        canManage={canEditCurrentForm}
      />
    </div>
  );
}
