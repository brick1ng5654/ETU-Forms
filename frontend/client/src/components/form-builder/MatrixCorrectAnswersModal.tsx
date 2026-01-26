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
import { Check } from "lucide-react"; 
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"; 

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
  const pointsPerRow = (props.pointsPerRow as Record<string, number> | undefined) || {};
  const pointsPerColumn = (props.pointsPerColumn as Record<string, number> | undefined) || {};
  const matrixValidationMode = (props.matrixValidationMode as "any" | "all" | undefined) || undefined;
  const matrixTotalPoints = (props.matrixTotalPoints as number | undefined) || 0;
  
  // Локальное состояние для выбранных ответов
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>(matrixCorrectAnswers);
  // Локальное состояние для баллов по ячейкам
  const [cellPoints, setCellPoints] = useState<Record<string, number>>(pointsPerCell || {});
  // Локальное состояние для баллов по строкам
  const [rowPoints, setRowPoints] = useState<Record<string, number>>(pointsPerRow || {});
  // Локальное состояние для баллов по столбцам
  const [columnPoints, setColumnPoints] = useState<Record<string, number>>(pointsPerColumn || {});
  // Локальное состояние для переключателя баллов по строкам
  const [enableRowPoints, setEnableRowPoints] = useState<boolean>(Object.keys(pointsPerRow).length > 0);
  // Локальное состояние для переключателя баллов по столбцам
  const [enableColumnPoints, setEnableColumnPoints] = useState<boolean>(Object.keys(pointsPerColumn).length > 0);
  // Локальное состояние для режима проверки
  const [validationMode, setValidationMode] = useState<"any" | "all" | undefined>(matrixValidationMode);
  // Локальное состояние для баллов всей матрицы
  const [totalPoints, setTotalPoints] = useState<number>(matrixTotalPoints);
  
  // Обновление состояния при изменении props
  useEffect(() => {
    setSelectedAnswers(matrixCorrectAnswers);
    setCellPoints(pointsPerCell || {});
    setRowPoints(pointsPerRow || {});
    setColumnPoints(pointsPerColumn || {});
    setEnableRowPoints(Object.keys(pointsPerRow).length > 0);
    setEnableColumnPoints(Object.keys(pointsPerColumn).length > 0);
    setValidationMode(matrixValidationMode);
    setTotalPoints(matrixTotalPoints);
  }, [field.id, matrixCorrectAnswers.length, JSON.stringify(pointsPerCell), JSON.stringify(pointsPerRow), JSON.stringify(pointsPerColumn), matrixValidationMode]);
  
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
      
      // Автоматически устанавливаем 1 балл для выбранной ячейки
      if (!cellPoints.hasOwnProperty(cellKey)) {
      setCellPoints(prev => ({
        ...prev,
        [cellKey]: 0
      }));
    }
    } else {
      // Удаляем ответ
      newAnswers = newAnswers.filter(key => key !== cellKey);
      
      // Удаляем баллы для отмененной ячейки
      setCellPoints(prev => {
        const updated = { ...prev };
        delete updated[cellKey];
        return updated;
      });
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
  
  // Обработчик изменения баллов для строки
  const handleRowPointsChange = (rowIndex: number, value: string) => {
    const numValue = value === "" ? 0 : parseInt(value, 10);
    
    if (value === "" || (!isNaN(numValue) && numValue >= 0 && numValue <= 1000)) {
      setRowPoints(prev => ({
        ...prev,
        [`${rowIndex + 1}`]: value === "" ? 0 : numValue
      }));
    }
  };
  
  // Обработчик изменения баллов для столбца
  const handleColumnPointsChange = (colIndex: number, value: string) => {
    const numValue = value === "" ? 0 : parseInt(value, 10);
    
    if (value === "" || (!isNaN(numValue) && numValue >= 0 && numValue <= 1000)) {
      setColumnPoints(prev => ({
        ...prev,
        [`${colIndex + 1}`]: value === "" ? 0 : numValue
      }));
    }
  };
  
  // Сохранение изменений
  const handleSave = () => {
    // Формируем объект pointsPerCell только с ненулевыми значениями
    const allCellPoints: Record<string, number> = {};
    selectedAnswers.forEach(cellKey => {
    allCellPoints[cellKey] = cellPoints[cellKey] || 0;
  });
    
    // Формируем объект pointsPerRow только с ненулевыми значениями
    const nonZeroRowPoints: Record<string, number> = {};
    if (enableRowPoints) {
      Object.entries(rowPoints).forEach(([key, value]) => {
        if (value > 0) {
          nonZeroRowPoints[key] = value;
        }
      });
    }
    
    // Формируем объект pointsPerColumn только с ненулевыми значениями
    const nonZeroColumnPoints: Record<string, number> = {};
    if (enableColumnPoints) {
      Object.entries(columnPoints).forEach(([key, value]) => {
        if (value > 0) {
          nonZeroColumnPoints[key] = value;
        }
      });
    }
    
    updateField(field.id, {
      props: {
        correctAnswers: selectedAnswers,
        pointsPerCell: Object.keys(allCellPoints).length >= 0 ? allCellPoints : undefined,
        pointsPerRow: enableRowPoints && Object.keys(nonZeroRowPoints).length > 0 ? nonZeroRowPoints : undefined,
        pointsPerColumn: enableColumnPoints && Object.keys(nonZeroColumnPoints).length > 0 ? nonZeroColumnPoints : undefined,
        matrixValidationMode: validationMode,
        matrixTotalPoints: totalPoints
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
                            // Отображаем только ячейки, которые выбраны как правильные ответы
                            if (!selectedAnswers.includes(cellKey)) {
                              return (
                                <td key={colIdx} className="border border-muted-foreground/20 p-2 bg-muted/10">
                                </td>
                              );
                            }
                            
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
              
              {/* Переключатель для баллов за строки */}
              <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm mt-4">
                <div className="space-y-0.5">
                  <Label>{t("propert.enablePointsPerRow")}</Label>
                </div>
                <Checkbox
                  checked={enableRowPoints}
                  onCheckedChange={(checked) => setEnableRowPoints(Boolean(checked))}
                />
              </div>
              
              {/* Баллы за строки */}
              {enableRowPoints && (
                <div className="space-y-3 border-t pt-4">
                  <Label className="text-green-600">{t("propert.pointsPerRow")}</Label>
                  <div className="overflow-x-auto border rounded p-2">
                    <table className="border-collapse border border-muted-foreground/20 text-sm w-full">
                      <thead>
                        <tr>
                          <th className="border border-muted-foreground/20 p-2 text-center bg-muted/30 font-medium">
                            {t("propert.matrixRows")}
                          </th>
                          <th className="border border-muted-foreground/20 p-2 text-center bg-muted/30 font-medium">
                            {t("propert.pointsPerRow")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, rowIdx) => (
                          <tr key={rowIdx}>
                            <td className="border border-muted-foreground/20 p-2 font-medium">
                              {row || `Row ${rowIdx + 1}`}
                            </td>
                            <td className="border border-muted-foreground/20 p-2">
                              <Input
                                type="number"
                                min="0"
                                max="1000"
                                value={rowPoints[`${rowIdx + 1}`] || 0}
                                onChange={(e) => handleRowPointsChange(rowIdx, e.target.value)}
                                className="w-full text-center border-green-200 focus-visible:ring-green-500"
                                placeholder="0"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* Переключатель для баллов за столбцы */}
              <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm mt-4">
                <div className="space-y-0.5">
                  <Label>{t("propert.enablePointsPerColumn")}</Label>
                </div>
                <Checkbox
                  checked={enableColumnPoints}
                  onCheckedChange={(checked) => setEnableColumnPoints(Boolean(checked))}
                />
              </div>
              
              {/* Баллы за столбцы */}
              {enableColumnPoints && (
                <div className="space-y-3 border-t pt-4">
                  <Label className="text-green-600">{t("propert.pointsPerColumn")}</Label>
                  <div className="overflow-x-auto border rounded p-2">
                    <table className="border-collapse border border-muted-foreground/20 text-sm w-full">
                      <thead>
                        <tr>
                          <th className="border border-muted-foreground/20 p-2 text-center bg-muted/30 font-medium">
                            {t("propert.matrixColumns")}
                          </th>
                          <th className="border border-muted-foreground/20 p-2 text-center bg-muted/30 font-medium">
                            {t("propert.pointsPerColumn")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {columns.map((column, colIdx) => (
                          <tr key={colIdx}>
                            <td className="border border-muted-foreground/20 p-2 font-medium">
                              {column || `Column ${colIdx + 1}`}
                            </td>
                            <td className="border border-muted-foreground/20 p-2">
                              <Input
                                type="number"
                                min="0"
                                max="1000"
                                value={columnPoints[`${colIdx + 1}`] || 0}
                                onChange={(e) => handleColumnPointsChange(colIdx, e.target.value)}
                                className="w-full text-center border-green-200 focus-visible:ring-green-500"
                                placeholder="0"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Баллы за всю матрицу */}
        <div className="space-y-3 border-t pt-4">
          <Label className="text-green-600">{t("propert.matrixTotalPoints")}</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0"
              max="1000"
              value={totalPoints}
              onChange={(e) => {
                const value = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                if (e.target.value === "" || (!isNaN(value) && value >= 0 && value <= 1000)) {
                  setTotalPoints(value);
                }
              }}
              className="w-[120px] border-green-200 focus-visible:ring-green-500"
              placeholder="0"
            />
            <span className="text-sm text-muted-foreground">{t("propert.points")}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("propert.matrixTotalPointsHelp")}
          </p>
        </div>
              
        {multiplePerRow && (
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center gap-2">
              <Label className="text-green-600">{t("propert.matrixValidationMode")}</Label>
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
              value={validationMode || ""} 
              onValueChange={(value) => setValidationMode(value as "any" | "all" | undefined)}
            >
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