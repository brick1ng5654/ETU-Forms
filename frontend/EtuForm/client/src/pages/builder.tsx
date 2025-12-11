import { useState, useRef, useEffect } from "react";
import { nanoid } from "nanoid";
import { FormField, FieldType, FormSchema } from "@/lib/form-types";
import { FormCanvas, getIconForType } from "@/components/form-builder/FormCanvas";
import { PropertiesPanel } from "@/components/form-builder/PropertiesPanel";
import { FormPreview } from "@/components/form-builder/FormPreview";
import { ToolboxItem } from "@/components/form-builder/ToolboxItem";
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

const TOOLBOX_ITEMS: { type: FieldType; label: string; category: string }[] = [
  // Basic
  { type: "header", label: "Header", category: "Basic" },
  { type: "text", label: "Text", category: "Basic" },
  { type: "number", label: "Number", category: "Basic" },
  
  // Choice
  { type: "select", label: "Dropdown", category: "Choice" },
  { type: "checkbox", label: "Checkbox", category: "Choice" },
  { type: "radio", label: "Radio Group", category: "Choice" },
  
  // Advanced
  { type: "date", label: "Date", category: "Advanced" },
  { type: "time", label: "Time", category: "Advanced" },
  { type: "email", label: "Email", category: "Advanced" },
  { type: "rating", label: "Rating", category: "Advanced" },
  { type: "ranking", label: "Ranking", category: "Advanced" },
  { type: "file", label: "File Upload", category: "Advanced" },
  
  // Specialized
  { type: "fullname", label: "Full Name", category: "Specialized" },
  { type: "phone", label: "Phone Number", category: "Specialized" },
  { type: "passport", label: "Passport Data", category: "Specialized" },
  { type: "inn", label: "INN", category: "Specialized" },
  { type: "snils", label: "SNILS", category: "Specialized" },
  { type: "account", label: "Bank Account", category: "Specialized" },
  { type: "country", label: "Country", category: "Specialized" },
  { type: "ogrn", label: "OGRN", category: "Specialized" },
  { type: "bik", label: "BIK", category: "Specialized" },
];

export default function Builder({ params }: { params: { id?: string } }) {
  const [location, setLocation] = useLocation();
  const [forms, setForms] = useState<FormSchema[]>([]);
  const [activeFormId, setActiveFormId] = useState<string | null>(null);
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isToolboxOpen, setIsToolboxOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const setForm = (updatedForm: FormSchema) => {
    const newForms = forms.map(f => f.id === updatedForm.id ? updatedForm : f);
    setForms(newForms);
    storage.saveForm(updatedForm);
  };

  const setFields = (newFields: FormField[]) => {
    if (activeForm) {
      setForm({ ...activeForm, fields: newFields });
    }
  };

  // Form Management
  const addNewForm = () => {
    const newForm = storage.createForm();
    setForms([...forms, newForm]);
    setActiveFormId(newForm.id);
    setLocation(`/builder/${newForm.id}`);
  };

  const closeForm = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (forms.length === 1) {
      toast({ title: "Cannot close last form", variant: "destructive" });
      return;
    }
    // We don't delete from storage here, just close tab. To delete, user uses dashboard.
    // Wait, the previous implementation deleted from storage. Let's keep consistency if user wants "close tab".
    // But typically "Tabs" in builders imply open documents. 
    // Let's assume "close" means "close tab", not delete.
    // But since we don't have a concept of "open forms" vs "all forms", let's behave like a browser tab
    // and just switch to another form.
    
    // Actually, let's keep it simple: If you close a tab here, it just switches view, it doesn't delete.
    const newForms = forms.filter(f => f.id !== id);
    // Wait, if we filter from state, we lose it from the "Tabs bar".
    // But if we want to PERSIST the form, we shouldn't delete it from storage.
    // The previous implementation deleted it. Let's change that. "Close" just removes from view?
    // But we are showing ALL forms in the tab bar.
    // If we want to show ALL forms, "Close" is weird.
    // Let's change the tab bar to only show "Open" forms?
    // For now, to keep it simple and robust: The tab bar shows ALL forms. "Close" button is confusing if it shows all.
    // I will remove the "Close" button from the tab bar to avoid accidental deletion. 
    // Deletion should happen in Dashboard.
  };

  const addField = (fieldType: FieldType, label: string) => {
    const defaultProps: Partial<FormField> = {};
    
    if (["checkbox", "radio", "select", "ranking"].includes(fieldType)) {
      defaultProps.options = ["Option 1", "Option 2", "Option 3"];
    }
    if (fieldType === "rating") {
      defaultProps.maxRating = 5;
    }
    if (fieldType === "country") {
      defaultProps.options = ["Russia", "USA", "China", "Germany", "France"]; 
    }
    if (fieldType === "file") {
      defaultProps.maxFileSize = 10;
      defaultProps.acceptedFileTypes = [];
    }
    if (fieldType === "text") {
      defaultProps.multiline = false;
    }

    const newField: FormField = {
      id: nanoid(),
      type: fieldType,
      label: fieldType === "header" ? "Section Header" : `New ${label}`,
      placeholder: "",
      required: false,
      ...defaultProps
    };

    const newFields = [...fields, newField];
    setFields(newFields);
    setSelectedId(newField.id);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const deleteField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
    if (selectedId === id) setSelectedId(null);
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
    toast({ title: "Form Saved", description: "Downloaded as JSON." });
  };

  const loadFormJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const schema = JSON.parse(content);
        if (Array.isArray(schema.fields)) {
          const newForm = {
             ...activeForm,
             title: schema.title || activeForm.title,
             description: schema.description || activeForm.description,
             fields: schema.fields
          };
          setForm(newForm);
          toast({ title: "Form Loaded", description: "Form structure loaded." });
        } else {
          throw new Error("Invalid schema");
        }
      } catch (error) {
        toast({ title: "Error", description: "Invalid JSON file", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const selectedField = fields.find(f => f.id === selectedId) || null;

  const groupedToolbox = TOOLBOX_ITEMS.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof TOOLBOX_ITEMS>);

  if (!activeForm) return <div>Loading...</div>;

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
            <span className="font-bold hidden sm:inline text-xl">ETU-F</span>
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
                  <span className="truncate">{form.title || "Untitled"}</span>
                </div>
              ))}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={addNewForm}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <Dialog>
            <DialogTrigger asChild>
               <Button variant="outline" size="sm" className="gap-2">
                <Eye className="h-4 w-4" /> <span className="hidden sm:inline">Preview</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{activeForm.title}</DialogTitle>
                {activeForm.description && (
                  <p className="text-sm text-muted-foreground">{activeForm.description}</p>
                )}
              </DialogHeader>
              <FormPreview form={activeForm} />
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary">Close Preview</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={loadFormJson} />
          <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" /> <span className="hidden sm:inline">Load</span>
          </Button>
          <Button size="sm" className="gap-2" onClick={saveFormJson}>
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Save</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className={cn("border-r border-border bg-white flex flex-col shrink-0 z-10 transition-all duration-300 ease-in-out overflow-hidden", isToolboxOpen ? "w-64" : "w-0 border-r-0")}>
          <div className="p-4 border-b border-border min-w-[256px]">
            <h2 className="font-semibold text-sm text-foreground uppercase tracking-wider">Toolbox</h2>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-6 min-w-[256px]">
            {Object.entries(groupedToolbox).map(([category, items]) => (
              <div key={category} className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground mb-3 pl-1 uppercase">{category}</p>
                {items.map((item) => (
                  <ToolboxItem 
                    key={item.type} 
                    type={item.type} 
                    label={item.label} 
                    icon={getIconForType(item.type)}
                    onAddField={addField}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <FormCanvas form={activeForm} setForm={setForm} selectedId={selectedId} setSelectedId={setSelectedId} />

        <div className="w-80 border-l border-border bg-white flex flex-col shrink-0 z-10">
           <PropertiesPanel selectedField={selectedField} updateField={updateField} deleteField={deleteField} />
        </div>
      </div>
    </div>
  );
}
