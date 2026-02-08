import { apiFetch } from "@/lib/api";
import type { FormElementModel, FormSchema } from "@/form/types";

type ServerFormStatus = "temp" | "submitted" | "deleted";

type ServerFormSummary = {
  form_id: number;
  user_id: number;
  title: string;
  description?: string | null;
  settings_json?: Record<string, unknown> | null;
  start_at?: string | null;
  end_at?: string | null;
  access_mode?: "public" | "private" | "unauthenticated" | null;
  status: ServerFormStatus;
  deleted_at?: string | null;
  expires_at?: string | null;
  version: number;
  prev_form_id?: number | null;
  created_at: string;
  updated_at: string;
  elements_count?: number;
};

type ServerBuilderElement = {
  client_id: string;
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

type ServerBuilderCondition = {
  source_client_id: string;
  target_client_id: string;
  operator: string;
  value?: Record<string, unknown> | null;
};

type ServerFormDetail = ServerFormSummary & {
  elements: ServerBuilderElement[];
  conditions: ServerBuilderCondition[];
};

type FormBuilderPayload = {
  title: string;
  description?: string | null;
  settings_json?: Record<string, unknown> | null;
  start_at?: string | null;
  end_at?: string | null;
  access_mode?: "public" | "private" | "unauthenticated" | null;
  elements: ServerBuilderElement[];
  conditions: ServerBuilderCondition[];
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
  detail.conditions.forEach((cond) => {
    const target = byId.get(cond.target_client_id);
    if (!target) return;
    if (!["equals", "not_equals", "answered"].includes(cond.operator)) return;
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
    fields,
    fieldCount: detail.elements_count ?? fields.length,
    status: detail.status,
    version: detail.version,
    prevFormId: detail.prev_form_id ? String(detail.prev_form_id) : null,
    settings_json: detail.settings_json ?? null,
    startAt: detail.start_at ?? null,
    endAt: detail.end_at ?? null,
    accessMode: detail.access_mode ?? undefined,
    updatedAt: toTimestamp(detail.updated_at),
  };
};

export const mapServerSummaryToSchema = (summary: ServerFormSummary): FormSchema => {
  return {
    id: String(summary.form_id),
    title: summary.title,
    description: summary.description ?? "",
    fields: [],
    fieldCount: summary.elements_count ?? 0,
    status: summary.status,
    version: summary.version,
    prevFormId: summary.prev_form_id ? String(summary.prev_form_id) : null,
    settings_json: summary.settings_json ?? null,
    startAt: summary.start_at ?? null,
    endAt: summary.end_at ?? null,
    accessMode: summary.access_mode ?? undefined,
    updatedAt: toTimestamp(summary.updated_at),
  };
};

export async function fetchForms(): Promise<FormSchema[]> {
  const res = await apiFetch("/api/v1/forms");
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const data = (await res.json()) as { forms: ServerFormSummary[] };
  return data.forms.map(mapServerSummaryToSchema);
}

export async function fetchFormDetail(formId: string): Promise<FormSchema> {
  const res = await apiFetch(`/api/v1/forms/${formId}`);
  if (!res.ok) {
    throw new Error(await res.text());
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
    throw new Error(await res.text());
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
    throw new Error(await res.text());
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
    throw new Error(await res.text());
  }
  const data = (await res.json()) as ServerFormDetail;
  return mapServerDetailToSchema(data);
}

export async function deleteForm(formId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/forms/${formId}`, {
    method: "DELETE",
    headers: {},
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}
