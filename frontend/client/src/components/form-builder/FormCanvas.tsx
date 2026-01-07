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
import { useState, useEffect, useRef } from "react";
import { FormField, FieldType, FormSchema } from "@/lib/form-types";
import { SortableField } from "./SortableField";
import { nanoid } from "nanoid";
import { 
  Type, AlignLeft, Hash, Calendar, Mail, List, CheckSquare, CircleDot, Heading, Star, ListOrdered, Upload, FolderTree, User, Phone, FileText, CreditCard, Globe, Clock, FileDigit
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import React from "react";
import { useTranslation } from 'react-i18next';
import { Languages } from "lucide-react";
interface FormCanvasProps {
  form: FormSchema;
  setForm: (form: FormSchema) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

/**
 * Возвращает иконку для типа поля формы
 * @param type - тип поля (text, number, email и т.д.)
 * @returns React-компонент иконки из библиотеки lucide-react
*/
export const getIconForType = (type: FieldType) => {
  switch (type) {
    // Базовые типы полей
    case "text": return Type;
    case "number": return Hash;
    case "header": return Heading;
    
    // Поля с возможностью выбора
    case "select": return List;
    case "checkbox": return CheckSquare;
    case "radio": return CircleDot;
    
    // Расширенные поля
    case "datetime": return Calendar;
    case "email": return Mail;
    case "rating": return Star;
    case "ranking": return ListOrdered;
    case "file": return Upload;
    case "category": return FolderTree;
    
    // Специализированные поля
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

/**
 Компонент холста формы - область для редактирования и перетаскивания полей формы
 Отвечает за:
 1. Отображение полей формы
 2. Drag & Drop переупорядочивание полей
 3. Редактирование заголовка и описания формы
 4. Визуальную обратную связь при перетаскивании
*/
export function FormCanvas({ form, setForm, selectedId, setSelectedId }: FormCanvasProps) {

  const { t, i18n } = useTranslation()  // Хук для локализации
  const [activeDragItem, setActiveDragItem] = useState<any>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { setNodeRef, isOver } = useDroppable({
    id: 'form-canvas-droppable',
  });

  /**
   Настройка сенсоров для перетаскивания
   PointerSensor активируется при перемещении мыши/таче
  */
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  /**
   Обработчик начала перетаскивания
   Сохраняет данные перетаскиваемого поля
  */
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const field = form.fields.find(f => f.id === active.id);
    setActiveDragItem(field);
  };

  /**
   Обработчик завершения перетаскивания
   Выполняет переупорядочивание полей в массиве формы
  */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    // Если элемент перетащен в новую позицию
    if (active.id !== over?.id) {
      const oldIndex = form.fields.findIndex(f => f.id === active.id);
      const newIndex = form.fields.findIndex(f => f.id === over?.id);
      
      // Перемещаем элемент в массиве
      const newFields = arrayMove(form.fields, oldIndex, newIndex);
      setForm({ ...form, fields: newFields });
    }
    
    setActiveDragItem(null);
  };

  /**
   Функция для автоматического изменения высоты textarea
  */
  const adjustTextareaHeight = (textarea: HTMLTextAreaElement | null) => {
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  /**
   Обновление заголовка формы
  */
  const updateTitle = (title: string) => {
    setForm({ ...form, title });
  };

  /**
   Обновление описания формы
  */
  const updateDescription = (description: string) => {
    setForm({ ...form, description });
  };

  // Устанавливаем высоту при изменении значений
  useEffect(() => {
    adjustTextareaHeight(titleTextareaRef.current);
    adjustTextareaHeight(descriptionTextareaRef.current);
  }, [form.title, form.description]);

  return (
    // DndContext - компонент для Drag & Drop функциональности
    <DndContext
      sensors={sensors} // Передаем сенсор
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
    {/* Основная область холста формы */}
      <div className="flex-1 bg-muted/30 p-8 overflow-y-auto h-full builder-scroll" onClick={() => { console.log('FormCanvas background click, setting selectedId to null'); setSelectedId(null); }}>
        
        {/* Контейнер формы (белая карточка) */}
        <div className="max-w-3xl mx-auto min-h-[800px] bg-white rounded-xl shadow-sm border border-border/50 flex flex-col">
          
          {/* Шапка формы с редактируемыми полями */}
          <div className="p-8 border-b border-border/50 bg-white rounded-t-xl group hover:bg-muted/10 transition-colors relative">
             <div className="space-y-2">
              
              {/* Редактируемое поле заголовка */}
               <Textarea 
                 ref={titleTextareaRef}
                 value={form.title} 
                 onChange={(e) => {
                  const value = e.target.value.slice(0, 120);
                  updateTitle(value);
                  setTimeout(() => adjustTextareaHeight(titleTextareaRef.current), 0);
                }}
                 maxLength={120}
                 className="text-3xl font-bold text-foreground tracking-tight border-transparent hover:border-border px-0 py-1 focus-visible:ring-0 shadow-none bg-transparent resize-none whitespace-pre-wrap break-words overflow-hidden min-h-[1.5em]"
                 placeholder={t("common.untitled")}
                 rows={1}
               />
               
               {/* Редактируемое поле описания */}
               <Textarea 
                 ref={descriptionTextareaRef}
                 value={form.description} 
                 onChange={(e) => {
                  const value = e.target.value.slice(0, 720);
                  updateDescription(value);
                  setTimeout(() => adjustTextareaHeight(descriptionTextareaRef.current), 0);
                }}
                 maxLength={720}
                 className="text-muted-foreground text-lg border-transparent hover:border-border px-0 py-1 focus-visible:ring-0 shadow-none bg-transparent resize-none whitespace-pre-wrap break-words overflow-hidden min-h-[1.5em]"
                 placeholder={t("common.descriptionf")}
                 rows={1}
               />
             </div>

             {/* Индикатор редактируемости (показывается при наведении) */}
             <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Добавить иконку редактирования */}
             </div>
          </div>

          {/* Область для полей формы с поддержкой DnD */}
          <div 
            ref={setNodeRef}
            className={`flex-1 p-8 bg-[#FAFBFC] transition-colors 
              ${isOver ? 'bg-primary/5' : ''}`} // Подсветка при перетаскивании
          >

            {/* SortableContext управляет сортируемыми элементами внутри */}
            <SortableContext 
            items={form.fields}   // Массив ID элементов для сортировки
            strategy={verticalListSortingStrategy}  // Стратегия вертикальной сортировки
            > 
              {form.fields.length === 0 ? (
                 <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/20 rounded-lg bg-muted/5">
                    <p className="text-muted-foreground font-medium">{t("back.bgFormCreate")}</p>
                    <p className="text-sm text-muted-foreground/60 mt-1">{t("back.drag")}</p>
                 </div>
              ) : (

                // Отображение всех полей формы как сортируемых элементов
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
      
      {/* DragOverlay - элемент, который следует за курсором при перетаскивании */}
      <DragOverlay>
        {activeDragItem && (
          
          // Стилизованная миниатюра перетаскиваемого поля
          <div className="bg-white border-2 border-primary shadow-xl rounded-lg p-6 opacity-90">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-sm bg-primary/10 text-primary">

                {/* Динамическое отображение иконки типа поля */}
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
