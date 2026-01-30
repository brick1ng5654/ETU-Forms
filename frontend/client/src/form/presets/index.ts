import type { SemanticType } from "@/form/types";

export interface PresetPart {
  key: string;
  labelKey?: string;
  placeholderKey?: string;
  placeholder?: string;
  inputMode?: string;
  inputType?: string;
  options?: Array<{ value: string; labelKey?: string; label?: string }>;
  hiddenProp?: string;
  required?: boolean;
  maxChars?: number;
  maxDigits?: number;
  hideLengthIndicator?: boolean;
  normalize?: (value: string) => string;
  format?: (value: string) => string;
  validate?: (value: string, required?: boolean) => string[];
}

export interface Preset {
  normalize?: (value: string, ctx: { previous?: string; props: Record<string, unknown> }) => string;
  format?: (value: string) => string;
  validate?: (value: string, ctx: { required?: boolean; props: Record<string, unknown> }) => string[];
  labelKey?: string;
  getLabelKey?: (props: Record<string, unknown>) => string | undefined;
  placeholder?: string;
  placeholderKey?: string;
  getPlaceholderKey?: (props: Record<string, unknown>) => string | undefined;
  getMaxDigits?: (props: Record<string, unknown>) => number | undefined;
  inputMode?: string;
  inputType?: string;
  helperText?: string;
  maxChars?: number;
  maxDigits?: number;
  parts?: PresetPart[];
}

const digitsOnly = (value: string, max?: number) => {
  const normalized = value.replace(/\D/g, "");
  return typeof max === "number" ? normalized.slice(0, max) : normalized;
};

const formatRuPhoneDigits = (digits: string) => {
  if (!digits) return "";

  const normalized = digits.slice(0, 11);
  const rest = normalized.startsWith("7") ? normalized.slice(1) : normalized;
  let output = "+7";
  if (rest.length === 0) return output;

  const area = rest.slice(0, 3);
  output += ` (${area}`;
  if (area.length === 3) {
    output += ")";
  }
  if (rest.length <= 3) return output;

  const main = rest.slice(3);
  const part1 = main.slice(0, 3);
  output += ` ${part1}`;
  if (main.length <= 3) return output;

  const part2 = main.slice(3, 5);
  output += `-${part2}`;
  if (main.length <= 5) return output;

  const part3 = main.slice(5, 7);
  output += `-${part3}`;
  return output;
};

const formatSnils = (value: string) => {
  const digits = digitsOnly(value, 11);
  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const part3 = digits.slice(6, 9);
  const part4 = digits.slice(9, 11);

  let output = part1;
  if (part2) {
    output += `-${part2}`;
  }
  if (part3) {
    output += `-${part3}`;
  }
  if (part4) {
    output += ` ${part4}`;
  }
  return output;
};

const formatPassportSeries = (value: string) => {
  const digits = digitsOnly(value, 10);
  const part1 = digits.slice(0, 4);
  const part2 = digits.slice(4, 10);
  return part2 ? `${part1} ${part2}` : part1;
};

const formatPassportDepartmentCode = (value: string) => {
  const digits = digitsOnly(value, 6);
  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  return part2 ? `${part1}-${part2}` : part1;
};

const normalizeNamePart = (value: string, maxChars = 50) =>
  value.replace(/\s+/g, " ").trim().slice(0, maxChars);

const innLength = (props: Record<string, unknown>) =>
  props.innLegalEntity ? 10 : 12;

const ogrnLength = (props: Record<string, unknown>) =>
  props.ogrnIp ? 15 : 13;

export const presets: Record<SemanticType, Preset> = {
  email: {
    validate: (value, { required }) => {
      if (!value && !required) return [];
      const normalized = value.trim();
      if (!normalized) return required ? ["Required"] : [];
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
      return isValid ? [] : ["Invalid email"];
    },
    inputMode: "email",
    inputType: "email",
  },
  phone: {
    normalize: (value, { previous }) => {
      let digits = digitsOnly(value);
      if (!digits) return "";
      const prevDigits = previous ? digitsOnly(previous) : "";
      const isDeleting = prevDigits && digits.length < prevDigits.length;
      if (!isDeleting) {
        if (digits.startsWith("8")) {
          digits = `7${digits.slice(1)}`;
        }
        if (!digits.startsWith("7")) {
          digits = `7${digits}`;
        }
      }
      return digits.slice(0, 11);
    },
    format: formatRuPhoneDigits,
    validate: (value, { required }) => {
      const len = digitsOnly(value).length;
      if (!value && !required) return [];
      if (len !== 11) return ["Phone number must be 11 digits"];
      return [];
    },
    placeholder: "+7 (000) 000-00-00",
    inputMode: "tel",
    maxDigits: 11,
  },
  inn: {
    normalize: (value, { props }) => digitsOnly(value, innLength(props)),
    validate: (value, { required, props }) => {
      const len = digitsOnly(value).length;
      const expected = innLength(props);
      if (!value && !required) return [];
      if (len !== expected) return [`INN must be ${expected} digits`];
      return [];
    },
    labelKey: "inputLabels.inn",
    getPlaceholderKey: (props) => (props.innLegalEntity ? "placeholders.inn10" : "placeholders.inn12"),
    getMaxDigits: (props) => innLength(props),
    inputMode: "numeric",
  },
  snils: {
    normalize: (value) => digitsOnly(value, 11),
    format: formatSnils,
    validate: (value, { required }) => {
      const len = digitsOnly(value).length;
      if (!value && !required) return [];
      if (len !== 11) return ["SNILS must be 11 digits"];
      return [];
    },
    labelKey: "inputLabels.snils",
    placeholderKey: "placeholders.snils",
    inputMode: "numeric",
    maxDigits: 11,
  },
  ogrn: {
    normalize: (value, { props }) => digitsOnly(value, ogrnLength(props)),
    validate: (value, { required, props }) => {
      const len = digitsOnly(value).length;
      const expected = ogrnLength(props);
      if (!value && !required) return [];
      if (len !== expected) return [`OGRN must be ${expected} digits`];
      return [];
    },
    getLabelKey: (props) => (props.ogrnIp ? "inputLabels.ogrnIp" : "inputLabels.ogrn"),
    getPlaceholderKey: (props) => (props.ogrnIp ? "placeholders.ogrnIp" : "placeholders.ogrn"),
    getMaxDigits: (props) => ogrnLength(props),
    inputMode: "numeric",
  },
  bik: {
    normalize: (value) => digitsOnly(value, 9),
    validate: (value, { required }) => {
      const len = digitsOnly(value).length;
      if (!value && !required) return [];
      if (len !== 9) return ["BIK must be 9 digits"];
      return [];
    },
    labelKey: "inputLabels.bik",
    placeholderKey: "placeholders.bik",
    inputMode: "numeric",
    maxDigits: 9,
  },
  bank_account: {
    normalize: (value) => digitsOnly(value, 20),
    validate: (value, { required }) => {
      const len = digitsOnly(value).length;
      if (!value && !required) return [];
      if (len !== 20) return ["Account must be 20 digits"];
      return [];
    },
    inputMode: "numeric",
    maxDigits: 20,
  },
  full_name: {
    parts: [
      {
        key: "lastName",
        labelKey: "formParts.fullName.lastName",
        placeholderKey: "formParts.fullName.lastName",
        maxChars: 50,
        hideLengthIndicator: true,
        required: true,
        normalize: (value) => normalizeNamePart(value, 50),
        validate: (value, required) => {
          if (!required) return [];
          return value ? [] : ["Required"];
        },
      },
      {
        key: "firstName",
        labelKey: "formParts.fullName.firstName",
        placeholderKey: "formParts.fullName.firstName",
        maxChars: 50,
        hideLengthIndicator: true,
        required: true,
        normalize: (value) => normalizeNamePart(value, 50),
        validate: (value, required) => {
          if (!required) return [];
          return value ? [] : ["Required"];
        },
      },
      {
        key: "patronymic",
        labelKey: "formParts.fullName.patronymic",
        placeholderKey: "formParts.fullName.patronymic",
        maxChars: 50,
        hideLengthIndicator: true,
        required: false,
        normalize: (value) => normalizeNamePart(value, 50),
      },
    ],
  },
  passport: {
    parts: [
      {
        key: "lastName",
        labelKey: "formParts.fullName.lastName",
        placeholderKey: "formParts.fullName.lastName",
        hiddenProp: "hidePassportFullName",
        maxChars: 50,
        hideLengthIndicator: true,
        normalize: (value) => normalizeNamePart(value, 50),
      },
      {
        key: "firstName",
        labelKey: "formParts.fullName.firstName",
        placeholderKey: "formParts.fullName.firstName",
        hiddenProp: "hidePassportFullName",
        maxChars: 50,
        hideLengthIndicator: true,
        normalize: (value) => normalizeNamePart(value, 50),
      },
      {
        key: "patronymic",
        labelKey: "formParts.fullName.patronymic",
        placeholderKey: "formParts.fullName.patronymic",
        hiddenProp: "hidePassportFullName",
        maxChars: 50,
        hideLengthIndicator: true,
        required: false,
        normalize: (value) => normalizeNamePart(value, 50),
      },
      {
        key: "gender",
        labelKey: "formParts.passport.gender",
        hiddenProp: "hidePassportGender",
        options: [
          { value: "male", labelKey: "formParts.passport.genderMale" },
          { value: "female", labelKey: "formParts.passport.genderFemale" },
        ],
      },
      {
        key: "birthDate",
        labelKey: "formParts.passport.birthDate",
        placeholderKey: "formParts.passport.birthDate",
        hiddenProp: "hidePassportBirthDate",
        inputType: "date",
      },
      {
        key: "seriesNumber",
        labelKey: "formParts.passport.seriesNumber",
        placeholderKey: "formParts.passport.seriesNumber",
        inputMode: "numeric",
        hiddenProp: "hidePassportSeriesNumber",
        maxChars: 11,
        maxDigits: 10,
        normalize: (value) => digitsOnly(value, 10),
        format: formatPassportSeries,
        validate: (value, required) => {
          const len = digitsOnly(value).length;
          if (!required && !value) return [];
          if (len !== 10) return ["Series and number must be 10 digits"];
          return [];
        },
      },
      {
        key: "issuedBy",
        labelKey: "formParts.passport.issuedBy",
        placeholderKey: "formParts.passport.issuedBy",
        hiddenProp: "hidePassportIssuedBy",
        maxChars: 60,
        hideLengthIndicator: true,
        normalize: (value) => value.slice(0, 60),
      },
      {
        key: "issueDate",
        labelKey: "formParts.passport.issueDate",
        placeholderKey: "formParts.passport.issueDate",
        hiddenProp: "hidePassportIssueDate",
        inputType: "date",
      },
      {
        key: "departmentCode",
        labelKey: "formParts.passport.departmentCode",
        placeholderKey: "formParts.passport.departmentCode",
        inputMode: "numeric",
        hiddenProp: "hidePassportDepartmentCode",
        maxChars: 7,
        maxDigits: 6,
        normalize: (value) => digitsOnly(value, 6),
        format: formatPassportDepartmentCode,
        validate: (value, required) => {
          const len = digitsOnly(value).length;
          if (!required && !value) return [];
          if (len !== 6) return ["Department code must be 6 digits"];
          return [];
        },
      },
      {
        key: "birthPlace",
        labelKey: "formParts.passport.birthPlace",
        placeholderKey: "formParts.passport.birthPlace",
        hiddenProp: "hidePassportBirthPlace",
        maxChars: 60,
        hideLengthIndicator: true,
        normalize: (value) => value.slice(0, 60),
      },
    ],
  },
};
