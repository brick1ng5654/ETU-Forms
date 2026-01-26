import type { FormElementModel, SemanticType, WidgetType } from "@/form/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { X, Plus, Trash2, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { MatrixCorrectAnswersModal } from "./MatrixCorrectAnswersModal";
import { MouseEvent } from 'react';
interface PropertiesPanelProps {
  selectedField: FormElementModel | null;
  selectedIds: string[];
  updateField: (id: string, updates: Partial<FormElementModel>) => void;
  deleteField: (id: string) => void;
  deleteSelected: () => void;
  fields: FormElementModel[];
}

interface SortableFieldProps {
  field: FormElementModel;
  isSelected: boolean;
  onSelect: (id: string, event: MouseEvent<HTMLDivElement>) => void;
  onDelete: (id: string) => void;
  updateField: (id: string, updates: Partial<FormElementModel>) => void;
  fields: FormElementModel[];
}

interface SortableOptionItemProps {
  id: string;
  option: string;
  disabled?: boolean;
}

function SortableOptionItem({ id, option, disabled }: SortableOptionItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded border ${
        disabled ? "bg-gray-50 border-gray-200 opacity-60" : "bg-white border-gray-200 hover:bg-gray-50"
      } ${isDragging ? "shadow-lg z-50" : ""}`}
    >
      <div {...attributes} {...listeners} className={`cursor-grab ${disabled ? "cursor-not-allowed" : ""}`}>
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>
      <span className="flex-1 text-sm">{option}</span>
    </div>
  );
}

type PropertyFieldType = "text" | "textarea" | "switch" | "number" | "slider" | "tags" | "select";

type PropertyFieldDef = {
  key: string;
  labelKey: string;
  type: PropertyFieldType;
  target: "label" | "description" | "required" | `props.${string}`;
  maxLength?: number;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  tooltipKey?: string;
  helperKey?: string;
  visible?: (field: FormElementModel) => boolean;
  disabled?: (field: FormElementModel) => boolean;
  guard?: (field: FormElementModel, value: unknown) => boolean;
};

const widgetTypeLabelKey: Record<WidgetType, string> = {
  header: "header",
  text_input: "text",
  textarea: "text",
  number_input: "number",
  select: "select",
  checkbox: "checkbox",
  radio: "radio",
  datetime: "datetime",
  file_upload: "file",
  rating: "rating",
  ranking: "ranking",
  matrix: "matrix",
};

const semanticTypeLabelKey: Record<SemanticType, string> = {
  phone: "phone",
  inn: "inn",
  snils: "snils",
  full_name: "fullname",
  ogrn: "ogrn",
  bik: "bik",
  bank_account: "account",
  passport: "passport",
};

const baseLabelField: PropertyFieldDef = {
  key: "label",
  labelKey: "propert.label",
  type: "textarea",
  target: "label",
  maxLength: 120,
};

const helperTextField: PropertyFieldDef = {
  key: "description",
  labelKey: "propert.helper",
  type: "textarea",
  target: "description",
  maxLength: 1200,
};

const requiredField: PropertyFieldDef = {
  key: "required",
  labelKey: "propert.requered",
  type: "switch",
  target: "required",
};

const placeholderField: PropertyFieldDef = {
  key: "placeholder",
  labelKey: "propert.placeholder",
  type: "textarea",
  target: "props.placeholder",
  maxLength: 80,
};

const propertiesSchemaByWidgetType: Record<WidgetType, PropertyFieldDef[]> = {
  header: [baseLabelField],
  text_input: [baseLabelField, placeholderField, helperTextField, requiredField],
  textarea: [baseLabelField, placeholderField, helperTextField, requiredField],
  number_input: [
    baseLabelField,
    placeholderField,
    helperTextField,
    requiredField,
    {
      key: "allowDecimals",
      labelKey: "propert.allowdec",
      type: "switch",
      target: "props.allowDecimals",
    },
  ],
  select: [
    baseLabelField,
    helperTextField,
    requiredField,
    {
      key: "multiple",
      labelKey: "propert.allowmult",
      type: "switch",
      target: "props.multiple",
    },
  ],
  checkbox: [baseLabelField, helperTextField, requiredField],
  radio: [baseLabelField, helperTextField, requiredField],
  datetime: [
    baseLabelField,
    helperTextField,
    {
      key: "hideDate",
      labelKey: "propert.hideDate",
      type: "switch",
      target: "props.hideDate",
      disabled: (fieldParam) => Boolean((fieldParam.props as Record<string, any>).hideTime),
    },
    {
      key: "hideTime",
      labelKey: "propert.hideTime",
      type: "switch",
      target: "props.hideTime",
      disabled: (fieldParam) => Boolean((fieldParam.props as Record<string, any>).hideDate),
    },
  ],
  file_upload: [
    baseLabelField,
    helperTextField,
    {
      key: "maxFileSize",
      labelKey: "propert.sizefile",
      type: "number",
      target: "props.maxFileSize",
      min: 1,
      max: 100,
      step: 1,
    },
    {
      key: "acceptedFileTypes",
      labelKey: "propert.accepfile",
      type: "tags",
      target: "props.acceptedFileTypes",
      placeholder: ".pdf, .jpg, .png",
    },
  ],
  rating: [
    baseLabelField,
    helperTextField,
    {
      key: "maxRating",
      labelKey: "propert.maxrati",
      type: "slider",
      target: "props.maxRating",
      min: 3,
      max: 10,
      step: 1,
    },
  ],
  ranking: [baseLabelField, helperTextField, requiredField],
  matrix: [
    baseLabelField,
    helperTextField,
    requiredField,
    {
      key: "multiplePerRow",
      labelKey: "propert.matrixMultiplePerRow",
      type: "switch",
      target: "props.multiplePerRow",
    },
  ],
};

const propertiesSchemaBySemanticType: Partial<Record<SemanticType, PropertyFieldDef[]>> = {
  inn: [
    {
      key: "innLegalEntity",
      labelKey: "propert.innLegalEntity",
      type: "switch",
      target: "props.innLegalEntity",
      tooltipKey: "propert.innLegalEntityHelp",
    },
  ],
  ogrn: [
    {
      key: "ogrnIp",
      labelKey: "propert.ogrnIp",
      type: "switch",
      target: "props.ogrnIp",
      tooltipKey: "propert.ogrnHelp",
    },
  ],
  passport: [
    {
      key: "hidePassportSeriesNumber",
      labelKey: "propert.hidePassportSeriesNumber",
      type: "switch",
      target: "props.hidePassportSeriesNumber",
      disabled: (fieldParam) => {
        const props = fieldParam.props as Record<string, any>;
        const visible = [
          !props.hidePassportSeriesNumber,
          !props.hidePassportIssuedBy,
          !props.hidePassportIssueDate,
          !props.hidePassportDepartmentCode,
          !props.hidePassportBirthPlace,
        ].filter(Boolean).length;
        return !props.hidePassportSeriesNumber && visible === 1;
      },
      guard: (fieldParam, value) => {
        if (!value) return true;
        const props = fieldParam.props as Record<string, any>;
        const visible = [
          !props.hidePassportSeriesNumber,
          !props.hidePassportIssuedBy,
          !props.hidePassportIssueDate,
          !props.hidePassportDepartmentCode,
          !props.hidePassportBirthPlace,
        ].filter(Boolean).length;
        return visible > 1;
      },
    },
    {
      key: "hidePassportIssuedBy",
      labelKey: "propert.hidePassportIssuedBy",
      type: "switch",
      target: "props.hidePassportIssuedBy",
      disabled: (fieldParam) => {
        const props = fieldParam.props as Record<string, any>;
        const visible = [
          !props.hidePassportSeriesNumber,
          !props.hidePassportIssuedBy,
          !props.hidePassportIssueDate,
          !props.hidePassportDepartmentCode,
          !props.hidePassportBirthPlace,
        ].filter(Boolean).length;
        return !props.hidePassportIssuedBy && visible === 1;
      },
      guard: (fieldParam, value) => {
        if (!value) return true;
        const props = fieldParam.props as Record<string, any>;
        const visible = [
          !props.hidePassportSeriesNumber,
          !props.hidePassportIssuedBy,
          !props.hidePassportIssueDate,
          !props.hidePassportDepartmentCode,
          !props.hidePassportBirthPlace,
        ].filter(Boolean).length;
        return visible > 1;
      },
    },
    {
      key: "hidePassportIssueDate",
      labelKey: "propert.hidePassportIssueDate",
      type: "switch",
      target: "props.hidePassportIssueDate",
      disabled: (fieldParam) => {
        const props = fieldParam.props as Record<string, any>;
        const visible = [
          !props.hidePassportSeriesNumber,
          !props.hidePassportIssuedBy,
          !props.hidePassportIssueDate,
          !props.hidePassportDepartmentCode,
          !props.hidePassportBirthPlace,
        ].filter(Boolean).length;
        return !props.hidePassportIssueDate && visible === 1;
      },
      guard: (fieldParam, value) => {
        if (!value) return true;
        const props = fieldParam.props as Record<string, any>;
        const visible = [
          !props.hidePassportSeriesNumber,
          !props.hidePassportIssuedBy,
          !props.hidePassportIssueDate,
          !props.hidePassportDepartmentCode,
          !props.hidePassportBirthPlace,
        ].filter(Boolean).length;
        return visible > 1;
      },
    },
    {
      key: "hidePassportDepartmentCode",
      labelKey: "propert.hidePassportDepartmentCode",
      type: "switch",
      target: "props.hidePassportDepartmentCode",
      disabled: (fieldParam) => {
        const props = fieldParam.props as Record<string, any>;
        const visible = [
          !props.hidePassportSeriesNumber,
          !props.hidePassportIssuedBy,
          !props.hidePassportIssueDate,
          !props.hidePassportDepartmentCode,
          !props.hidePassportBirthPlace,
        ].filter(Boolean).length;
        return !props.hidePassportDepartmentCode && visible === 1;
      },
      guard: (fieldParam, value) => {
        if (!value) return true;
        const props = fieldParam.props as Record<string, any>;
        const visible = [
          !props.hidePassportSeriesNumber,
          !props.hidePassportIssuedBy,
          !props.hidePassportIssueDate,
          !props.hidePassportDepartmentCode,
          !props.hidePassportBirthPlace,
        ].filter(Boolean).length;
        return visible > 1;
      },
    },
    {
      key: "hidePassportBirthPlace",
      labelKey: "propert.hidePassportBirthPlace",
      type: "switch",
      target: "props.hidePassportBirthPlace",
      disabled: (fieldParam) => {
        const props = fieldParam.props as Record<string, any>;
        const visible = [
          !props.hidePassportSeriesNumber,
          !props.hidePassportIssuedBy,
          !props.hidePassportIssueDate,
          !props.hidePassportDepartmentCode,
          !props.hidePassportBirthPlace,
        ].filter(Boolean).length;
        return !props.hidePassportBirthPlace && visible === 1;
      },
      guard: (fieldParam, value) => {
        if (!value) return true;
        const props = fieldParam.props as Record<string, any>;
        const visible = [
          !props.hidePassportSeriesNumber,
          !props.hidePassportIssuedBy,
          !props.hidePassportIssueDate,
          !props.hidePassportDepartmentCode,
          !props.hidePassportBirthPlace,
        ].filter(Boolean).length;
        return visible > 1;
      },
    },
  ],
};

const getValueByTarget = (field: FormElementModel, target: PropertyFieldDef["target"]) => {
  if (target === "label") return field.label;
  if (target === "description") return field.description || "";
  if (target === "required") return Boolean(field.required);
  if (target.startsWith("props.")) {
    const key = target.replace("props.", "");
    return (field.props as Record<string, any>)[key];
  }
  return undefined;
};

export function PropertiesPanel({ selectedField, selectedIds, updateField, deleteField, deleteSelected, fields }: PropertiesPanelProps) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [rankingOrderOptions, setRankingOrderOptions] = useState<string[]>([]);
  const [isConditionalSelectOpen, setIsConditionalSelectOpen] = useState(false);
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);
  useEffect(() => {
    if (!selectedField) return;
    const options = (selectedField.props as Record<string, any>).options as string[] | undefined;
    setRankingOrderOptions(options ? [...options] : []);
  }, [selectedField?.id, selectedField?.props]);

  if (selectedIds.length > 1) {
    const panelClassName = isConditionalSelectOpen
      ? "p-4 space-y-6 overflow-y-auto h-full pb-[40vh]"
      : "p-4 space-y-6 overflow-y-auto h-full pb-32";
    const spacerClassName = isConditionalSelectOpen ? "h-[40vh]" : "h-24";
    return (
      <div className={panelClassName}>
        <div className="flex items-center justify-between border-b pb-4">
          <h3 className="font-semibold text-lg">{t("propert.propet")}</h3>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{t("builder.selectedCount", { count: selectedIds.length })}</p>
        </div>
        <div className="grid gap-2">
          <Button variant="destructive" onClick={deleteSelected}>
            {t("builder.deleteSelected")}
          </Button>
        </div>
        <div className={spacerClassName} />
      </div>
    );
  }
  if (!selectedField) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>{t("back.properties")}</p>
      </div>
    );
  }

  const props = selectedField.props as Record<string, any>;
  const hideDate = Boolean(props.hideDate);
  const hideTime = Boolean(props.hideTime);
  const hasOptions = ["select", "radio", "checkbox", "ranking"].includes(selectedField.widgetType);
  const isMatrix = selectedField.widgetType === "matrix";
  const isHeader = selectedField.widgetType === "header";
  const isDatetime = selectedField.widgetType === "datetime";
  const showRequiredToggle = !isHeader && !isDatetime && selectedField.semanticType !== "full_name";
  const schemaFields = propertiesSchemaByWidgetType[selectedField.widgetType].filter((fieldDef) => {
    if (fieldDef.key === "required" && !showRequiredToggle) return false;
    return !fieldDef.visible || fieldDef.visible(selectedField);
  });
  const semanticFields = selectedField.semanticType
    ? (propertiesSchemaBySemanticType[selectedField.semanticType] || [])
    : [];

  const specialized = Boolean(selectedField.semanticType);
  const canHaveCorrectAnswers = !isHeader && selectedField.widgetType !== "file_upload" && !isDatetime && !specialized;

  const updateByTarget = (target: PropertyFieldDef["target"], value: unknown) => {
    if (target === "label") {
      updateField(selectedField.id, { label: value as string });
      return;
    }
    if (target === "description") {
      updateField(selectedField.id, { description: value as string });
      return;
    }
    if (target === "required") {
      updateField(selectedField.id, { required: Boolean(value) });
      return;
    }
    if (target.startsWith("props.")) {
      const key = target.replace("props.", "");
      updateField(selectedField.id, { props: { [key]: value } });
    }
  };

  const renderPropertyField = (fieldDef: PropertyFieldDef) => {
    const value = getValueByTarget(selectedField, fieldDef.target);
    const isDisabled = fieldDef.disabled?.(selectedField) ?? false;
    const showTooltip = Boolean(fieldDef.tooltipKey);

    const label = (
      <div className="flex items-center gap-2">
        <Label>{t(fieldDef.labelKey)}</Label>
        {showTooltip && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t(fieldDef.tooltipKey!)}
                className="h-5 w-5 rounded-full border border-muted-foreground/40 text-muted-foreground text-[11px] leading-none flex items-center justify-center hover:bg-muted"
              >
                ?
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs text-xs leading-relaxed">
              {t(fieldDef.tooltipKey!)}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );

    if (fieldDef.type === "textarea") {
      return (
        <div key={fieldDef.key} className="space-y-2">
          {label}
          <Textarea
            value={String(value ?? "")}
            onChange={(e) => {
              const nextValue = fieldDef.maxLength ? e.target.value.slice(0, fieldDef.maxLength) : e.target.value;
              updateByTarget(fieldDef.target, nextValue);
            }}
            maxLength={fieldDef.maxLength}
            className="min-h-[60px] resize-y break-all"
          />
        </div>
      );
    }

    if (fieldDef.type === "text") {
      return (
        <div key={fieldDef.key} className="space-y-2">
          {label}
          <Input
            value={String(value ?? "")}
            onChange={(e) => {
              const nextValue = fieldDef.maxLength ? e.target.value.slice(0, fieldDef.maxLength) : e.target.value;
              updateByTarget(fieldDef.target, nextValue);
            }}
            placeholder={fieldDef.placeholder}
          />
        </div>
      );
    }

    if (fieldDef.type === "number") {
      return (
        <div key={fieldDef.key} className="space-y-2">
          {label}
          <Input
            type="number"
            min={fieldDef.min}
            max={fieldDef.max}
            step={fieldDef.step}
            value={Number(value ?? fieldDef.min ?? 0)}
            onChange={(e) => updateByTarget(fieldDef.target, parseInt(e.target.value, 10) || fieldDef.min || 0)}
          />
        </div>
      );
    }

    if (fieldDef.type === "slider") {
      const sliderValue = typeof value === "number" ? value : fieldDef.min || 0;
      return (
        <div key={fieldDef.key} className="space-y-2">
          <Label>
            {t(fieldDef.labelKey)} ({sliderValue})
          </Label>
          <Slider
            value={[sliderValue]}
            min={fieldDef.min}
            max={fieldDef.max}
            step={fieldDef.step}
            onValueChange={(val) => updateByTarget(fieldDef.target, val[0])}
          />
        </div>
      );
    }

    if (fieldDef.type === "tags") {
      const tagValue = Array.isArray(value) ? (value as string[]).join(", ") : String(value ?? "");
      return (
        <div key={fieldDef.key} className="space-y-2">
          {label}
          <Input
            placeholder={fieldDef.placeholder}
            value={tagValue}
            onChange={(e) => {
              const nextValue = e.target.value
                .split(",")
                .map((entry) => entry.trim())
                .filter(Boolean);
              updateByTarget(fieldDef.target, nextValue);
            }}
          />
        </div>
      );
    }

    if (fieldDef.type === "switch") {
      return (
        <div key={fieldDef.key} className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
          <div className="space-y-0.5">{label}</div>
          <Switch
            checked={Boolean(value)}
            onCheckedChange={(checked) => {
              if (fieldDef.guard && !fieldDef.guard(selectedField, checked)) {
                return;
              }
              updateByTarget(fieldDef.target, checked);
            }}
            disabled={isDisabled}
          />
        </div>
      );
    }

    if (fieldDef.type === "select") {
      const selectValue = String(value ?? "");
      let selectOptions: { value: string; label: string }[] = [];
      
      // Special handling for matrixValidationMode
      if (fieldDef.key === "matrixValidationMode") {
        
        selectOptions = [
          { value: "any", label: t("propert.matrixValidationModeAny") },
          { value: "all", label: t("propert.matrixValidationModeAll") }
        ];
      }
      
      return (
        <div key={fieldDef.key} className="space-y-2">
          <div className="flex items-center gap-2">
            {label}
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t("propert.matrixCorrPoint")}
                  className="h-4 w-4 rounded-full border border-muted-foreground/40 text-muted-foreground text-[9px] leading-none flex items-center justify-center hover:bg-muted"
                >
                  ?
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs leading-relaxed">
                {t("propert.matrixCorrPoint")}
              </TooltipContent>
            </Tooltip>
          </div>
          
          <Select
            value={selectValue}
            onValueChange={(value) => updateByTarget(fieldDef.target, value || undefined)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("common.selectopt")} />
            </SelectTrigger>
            <SelectContent>
              {selectOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return null;
  };

  const typeLabelKey = selectedField.semanticType
    ? semanticTypeLabelKey[selectedField.semanticType]
    : widgetTypeLabelKey[selectedField.widgetType];

  const options = (props.options as string[]) || [];

  const correctAnswers = (props.correctAnswers as string[]) || [];
  const hasCorrectAnswers = correctAnswers.length > 0;

  const panelClassName = isConditionalSelectOpen
    ? "p-4 space-y-6 overflow-y-auto h-full pb-[40vh]"
    : "p-4 space-y-6 overflow-y-auto h-full pb-32";
  const spacerClassName = isConditionalSelectOpen ? "h-[40vh]" : "h-24";

  return (
    <div className={panelClassName}>
      <div className="flex items-center justify-between border-b pb-4">
        <h3 className="font-semibold text-lg">{t("propert.propet")}</h3>
        <Button
          variant="destructive"
          size="icon"
          className="h-8 w-8"
          onClick={() => deleteField(selectedField.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <Label>{t("propert.fieldType")}</Label>
        <div className="text-sm text-muted-foreground font-medium">{t(`fields.${typeLabelKey}`)}</div>
      </div>

      <div className="space-y-4">
        {schemaFields.map(renderPropertyField)}
        {(selectedField.widgetType === "text_input" || selectedField.widgetType === "textarea") && (
          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label>{t("propert.longtxt")}</Label>
            </div>
            <Switch
              checked={selectedField.widgetType === "textarea"}
              onCheckedChange={(checked) => {
                updateField(selectedField.id, { widgetType: checked ? "textarea" : "text_input" });
              }}
            />
          </div>
        )}
        {semanticFields.length > 0 && (
          <div className="space-y-3 pt-2">
            {selectedField.semanticType === "passport" && (
              <Label>{t("propert.passportFields")}</Label>
            )}
            {semanticFields.map(renderPropertyField)}
            {selectedField.semanticType === "passport" && (
              <p className="text-xs text-muted-foreground">{t("propert.passportFieldWarning")}</p>
            )}
          </div>
        )}

        {(selectedField.widgetType === "text_input" && props.inputType === "email") && (
          <div className="space-y-2">
            <Label>{t("propert.domains")}</Label>
            <Input
              placeholder="example.com, company.org"
              value={Array.isArray(props.allowedDomains) ? props.allowedDomains.join(", ") : ""}
              onChange={(e) => {
                const nextValue = e.target.value
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(Boolean);
                updateField(selectedField.id, { props: { allowedDomains: nextValue } });
              }}
            />
          </div>
        )}

        {selectedField.widgetType === "datetime" && hideDate && hideTime && (
          <p className="text-xs text-destructive">{t("propert.datetimeWarning")}</p>
        )}

        {hasOptions && (
          <div className="space-y-3 pt-2 border-t">
            <Label>{t("propert.variabl")}</Label>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...options];
                      newOptions[index] = e.target.value;
                      updateField(selectedField.id, { props: { options: newOptions } });
                    }}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      const newOptions = options.filter((_, i) => i !== index);
                      updateField(selectedField.id, { props: { options: newOptions } });
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                disabled={selectedField.widgetType === "ranking" && hasCorrectAnswers}
                onClick={() => {
                  const newOptions = [...options, `Option ${options.length + 1}`];
                  updateField(selectedField.id, { props: { options: newOptions } });
                }}
              >
                <Plus className="h-4 w-4 mr-2" /> {t("propert.addopti")}
              </Button>
            </div>
          </div>
        )}

        {isMatrix && (
          <>
            <div className="space-y-3 pt-2 border-t">
              <Label>{t("propert.matrixRows")}</Label>
              <div className="space-y-2">
                {((props.rows as string[]) || []).map((row, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={row}
                      onChange={(e) => {
                        const newRows = [...((props.rows as string[]) || [])];
                        newRows[index] = e.target.value;
                        updateField(selectedField.id, { props: { rows: newRows } });
                      }}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        const newRows = ((props.rows as string[]) || []).filter((_, i) => i !== index);
                        updateField(selectedField.id, { props: { rows: newRows } });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => {
                    const currentRows = (props.rows as string[]) || [];
                    const newRows = [...currentRows, `Row ${currentRows.length + 1}`];
                    updateField(selectedField.id, { props: { rows: newRows } });
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" /> {t("propert.addopti")}
                </Button>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <Label>{t("propert.matrixColumns")}</Label>
              <div className="space-y-2">
                {((props.columns as string[]) || []).map((column, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={column}
                      onChange={(e) => {
                        const newColumns = [...((props.columns as string[]) || [])];
                        newColumns[index] = e.target.value;
                        updateField(selectedField.id, { props: { columns: newColumns } });
                      }}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        const newColumns = ((props.columns as string[]) || []).filter((_, i) => i !== index);
                        updateField(selectedField.id, { props: { columns: newColumns } });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => {
                    const currentColumns = (props.columns as string[]) || [];
                    const newColumns = [...currentColumns, `Column ${currentColumns.length + 1}`];
                    updateField(selectedField.id, { props: { columns: newColumns } });
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" /> {t("propert.addopti")}
                </Button>
              </div>
            </div>
          </>
        )}

        {canHaveCorrectAnswers && (
          <div className="space-y-3 pt-2 border-t mt-2">
            <Label className="text-green-600 flex items-center gap-1">
                  <Check className="h-4 w-4" /> {t("propert.corransw")}
                <Label className="text-green-600 flex items-center gap-1">
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={t("propert.matrixCorrectAnswersFormatHelp")}
                      className="h-4 w-4 rounded-full border border-muted-foreground/40 text-muted-foreground text-[9px] leading-none flex items-center justify-center hover:bg-muted"
                    >
                      ?
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs text-xs leading-relaxed">
                    {t("propert.matrixCorrectAnswersFormatHelp")}
                  </TooltipContent>
                </Tooltip>
              </Label>
            </Label>
            <p className="text-xs text-muted-foreground">
              {hasOptions
                ? selectedField.widgetType === "ranking"
                  ? t("propert.subranj")
                  : t("propert.corranopt")
                : t("propert.subtxt")}
            </p>

            {hasOptions && options.length > 0 ? (
              <div className="space-y-2">
                {selectedField.widgetType === "ranking" ? (
                  <div className="space-y-2">
                    {!hasCorrectAnswers ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-medium">{t("propert.dragToOrder")}</p>
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                          onDragEnd={(event) => {
                            const { active, over } = event;
                            if (over && active.id !== over.id) {
                              const oldIndex = rankingOrderOptions.findIndex((_, idx) => `option-${idx}` === active.id);
                              const newIndex = rankingOrderOptions.findIndex((_, idx) => `option-${idx}` === over.id);
                              if (oldIndex !== -1 && newIndex !== -1) {
                                const reordered = arrayMove(rankingOrderOptions, oldIndex, newIndex);
                                setRankingOrderOptions(reordered);
                              }
                            }
                          }}
                        >
                          <SortableContext
                            items={rankingOrderOptions.map((_, idx) => `option-${idx}`)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-2">
                              {rankingOrderOptions.map((option, index) => (
                                <SortableOptionItem key={`option-${index}`} id={`option-${index}`} option={option} />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                          onClick={() => {
                            updateField(selectedField.id, { props: { correctAnswers: [...rankingOrderOptions] } });
                          }}
                          disabled={rankingOrderOptions.length === 0}
                        >
                          <Check className="h-4 w-4 mr-2" /> {t("propert.fixOrder")}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="p-2 bg-green-50 rounded border border-green-200">
                          <p className="text-xs text-green-700 font-medium mb-1">{t("propert.correctorder")}:</p>
                          <ol className="list-decimal list-inside text-sm text-green-800">
                            {correctAnswers.map((answer, idx) => (
                              <li key={idx}>{answer}</li>
                            ))}
                          </ol>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                          onClick={() => {
                            updateField(selectedField.id, { props: { correctAnswers: undefined } });
                          }}
                        >
                          <X className="h-4 w-4 mr-2" /> {t("propert.cancelorder")}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  options.map((option, index) => {
                    const isSelected = correctAnswers.includes(option);
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 rounded border border-green-100 hover:bg-green-50"
                      >
                        <input
                          type="checkbox"
                          id={`correct-${selectedField.id}-${index}`}
                          checked={isSelected}
                          onChange={(e) => {
                            const currentAnswers = correctAnswers || [];
                            let newAnswers: string[];
                            if (e.target.checked) {
                              if (selectedField.widgetType === "radio" || selectedField.widgetType === "select") {
                                newAnswers = [option];
                              } else {
                                newAnswers = [...currentAnswers, option];
                              }
                            } else {
                              newAnswers = currentAnswers.filter((a) => a !== option);
                            }
                            updateField(selectedField.id, { props: { correctAnswers: newAnswers } });
                          }}
                          className="h-4 w-4 text-green-600 border-green-300 rounded focus:ring-green-500"
                        />
                        <label htmlFor={`correct-${selectedField.id}-${index}`} className="flex-1 text-sm cursor-pointer">
                          {option}
                        </label>
                        {isSelected && <Check className="h-4 w-4 text-green-600" />}
                      </div>
                    );
                  })
                )}
              </div>
            ) : hasOptions ? (
              <p className="text-xs text-muted-foreground italic">Add options first to select correct answers.</p>
            ) : (
              <div className="space-y-2">
                {correctAnswers.map((answer, index) => {
                  // For matrix fields, validate the format and bounds
                  let isInvalid = false;
                  if (selectedField.widgetType === "matrix" && answer !== "") {
                    // Validate format is "number:number"
                    const formatRegex = /^\d+:\d+$/;
                    if (!formatRegex.test(answer)) {
                      isInvalid = true;
                    } else {
                      // Validate numbers are within matrix bounds (1-indexed)
                      const [rowStr, colStr] = answer.split(':');
                      const row = parseInt(rowStr, 10);
                      const col = parseInt(colStr, 10);
                      
                      const rows = (props.rows as string[]) || [];
                      const columns = (props.columns as string[]) || [];
                      
                      if (row < 1 || row > rows.length || col < 1 || col > columns.length) {
                        isInvalid = true;
                      }
                    }
                  }
                  
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={answer}
                        onChange={(e) => {
                          // For matrix fields, validate the format is "number:number" and within bounds
                          const value = e.target.value;
                          if (selectedField.widgetType === "matrix") {
                            // Allow empty values
                            if (value === "") {
                              const newAnswers = [...correctAnswers];
                              newAnswers[index] = value;
                              updateField(selectedField.id, { props: { correctAnswers: newAnswers } });
                              return;
                            }
                            
                            // Validate format is "number:number" and contains only digits and colon
                            const formatRegex = /^\d+:\d+$/;
                            const validCharacters = /^[0-9:]*$/.test(value);
                            if (!validCharacters) {
                              // Invalid characters, don't update
                              return;
                            }
                            if (!formatRegex.test(value)) {
                              // Invalid format, still update to allow typing
                              const newAnswers = [...correctAnswers];
                              newAnswers[index] = value;
                              updateField(selectedField.id, { props: { correctAnswers: newAnswers } });
                              return;
                            }
                            
                            // Validate numbers are within matrix bounds (1-indexed)
                            const [rowStr, colStr] = value.split(':');
                            const row = parseInt(rowStr, 10);
                            const col = parseInt(colStr, 10);
                            
                            const rows = (props.rows as string[]) || [];
                            const columns = (props.columns as string[]) || [];
                            
                            if (row >= 1 && row <= rows.length && col >= 1 && col <= columns.length) {
                              const newAnswers = [...correctAnswers];
                              newAnswers[index] = value;
                              updateField(selectedField.id, { props: { correctAnswers: newAnswers } });
                            } else {
                              // Out of bounds, still update to allow typing
                              const newAnswers = [...correctAnswers];
                              newAnswers[index] = value;
                              updateField(selectedField.id, { props: { correctAnswers: newAnswers } });
                            }
                          } else {
                            // For non-matrix fields, allow any value
                            const newAnswers = [...correctAnswers];
                            newAnswers[index] = value;
                            updateField(selectedField.id, { props: { correctAnswers: newAnswers } });
                          }
                        }}
                        placeholder={t("propert.correctAnswerPlaceholder")}
                        className={`focus-visible:ring-green-500 ${isInvalid ? "border-red-500" : "border-green-200"}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          const newAnswers = correctAnswers.filter((_, i) => i !== index);
                          updateField(selectedField.id, { props: { correctAnswers: newAnswers } });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                  onClick={() => {
                    const newAnswers = [...correctAnswers, ""];
                    updateField(selectedField.id, { props: { correctAnswers: newAnswers } });
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" /> {t("propert.addcorransw")}
                </Button>
                <MatrixCorrectAnswersModal
                  field={selectedField}
                  open={isMatrixModalOpen}
                  onOpenChange={setIsMatrixModalOpen}
                  updateField={updateField}
                />

              </div>
            )}

            <div className="space-y-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMatrixModalOpen(true);
                }}
              > 
                {t("propert.distributePoints")}
              </Button>
            </div>

            {isMatrix && (() => {
      const rows = (props.rows as string[]) || [];
      const columns = (props.columns as string[]) || [];
      const multiplePerRow = Boolean(props.multiplePerRow);
      const matrixCorrectAnswers = (props.correctAnswers as string[]) || [];
      
      if (rows.length === 0 || columns.length === 0) {
        return (
          <p className="text-xs text-muted-foreground italic">
            {t("propert.addMatrixRowsColumns")}
            
          </p>
        );
      }
    })()}
          </div>

          
        )}

        <div className="space-y-3 pt-2 border-t mt-2">
          <Label className="text-blue-600 flex items-center gap-1">
            <Check className="h-4 w-4" /> {t("logic.conditional")}
          </Label>
          <div className="space-y-2">
          <Label>{t("logic.dependsOn")}</Label>
            <Select
              value={(props.conditionalLogic as Record<string, any> | undefined)?.dependsOn || "__none__"}
              onOpenChange={setIsConditionalSelectOpen}
              onValueChange={(value) => {
                const logic = (props.conditionalLogic as Record<string, any>) || { condition: "equals" };
                updateField(selectedField.id, {
                  props: {
                    conditionalLogic: value === "__none__" ? undefined : { ...logic, dependsOn: value },
                  },
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("logic.none")} />
              </SelectTrigger>
              <SelectContent className="max-h-72 w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)]">
                <SelectItem value="__none__">{t("logic.none")}</SelectItem>
                {fields?.filter((field) => field.id !== selectedField.id).map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.label} ({t(`fields.${field.semanticType ? semanticTypeLabelKey[field.semanticType] : widgetTypeLabelKey[field.widgetType]}`)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(props.conditionalLogic as Record<string, any> | undefined)?.dependsOn && (
            <>
              <div className="space-y-2">
                <Label>{t("logic.condition")}</Label>
                <Select
                  value={(props.conditionalLogic as Record<string, any>).condition as string}
                  onValueChange={(value) => {
                    const logic = props.conditionalLogic as Record<string, any>;
                    updateField(selectedField.id, {
                      props: {
                        conditionalLogic: { ...logic, condition: value },
                      },
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите условие" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">{t("logic.equals")}</SelectItem>
                    <SelectItem value="not_equals">{t("logic.not_equals")}</SelectItem>
                    <SelectItem value="answered">{t("logic.answered")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(["equals", "not_equals"].includes((props.conditionalLogic as Record<string, any>).condition as string)) && (
                <div className="space-y-2">
                  <Label>{t("logic.expectedValue")}</Label>
                  {(() => {
                    const dependsOnField = fields.find(
                      (field) => field.id === (props.conditionalLogic as Record<string, any>).dependsOn
                    );
                    const dependsOnOptions = (dependsOnField?.props as Record<string, any>)?.options as string[] | undefined;
                    const hasOptions = dependsOnOptions && dependsOnOptions.length > 0;
                    const dependsOnMultiple = Boolean(
                      (dependsOnField?.props as Record<string, any>)?.multiple
                    );
                    const expectedValue = (props.conditionalLogic as Record<string, any>).expectedValue;

                    if (hasOptions && dependsOnField && dependsOnOptions) {
                      if (dependsOnMultiple) {
                        const currentValues = Array.isArray(expectedValue)
                          ? expectedValue
                          : expectedValue
                          ? [expectedValue]
                          : [];
                        return (
                          <div className="space-y-2">
                            {dependsOnOptions.filter(Boolean).map((option, index) => {
                              const isSelected = currentValues.includes(option);
                              return (
                                <div key={index} className="flex items-center gap-2 p-2 rounded border border-blue-100 hover:bg-blue-50">
                                  <input
                                    type="checkbox"
                                    id={`expected-${selectedField.id}-${index}`}
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const logic = props.conditionalLogic as Record<string, any>;
                                      let newExpectedValue: string | string[];
                                      if (e.target.checked) {
                                        newExpectedValue = [...currentValues, option];
                                      } else {
                                        newExpectedValue = currentValues.filter((v) => v !== option);
                                        if (newExpectedValue.length === 1) newExpectedValue = newExpectedValue[0];
                                      }
                                      updateField(selectedField.id, {
                                        props: {
                                          conditionalLogic: {
                                            ...logic,
                                            expectedValue: Array.isArray(newExpectedValue) && newExpectedValue.length === 0
                                              ? undefined
                                              : newExpectedValue,
                                          },
                                        },
                                      });
                                    }}
                                    className="h-4 w-4 text-blue-600 border-blue-300 rounded focus:ring-blue-500"
                                  />
                                  <label htmlFor={`expected-${selectedField.id}-${index}`} className="flex-1 text-sm cursor-pointer">
                                    {option}
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }

                      const selectedValue = Array.isArray(expectedValue)
                        ? expectedValue[0] || ""
                        : (expectedValue as string) || "";
                      return (
                        <Select
                          value={selectedValue}
                          onValueChange={(value) => {
                            const logic = props.conditionalLogic as Record<string, any>;
                            updateField(selectedField.id, {
                              props: {
                                conditionalLogic: { ...logic, expectedValue: value || undefined },
                              },
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите значение" />
                          </SelectTrigger>
                          <SelectContent>
                            {dependsOnOptions.filter(Boolean).map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    }

                    return (
                      <>
                        <Input
                          value={Array.isArray(expectedValue)
                            ? expectedValue.join(", ")
                            : (expectedValue as string) || ""}
                          onChange={(e) => {
                            const logic = props.conditionalLogic as Record<string, any>;
                            const value = e.target.value;
                            const newExpectedValue = value.includes(",")
                              ? value.split(",").map((entry) => entry.trim()).filter(Boolean)
                              : value;
                            updateField(selectedField.id, {
                              props: {
                                conditionalLogic: {
                                  ...logic,
                                  expectedValue: value ? newExpectedValue : undefined,
                                },
                              },
                            });
                          }}
                          placeholder="Введите ожидаемое значение"
                        />
                        <p className="text-xs text-muted-foreground">
                          Для множественных значений разделяйте запятой
                        </p>
                      </>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className={spacerClassName} />
    </div>
  );
}