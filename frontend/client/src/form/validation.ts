import type { AnswersById, FormElementModel, FullNameAnswer, PassportAnswer } from "@/form/types";
import { presets } from "@/form/presets";
import { getCountryCodes, isCountryField, resolveCountryCode } from "@/lib/countries";
import {
  CHOICE_OTHER_MAX_CHARS,
  getChoiceMultiState,
  getChoiceSingleState,
  hasChoiceValue,
} from "@/form/choice-answer";

export type ValidationErrorsById = Record<string, string[]>;
const REPEATABLE_ID_SEPARATOR = "::repeatable::";

const parseRepeatableChildId = (value: string): { blockId: string; index: number; childId: string } | null => {
  const parts = value.split(REPEATABLE_ID_SEPARATOR);
  if (parts.length !== 3) return null;
  const index = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(index) || index < 0) return null;
  return { blockId: parts[0], index, childId: parts[2] };
};

const getParentBlockId = (element: FormElementModel): string | null => {
  const raw = (element.props as Record<string, unknown> | undefined)?.parentBlockId;
  if (typeof raw !== "string") return null;
  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : null;
};

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
    const parentBlockId = getParentBlockId(element);
    if (parentBlockId && elements.some((candidate) => candidate.id === parentBlockId)) {
      return;
    }
    const value = answers[element.id];
    const elementErrors: string[] = [];
    const props = element.props as Record<string, unknown>;
    const preset = element.semanticType ? presets[element.semanticType] : undefined;
    if (props.readOnly) {
      return;
    }

    if (element.widgetType === "repeatable_block") {
      const nestedFields = Array.isArray(element.children) ? element.children : [];
      const instancesByIndex = new Map<number, Record<string, unknown>>();
      Object.entries(answers).forEach(([answerKey, answerValue]) => {
        const parsed = parseRepeatableChildId(answerKey);
        if (!parsed || parsed.blockId !== element.id) return;
        const bucket = instancesByIndex.get(parsed.index) ?? {};
        bucket[parsed.childId] = answerValue;
        instancesByIndex.set(parsed.index, bucket);
      });

      let instances = Array.from(instancesByIndex.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, record]) => record);
      if (instances.length === 0 && Array.isArray(value)) {
        instances = value
          .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
          .map((entry) => entry as Record<string, unknown>);
      }

      const rawMaxCount = Number((props as Record<string, unknown>).maxCount);
      const rawMinCount = Number((props as Record<string, unknown>).minCount);
      const minCountRaw = Number.isFinite(rawMinCount) && rawMinCount >= 0 ? Math.floor(rawMinCount) : 1;
      const minCount = Math.min(minCountRaw, 100);
      const maxCountRaw = Number.isFinite(rawMaxCount) && rawMaxCount > 0 ? Math.floor(rawMaxCount) : 1;
      const maxCountBase = Math.min(maxCountRaw, 100);
      const maxCount = Math.max(maxCountBase, minCount);
      if (instances.length > maxCount) {
        elementErrors.push("Invalid selection");
      }
      if (instances.length < minCount) {
        elementErrors.push("Required");
      }

      if (instances.length > 0 && nestedFields.length > 0) {
        instances.forEach((instance, instanceIndex) => {
          nestedFields.forEach((childField) => {
            const childErrors = validateForm([childField], { [childField.id]: (instance as Record<string, unknown>)[childField.id] as any });
            if (childErrors[childField.id]?.length) {
              childErrors[childField.id].forEach((err) => elementErrors.push(`#${instanceIndex + 1}: ${err}`));
            }
          });
        });
      }

      if (elementErrors.length > 0) {
        errors[element.id] = elementErrors;
      }
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
      const isChoiceWidget =
        element.widgetType === "select" ||
        element.widgetType === "radio" ||
        element.widgetType === "checkbox";
      const isMissingRequiredValue = isChoiceWidget
        ? !hasChoiceValue(value, element.widgetType === "checkbox")
        : isEmptyValue(value);

      if (element.required && isMissingRequiredValue) {
        elementErrors.push("Required");
      }

      if (element.widgetType === "select" || element.widgetType === "radio") {
        const isCountrySelect = isCountryField(element);
        const allowOther = Boolean(props.allowOther) && !isCountrySelect;
        const options = isCountrySelect ? getCountryCodes() : (props.options as string[]) || [];
        const state = getChoiceSingleState(value);

        if (state.otherSelected) {
          if (!allowOther) {
            elementErrors.push("Invalid selection");
          } else {
            const otherText = state.otherText.trim();
            if (otherText.length === 0 || otherText.length > CHOICE_OTHER_MAX_CHARS) {
              elementErrors.push("Invalid selection");
            }
          }
        } else {
          const answerValue = state.selected;
          const normalized = isCountrySelect
            ? resolveCountryCode(answerValue) || answerValue
            : answerValue;
          if (!isEmptyValue(answerValue) && !isOptionValue(normalized, options)) {
            elementErrors.push("Invalid selection");
          }
        }
      }

      if (element.widgetType === "checkbox") {
        const allowOther = Boolean(props.allowOther);
        const options = (props.options as string[]) || [];
        const state = getChoiceMultiState(value);
        state.selected.forEach((item) => {
          if (!isOptionValue(item, options)) {
            elementErrors.push("Invalid selection");
          }
        });
        if (state.otherSelected) {
          if (!allowOther) {
            elementErrors.push("Invalid selection");
          } else {
            const otherText = state.otherText.trim();
            if (otherText.length === 0 || otherText.length > CHOICE_OTHER_MAX_CHARS) {
              elementErrors.push("Invalid selection");
            }
          }
        }
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
