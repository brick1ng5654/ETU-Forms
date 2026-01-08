import { FormField } from "@/lib/form-types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { X, Plus, Trash2, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from 'react-i18next';
import { Languages } from "lucide-react";

interface PropertiesPanelProps {
  selectedField: FormField | null;
  updateField: (id: string, updates: Partial<FormField>) => void;
  deleteField: (id: string) => void;
  fields: FormField[];
}

export function PropertiesPanel({ selectedField, updateField, deleteField, fields }: PropertiesPanelProps) {
  const { t, i18n } = useTranslation()
  if (!selectedField) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>{t("back.properties")}</p>
      </div>
    );
  }

  const hasOptions = ["select", "radio", "checkbox", "ranking"].includes(selectedField.type);
  const isRating = selectedField.type === "rating";
  const isNumber = selectedField.type === "number";
  const isEmail = selectedField.type === "email";
  const isFile = selectedField.type === "file";
  const isHeader = selectedField.type === "header";
  const isDatetime = selectedField.type === "datetime";
  const isText = selectedField.type === "text";
  
  // Specialized field types that should not have correct answers
  const specializedTypes = ["fullname", "phone", "passport", "inn", "snils", "account", "country", "ogrn", "bik"];
  const isSpecialized = specializedTypes.includes(selectedField.type);
  
  // Fields that can have "Correct Answers"
  const canHaveCorrectAnswers = !isHeader && !isFile && selectedField.type !== "category" && !isDatetime && !isSpecialized;

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full pb-20">
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
            <div className="text-sm text-muted-foreground font-medium">
              {t(`fields.${selectedField.type}`)}
            </div>
        </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t("propert.label")}</Label>
          <Textarea 
            value={selectedField.label} 
            onChange={(e) => {
              console.log('Updating label, e.target.value:', e.target.value, 'type:', typeof e.target.value);
              const value = e.target.value ? e.target.value.slice(0, 120) : '';
              console.log('New label value:', value);
              updateField(selectedField.id, { label: value });
            }}
            maxLength={120}
            className="min-h-[80px]"
          />
        </div>

        {!isHeader && !["checkbox", "radio", "rating", "file", "datetime", "fullname"].includes(selectedField.type) && (
          <div className="space-y-2">
            <Label>{t("propert.placeholder")}</Label>
            <Textarea
              value={selectedField.placeholder || ""}
              onChange={(e) => {
                const value = e.target.value.slice(0, 80);
                updateField(selectedField.id, { placeholder: value });
              }}
              maxLength={80}
              className="min-h-[44px] resize-y break-all"
            />
          </div>
        )}
        
        {!isHeader && (
          <div className="space-y-2">
            <Label>{t("propert.helper")}</Label>
            <Textarea
              value={selectedField.helperText || ""}
              onChange={(e) => {
                const value = e.target.value.slice(0, 1200);
                updateField(selectedField.id, { helperText: value });
              }}
              maxLength={1200}
              className="min-h-[60px] resize-y break-all"
            />
          </div>
        )}

        {/* Correct Answers Section */}
        {canHaveCorrectAnswers && (
          <div className="space-y-3 pt-2 border-t mt-2">
            <Label className="text-green-600 flex items-center gap-1">
              <Check className="h-4 w-4" /> {t("propert.corransw")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {hasOptions 
                ? (selectedField.type === "ranking" 
                    ? t("propert.subranj")
                    : t("propert.corranopt"))
                    : t("propert.subtxt")}
            </p>
            
            {/* For fields with options (select, radio, checkbox, ranking) - show checkboxes to select from options */}
            {hasOptions && selectedField.options && selectedField.options.length > 0 ? (
              <div className="space-y-2">
                {selectedField.type === "ranking" ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {t("propert.subranji")}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                      onClick={() => {
                        updateField(selectedField.id, { correctAnswers: [...(selectedField.options || [])] });
                      }}
                    >
                      <Check className="h-4 w-4 mr-2" /> {t("propert.curorder")}
                    </Button>
                    {selectedField.correctAnswers && selectedField.correctAnswers.length > 0 && (
                      <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                        <p className="text-xs text-green-700 font-medium mb-1">Correct order:</p>
                        <ol className="list-decimal list-inside text-sm text-green-800">
                          {selectedField.correctAnswers.map((answer, idx) => (
                            <li key={idx}>{answer}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ) : (
                  selectedField.options.map((option, index) => {
                    const isSelected = selectedField.correctAnswers?.includes(option) || false;
                    return (
                      <div key={index} className="flex items-center gap-2 p-2 rounded border border-green-100 hover:bg-green-50">
                        <input
                          type="checkbox"
                          id={`correct-${selectedField.id}-${index}`}
                          checked={isSelected}
                          onChange={(e) => {
                            const currentAnswers = selectedField.correctAnswers || [];
                            let newAnswers: string[];
                            if (e.target.checked) {
                              if (selectedField.type === "radio" || selectedField.type === "select") {
                                newAnswers = [option];
                              } else {
                                newAnswers = [...currentAnswers, option];
                              }
                            } else {
                              newAnswers = currentAnswers.filter(a => a !== option);
                            }
                            updateField(selectedField.id, { correctAnswers: newAnswers });
                          }}
                          className="h-4 w-4 text-green-600 border-green-300 rounded focus:ring-green-500"
                        />
                        <label 
                          htmlFor={`correct-${selectedField.id}-${index}`}
                          className="flex-1 text-sm cursor-pointer"
                        >
                          {option}
                        </label>
                        {isSelected && <Check className="h-4 w-4 text-green-600" />}
                      </div>
                    );
                  })
                )}
                {selectedField.options.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Add options first to select correct answers.</p>
                )}
              </div>
            ) : hasOptions ? (
              <p className="text-xs text-muted-foreground italic">Add options first to select correct answers.</p>
            ) : (
              <div className="space-y-2">
                {selectedField.correctAnswers?.map((answer, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input 
                      value={answer} 
                      onChange={(e) => {
                        const newAnswers = [...(selectedField.correctAnswers || [])];
                        newAnswers[index] = e.target.value;
                        updateField(selectedField.id, { correctAnswers: newAnswers });
                      }}
                      placeholder="Enter correct answer"
                      className="border-green-200 focus-visible:ring-green-500"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        const newAnswers = selectedField.correctAnswers?.filter((_, i) => i !== index);
                        updateField(selectedField.id, { correctAnswers: newAnswers });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                  onClick={() => {
                    const newAnswers = [...(selectedField.correctAnswers || []), ""];
                    updateField(selectedField.id, { correctAnswers: newAnswers });
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" /> {t("propert.addcorransw")}
                </Button>
              </div>
            )}
            
            <div className="space-y-2 mt-3">
              <Label className="text-green-600">{t("propert.pointcorr")}</Label>
              <Input 
                type="number"
                min="0"
                value={selectedField.points ?? ""}
                onChange={(e) => updateField(selectedField.id, { points: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="0"
                className="border-green-200 focus-visible:ring-green-500"
              />
              <p className="text-xs text-muted-foreground">{t("propert.subpoint")}</p>
            </div>
          </div>
        )}

        {/* Conditional Logic Section */}
        <div className="space-y-3 pt-2 border-t mt-2">
          <Label className="text-blue-600 flex items-center gap-1">
            <Check className="h-4 w-4" /> {t("logic.conditional")}
          </Label>
          <div className="space-y-2">
            <Label>{t("logic.dependsOn")}</Label>
            <Select
              value={selectedField.conditionalLogic?.dependsOn || "__none__"}
              onValueChange={(value) => {
                const logic = selectedField.conditionalLogic || { condition: "equals" };
                updateField(selectedField.id, {
                  conditionalLogic: value === "__none__" ? undefined : { ...logic, dependsOn: value }
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("logic.none")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("logic.none")}</SelectItem>
                {fields?.filter(f => f.id !== selectedField.id).map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.label} ({t(`fields.${field.type}`)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedField.conditionalLogic?.dependsOn && (
            <>
              <div className="space-y-2">
                <Label>{t("logic.condition")}</Label>
                <Select
                  value={selectedField.conditionalLogic.condition || ""}
                  onValueChange={(value) => {
                    const logic = selectedField.conditionalLogic!;
                    updateField(selectedField.id, {
                      conditionalLogic: { ...logic, condition: value as any }
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

              {(selectedField.conditionalLogic.condition === "equals" || selectedField.conditionalLogic.condition === "not_equals") && (
                <div className="space-y-2">
                  <Label>{t("logic.expectedValue")}</Label>
                  {(() => {
                    const dependsOnField = fields.find(f => f.id === selectedField.conditionalLogic!.dependsOn);
                    const hasOptions = dependsOnField && dependsOnField.options && dependsOnField.options.length > 0;
                    if (hasOptions && dependsOnField && dependsOnField.options) {
                      if (dependsOnField.multiple) {
                        // Multiple selection with checkboxes
                        return (
                          <div className="space-y-2">
                            {dependsOnField.options.filter(Boolean).map((option, index) => {
                              const expectedValue = selectedField.conditionalLogic!.expectedValue;
                              const currentValues = Array.isArray(expectedValue) ? expectedValue : expectedValue ? [expectedValue] : [];
                              const isSelected = currentValues.includes(option);
                              return (
                                <div key={index} className="flex items-center gap-2 p-2 rounded border border-blue-100 hover:bg-blue-50">
                                  <input
                                    type="checkbox"
                                    id={`expected-${selectedField.id}-${index}`}
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const logic = selectedField.conditionalLogic!;
                                      let newExpectedValue: string | string[];
                                      if (e.target.checked) {
                                        newExpectedValue = [...currentValues, option];
                                      } else {
                                        newExpectedValue = currentValues.filter(v => v !== option);
                                        if (newExpectedValue.length === 1) newExpectedValue = newExpectedValue[0];
                                      }
                                      updateField(selectedField.id, {
                                        conditionalLogic: { ...logic, expectedValue: newExpectedValue.length > 0 ? newExpectedValue : undefined }
                                      });
                                    }}
                                    className="h-4 w-4 text-blue-600 border-blue-300 rounded focus:ring-blue-500"
                                  />
                                  <label
                                    htmlFor={`expected-${selectedField.id}-${index}`}
                                    className="flex-1 text-sm cursor-pointer"
                                  >
                                    {option}
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        );
                      } else {
                        // Single selection with select
                        const expectedValue = selectedField.conditionalLogic!.expectedValue;
                        return (
                          <Select
                            value={Array.isArray(expectedValue)
                              ? expectedValue[0] || ""
                              : (expectedValue || "")}
                            onValueChange={(value) => {
                              const logic = selectedField.conditionalLogic!;
                              updateField(selectedField.id, {
                                conditionalLogic: { ...logic, expectedValue: value || undefined }
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите значение" />
                            </SelectTrigger>
                            <SelectContent>
                              {dependsOnField.options.filter(Boolean).map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      }
                    } else {
                      // Fallback to input
                      const expectedValue = selectedField.conditionalLogic!.expectedValue;
                      return (
                        <>
                          <Input
                            value={Array.isArray(expectedValue)
                              ? expectedValue.join(", ")
                              : (expectedValue || "")}
                            onChange={(e) => {
                              const logic = selectedField.conditionalLogic!;
                              const value = e.target.value;
                              // Для множественных значений разделять по запятой
                              const newExpectedValue = value.includes(",")
                                ? value.split(",").map(v => v.trim()).filter(Boolean)
                                : value;
                              updateField(selectedField.id, {
                                conditionalLogic: { ...logic, expectedValue: value ? newExpectedValue : undefined }
                              });
                            }}
                            placeholder="Введите ожидаемое значение"
                          />
                          <p className="text-xs text-muted-foreground">
                            Для множественных значений разделяйте запятой
                          </p>
                        </>
                      );
                    }
                  })()}
                </div>
              )}
            </>
          )}
        </div>
        <hr className="border-t border-border my-4" />
        {isText && (
          <>
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm mt-4">
              <div className="space-y-0.5">
                <Label>{t("propert.longtxt")}</Label>
              </div>
              <Switch 
                checked={selectedField.multiline}
                onCheckedChange={(checked) => updateField(selectedField.id, { multiline: checked })}
              />
            </div>
          </>
        )}

        {isNumber && (
          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label>{t("propert.allowdec")}</Label>
            </div>
            <Switch 
              checked={selectedField.allowDecimals}
              onCheckedChange={(checked) => updateField(selectedField.id, { allowDecimals: checked })}
            />
          </div>
        )}

        {isFile && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("propert.sizefile")}</Label>
              <Input 
                type="number"
                value={selectedField.maxFileSize || 10}
                onChange={(e) => updateField(selectedField.id, { maxFileSize: parseInt(e.target.value) || 10 })}
              />
            </div>
            <div className="space-y-2">
               <Label>{t("propert.accepfile")}</Label>
               <Input 
                 placeholder=".pdf, .jpg, .png"
                 value={selectedField.acceptedFileTypes?.join(", ") || ""}
                 onChange={(e) => updateField(selectedField.id, { 
                   acceptedFileTypes: e.target.value.split(",").map(d => d.trim()).filter(Boolean) 
                 })}
               />
            </div>
          </div>
        )}

        {isRating && (
           <div className="space-y-2">
            <Label>{t("propert.maxrati")} ({selectedField.maxRating || 5})</Label>
            <Slider 
              value={[selectedField.maxRating || 5]}
              min={3}
              max={10}
              step={1}
              onValueChange={(val) => updateField(selectedField.id, { maxRating: val[0] })}
            />
           </div>
        )}

        {isEmail && (
          <div className="space-y-2">
             <Label>{t("propert.domains")}</Label>
             <Input 
               placeholder="example.com, company.org"
               value={selectedField.allowedDomains?.join(", ") || ""}
               onChange={(e) => updateField(selectedField.id, { 
                 allowedDomains: e.target.value.split(",").map(d => d.trim()).filter(Boolean) 
               })}
             />
          </div>
        )}
        
        {selectedField.type === "select" && (
           <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label>{t("propert.allowmult")}</Label>
            </div>
            <Switch 
              checked={selectedField.multiple}
              onCheckedChange={(checked) => updateField(selectedField.id, { multiple: checked })}
            />
          </div>
        )}

        {isDatetime && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <Label>{t("propert.hideDate")}</Label>
              </div>
              <Switch 
                checked={selectedField.hideDate || false}
                onCheckedChange={(checked) => {
                  // Prevent hiding both date and time
                  if (checked && selectedField.hideTime) {
                    return;
                  }
                  updateField(selectedField.id, { hideDate: checked });
                }}
                disabled={selectedField.hideTime}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <Label>{t("propert.hideTime")}</Label>
              </div>
              <Switch 
                checked={selectedField.hideTime || false}
                onCheckedChange={(checked) => {
                  // Prevent hiding both date and time
                  if (checked && selectedField.hideDate) {
                    return;
                  }
                  updateField(selectedField.id, { hideTime: checked });
                }}
                disabled={selectedField.hideDate}
              />
            </div>
            {(selectedField.hideDate && selectedField.hideTime) && (
              <p className="text-xs text-destructive">{t("propert.datetimeWarning")}</p>
            )}
          </div>
        )}

        {!isHeader && !isDatetime && selectedField.type !== "fullname" && (
          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label>{t("propert.requered")}</Label>
            </div>
            <Switch 
              checked={selectedField.required}
              onCheckedChange={(checked) => updateField(selectedField.id, { required: checked })}
            />
          </div>
        )}
        <hr className="border-t border-border my-1" />
        {hasOptions && (
          <div className="space-y-3 pt-2">
            <Label>{t("propert.variabl")}</Label>
            <div className="space-y-2">
              {selectedField.options?.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input 
                    value={option} 
                    onChange={(e) => {
                      const newOptions = [...(selectedField.options || [])];
                      newOptions[index] = e.target.value;
                      updateField(selectedField.id, { options: newOptions });
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      const newOptions = selectedField.options?.filter((_, i) => i !== index);
                      updateField(selectedField.id, { options: newOptions });
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
                  const newOptions = [...(selectedField.options || []), `Option ${(selectedField.options?.length || 0) + 1}`];
                  updateField(selectedField.id, { options: newOptions });
                }}
              >
                <Plus className="h-4 w-4 mr-2" /> {t("propert.addopti")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
