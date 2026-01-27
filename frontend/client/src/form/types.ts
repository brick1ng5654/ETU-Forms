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

export type FormAccessMode = "public" | "private" | "unauthenticated";

export interface FormSchema {
  id: string;
  folderId?: string;
  title: string;
  description: string;
  fields: FormElementModel[];
  startAt?: string | null;
  endAt?: string | null;
  accessMode?: FormAccessMode;
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

// full_name canonical keys:
// - lastName, firstName required
// - patronymic optional
export type FullNameAnswer = {
  lastName: string;
  firstName: string;
  patronymic?: string | null;
};

// passport canonical keys:
// - seriesNumber: 10 digits only
// - departmentCode: 6 digits only
// - issueDate: YYYY-MM-DD
// - birthDate: YYYY-MM-DD
// - issuedBy, birthPlace optional strings
export type PassportAnswer = {
  lastName?: string | null;
  firstName?: string | null;
  patronymic?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  seriesNumber: string;
  issuedBy?: string | null;
  issueDate?: string | null;
  departmentCode?: string | null;
  birthPlace?: string | null;
};

export type AnswerValue =
  | string
  | string[]
  | number
  | Date
  | FullNameAnswer
  | PassportAnswer
  | DateTimeAnswer
  | null;

export type AnswersById = Record<string, AnswerValue>;
