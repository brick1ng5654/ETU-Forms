import type { AnswersById, FormElementModel, FullNameAnswer, PassportAnswer } from "@/form/types";
import { presets } from "@/form/presets";
import { getCountryCodes, isCountryField, resolveCountryCode } from "@/lib/countries";

export type ValidationErrorsById = Record<string, string[]>;

const isEmptyValue = (value: unknown) => {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
};

const isOptionValue = (value: string, options: string[]) =>
  options.some((option) => option === value);

export const validateForm = (elements: FormElementModel[], answers: AnswersById): ValidationErrorsById => {
  const errors: ValidationErrorsById = {};

  elements.forEach((element) => {
    const value = answers[element.id];
    const elementErrors: string[] = [];
    const props = element.props as Record<string, unknown>;
    const preset = element.semanticType ? presets[element.semanticType] : undefined;
    if (props.readOnly) {
      return;
    }

    // Composite answers (full_name, passport) are validated per part.key using preset.parts.
    if (preset?.parts) {
      const composite = (value as FullNameAnswer | PassportAnswer | undefined) || {};
      const compositeRecord = composite as Record<string, string | null>;
      preset.parts.forEach((part) => {
        if (part.hiddenProp && props[part.hiddenProp]) {
          return;
        }
        const partValue = compositeRecord[part.key] ?? "";
        const required = part.required ?? element.required ?? false;
        if (required && isEmptyValue(partValue)) {
          elementErrors.push(`${part.key}: Required`);
          return;
        }
        const optionValues = part.options?.map((option) => option.value) ?? [];
        if (optionValues.length > 0 && !isEmptyValue(partValue) && !optionValues.includes(String(partValue))) {
          elementErrors.push(`${part.key}: Invalid selection`);
          return;
        }
        if (part.validate) {
          const partErrors = part.validate(partValue ?? "", required);
          partErrors.forEach((err) => elementErrors.push(`${part.key}: ${err}`));
        }
      });
    } else {
      if (element.required && isEmptyValue(value)) {
        elementErrors.push("Required");
      }

      if (element.widgetType === "select" || element.widgetType === "radio") {
        const isCountrySelect = isCountryField(element);
        const options = isCountrySelect ? getCountryCodes() : (props.options as string[]) || [];
        const normalized = typeof value === "string" && isCountrySelect
          ? resolveCountryCode(value) || value
          : value;
        if (!isEmptyValue(value) && typeof normalized === "string" && !isOptionValue(normalized, options)) {
          elementErrors.push("Invalid selection");
        }
      }

      if (element.widgetType === "checkbox") {
        const options = (props.options as string[]) || [];
        const selected = Array.isArray(value) ? value : [];
        selected.forEach((item) => {
          if (!isOptionValue(item, options)) {
            elementErrors.push("Invalid selection");
          }
        });
      }

      if (element.widgetType === "number_input" && !isEmptyValue(value)) {
        const numeric = typeof value === "number" ? value : Number(value);
        if (Number.isNaN(numeric)) {
          elementErrors.push("Invalid number");
        }
      }

      if (element.widgetType === "matrix") {
        const rows = (props.rows as string[]) || [];
        const columns = (props.columns as string[]) || [];
        const selected = Array.isArray(value) ? value : [];
        selected.forEach((cellKey) => {
          if (typeof cellKey !== "string") {
            elementErrors.push("Invalid selection");
            return;
          }
          const [rowIdxStr, colIdxStr] = cellKey.split(":");
          const rowIdx = parseInt(rowIdxStr, 10);
          const colIdx = parseInt(colIdxStr, 10);
          if (
            Number.isNaN(rowIdx) ||
            Number.isNaN(colIdx) ||
            rowIdx < 1 ||
            rowIdx > rows.length ||
            colIdx < 1 ||
            colIdx > columns.length
          ) {
            elementErrors.push("Invalid selection");
          }
        });
      }

      if (preset?.validate && typeof value === "string") {
        const presetErrors = preset.validate(value, {
          required: element.required,
          props,
        });
        elementErrors.push(...presetErrors);
      }
    }

    if (elementErrors.length > 0) {
      errors[element.id] = elementErrors;
    }
  });

  return errors;
};
