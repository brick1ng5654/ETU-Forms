import { FormField } from "@/lib/form-types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { X, Plus, Trash2, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PropertiesPanelProps {
  selectedField: FormField | null;
  updateField: (id: string, updates: Partial<FormField>) => void;
  deleteField: (id: string) => void;
}

export function PropertiesPanel({ selectedField, updateField, deleteField }: PropertiesPanelProps) {
  if (!selectedField) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Select a field on the canvas to edit its properties.</p>
      </div>
    );
  }

  const hasOptions = ["select", "radio", "checkbox", "ranking"].includes(selectedField.type);
  const isRating = selectedField.type === "rating";
  const isText = selectedField.type === "text";
  const isNumber = selectedField.type === "number";
  const isEmail = selectedField.type === "email";
  const isFile = selectedField.type === "file";
  const isHeader = selectedField.type === "header";
  
  // Fields that can have "Correct Answers"
  const canHaveCorrectAnswers = !isHeader && !isFile && selectedField.type !== "category";

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full pb-20">
      <div className="flex items-center justify-between border-b pb-4">
        <h3 className="font-semibold text-lg">Properties</h3>
        <Button 
          variant="destructive" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => deleteField(selectedField.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Label</Label>
          <Textarea 
            value={selectedField.label} 
            onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
            className="min-h-[80px]"
          />
        </div>

        {!isHeader && !["checkbox", "radio", "rating", "file"].includes(selectedField.type) && (
          <div className="space-y-2">
            <Label>Placeholder</Label>
            <Input 
              value={selectedField.placeholder || ""} 
              onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value })}
            />
          </div>
        )}
        
        {!isHeader && (
           <div className="space-y-2">
            <Label>Helper Text</Label>
            <Input 
              value={selectedField.helperText || ""} 
              onChange={(e) => updateField(selectedField.id, { helperText: e.target.value })}
            />
          </div>
        )}

        {/* Correct Answers Section */}
        {canHaveCorrectAnswers && (
          <div className="space-y-3 pt-2 border-t mt-2">
            <Label className="text-green-600 flex items-center gap-1">
              <Check className="h-4 w-4" /> Correct Answer(s)
            </Label>
            <p className="text-xs text-muted-foreground">
              {hasOptions 
                ? (selectedField.type === "ranking" 
                    ? "Drag options in the correct order above, then mark as correct order." 
                    : "Select the correct answer(s) from the options.")
                : "Add valid answers for auto-grading."}
            </p>
            
            {/* For fields with options (select, radio, checkbox, ranking) - show checkboxes to select from options */}
            {hasOptions && selectedField.options && selectedField.options.length > 0 ? (
              <div className="space-y-2">
                {selectedField.type === "ranking" ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      The correct order is the current order of options above. Click "Set Current Order as Correct" to save it.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                      onClick={() => {
                        updateField(selectedField.id, { correctAnswers: [...(selectedField.options || [])] });
                      }}
                    >
                      <Check className="h-4 w-4 mr-2" /> Set Current Order as Correct
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
                  <Plus className="h-4 w-4 mr-2" /> Add Correct Answer
                </Button>
              </div>
            )}
            
            <div className="space-y-2 mt-3">
              <Label className="text-green-600">Points for Correct Answer</Label>
              <Input 
                type="number"
                min="0"
                value={selectedField.points ?? ""}
                onChange={(e) => updateField(selectedField.id, { points: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="0"
                className="border-green-200 focus-visible:ring-green-500"
              />
              <p className="text-xs text-muted-foreground">Points awarded for a correct answer in quiz mode.</p>
            </div>
          </div>
        )}

        {isText && (
          <>
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm mt-4">
              <div className="space-y-0.5">
                <Label>Long Text (Multiline)</Label>
              </div>
              <Switch 
                checked={selectedField.multiline}
                onCheckedChange={(checked) => updateField(selectedField.id, { multiline: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Characters</Label>
              <Input 
                type="number"
                value={selectedField.maxChars || ""} 
                onChange={(e) => updateField(selectedField.id, { maxChars: parseInt(e.target.value) || undefined })}
              />
            </div>
          </>
        )}

        {isNumber && (
          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label>Allow Decimals</Label>
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
              <Label>Max File Size (MB)</Label>
              <Input 
                type="number"
                value={selectedField.maxFileSize || 10}
                onChange={(e) => updateField(selectedField.id, { maxFileSize: parseInt(e.target.value) || 10 })}
              />
            </div>
            <div className="space-y-2">
               <Label>Accepted Types (e.g. .pdf, .jpg)</Label>
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
            <Label>Max Rating Value ({selectedField.maxRating || 5})</Label>
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
             <Label>Allowed Domains (comma separated)</Label>
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
              <Label>Allow Multiple</Label>
            </div>
            <Switch 
              checked={selectedField.multiple}
              onCheckedChange={(checked) => updateField(selectedField.id, { multiple: checked })}
            />
          </div>
        )}

        {!isHeader && (
          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label>Required</Label>
              <div className="text-xs text-muted-foreground">
                Make this field mandatory
              </div>
            </div>
            <Switch 
              checked={selectedField.required}
              onCheckedChange={(checked) => updateField(selectedField.id, { required: checked })}
            />
          </div>
        )}

        {hasOptions && (
          <div className="space-y-3 pt-2">
            <Label>Options</Label>
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
                <Plus className="h-4 w-4 mr-2" /> Add Option
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
