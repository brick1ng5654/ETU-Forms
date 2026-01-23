import type { SemanticType, WidgetType } from "@/form/types";

const widgetTypeAliases: Record<string, WidgetType> = {
  header: "header",
  heading: "header",
  text: "text_input",
  text_input: "text_input",
  textarea: "textarea",
  number: "number_input",
  number_input: "number_input",
  select: "select",
  radio: "radio",
  checkbox: "checkbox",
  datetime: "datetime",
  file: "file_upload",
  file_upload: "file_upload",
  rating: "rating",
  ranking: "ranking",
  email: "text_input",
  country: "select",
  category: "select",
};

const semanticTypeAliases: Record<string, SemanticType> = {
  phone: "phone",
  inn: "inn",
  snils: "snils",
  fullname: "full_name",
  full_name: "full_name",
  ogrn: "ogrn",
  orgn: "ogrn",
  bik: "bik",
  account: "bank_account",
  bank_account: "bank_account",
  passport: "passport",
};

export const canonicalWidgetTypes: WidgetType[] = [
  "header",
  "text_input",
  "textarea",
  "number_input",
  "select",
  "radio",
  "checkbox",
  "datetime",
  "file_upload",
  "rating",
  "ranking",
];

export const canonicalSemanticTypes: SemanticType[] = [
  "phone",
  "inn",
  "snils",
  "full_name",
  "ogrn",
  "bik",
  "bank_account",
  "passport",
];

export function normalizeWidgetType(raw?: string): WidgetType | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toLowerCase();
  return widgetTypeAliases[key];
}

export function normalizeSemanticType(raw?: string): SemanticType | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toLowerCase();
  return semanticTypeAliases[key];
}

export function normalizeRawType(raw?: string): {
  widgetType: WidgetType;
  semanticType?: SemanticType;
} {
  const widgetType = normalizeWidgetType(raw);
  if (widgetType) {
    return { widgetType };
  }

  const semanticType = normalizeSemanticType(raw);
  if (semanticType) {
    return { widgetType: "text_input", semanticType };
  }

  return { widgetType: "text_input" };
}
