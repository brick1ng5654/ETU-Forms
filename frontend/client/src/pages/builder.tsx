import { useState, useRef, useEffect, useCallback } from "react";
import type { MouseEvent } from "react";
import { nanoid } from "nanoid";
import type { FormElementModel, FormSchema } from "@/form/types";
import { FormCanvas, getIconForElement } from "@/components/form-builder/FormCanvas";
import { PropertiesPanel } from "@/components/form-builder/PropertiesPanel";
import FormPreview from "@/components/form-builder/FormPreview";
import { ToolboxItem, ToolboxItemDefinition } from "@/components/form-builder/ToolboxItem";
import { Button } from "@/components/ui/button";
import { 
  Eye, Share2, Save, ChevronLeft, Upload, Download, FileJson, 
  PanelLeftClose, PanelLeftOpen, Plus, X, Calendar as CalendarIcon
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { storage } from "@/lib/storage";
import { useRoute, useLocation } from "wouter";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { fromStructureJson } from "@/form/adapters/fromStructureJson";

import { useTranslation } from 'react-i18next';
import { Languages } from "lucide-react";

const TOOLBOX_ITEMS: ToolboxItemDefinition[] = [
  // Basic
  { widgetType: "header", labelKey: "header", category: "Basic" },
  { widgetType: "textarea", labelKey: "text", category: "Basic" },
  { widgetType: "number_input", labelKey: "number", category: "Basic" },

  // Choice
  { widgetType: "select", labelKey: "select", category: "Choice" },
  { widgetType: "checkbox", labelKey: "checkbox", category: "Choice" },
  { widgetType: "radio", labelKey: "radio", category: "Choice" },

  // Advanced
  { widgetType: "datetime", labelKey: "datetime", category: "Advanced" },
  { widgetType: "text_input", labelKey: "email", category: "Advanced", props: { inputType: "email" } },
  { widgetType: "rating", labelKey: "rating", category: "Advanced" },
  { widgetType: "ranking", labelKey: "ranking", category: "Advanced" },
  { widgetType: "file_upload", labelKey: "file", category: "Advanced" },

  // Specialized
  { widgetType: "text_input", semanticType: "full_name", labelKey: "fullname", category: "Specialized" },
  { widgetType: "text_input", semanticType: "phone", labelKey: "phone", category: "Specialized" },
  { widgetType: "text_input", semanticType: "passport", labelKey: "passport", category: "Specialized" },
  { widgetType: "text_input", semanticType: "inn", labelKey: "inn", category: "Specialized" },
  { widgetType: "text_input", semanticType: "snils", labelKey: "snils", category: "Specialized" },
  { widgetType: "text_input", semanticType: "bank_account", labelKey: "account", category: "Specialized" },
  { widgetType: "select", labelKey: "country", category: "Specialized", props: { options: ["Russia", "USA", "China", "Germany", "France"] } },
  { widgetType: "text_input", semanticType: "ogrn", labelKey: "ogrn", category: "Specialized" },
  { widgetType: "text_input", semanticType: "bik", labelKey: "bik", category: "Specialized" },
];

export default function Builder({ params }: { params: { id?: string } }) {
  const [location, setLocation] = useLocation();
  const [forms, setForms] = useState<FormSchema[]>([]);
  const [activeFormId, setActiveFormId] = useState<string | null>(null);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<FormSchema[]>([]);
  const [redoHistory, setRedoHistory] = useState<FormSchema[]>([]);
  const isUndoingRef = useRef(false);
  const isRedoingRef = useRef(false);
  const lastHistoryKeyRef = useRef<string | null>(null);
  const lastHistoryAtRef = useRef(0);
  const MAX_HISTORY = 50;
  const HISTORY_MERGE_WINDOW_MS = 2000;

  const handleSelectField = (id: string, event: MouseEvent<HTMLDivElement>) => {
    console.log('Selecting field:', id);
    if (event.shiftKey && lastSelectedId) {
      const currentIndex = fields.findIndex(f => f.id === id);
      const lastIndex = fields.findIndex(f => f.id === lastSelectedId);
      if (currentIndex !== -1 && lastIndex !== -1) {
        const [start, end] = currentIndex < lastIndex ? [currentIndex, lastIndex] : [lastIndex, currentIndex];
        const rangeIds = fields.slice(start, end + 1).map(f => f.id);
        setSelectedIds(rangeIds);
        setLastSelectedId(id);
        return;
      }
    }

    if (event.metaKey || event.ctrlKey) {
      setSelectedIds(prev => {
        if (prev.includes(id)) {
          return prev.filter(existingId => existingId !== id);
        }
        return [...prev, id];
      });
      setLastSelectedId(id);
      return;
    }

    setSelectedIds([id]);
    setLastSelectedId(id);
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setLastSelectedId(null);
  };
  const [isToolboxOpen, setIsToolboxOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t, i18n } = useTranslation();

  // Initialize
  useEffect(() => {
    const loadedForms = storage.getForms();
    if (loadedForms.length > 0) {
      setForms(loadedForms);
      if (params.id) {
        setActiveFormId(params.id);
      } else {
        setActiveFormId(loadedForms[0].id);
      }
    } else {
      // Create default form if none exist
      const newForm = storage.createForm();
      setForms([newForm]);
      setActiveFormId(newForm.id);
    }
  }, []);

  // Sync active form ID with URL if params change
  useEffect(() => {
    if (params.id && forms.some(f => f.id === params.id)) {
      setActiveFormId(params.id);
    }
  }, [params.id, forms]);

  const activeForm = forms.find(f => f.id === activeFormId) || forms[0];
  const fields = activeForm?.fields || [];

  // Auto-save effect
  useEffect(() => {
    if (activeForm) {
      storage.saveForm(activeForm);
    }
  }, [activeForm]);

  useEffect(() => {
    setHistory([]);
    setRedoHistory([]);
    isUndoingRef.current = false;
    isRedoingRef.current = false;
    lastHistoryKeyRef.current = null;
    lastHistoryAtRef.current = 0;
  }, [activeFormId]);

  const cloneForm = (form: FormSchema): FormSchema => {
    return JSON.parse(JSON.stringify(form)) as FormSchema;
  };

  const pushHistory = (form: FormSchema) => {
    setHistory(prev => {
      const next = [...prev, cloneForm(form)];
      if (next.length > MAX_HISTORY) {
        next.shift();
      }
      return next;
    });
  };

  const setForm = (updatedForm: FormSchema, options?: { historyKey?: string | null }) => {
    if (activeForm && updatedForm.id === activeForm.id && !isUndoingRef.current) {
      const historyKey = options?.historyKey ?? null;
      const now = Date.now();
      const canMerge =
        historyKey &&
        historyKey === lastHistoryKeyRef.current &&
        now - lastHistoryAtRef.current < HISTORY_MERGE_WINDOW_MS;

      if (!canMerge) {
        pushHistory(activeForm);
      }

      if (!isRedoingRef.current) {
        setRedoHistory([]);
      }
      lastHistoryKeyRef.current = historyKey;
      lastHistoryAtRef.current = now;
    }
    const newForms = forms.map(f => f.id === updatedForm.id ? updatedForm : f);
    setForms(newForms);
    storage.saveForm(updatedForm);
  };

  const normalizeFields = (elements: FormElementModel[]) =>
    elements.map((element, index) => ({
      ...element,
      props: element.props ?? {},
      sortIndex: index,
    }));

  const setFields = (newFields: FormElementModel[], options?: { historyKey?: string | null }) => {
    if (activeForm) {
      setForm({ ...activeForm, fields: normalizeFields(newFields) }, options);
    }
  };

  // Form Management
  const addNewForm = () => {
    const newForm = storage.createForm();
    const activeFormIndex = forms.findIndex(f => f.id === activeFormId);
    let newForms: FormSchema[];
    
    if (activeFormIndex >= 0) {
      newForms = [...forms.slice(0, activeFormIndex + 1), newForm, ...forms.slice(activeFormIndex + 1)];
    } else {
      newForms = [...forms, newForm];
    }
    
    setForms(newForms);
    setActiveFormId(newForm.id);
    setLocation(`/builder/${newForm.id}`);
  };

  const closeForm = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (forms.length === 1) {
      toast({ title: t('builder.cannotCloseLastForm'), variant: "destructive" });
      return;
    }
    const newForms = forms.filter(f => f.id !== id);
    setForms(newForms);
    storage.deleteForm(id);
    
    // If closed form was active, switch to another
    if (activeFormId === id) {
      const newActiveId = newForms[0]?.id || null;
      setActiveFormId(newActiveId);
      if (newActiveId) {
        setLocation(`/builder/${newActiveId}`);
      }
    }
  };

  const addField = (item: ToolboxItemDefinition, label: string) => {
    const defaultProps: Record<string, unknown> = { ...(item.props ?? {}) };
    const widgetDefaults: Record<string, unknown> = {};

    if (["select", "radio", "checkbox", "ranking"].includes(item.widgetType)) {
      widgetDefaults.options = ["Option 1", "Option 2"];
    }
    if (item.widgetType === "rating") {
      widgetDefaults.maxRating = 5;
    }

    const newField: FormElementModel = {
      id: nanoid(),
      widgetType: item.widgetType,
      semanticType: item.semanticType,
      label,
      description: "",
      required: false,
      props: { ...widgetDefaults, ...defaultProps },
      sortIndex: fields.length,
    };

    setFields([...fields, newField]);
    setSelectedIds([newField.id]);
    setLastSelectedId(newField.id);
  };

  const updateField = (id: string, updates: Partial<FormElementModel>) => {
    const activeElement = document.activeElement;
    const isTextInput =
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement;
    const updateKeys = Object.keys(updates);
    const historyKey = isTextInput && updateKeys.length === 1
      ? `input:${id}:${updateKeys[0]}`
      : null;
    setFields(fields.map(field => {
      if (field.id !== id) return field;
      const nextProps = updates.props
        ? { ...field.props, ...updates.props }
        : field.props;
      return { ...field, ...updates, props: nextProps };
    }), { historyKey });
  };

  const deleteField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
    setSelectedIds(prev => prev.filter(existingId => existingId !== id));
    if (lastSelectedId === id) setLastSelectedId(null);
  };

  const deleteSelected = () => {
    if (selectedIds.length === 0) return;
    const selectedSet = new Set(selectedIds);
    setFields(fields.filter(f => !selectedSet.has(f.id)));
    clearSelection();
  };

  const undoLast = useCallback(() => {
    if (!activeForm || history.length === 0) return;
    const previousForm = history[history.length - 1];
    const currentForm = activeForm;
    setHistory(prev => prev.slice(0, -1));
    setRedoHistory(prev => [...prev, cloneForm(currentForm)]);
    isUndoingRef.current = true;
    setForm(previousForm);
    isUndoingRef.current = false;
    lastHistoryKeyRef.current = null;
    lastHistoryAtRef.current = 0;

    const previousIds = new Set(previousForm.fields.map(field => field.id));
    setSelectedIds(prev => prev.filter(id => previousIds.has(id)));
    setLastSelectedId(prev => (prev && previousIds.has(prev)) ? prev : null);
  }, [activeForm, history]);

  const redoLast = useCallback(() => {
    if (!activeForm || redoHistory.length === 0) return;
    const nextForm = redoHistory[redoHistory.length - 1];
    const currentForm = activeForm;
    setRedoHistory(prev => prev.slice(0, -1));
    setHistory(prev => [...prev, cloneForm(currentForm)]);
    isRedoingRef.current = true;
    setForm(nextForm);
    isRedoingRef.current = false;
    lastHistoryKeyRef.current = null;
    lastHistoryAtRef.current = 0;

    const nextIds = new Set(nextForm.fields.map(field => field.id));
    setSelectedIds(prev => prev.filter(id => nextIds.has(id)));
    setLastSelectedId(prev => (prev && nextIds.has(prev)) ? prev : null);
  }, [activeForm, redoHistory]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isUndo =
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        (event.code === "KeyZ" || event.key.toLowerCase() === "z");
      const isRedo =
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        (event.code === "KeyZ" || event.key.toLowerCase() === "z");
      if (!isUndo && !isRedo) return;

      if (isUndo && history.length === 0) {
        return;
      }
      if (isRedo && redoHistory.length === 0) {
        return;
      }

      event.preventDefault();
      if (isUndo) {
        undoLast();
      } else {
        redoLast();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history.length, redoHistory.length, undoLast, redoLast]);

  const moveSelected = (direction: "up" | "down") => {
    if (selectedIds.length === 0) return;
    const selectedSet = new Set(selectedIds);
    const newFields = [...fields];

    if (direction === "up") {
      for (let i = 1; i < newFields.length; i += 1) {
        const current = newFields[i];
        const previous = newFields[i - 1];
        if (selectedSet.has(current.id) && !selectedSet.has(previous.id)) {
          newFields[i - 1] = current;
          newFields[i] = previous;
        }
      }
    } else {
      for (let i = newFields.length - 2; i >= 0; i -= 1) {
        const current = newFields[i];
        const next = newFields[i + 1];
        if (selectedSet.has(current.id) && !selectedSet.has(next.id)) {
          newFields[i + 1] = current;
          newFields[i] = next;
        }
      }
    }

    setFields(newFields);
  };

  const saveFormJson = () => {
    if (!activeForm) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeForm, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${activeForm.title.toLowerCase().replace(/\s+/g, '_')}_schema.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    toast({ title: t('builder.formSaved'), description: t('builder.formSavedDesc') });
  };

  const loadFormJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const schema = JSON.parse(content);
        const rawFields = Array.isArray(schema.fields)
          ? schema.fields
          : Array.isArray(schema.structure_json?.fields)
            ? schema.structure_json.fields
            : [];
        if (Array.isArray(rawFields)) {
          const normalizedFields =
            rawFields.length > 0 && !rawFields[0].widgetType && rawFields[0].type
              ? fromStructureJson({ fields: rawFields })
              : rawFields;
          const newForm = {
             ...activeForm,
             title: schema.title || activeForm.title,
             description: schema.description || activeForm.description,
             fields: normalizeFields(normalizedFields as FormElementModel[]),
          };
          setForm(newForm);
          toast({ title: t('builder.formLoaded'), description: t('builder.formLoadedDesc') });
        } else {
          throw new Error("Invalid schema");
        }
      } catch (error) {
        toast({ title: t('builder.error'), description: t('builder.invalidJson'), variant: "destructive" });
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const selectedField = selectedIds.length === 1 ? fields.find(f => f.id === selectedIds[0]) || null : null;

  const groupedToolbox = TOOLBOX_ITEMS.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ToolboxItemDefinition[]>);

  if (!activeForm) return <div>Loading...</div>;

  console.log('Rendering Builder, activeForm:', activeForm, 'selectedIds:', selectedIds);

  return (
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
      {/* Navbar */}
      <header className="h-19 border-b border-border bg-white flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="-ml-2" onClick={() => setIsToolboxOpen(!isToolboxOpen)}>
            {isToolboxOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          </Button>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation('/')}>
            <div className="h-16 w-16 rounded-lg flex items-center justify-center">
               <img src="/logo_etu.png" alt="ETU_LOGO" />
            </div>
            <span className="font-bold hidden sm:inline text-xl color-txt">{t('ETU-Form')}</span>
          </div>
          
          <div className="h-8 w-px bg-border mx-2 hidden md:block" />
          <div className="flex-1 flex items-center overflow-x-auto no-scrollbar max-w-xl">
            <div className="flex items-center gap-1">
              {forms.map(form => (
                <div 
                  key={form.id}
                  onClick={() => {
                    setActiveFormId(form.id);
                    setLocation(`/builder/${form.id}`);
                  }}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors min-w-[100px] max-w-[160px]",
                    activeFormId === form.id 
                      ? "bg-secondary text-secondary-foreground font-medium" 
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  <span className="truncate">{form.title || t("common.untitled")}</span>
                  <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
          onClick={(e) => closeForm(e, form.id)}
          title="Close form"
        >
          <X className="h-3 w-3" />
        </Button>
                </div>
              ))}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={addNewForm}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 h-9 px-3"
              onClick={() => {
                const newLang = i18n.language.startsWith('ru') ? 'en' : 'ru';
                i18n.changeLanguage(newLang);
              }}
              title={i18n.language.startsWith('ru') ? 'Переключить на Английский' : 'Switch to Russian'}>
              <Languages className="h-4 w-4" />
              <span className="hidden sm:inline text-sm font-medium">
                {i18n.language.startsWith('ru') ? 'RU' : 'EN'}
              </span>
            </Button>
           <Dialog>
            <DialogTrigger asChild>
               <Button variant="outline" size="sm" className="gap-2">
                <Eye className="h-4 w-4" /> <span className="hidden sm:inline">{t('builder.preview')}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{activeForm.title || t('common.untitled')}</DialogTitle>
                {activeForm.description && (
                  <p className="text-sm text-muted-foreground">{activeForm.description}</p>
                )}
              </DialogHeader>
              <FormPreview form={activeForm} />
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary">{t('builder.closePreview')}</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={loadFormJson} />
          <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" /> <span className="hidden sm:inline">{t('builder.load')}</span>
          </Button>
          <Button size="sm" className="gap-2" onClick={saveFormJson}>
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">{t('builder.save')}</span>
          </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className={cn("border-r border-border bg-white flex flex-col shrink-0 z-10 transition-all duration-300 ease-in-out overflow-hidden", isToolboxOpen ? "w-64" : "w-0 border-r-0")}>
          <div className="p-4 border-b border-border min-w-[256px]">
            <h2 className="font-semibold text-sm text-foreground uppercase tracking-wider">{t('builder.toolbox')}</h2>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-6 min-w-[256px]">
            {Object.entries(groupedToolbox).map(([category, items]) => (
              <div key={category} className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground mb-3 pl-1 uppercase">{t(`categories.${category}`)}</p>
                {items.map((item) => (
                  <ToolboxItem
                    key={`${item.category}-${item.labelKey}`}
                    item={item}
                    label={t(`fields.${item.labelKey}`)}
                    icon={getIconForElement(item.widgetType, item.semanticType)}
                    onAddField={addField}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <FormCanvas
          key={activeForm.id}
          form={activeForm}
          setForm={setForm}
          selectedIds={selectedIds}
          moveSelected={moveSelected}
          onSelectField={handleSelectField}
          clearSelection={clearSelection}
          deleteField={deleteField}
          updateField={updateField}
          onUndo={undoLast}
          onRedo={redoLast}
          canUndo={history.length > 0}
          canRedo={redoHistory.length > 0}
          fields={fields}
        />

        <div className="w-80 border-l border-border bg-white flex flex-col shrink-0 z-10">
           <PropertiesPanel
             key={selectedField?.id || selectedIds.join("-") || 'none'}
             selectedField={selectedField}
             selectedIds={selectedIds}
             updateField={updateField}
             deleteField={deleteField}
             deleteSelected={deleteSelected}
             fields={fields}
           />
        </div>
      </div>
    </div>
  );
}
