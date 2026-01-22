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

export const fromStructureJson = (structure: StructureJson): FormElementModel[] => {
  const fields = Array.isArray(structure.fields) ? structure.fields : [];
  return fields.map((field, index) => {
    const explicitWidget = normalizeWidgetType(field.widgetType);
    const explicitSemantic = normalizeSemanticType(field.semanticType);
    const normalized = normalizeRawType(field.type);

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
};
