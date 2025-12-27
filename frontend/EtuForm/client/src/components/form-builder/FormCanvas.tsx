import { 
  DndContext, 
  DragOverlay, 
  useSensor, 
  useSensors, 
  PointerSensor,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
  closestCenter,
  useDroppable
} from "@dnd-kit/core";
import { 
  SortableContext, 
  verticalListSortingStrategy,
  arrayMove 
} from "@dnd-kit/sortable";
import { useState, useEffect } from "react";
import { FormField, FieldType, FormSchema } from "@/lib/form-types";
import { SortableField } from "./SortableField";
import { ToolboxItemOverlay } from "./ToolboxItem";
import { nanoid } from "nanoid";
import { 
  Type, AlignLeft, Hash, Calendar, Mail, List, CheckSquare, CircleDot, Heading, Star, ListOrdered, Upload, FolderTree, User, Phone, FileText, CreditCard, Globe, Clock, FileDigit
} from "lucide-react";
import { Input } from "@/components/ui/input";
import React from "react";
import { useTranslation } from 'react-i18next';
import { Languages } from "lucide-react";
interface FormCanvasProps {
  form: FormSchema;
  setForm: (form: FormSchema) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

export const getIconForType = (type: FieldType) => {
  switch (type) {
    // Basic
    case "text": return Type;
    case "number": return Hash;
    case "header": return Heading;
    
    // Choice
    case "select": return List;
    case "checkbox": return CheckSquare;
    case "radio": return CircleDot;
    
    // Advanced
    case "date": return Calendar;
    case "time": return Clock;
    case "email": return Mail;
    case "rating": return Star;
    case "ranking": return ListOrdered;
    case "file": return Upload;
    case "category": return FolderTree;
    
    // Specialized
    case "fullname": return User;
    case "phone": return Phone;
    case "passport": return FileText;
    case "inn": return FileText;
    case "snils": return FileText;
    case "ogrn": return FileText;
    case "bik": return FileText;
    case "account": return CreditCard;
    case "country": return Globe;
    
    default: return Type;
  }
};

export function FormCanvas({ form, setForm, selectedId, setSelectedId }: FormCanvasProps) {
  const [activeDragItem, setActiveDragItem] = useState<any>(null);
  const { t, i18n } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({
    id: 'form-canvas-droppable',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const field = form.fields.find(f => f.id === active.id);
    setActiveDragItem(field);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
      const oldIndex = form.fields.findIndex(f => f.id === active.id);
      const newIndex = form.fields.findIndex(f => f.id === over?.id);
      
      const newFields = arrayMove(form.fields, oldIndex, newIndex);
      setForm({ ...form, fields: newFields });
    }
    
    setActiveDragItem(null);
  };

  const updateTitle = (title: string) => {
    setForm({ ...form, title });
  };

  const updateDescription = (description: string) => {
    setForm({ ...form, description });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 bg-muted/30 p-8 overflow-y-auto h-full builder-scroll" onClick={() => setSelectedId(null)}>
        <div className="max-w-3xl mx-auto min-h-[800px] bg-white rounded-xl shadow-sm border border-border/50 flex flex-col">
          {/* Form Header (Editable) */}
          <div className="p-8 border-b border-border/50 bg-white rounded-t-xl group hover:bg-muted/10 transition-colors relative">
             <div className="space-y-2">
               <Input 
                 value={form.title} 
                 onChange={(e) => updateTitle(e.target.value)}
                 className="text-3xl font-bold text-foreground tracking-tight border-transparent hover:border-border px-0 h-auto py-1 focus-visible:ring-0 shadow-none bg-transparent"
                 placeholder="Untitled Form"
               />
               <Input 
                 value={form.description} 
                 onChange={(e) => updateDescription(e.target.value)}
                 className="text-muted-foreground text-lg border-transparent hover:border-border px-0 h-auto py-1 focus-visible:ring-0 shadow-none bg-transparent"
                 placeholder="Form Description"
               />
             </div>
             <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
               {/* Indication that header is editable */}
             </div>
          </div>

          {/* Canvas Area */}
          <div 
            ref={setNodeRef}
            className={`flex-1 p-8 bg-[#FAFBFC] transition-colors ${isOver ? 'bg-primary/5' : ''}`}
          >
            <SortableContext items={form.fields} strategy={verticalListSortingStrategy}>
              {form.fields.length === 0 ? (
                 <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/20 rounded-lg bg-muted/5">
                    <p className="text-muted-foreground font-medium">{t("back.bgFormCreate")}</p>
                    <p className="text-sm text-muted-foreground/60 mt-1">{t("back.drag")}</p>
                 </div>
              ) : (
                form.fields.map((field) => (
                  <SortableField 
                    key={field.id} 
                    field={field} 
                    isSelected={selectedId === field.id}
                    onSelect={setSelectedId}
                  />
                ))
              )}
            </SortableContext>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeDragItem && (
          <div className="bg-white border-2 border-primary shadow-xl rounded-lg p-6 opacity-90">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-sm bg-primary/10 text-primary">
                {getIconForType(activeDragItem.type) && React.createElement(getIconForType(activeDragItem.type), { className: "h-4 w-4" })}
              </div>
              <span className="text-sm font-medium">{activeDragItem.label}</span>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
