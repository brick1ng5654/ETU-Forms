import { apiFetch } from "@/lib/api";
import { authHeader } from "@/lib/auth";
import type { AnswersById, FormElementModel, FormPageModel, FormSchema } from "@/form/types";
import { t as i18nT } from "i18next";

type ServerFormStatus = "temp" | "submitted" | "deleted";

type ServerFormSummary = {
  form_id: number;
  user_id: number;
  owner_name?: string | null;
  title: string;
  description?: string | null;
  settings_json?: Record<string, unknown> | null;
  start_at?: string | null;
  end_at?: string | null;
  access_mode?: "private" | "unauthenticated" | null;
  status: ServerFormStatus;
  deleted_at?: string | null;
  expires_at?: string | null;
  version: number;
  prev_form_id?: number | null;
  created_at: string;
  updated_at: string;
  elements_count?: number;
  can_edit?: boolean;
  can_view_responses?: boolean;
  can_continue_passage?: boolean;
};

type ServerBuilderElement = {
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
};

type ServerFormPage = {
  page_id: number;
  title?: string | null;
  page_index: number;
  allow_back: boolean;
};

type ServerBuilderCondition = {
  source_client_id: string;
  target_client_id: string;
  operator: string;
  value?: Record<string, unknown> | null;
};

type ServerFormDetail = ServerFormSummary & {
  pages: ServerFormPage[];
  elements: ServerBuilderElement[];
  conditions: ServerBuilderCondition[];
};

type ServerFormStoredResponse = {
  response_id: number;
  form_id: number;
  user_id: number;
  responder_name: string;
  responder_email?: string | null;
  status: "draft" | "submitted" | "cancelled";
  created_at: string;
  completed_at?: string | null;
  version: number;
  answers: Record<string, unknown>;
};

type ServerFormStoredResponsesResponse = {
  responses: ServerFormStoredResponse[];
};

type FormBuilderPayload = {
  title: string;
  description?: string | null;
  settings_json?: Record<string, unknown> | null;
  start_at?: string | null;
  end_at?: string | null;
  access_mode?: "private" | "unauthenticated" | null;
  pages: ServerFormPage[];
  elements: ServerBuilderElement[];
  conditions: ServerBuilderCondition[];
};

export type FormSubmitAnswersPayload = {
  answers: Record<string, unknown>;
  started_at?: string;
};

export type FormSubmitAnswersResult = {
  response_id: number;
  submitted_at: string;
  answers_count: number;
};

export type HttpError = Error & { status?: number };

export type StoredFormResponse = {
  responseId: number;
  formId: string;
  userId: number;
  responderName: string;
  responderEmail?: string | null;
  status: "draft" | "submitted" | "cancelled";
  createdAt: string;
  completedAt: string | null;
  version: number;
  answers: AnswersById;
};

const readErrorMessage = async (res: Response): Promise<string> => {
  const text = await res.text();
  if (!text) return `${res.status} ${res.statusText}`;
  try {
    const parsed = JSON.parse(text) as { detail?: unknown };
    if (typeof parsed?.detail === "string" && parsed.detail.trim()) {
      return parsed.detail;
    }
  } catch {
    // no-op
  }
  return text;
};

const asHttpError = async (res: Response): Promise<HttpError> => {
  const error = new Error(await readErrorMessage(res)) as HttpError;
  error.status = res.status;
  return error;
};

const toTimestamp = (value?: string | number | null): number => {
  if (!value) return Date.now();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? Date.now() : parsed.getTime();
};

const mapWidgetFromServer = (widget: string): FormElementModel["widgetType"] => {
  if (widget === "heading") return "header";
  if (widget === "email_input") return "text_input";
  if (widget === "static_text") return "text_input";
  return widget as FormElementModel["widgetType"];
};

const mapSemanticFromServer = (widget: string, semantic?: string | null): FormElementModel["semanticType"] | undefined => {
  if (semantic) return semantic as FormElementModel["semanticType"];
  if (widget === "email_input") return "email";
  return undefined;
};

const mapCorrectAnswers = (raw?: Record<string, unknown> | null): unknown => {
  if (!raw) return undefined;
  if (Array.isArray((raw as any).values)) {
    return (raw as any).values;
  }
  if ((raw as any).value !== undefined) {
    return [(raw as any).value];
  }
  return undefined;
};

export const mapServerDetailToSchema = (detail: ServerFormDetail): FormSchema => {
  const pages: FormPageModel[] = (detail.pages ?? []).map((page) => ({
    id: Number(page.page_id),
    title: page.title ?? "",
    pageIndex: Number(page.page_index ?? 0),
    allowBack: Boolean(page.allow_back),
  }));
  const normalizedPages =
    pages.length > 0
      ? pages.sort((a, b) => a.pageIndex - b.pageIndex)
      : [{ id: 1, title: i18nT("pages.defaultTitle", { index: 1 }), pageIndex: 0, allowBack: true }];
  const pageIdSet = new Set(normalizedPages.map((page) => page.id));
  const fallbackPageId = normalizedPages[0].id;

  const fields: FormElementModel[] = detail.elements.map((el) => {
    const otherSettings = { ...(el.other_settings ?? {}) } as Record<string, unknown>;
    delete otherSettings.client_id;
    delete otherSettings.sort_index;
    const props: Record<string, unknown> = { ...otherSettings };
    if (el.text_hint) props.placeholder = el.text_hint;
    const correctAnswers = mapCorrectAnswers(el.correct_answer);
    if (correctAnswers !== undefined) props.correctAnswers = correctAnswers;

    return {
      id: String(el.client_id || ""),
      pageId: pageIdSet.has(el.page_id) ? el.page_id : fallbackPageId,
      widgetType: mapWidgetFromServer(el.widget),
      semanticType: mapSemanticFromServer(el.widget, el.semantic ?? undefined),
      label: el.label,
      description: el.description ?? "",
      required: !!el.required_field,
      props,
      sortIndex: el.sort_index,
    };
  });

  const byId = new Map(fields.map((field) => [field.id, field]));
  const fieldIds = new Set(fields.map((field) => field.id));

  fields.forEach((field) => {
    const props = field.props as Record<string, unknown>;
    const rawLogic = props.conditionalLogic as Record<string, unknown> | undefined;
    if (!rawLogic) return;

    const dependsOn = rawLogic.dependsOn == null ? "" : String(rawLogic.dependsOn);
    const condition = typeof rawLogic.condition === "string" ? rawLogic.condition : "";
    const isSupportedCondition = condition === "equals" || condition === "not_equals" || condition === "answered";

    if (!dependsOn || !fieldIds.has(dependsOn) || !isSupportedCondition) {
      const { conditionalLogic: _drop, ...nextProps } = props;
      field.props = nextProps;
      return;
    }

    field.props = {
      ...props,
      conditionalLogic: {
        ...rawLogic,
        dependsOn,
        condition,
      },
    };
  });

  detail.conditions.forEach((cond) => {
    const target = byId.get(cond.target_client_id);
    if (!target) return;
    if (!["equals", "not_equals", "answered"].includes(cond.operator)) return;
    if (!fieldIds.has(cond.source_client_id)) return;
    const value = cond.value ?? {};
    const expectedValue = Array.isArray((value as any).values)
      ? (value as any).values
      : (value as any).value;
    target.props = {
      ...target.props,
      conditionalLogic: {
        dependsOn: cond.source_client_id,
        condition: cond.operator,
        expectedValue: cond.operator === "answered" ? undefined : expectedValue,
      },
    };
  });

  return {
    id: String(detail.form_id),
    title: detail.title,
    description: detail.description ?? "",
    pages: normalizedPages,
    fields,
    fieldCount: detail.elements_count ?? fields.length,
    status: detail.status,
    version: detail.version,
    prevFormId: detail.prev_form_id ? String(detail.prev_form_id) : null,
    settings_json: detail.settings_json ?? null,
    startAt: detail.start_at ?? null,
    endAt: detail.end_at ?? null,
    accessMode: detail.access_mode ?? undefined,
    createdAt: toTimestamp(detail.created_at),
    updatedAt: toTimestamp(detail.updated_at),
  };
};

export const mapServerSummaryToSchema = (summary: ServerFormSummary): FormSchema => {
  return {
    id: String(summary.form_id),
    title: summary.title,
    description: summary.description ?? "",
    pages: [],
    ownerName: summary.owner_name ?? undefined,
    fields: [],
    fieldCount: summary.elements_count ?? 0,
    status: summary.status,
    version: summary.version,
    prevFormId: summary.prev_form_id ? String(summary.prev_form_id) : null,
    settings_json: summary.settings_json ?? null,
    startAt: summary.start_at ?? null,
    endAt: summary.end_at ?? null,
    accessMode: summary.access_mode ?? undefined,
    createdAt: toTimestamp(summary.created_at),
    updatedAt: toTimestamp(summary.updated_at),
    canEdit: summary.can_edit ?? undefined,
    canViewResponses: summary.can_view_responses ?? undefined,
    canContinuePassage: summary.can_continue_passage ?? undefined,
  };
};

export async function fetchForms(): Promise<FormSchema[]> {
  const res = await apiFetch("/api/v1/forms");
  if (!res.ok) {
    throw await asHttpError(res);
  }
  const data = (await res.json()) as { forms: ServerFormSummary[] };
  return data.forms.map(mapServerSummaryToSchema);
}

export async function fetchFormsCatalog(): Promise<FormSchema[]> {
  const res = await apiFetch("/api/v1/forms/catalog");
  if (!res.ok) {
    throw await asHttpError(res);
  }
  const data = (await res.json()) as { forms: ServerFormSummary[] };
  return data.forms.map(mapServerSummaryToSchema);
}

export async function fetchFormDetail(formId: string): Promise<FormSchema> {
  
  const res = await apiFetch(`/api/v1/forms/${formId}`);
  if (!res.ok) {
    throw await asHttpError(res);
  }
  const data = (await res.json()) as ServerFormDetail;
  return mapServerDetailToSchema(data);
}

export async function fetchPublicFormDetail(formId: string, key?: string | null): Promise<FormSchema> {
  const params = new URLSearchParams();
  if (key) params.set("key", key);
  const query = params.toString();
  const res = await apiFetch(`/api/v1/forms/${formId}/public${query ? `?${query}` : ""}`, { method: "GET" });
  if (!res.ok) {
    throw await asHttpError(res);
  }
  const data = (await res.json()) as ServerFormDetail;
  return mapServerDetailToSchema(data);
}

export async function createForm(payload: { title: string; description?: string }): Promise<FormSchema> {
  const res = await apiFetch("/api/v1/forms", {
    method: "POST",
    headers: { "Content-Type": "application/json"},
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw await asHttpError(res);
  }
  const data = (await res.json()) as ServerFormSummary;
  return mapServerSummaryToSchema(data);
}

export async function saveForm(formId: string, payload: FormBuilderPayload): Promise<FormSchema> {
  const res = await apiFetch(`/api/v1/forms/${formId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json"},
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw await asHttpError(res);
  }
  const data = (await res.json()) as ServerFormDetail;
  return mapServerDetailToSchema(data);
}

export async function saveFormInPlace(formId: string, payload: FormBuilderPayload): Promise<FormSchema> {
  const res = await fetch(`/api/v1/forms/${formId}?in_place=true`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeader() },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw await asHttpError(res);
  }
  const data = (await res.json()) as ServerFormDetail;
  return mapServerDetailToSchema(data);
}

export async function publishForm(formId: string, payload: FormBuilderPayload): Promise<FormSchema> {
  const res = await apiFetch(`/api/v1/forms/${formId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json"},
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw await asHttpError(res);
  }
  const data = (await res.json()) as ServerFormDetail;
  return mapServerDetailToSchema(data);
}

export async function submitPublicFormResponse(
  formId: string,
  payload: FormSubmitAnswersPayload,
  key?: string | null
): Promise<FormSubmitAnswersResult> {
  const params = new URLSearchParams();
  if (key) params.set("key", key);
  const query = params.toString();

  const res = await apiFetch(`/api/v1/forms/${formId}/responses${query ? `?${query}` : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw await asHttpError(res);
  }
  return (await res.json()) as FormSubmitAnswersResult;
}

const mapStoredResponse = (row: ServerFormStoredResponse): StoredFormResponse => ({
  responseId: row.response_id,
  formId: String(row.form_id),
  userId: row.user_id,
  responderName: row.responder_name,
  responderEmail: row.responder_email ?? null,
  status: row.status,
  createdAt: row.created_at,
  completedAt: row.completed_at ?? null,
  version: row.version,
  answers: (row.answers ?? {}) as AnswersById,
});

export async function fetchFormResponses(formId: string): Promise<StoredFormResponse[]> {
  
  const res = await apiFetch(`/api/v1/forms/${formId}/responses`);
  if (!res.ok) {
    throw await asHttpError(res);
  }
  const data = (await res.json()) as ServerFormStoredResponsesResponse;
  return (data.responses ?? []).map(mapStoredResponse);
}

export async function deleteForm(formId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/forms/${formId}`, {
    method: "DELETE",
    headers: {},
  });
  if (!res.ok) {
    throw await asHttpError(res);
  }
}
