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
  | "ranking"
  | "matrix";

export type SemanticType =
  | "phone"
  | "email"
  | "inn"
  | "snils"
  | "full_name"
  | "ogrn"
  | "bik"
  | "bank_account"
  | "passport";

export type ElementAttachment = {
  file_id: number;
  name: string;
  mime_type: string;
  size_bytes: number;
  url: string;
  content_hash?: string;
  status?: "temp" | "submitted" | "deleted";
};

export type FormElementProps = {
  attachments?: ElementAttachment[];
  attachmentsDisplay?: "list" | "slider";
  [key: string]: unknown;
};

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

export type FormAccessMode = "private" | "unauthenticated";

export interface FormSchema {
  id: string;
  folderId?: string;
  title: string;
  description: string;
  ownerName?: string;
  fields: FormElementModel[];
  fieldCount?: number;
  status?: "temp" | "submitted" | "deleted";
  version?: number;
  prevFormId?: string | null;
  settings_json?: Record<string, unknown> | null;
  startAt?: string | null;
  endAt?: string | null;
  accessMode?: FormAccessMode;
  createdAt?: number;
  updatedAt: number;
  canEdit?: boolean;
  canViewResponses?: boolean;
  canContinuePassage?: boolean;
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

export type ChoiceAnswer = {
  selected?: string | string[] | null;
  otherSelected?: boolean;
  otherText?: string | null;
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

// Matrix answer is stored as an array of "rowIndex:colIndex" keys
export type MatrixAnswer = string[];
export type FileUploadAnswer = ElementAttachment[];

export type AnswerValue =
  | string
  | string[]
  | number
  | Date
  | ChoiceAnswer
  | FullNameAnswer
  | PassportAnswer
  | DateTimeAnswer
  | MatrixAnswer
  | FileUploadAnswer
  | null;

export type AnswersById = Record<string, AnswerValue>;
