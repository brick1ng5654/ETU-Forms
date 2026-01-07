import { LucideIcon } from "lucide-react";

export type FieldType = 
  | "text" 
  | "number" 
  | "select" 
  | "checkbox" 
  | "radio" 
  | "datetime"
  | "email"
  | "header"
  | "rating"
  | "ranking"
  | "file"
  | "category" // For category/subcategory
  // Pre-validated text fields
  | "fullname"
  | "phone"
  | "passport"
  | "inn"
  | "snils"
  | "ogrn"
  | "bik"
  | "account" // Correspondent/Settlement account
  | "country";

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[]; // For select, radio, checkbox, ranking
  helperText?: string;
  maxRating?: number; // For rating
  maxChars?: number; // For text limit
  subCategories?: Record<string, string[]>; // For category/subcategory
  allowedDomains?: string[]; // For email domain restriction
  multiple?: boolean; // For select multiple
  multiline?: boolean; // For text (merged textarea)
  allowDecimals?: boolean; // For number
  maxFileSize?: number; // For file (MB)
  acceptedFileTypes?: string[]; // For file (.pdf, .jpg etc)
  correctAnswers?: string[]; // For quiz mode - list of valid answers
  points?: number; // Points for correct answer in quiz mode
  conditionalLogic?: ConditionalLogic;
}

export interface FormFolder {
  id: string;
  name: string;
}

export interface FormSchema {
  id: string;
  folderId?: string; // Optional folder association
  title: string;
  description: string;
  fields: FormField[];
  updatedAt: number;
}

export interface ConditionalLogic {
  dependsOn?: string; // ID поля-родителя
  condition: "equals" | "not_equals" | "answered" | "not_answered";
  expectedValue?: string | string[]; // Для select с multiple - массив
}


