import type { FormElementModel } from "@/form/types";
import { normalizeRawType, normalizeWidgetType, normalizeSemanticType } from "@/form/elementTypeRegistry";

export interface StructureField {
  id?: string | number;
  type?: string;
  widgetType?: string;
  semanticType?: string;
  label?: string;
  description?: string;
  helperText?: string;
  required?: boolean;
  sortIndex?: number;
  other_settings?: Record<string, unknown>;
  props?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface StructureJson {
  fields: StructureField[];
}

export type UnknownTypeSource = "type" | "widgetType" | "semanticType";

export type UnknownTypeWarning = {
  source: UnknownTypeSource;
  raw: string;
  index: number;
  label?: string;
};

export type TypeNormalizationMode = "strict" | "lenient";

export type StructureNormalizationResult = {
  fields: FormElementModel[];
  warnings: UnknownTypeWarning[];
};

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const stableIdFromField = (field: StructureField, index: number) => {
  if (field.id != null) {
    return String(field.id);
  }
  const seed = `${field.type ?? field.widgetType ?? "field"}:${field.label ?? ""}:${index}`;
  return `tmp_${hashString(seed)}`;
};

let lastUnknownTypeWarnings: UnknownTypeWarning[] = [];

export const getLastUnknownTypeWarnings = () => lastUnknownTypeWarnings;

const reportUnknownTypes = (warnings: UnknownTypeWarning[], mode: TypeNormalizationMode) => {
  lastUnknownTypeWarnings = warnings;
  if (warnings.length === 0) return;

  const message = `Unknown field types detected: ${warnings
    .map((warning) => `${warning.source}="${warning.raw}"@${warning.index}`)
    .join(", ")}`;

  if (mode === "strict") {
    console.error(message, warnings);
    return;
  }

  console.warn(message, warnings);
  if (typeof window !== "undefined") {
    const win = window as Window & {
      __etuUnknownTypeCount?: number;
      __etuUnknownTypeLast?: UnknownTypeWarning[];
    };
    win.__etuUnknownTypeCount = (win.__etuUnknownTypeCount ?? 0) + warnings.length;
    win.__etuUnknownTypeLast = warnings;
  }
};

const extractProps = (field: StructureField) => {
  const {
    id,
    type,
    widgetType,
    semanticType,
    label,
    description,
    helperText,
    required,
    sortIndex,
    other_settings,
    props,
    ...rest
  } = field;

  return {
    ...(other_settings ?? {}),
    ...(props ?? {}),
    ...rest,
  };
};

export const fromStructureJsonWithMeta = (
  structure: StructureJson,
  options?: { mode?: TypeNormalizationMode }
): StructureNormalizationResult => {
  const fields = Array.isArray(structure.fields) ? structure.fields : [];
  const warnings: UnknownTypeWarning[] = [];
  const mode = options?.mode ?? (import.meta.env.DEV ? "strict" : "lenient");

  const normalizedFields = fields.map((field, index) => {
    const explicitWidget = normalizeWidgetType(field.widgetType);
    const explicitSemantic = normalizeSemanticType(field.semanticType);
    const normalized = normalizeRawType(field.type);

    if (field.widgetType && !explicitWidget) {
      warnings.push({ source: "widgetType", raw: field.widgetType, index, label: field.label });
    }
    if (field.semanticType && !explicitSemantic) {
      warnings.push({ source: "semanticType", raw: field.semanticType, index, label: field.label });
    }
    if (field.type && !normalizeWidgetType(field.type) && !normalizeSemanticType(field.type)) {
      warnings.push({ source: "type", raw: field.type, index, label: field.label });
    }

    const widgetType = explicitWidget ?? normalized.widgetType;
    const semanticType = explicitSemantic ?? normalized.semanticType;

    const props = extractProps(field);

    if (field.type === "text" && props.multiline) {
      return {
        id: stableIdFromField(field, index),
        widgetType: "textarea",
        semanticType,
        label: field.label ?? "",
        description: field.description ?? field.helperText ?? "",
        required: field.required ?? false,
        props,
        sortIndex: index,
      };
    }

    if (field.type === "email" && !props.inputType) {
      props.inputType = "email";
    }

    return {
      id: stableIdFromField(field, index),
      widgetType,
      semanticType,
      label: field.label ?? "",
      description: field.description ?? field.helperText ?? "",
      required: field.required ?? false,
      props,
      sortIndex: index,
    };
  });

  reportUnknownTypes(warnings, mode);
  return { fields: normalizedFields, warnings };
};

export const fromStructureJson = (structure: StructureJson): FormElementModel[] =>
  fromStructureJsonWithMeta(structure).fields;
