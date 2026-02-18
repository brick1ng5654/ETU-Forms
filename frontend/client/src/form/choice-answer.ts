import type { ChoiceAnswer } from "@/form/types";

export const CHOICE_OTHER_SENTINEL = "__other_option__";
export const CHOICE_OTHER_MAX_CHARS = 255;

type ChoiceRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is ChoiceRecord =>
  typeof value === "object" && value !== null;

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => String(item)).filter((item) => item.trim().length > 0)
    : [];

export const isChoiceAnswer = (value: unknown): value is ChoiceAnswer => {
  if (!isRecord(value)) return false;
  return "selected" in value || "otherSelected" in value || "otherText" in value;
};

export type ChoiceSingleState = {
  selected: string;
  otherSelected: boolean;
  otherText: string;
};

export type ChoiceMultiState = {
  selected: string[];
  otherSelected: boolean;
  otherText: string;
};

export const getChoiceSingleState = (value: unknown): ChoiceSingleState => {
  if (isChoiceAnswer(value)) {
    return {
      selected: asString(value.selected),
      otherSelected: Boolean(value.otherSelected),
      otherText: asString(value.otherText),
    };
  }
  return {
    selected: asString(value),
    otherSelected: false,
    otherText: "",
  };
};

export const getChoiceMultiState = (value: unknown): ChoiceMultiState => {
  if (isChoiceAnswer(value)) {
    return {
      selected: asStringArray(value.selected),
      otherSelected: Boolean(value.otherSelected),
      otherText: asString(value.otherText),
    };
  }
  return {
    selected: asStringArray(value),
    otherSelected: false,
    otherText: "",
  };
};

export const hasChoiceValue = (value: unknown, isMultiple: boolean): boolean => {
  if (isMultiple) {
    const state = getChoiceMultiState(value);
    if (state.selected.length > 0) return true;
    if (state.otherSelected) return state.otherText.trim().length > 0;
    return false;
  }

  const state = getChoiceSingleState(value);
  if (state.otherSelected) return state.otherText.trim().length > 0;
  return state.selected.trim().length > 0;
};

export const getChoiceComparableValues = (value: unknown, isMultiple: boolean): string[] => {
  if (isMultiple) {
    const state = getChoiceMultiState(value);
    const values = [...state.selected];
    if (state.otherSelected && state.otherText.trim().length > 0) {
      values.push(state.otherText.trim());
    }
    return values;
  }

  const state = getChoiceSingleState(value);
  if (state.otherSelected) {
    const otherValue = state.otherText.trim();
    return otherValue ? [otherValue] : [];
  }
  return state.selected.trim().length > 0 ? [state.selected] : [];
};
