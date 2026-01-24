import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FormElementModel } from "@/form/types";

interface MatrixCorrectAnswersModalProps {
  field: FormElementModel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updateField: (id: string, updates: Partial<FormElementModel>) => void;
}

export function MatrixCorrectAnswersModal({ 
  field, 
  open, 
  onOpenChange,
  updateField
}: MatrixCorrectAnswersModalProps) {
  const { t } = useTranslation();
  const props = field.props as Record<string, any>;
  const rows = (props.rows as string[]) || [];
  const columns = (props.columns as string[]) || [];
  const multiplePerRow = Boolean(props.multiplePerRow);
  const matrixCorrectAnswers = (props.correctAnswers as string[]) || [];
  
  // Локальное состояние для выбранных ответов
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>(matrixCorrectAnswers);
  
  // Обработчик изменения выбора
  const handleAnswerChange = (cellKey: string, checked: boolean) => {
    let newAnswers = [...selectedAnswers];
    
    if (checked) {
      if (multiplePerRow) {
        // Для множественного выбора добавляем ответ
        newAnswers.push(cellKey);
      } else {
        // Для одиночного выбора удаляем другие ответы в этой строке и добавляем новый
        const rowPrefix = cellKey.split(':')[0];
        newAnswers = newAnswers.filter(key => !key.startsWith(`${rowPrefix}:`));
        newAnswers.push(cellKey);
      }
    } else {
      // Удаляем ответ
      newAnswers = newAnswers.filter(key => key !== cellKey);
    }
    
    setSelectedAnswers(newAnswers);
  };
  
  // Сохранение изменений
  const handleSave = () => {
    updateField(field.id, { props: { correctAnswers: selectedAnswers } });
    onOpenChange(false);
  };
  
  // Отмена изменений
  const handleCancel = () => {
    setSelectedAnswers(matrixCorrectAnswers);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("propert.matrixCorrectAnswers")}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("propert.matrixCorrectAnswersHelp")}
          </p>
          
          {rows.length === 0 || columns.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              {t("propert.addMatrixRowsColumns")}
            </p>
          ) : (
            <div className="overflow-x-auto border rounded p-2">
              <table className="border-collapse border border-muted-foreground/20 text-sm w-full">
                <thead>
                  <tr>
                    <th className="border border-muted-foreground/20 p-2 text-center bg-muted/30 font-medium">
                      {t("propert.matrixRows")}
                    </th>
                    {columns.map((col, colIdx) => (
                      <th key={colIdx} className="border border-muted-foreground/20 p-2 text-center bg-muted/30 font-medium">
                        {col || `Column ${colIdx + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      <td className="border border-muted-foreground/20 p-2 font-medium">
                        {row || `Row ${rowIdx + 1}`}
                      </td>
                      {columns.map((_, colIdx) => {
                        const cellKey = `${rowIdx + 1}:${colIdx + 1}`;
                        const isChecked = selectedAnswers.includes(cellKey);
                        
                        return (
                          <td key={colIdx} className="border border-muted-foreground/20 p-2 text-center">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => handleAnswerChange(cellKey, Boolean(checked))}
                              className="mx-auto"
                              simplifiedAnimation
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        <DialogFooter className="gap-2 sm:space-x-0">
          <Button variant="outline" onClick={handleCancel}>
            {t("common.close")}
          </Button>
          <Button onClick={handleSave}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}