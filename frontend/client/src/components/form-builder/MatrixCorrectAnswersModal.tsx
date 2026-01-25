import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const pointsPerCell = (props.pointsPerCell as Record<string, number> | undefined) || {};
  const matrixValidationMode = (props.matrixValidationMode as "any" | "all" | undefined) || undefined;
  
  // Локальное состояние для выбранных ответов
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>(matrixCorrectAnswers);
  // Локальное состояние для баллов по ячейкам
  const [cellPoints, setCellPoints] = useState<Record<string, number>>(pointsPerCell || {});
  // Локальное состояние для режима проверки
  const [validationMode, setValidationMode] = useState<"any" | "all" | undefined>(matrixValidationMode);
  
  // Обновление состояния при изменении props
  useEffect(() => {
    setSelectedAnswers(matrixCorrectAnswers);
    setCellPoints(pointsPerCell || {});
    setValidationMode(matrixValidationMode);
  }, [field.id, matrixCorrectAnswers.length, JSON.stringify(pointsPerCell), matrixValidationMode]);
  
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
  
  // Обработчик изменения баллов для ячейки
  const handlePointsChange = (cellKey: string, value: string) => {
    const numValue = value === "" ? 0 : parseInt(value, 10);
    
    if (value === "" || (!isNaN(numValue) && numValue >= 0 && numValue <= 1000)) {
      setCellPoints(prev => ({
        ...prev,
        [cellKey]: value === "" ? 0 : numValue
      }));
    }
  };
  
  // Сохранение изменений
  const handleSave = () => {
    // Формируем объект pointsPerCell только с ненулевыми значениями
    const nonZeroPoints: Record<string, number> = {};
    Object.entries(cellPoints).forEach(([key, value]) => {
      if (value > 0) {
        nonZeroPoints[key] = value;
      }
    });
    
    updateField(field.id, {
      props: {
        correctAnswers: selectedAnswers,
        pointsPerCell: Object.keys(nonZeroPoints).length > 0 ? nonZeroPoints : undefined,
        matrixValidationMode: validationMode
      }
    });
    onOpenChange(false);
  };
  
  // Отмена изменений
  const handleCancel = () => {
    setSelectedAnswers(matrixCorrectAnswers);
    setCellPoints(pointsPerCell || {});
    setValidationMode(matrixValidationMode);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
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
            <>
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
              
              <div className="space-y-3 border-t pt-4">
                <Label className="text-green-600">{t("propert.pointsPerCell")}</Label>
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
                            return (
                              <td key={colIdx} className="border border-muted-foreground/20 p-2">
                                <Input
                                  type="number"
                                  min="0"
                                  max="1000"
                                  value={cellPoints[cellKey] || 0}
                                  onChange={(e) => handlePointsChange(cellKey, e.target.value)}
                                  className="w-full text-center border-green-200 focus-visible:ring-green-500"
                                  placeholder="0"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
             
        {multiplePerRow && (
          <div className="space-y-2 border-t pt-4">
            <Label className="text-green-600">{t("propert.matrixValidationMode")}</Label>
            <Select value={validationMode || ""} onValueChange={(value) => setValidationMode(value as "any" | "all" | undefined)}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder={t("propert.matrixValidationMode")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t("propert.matrixValidationModeAny")}</SelectItem>
                <SelectItem value="all">{t("propert.matrixValidationModeAll")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        
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