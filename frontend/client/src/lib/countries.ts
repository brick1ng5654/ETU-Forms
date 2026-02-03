import type { FormElementModel } from "@/form/types";

export type CountryOption = {
  code: string;
  labelEn: string;
  labelRu: string;
  search: string;
};

export type CountryOptionWithLabel = CountryOption & {
  label: string;
};

type CountryEntry = {
  code: string;
  labelEn?: string;
  labelRu?: string;
  aliases?: string[];
};

const LEGACY_COUNTRY_OPTIONS = ["Russia", "USA", "China", "Germany", "France"];
const LEGACY_COUNTRY_LABELS = new Set(["Country", "Страна"]);

const COUNTRY_ENTRIES: CountryEntry[] = [
  { code: "AF" },
  { code: "AL" },
  { code: "DZ" },
  { code: "AD" },
  { code: "AO" },
  { code: "AG" },
  { code: "AR" },
  { code: "AM" },
  { code: "AU" },
  { code: "AT" },
  { code: "AZ" },
  { code: "BS" },
  { code: "BH" },
  { code: "BD" },
  { code: "BB" },
  { code: "BY" },
  { code: "BE" },
  { code: "BZ" },
  { code: "BJ" },
  { code: "BT" },
  { code: "BO" },
  { code: "BA" },
  { code: "BW" },
  { code: "BR" },
  { code: "BN" },
  { code: "BG" },
  { code: "BF" },
  { code: "BI" },
  { code: "KH" },
  { code: "CM" },
  { code: "CA" },
  { code: "CV" },
  { code: "CF" },
  { code: "TD" },
  { code: "CL" },
  { code: "CN" },
  { code: "CO" },
  { code: "KM" },
  { code: "CG" },
  { code: "CR" },
  { code: "CI" },
  { code: "HR" },
  { code: "CU" },
  { code: "CY" },
  { code: "CZ" },
  { code: "KP" },
  { code: "CD" },
  { code: "DK" },
  { code: "DJ" },
  { code: "DM" },
  { code: "DO" },
  { code: "EC" },
  { code: "EG" },
  { code: "SV" },
  { code: "GQ" },
  { code: "ER" },
  { code: "EE" },
  { code: "ET" },
  { code: "FJ" },
  { code: "FI" },
  { code: "FR" },
  { code: "GA" },
  { code: "GM" },
  { code: "GE" },
  { code: "DE" },
  { code: "GH" },
  { code: "GR" },
  { code: "GD" },
  { code: "GT" },
  { code: "GN" },
  { code: "GW" },
  { code: "GY" },
  { code: "HT" },
  { code: "HN" },
  { code: "HU" },
  { code: "IS" },
  { code: "IN" },
  { code: "ID" },
  { code: "IR" },
  { code: "IQ" },
  { code: "IE" },
  { code: "IL" },
  { code: "IT" },
  { code: "JM" },
  { code: "JP" },
  { code: "JO" },
  { code: "KZ" },
  { code: "KE" },
  { code: "KI" },
  { code: "KW" },
  { code: "KG" },
  { code: "LA" },
  { code: "LV" },
  { code: "LB" },
  { code: "LS" },
  { code: "LR" },
  { code: "LY" },
  { code: "LI" },
  { code: "LT" },
  { code: "LU" },
  { code: "MG" },
  { code: "MW" },
  { code: "MY" },
  { code: "MV" },
  { code: "ML" },
  { code: "MT" },
  { code: "MH" },
  { code: "MR" },
  { code: "MU" },
  { code: "MX" },
  { code: "FM" },
  { code: "MC" },
  { code: "MN" },
  { code: "ME" },
  { code: "MA" },
  { code: "MZ" },
  { code: "MM" },
  { code: "NA" },
  { code: "NR" },
  { code: "NP" },
  { code: "NL" },
  { code: "NZ" },
  { code: "NI" },
  { code: "NE" },
  { code: "NG" },
  { code: "NO" },
  { code: "OM" },
  { code: "PK" },
  { code: "PW" },
  { code: "PA" },
  { code: "PG" },
  { code: "PY" },
  { code: "PE" },
  { code: "PH" },
  { code: "PL" },
  { code: "PT" },
  { code: "QA" },
  { code: "KR" },
  { code: "MD" },
  { code: "RO" },
  { code: "RU", aliases: ["Russia", "Russian Federation", "РФ", "Российская Федерация"] },
  { code: "RW" },
  { code: "KN" },
  { code: "LC" },
  { code: "VC" },
  { code: "WS" },
  { code: "SM" },
  { code: "ST" },
  { code: "SA" },
  { code: "SN" },
  { code: "RS" },
  { code: "SC" },
  { code: "SL" },
  { code: "SG" },
  { code: "SK" },
  { code: "SI" },
  { code: "SB" },
  { code: "SO" },
  { code: "ZA" },
  { code: "SS" },
  { code: "ES" },
  { code: "LK" },
  { code: "SD" },
  { code: "SR" },
  { code: "SZ" },
  { code: "SE" },
  { code: "CH" },
  { code: "SY" },
  { code: "TJ" },
  { code: "TH" },
  { code: "MK" },
  { code: "TL" },
  { code: "TG" },
  { code: "TO" },
  { code: "TT" },
  { code: "TN" },
  { code: "TR" },
  { code: "TM" },
  { code: "TV" },
  { code: "UG" },
  { code: "UA" },
  { code: "AE" },
  { code: "GB", aliases: ["UK", "Great Britain"] },
  { code: "TZ" },
  {
    code: "US",
    labelEn: "United States of America",
    labelRu: "Соединенные Штаты Америки",
    aliases: [
      "USA",
      "United States",
      "United States of America",
      "America",
      "США",
      "Соединенные Штаты",
      "Соединенные Штаты Америки",
      "Америка",
    ],
  },
  { code: "UY" },
  { code: "UZ" },
  { code: "VU" },
  { code: "VE" },
  { code: "VN" },
  { code: "YE" },
  { code: "ZM" },
  { code: "ZW" },
  { code: "VA" },
  {
    code: "PS",
    labelEn: "Palestine",
    labelRu: "Палестина",
    aliases: ["State of Palestine", "Государство Палестина"],
  },
  {
    code: "TW",
    labelEn: "Taiwan",
    labelRu: "Тайвань",
    aliases: ["Republic of China", "Chinese Taipei", "Китайская Республика", "Китайский Тайбэй"],
  },
  {
    code: "EH",
    labelEn: "Sahrawi Arab Democratic Republic",
    labelRu: "Сахарская Арабская Демократическая Республика",
    aliases: ["Western Sahara", "SADR", "САДР", "Западная Сахара"],
  },
  {
    code: "XK",
    labelEn: "Kosovo",
    labelRu: "Косово",
    aliases: ["Republic of Kosovo", "Республика Косово", "Kosova"],
  },
  {
    code: "XA",
    labelEn: "Abkhazia",
    labelRu: "Абхазия",
    aliases: ["Republic of Abkhazia", "Республика Абхазия"],
  },
  {
    code: "XB",
    labelEn: "South Ossetia",
    labelRu: "Южная Осетия",
    aliases: [
      "Republic of South Ossetia",
      "Республика Южная Осетия",
      "South Ossetia-Alania",
      "Южная Осетия - Алания",
    ],
  },
  {
    code: "XC",
    labelEn: "Somaliland",
    labelRu: "Сомалиленд",
    aliases: ["Republic of Somaliland", "Республика Сомалиленд"],
  },
  {
    code: "XD",
    labelEn: "Northern Cyprus",
    labelRu: "Турецкая Республика Северного Кипра",
    aliases: ["Turkish Republic of Northern Cyprus", "TRNC", "ТРСК", "Северный Кипр"],
  },
];

export const normalizeCountrySearch = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0400-\u04ff]+/g, " ")
    .trim();

type CountryBase = {
  list: CountryOption[];
  byCode: Map<string, CountryOption>;
  byName: Map<string, string>;
  codes: string[];
};

let cachedBase: CountryBase | null = null;
let cachedOptionsByLocale: Record<string, CountryOptionWithLabel[]> = {};

const buildCountryBase = (): CountryBase => {
  let displayNamesEn: Intl.DisplayNames | null = null;
  let displayNamesRu: Intl.DisplayNames | null = null;
  try {
    displayNamesEn = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    displayNamesEn = null;
  }
  try {
    displayNamesRu = new Intl.DisplayNames(["ru"], { type: "region" });
  } catch {
    displayNamesRu = null;
  }

  const byCode = new Map<string, CountryOption>();
  const byName = new Map<string, string>();
  const list: CountryOption[] = [];

  const addEntry = (entry: CountryEntry) => {
    const code = entry.code.toUpperCase();
    if (byCode.has(code)) return;
    const labelEn = entry.labelEn || displayNamesEn?.of(code) || code;
    const labelRu = entry.labelRu || displayNamesRu?.of(code) || labelEn;
    const aliases = entry.aliases ?? [];
    const search = normalizeCountrySearch(`${labelEn} ${labelRu} ${code} ${aliases.join(" ")}`);
    const country = { code, labelEn, labelRu, search };
    list.push(country);
    byCode.set(code, country);
    byName.set(normalizeCountrySearch(labelEn), code);
    byName.set(normalizeCountrySearch(labelRu), code);
    aliases.forEach((alias) => {
      byName.set(normalizeCountrySearch(alias), code);
    });
  };

  COUNTRY_ENTRIES.forEach(addEntry);

  return { list, byCode, byName, codes: list.map((entry) => entry.code) };
};

const getCountryBase = () => {
  if (!cachedBase) {
    cachedBase = buildCountryBase();
  }
  return cachedBase;
};

export const getCountryCodes = () => getCountryBase().codes;

export const getCountryOptions = (locale: string): CountryOptionWithLabel[] => {
  const key = locale.toLowerCase().startsWith("ru") ? "ru" : "en";
  if (cachedOptionsByLocale[key]) {
    return cachedOptionsByLocale[key];
  }

  const base = getCountryBase();
  const options = base.list
    .map((entry) => ({
      ...entry,
      label: key === "ru" ? entry.labelRu : entry.labelEn,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, key));

  cachedOptionsByLocale[key] = options;
  return options;
};

export const getCountryLabel = (code: string, locale: string) => {
  const entry = getCountryBase().byCode.get(code.toUpperCase());
  if (!entry) return undefined;
  return locale.toLowerCase().startsWith("ru") ? entry.labelRu : entry.labelEn;
};

export const resolveCountryCode = (value?: string | null) => {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  const byCode = getCountryBase().byCode;
  const asCode = normalized.toUpperCase();
  if (byCode.has(asCode)) {
    return asCode;
  }
  const key = normalizeCountrySearch(normalized);
  return getCountryBase().byName.get(key);
};

const isLegacyCountryOptions = (options?: string[]) => {
  if (!options) return false;
  if (options.length !== LEGACY_COUNTRY_OPTIONS.length) return false;
  return options.every((option, index) => option === LEGACY_COUNTRY_OPTIONS[index]);
};

export const isCountryField = (field: FormElementModel) => {
  if (field.widgetType !== "select") return false;
  const props = field.props as Record<string, unknown>;
  if (props.optionsSource === "countries") return true;
  const label = field.label?.trim() ?? "";
  const options = (props.options as string[]) || [];
  return LEGACY_COUNTRY_LABELS.has(label) && isLegacyCountryOptions(options);
};
