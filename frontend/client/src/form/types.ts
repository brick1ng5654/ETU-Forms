export type WidgetType =
  | "header"
  | "text_input"
  | "textarea"
  | "number_input"
  | "select"
  | "radio"
  | "checkbox"
  | "datetime"
  | "file_upload"
  | "rating"
  | "ranking";

export type SemanticType =
  | "phone"
  | "inn"
  | "snils"
  | "full_name"
  | "ogrn"
  | "bik"
  | "bank_account"
  | "passport";

export type FormElementProps = Record<string, unknown>;

export interface FormElementModel {
  id: string;
  widgetType: WidgetType;
  semanticType?: SemanticType;
  label: string;
  description?: string;
  required?: boolean;
  props: FormElementProps;
  sortIndex: number;
  children?: FormElementModel[];
}

export interface FormFolder {
  id: string;
  name: string;
}

export interface FormSchema {
  id: string;
  folderId?: string;
  title: string;
  description: string;
  fields: FormElementModel[];
  updatedAt: number;
}

export interface ConditionalLogic {
  dependsOn?: string;
  condition: "equals" | "not_equals" | "answered";
  expectedValue?: string | string[];
}

export type DateTimeAnswer = {
  date?: string | null;
  time?: string | null;
};

export type AnswerValue =
  | string
  | string[]
  | number
  | Date
  | Record<string, string | null>
  | DateTimeAnswer
  | null;

export type AnswersById = Record<string, AnswerValue>;
