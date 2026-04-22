import { useState, useEffect } from "react";
import type { KeyboardEvent, ClipboardEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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

const MATRIX_NUMBER_MIN_LIMIT = -999999;
const MATRIX_NUMBER_MAX_LIMIT = 999999;
const MATRIX_NUMBER_INPUT_MAX_LENGTH = 7;
const MATRIX_TEXT_MAX_LENGTH_LIMIT = 256;
const MATRIX_NUMBER_ONLY_PATTERN = /^-?\d*$/;

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
  const matrixInputType = (props.matrixInputType as "radio" | "checkbox" | "number" | "text") || (multiplePerRow ? "checkbox" : "radio");
  const matrixNumberMin = props.matrixNumberMin as number | undefined;
  const matrixNumberMax = props.matrixNumberMax as number | undefined;
  const matrixTextMaxLength = props.matrixTextMaxLength as number | undefined;
  const matrixCorrectAnswers = (props.correctAnswers as string[]) || [];
  const matrixCorrectAnswerValues = (props.correctAnswerValues as Record<string, string> | undefined) || {};
  const pointsPerCell = (props.pointsPerCell as Record<string, number> | undefined) || {};
  const pointsPerRow = (props.pointsPerRow as Record<string, number> | undefined) || {};
  const pointsPerColumn = (props.pointsPerColumn as Record<string, number> | undefined) || {};
  const matrixValidationMode = (props.matrixValidationMode as string | undefined) || undefined;
  const matrixTotalPoints = (props.matrixTotalPoints as number | undefined) || 0;

  const mapPointsToInputs = (input?: Record<string, number>) => {
    const next: Record<string, string> = {};
    Object.entries(input || {}).forEach(([key, value]) => {
      if (typeof value === "number") {
        next[key] = String(value);
      }
    });
    return next;
  };
  
  // Р›РѕРєР°Р»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ РґР»СЏ РІС‹Р±СЂР°РЅРЅС‹С… РѕС‚РІРµС‚РѕРІ
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>(matrixCorrectAnswers);
  // Р›РѕРєР°Р»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ РґР»СЏ Р·РЅР°С‡РµРЅРёР№ РїСЂР°РІРёР»СЊРЅС‹С… РѕС‚РІРµС‚РѕРІ (РґР»СЏ number/text СЂРµР¶РёРјРѕРІ)
  const [correctAnswerValues, setCorrectAnswerValues] = useState<Record<string, string>>(matrixCorrectAnswerValues);
  // Р›РѕРєР°Р»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ РґР»СЏ Р±Р°Р»Р»РѕРІ РїРѕ СЏС‡РµР№РєР°Рј
  const [cellPoints, setCellPoints] = useState<Record<string, number>>(pointsPerCell || {});
  const [cellPointsInput, setCellPointsInput] = useState<Record<string, string>>(mapPointsToInputs(pointsPerCell));
  // Р›РѕРєР°Р»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ РґР»СЏ Р±Р°Р»Р»РѕРІ РїРѕ СЃС‚СЂРѕРєР°Рј
  const [rowPoints, setRowPoints] = useState<Record<string, number>>(pointsPerRow || {});
  const [rowPointsInput, setRowPointsInput] = useState<Record<string, string>>(mapPointsToInputs(pointsPerRow));
  // Р›РѕРєР°Р»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ РґР»СЏ Р±Р°Р»Р»РѕРІ РїРѕ СЃС‚РѕР»Р±С†Р°Рј
  const [columnPoints, setColumnPoints] = useState<Record<string, number>>(pointsPerColumn || {});
  const [columnPointsInput, setColumnPointsInput] = useState<Record<string, string>>(mapPointsToInputs(pointsPerColumn));
  // Р›РѕРєР°Р»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ РґР»СЏ Р±Р°Р»Р»РѕРІ РІСЃРµР№ РјР°С‚СЂРёС†С‹
  const [totalPoints, setTotalPoints] = useState<number>(matrixTotalPoints);
  const [totalPointsInput, setTotalPointsInput] = useState<string>(
    matrixTotalPoints ? String(matrixTotalPoints) : ""
  );
  
  // Р›РѕРєР°Р»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ РґР»СЏ С‚РёРїР° СЂР°СЃРїСЂРµРґРµР»РµРЅРёСЏ Р±Р°Р»Р»РѕРІ
  const [pointsDistributionType, setPointsDistributionType] = useState<"cell" | "row" | "column" | "total" | undefined>(
    props.pointsDistributionType || (Object.keys(pointsPerCell).length > 0 ? "cell" :
    Object.keys(pointsPerRow).length > 0 ? "row" :
    Object.keys(pointsPerColumn).length > 0 ? "column" :
    matrixTotalPoints > 0 ? "total" : "cell")
  );
  
  // Р›РѕРєР°Р»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ РґР»СЏ СЂРµР¶РёРјР° РїСЂРѕРІРµСЂРєРё
  const [validationMode, setValidationMode] = useState<string | undefined>(matrixValidationMode);
  
  // РћР±РЅРѕРІР»РµРЅРёРµ СЃРѕСЃС‚РѕСЏРЅРёСЏ РїСЂРё РёР·РјРµРЅРµРЅРёРё props
  useEffect(() => {
    setSelectedAnswers(matrixCorrectAnswers);
    setCorrectAnswerValues(matrixCorrectAnswerValues);
    setCellPoints(pointsPerCell || {});
    setCellPointsInput(mapPointsToInputs(pointsPerCell));
    setRowPoints(pointsPerRow || {});
    setRowPointsInput(mapPointsToInputs(pointsPerRow));
    setColumnPoints(pointsPerColumn || {});
    setColumnPointsInput(mapPointsToInputs(pointsPerColumn));
    setTotalPoints(matrixTotalPoints);
    setTotalPointsInput(matrixTotalPoints ? String(matrixTotalPoints) : "");
    
    // РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј С‚РёРї СЂР°СЃРїСЂРµРґРµР»РµРЅРёСЏ Р±Р°Р»Р»РѕРІ
    if (props.pointsDistributionType) {
      setPointsDistributionType(props.pointsDistributionType);
    } else if (Object.keys(pointsPerCell || {}).length > 0) {
      setPointsDistributionType("cell");
    } else if (Object.keys(pointsPerRow || {}).length > 0) {
      setPointsDistributionType("row");
    } else if (Object.keys(pointsPerColumn || {}).length > 0) {
      setPointsDistributionType("column");
    } else if ((matrixTotalPoints || 0) > 0) {
      setPointsDistributionType("total");
    } else {
      setPointsDistributionType("cell");
    }
    
    // РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј СЂРµР¶РёРј РїСЂРѕРІРµСЂРєРё
    setValidationMode(matrixValidationMode);
  }, [field.id, matrixCorrectAnswers.length, JSON.stringify(pointsPerCell), JSON.stringify(pointsPerRow), JSON.stringify(pointsPerColumn), JSON.stringify(matrixCorrectAnswerValues), matrixValidationMode, matrixTotalPoints, props.pointsDistributionType]);

  const decimalInputPattern = /^\d*(?:\.\d*)?$/;
  const decimalValuePattern = /^\d+(?:\.\d*)?$/;

  const parsePointInput = (raw: string, fallback: number) => {
    const trimmed = raw.trim();
    if (!decimalValuePattern.test(trimmed)) {
      return fallback;
    }
    const parsed = Number.parseFloat(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1000) {
      return fallback;
    }
    return parsed;
  };

  const getPointInputValue = (inputMap: Record<string, string>, key: string, fallback: number) =>
    inputMap[key] ?? String(fallback);

  const handlePointsKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const { key, currentTarget } = event;
    if (key.length !== 1) {
      return;
    }
    if (key === ".") {
      if (currentTarget.value.includes(".")) {
        event.preventDefault();
      }
      return;
    }
    if (!/^\d$/.test(key)) {
      event.preventDefault();
    }
  };

  const handlePointsPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    if (!decimalInputPattern.test(text)) {
      event.preventDefault();
    }
  };

  const handleMatrixNumberKeyDown = (e: KeyboardEvent<HTMLInputElement>, currentValue: string) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    if (e.key.length !== 1) return;
    if (e.key === "-") {
      const el = e.target as HTMLInputElement;
      const sel = el.selectionStart ?? 0;
      const atStart = sel === 0;
      const hasMinus = (el.value ?? currentValue).includes("-");
      if (!atStart || hasMinus) e.preventDefault();
      return;
    }
    if (!/^\d$/.test(e.key)) e.preventDefault();
  };

  const handleMatrixNumberPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (/[^\d-]/.test(text)) {
      e.preventDefault();
      return;
    }
    if ((text.match(/-/g) || []).length > 1 || (text.includes("-") && !text.startsWith("-"))) {
      e.preventDefault();
    }
  };
  
  // РћР±СЂР°Р±РѕС‚С‡РёРє РёР·РјРµРЅРµРЅРёСЏ РІС‹Р±РѕСЂР° РѕС‚РІРµС‚РѕРІ
  const handleAnswerChange = (cellKey: string, checked: boolean) => {
    let newAnswers = [...selectedAnswers];
    
    if (checked) {
      if (multiplePerRow) {
        // Р”Р»СЏ РјРЅРѕР¶РµСЃС‚РІРµРЅРЅРѕРіРѕ РІС‹Р±РѕСЂР° РґРѕР±Р°РІР»СЏРµРј РѕС‚РІРµС‚
        newAnswers.push(cellKey);
      } else {
        // Р”Р»СЏ РѕРґРёРЅРѕС‡РЅРѕРіРѕ РІС‹Р±РѕСЂР° СѓРґР°Р»СЏРµРј РґСЂСѓРіРёРµ РѕС‚РІРµС‚С‹ РІ СЌС‚РѕР№ СЃС‚СЂРѕРєРµ Рё РґРѕР±Р°РІР»СЏРµРј РЅРѕРІС‹Р№
        const rowPrefix = cellKey.split(':')[0];
        newAnswers = newAnswers.filter(key => !key.startsWith(`${rowPrefix}:`));
        newAnswers.push(cellKey);
      }
      
      // РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРё СѓСЃС‚Р°РЅР°РІР»РёРІР°РµРј 0 Р±Р°Р»Р»РѕРІ РґР»СЏ РІС‹Р±СЂР°РЅРЅРѕР№ СЏС‡РµР№РєРё
      if (!cellPoints.hasOwnProperty(cellKey)) {
        setCellPoints(prev => ({
          ...prev,
          [cellKey]: 1
        }));
        setCellPointsInput(prev => ({
          ...prev,
          [cellKey]: "1"
        }));
      }
    } else {
      // РЈРґР°Р»СЏРµРј РѕС‚РІРµС‚
      newAnswers = newAnswers.filter(key => key !== cellKey);
      
      // РЈРґР°Р»СЏРµРј Р±Р°Р»Р»С‹ РґР»СЏ РѕС‚РјРµРЅРµРЅРЅРѕР№ СЏС‡РµР№РєРё
      setCellPoints(prev => {
        const updated = { ...prev };
        delete updated[cellKey];
        return updated;
      });
      setCellPointsInput(prev => {
        const updated = { ...prev };
        delete updated[cellKey];
        return updated;
      });
    }
    
    setSelectedAnswers(newAnswers);
  };
  
  // РћР±СЂР°Р±РѕС‚С‡РёРє РёР·РјРµРЅРµРЅРёСЏ Р±Р°Р»Р»РѕРІ РґР»СЏ СЏС‡РµР№РєРё
  const handleCellPointsInputChange = (cellKey: string, value: string) => {
    if (decimalInputPattern.test(value)) {
      setCellPointsInput(prev => ({
        ...prev,
        [cellKey]: value
      }));
    }
  };

  const commitCellPoints = (cellKey: string) => {
    const rawValue = cellPointsInput[cellKey] ?? "";
    const fallback = cellPoints[cellKey] ?? 1;
    const nextValue = parsePointInput(rawValue, fallback);
    setCellPoints(prev => ({
      ...prev,
      [cellKey]: nextValue
    }));
    setCellPointsInput(prev => ({
      ...prev,
      [cellKey]: String(nextValue)
    }));
  };
  
  const handleRowPointsInputChange = (rowIndex: number, value: string) => {
    if (decimalInputPattern.test(value)) {
      setRowPointsInput(prev => ({
        ...prev,
        [`${rowIndex + 1}`]: value
      }));
    }
  };

  const commitRowPoints = (rowIndex: number) => {
    const key = `${rowIndex + 1}`;
    const rawValue = rowPointsInput[key] ?? "";
    const fallback = rowPoints[key] ?? 1;
    const nextValue = parsePointInput(rawValue, fallback);
    setRowPoints(prev => ({
      ...prev,
      [key]: nextValue
    }));
    setRowPointsInput(prev => ({
      ...prev,
      [key]: String(nextValue)
    }));
  };
  
  const handleColumnPointsInputChange = (colIndex: number, value: string) => {
    if (decimalInputPattern.test(value)) {
      setColumnPointsInput(prev => ({
        ...prev,
        [`${colIndex + 1}`]: value
      }));
    }
  };

  const commitColumnPoints = (colIndex: number) => {
    const key = `${colIndex + 1}`;
    const rawValue = columnPointsInput[key] ?? "";
    const fallback = columnPoints[key] ?? 1;
    const nextValue = parsePointInput(rawValue, fallback);
    setColumnPoints(prev => ({
      ...prev,
      [key]: nextValue
    }));
    setColumnPointsInput(prev => ({
      ...prev,
      [key]: String(nextValue)
    }));
  };

  const handleTotalPointsInputChange = (value: string) => {
    if (decimalInputPattern.test(value)) {
      setTotalPointsInput(value);
    }
  };

  const commitTotalPoints = () => {
    const rawValue = totalPointsInput ?? "";
    const fallback = totalPoints || 1;
    const nextValue = parsePointInput(rawValue, fallback);
    setTotalPoints(nextValue);
    setTotalPointsInput(String(nextValue));
  };

  const handlePointsDistributionTypeChange = (value: string) => {
    setPointsDistributionType((value || "cell") as "cell" | "row" | "column" | "total");
  };
  
  // РћР±СЂР°Р±РѕС‚С‡РёРє РёР·РјРµРЅРµРЅРёСЏ СЂРµР¶РёРјР° РїСЂРѕРІРµСЂРєРё
  const handleValidationModeChange = (value: string) => {
    setValidationMode(value);
  };

  const handleSingleRowSelection = (rowIndex: number, cellKey: string) => {
    const rowPrefix = `${rowIndex + 1}:`;
    const previousSelections = selectedAnswers.filter((key) => key.startsWith(rowPrefix));
    const newAnswers = selectedAnswers.filter((key) => !key.startsWith(rowPrefix));

    newAnswers.push(cellKey);

    if (!cellPoints.hasOwnProperty(cellKey)) {
      setCellPoints((prev) => ({
        ...prev,
        [cellKey]: 1,
      }));
      setCellPointsInput((prev) => ({
        ...prev,
        [cellKey]: "1",
      }));
    }

    if (previousSelections.length > 0) {
      setCellPoints((prev) => {
        const updated = { ...prev };
        previousSelections.forEach((key) => {
          if (key !== cellKey) {
            delete updated[key];
          }
        });
        return updated;
      });
      setCellPointsInput((prev) => {
        const updated = { ...prev };
        previousSelections.forEach((key) => {
          if (key !== cellKey) {
            delete updated[key];
          }
        });
        return updated;
      });
    }

    setSelectedAnswers(newAnswers);
  };

  const resolvedPointsDistributionType = pointsDistributionType || "cell";
  const showValidationMode =
    resolvedPointsDistributionType === "column" ||
    (resolvedPointsDistributionType === "row" && (multiplePerRow || matrixInputType === "number" || matrixInputType === "text"));
  
  useEffect(() => {
    if (showValidationMode && !validationMode) {
      setValidationMode("all");
    }
  }, [showValidationMode, validationMode]);
  const pointsDistributionOptions = [
    {
      value: "cell",
      label: t("propert.pointsPerCell"),
      help: t("propert.pointsPerCellHelp"),
    },
    {
      value: "row",
      label: t("propert.pointsPerRow"),
      help: t("propert.pointsPerRowHelp"),
    },
    {
      value: "column",
      label: t("propert.pointsPerColumn"),
      help: t("propert.pointsPerColumnHelp"),
    },
    {
      value: "total",
      label: t("propert.pointsTotal"),
      help: t("propert.pointsTotalHelp"),
    },
  ];

  useEffect(() => {
    if (resolvedPointsDistributionType === "row" && rows.length > 0) {
      setRowPoints((prev) => {
        const next = { ...prev };
        rows.forEach((_, index) => {
          const key = `${index + 1}`;
          if (next[key] === undefined) {
            next[key] = 1;
          }
        });
        return next;
      });
      setRowPointsInput((prev) => {
        const next = { ...prev };
        rows.forEach((_, index) => {
          const key = `${index + 1}`;
          if (!next[key]) {
            next[key] = "1";
          }
        });
        return next;
      });
    }

    if (resolvedPointsDistributionType === "column" && columns.length > 0) {
      setColumnPoints((prev) => {
        const next = { ...prev };
        columns.forEach((_, index) => {
          const key = `${index + 1}`;
          if (next[key] === undefined) {
            next[key] = 1;
          }
        });
        return next;
      });
      setColumnPointsInput((prev) => {
        const next = { ...prev };
        columns.forEach((_, index) => {
          const key = `${index + 1}`;
          if (!next[key]) {
            next[key] = "1";
          }
        });
        return next;
      });
    }

    if (resolvedPointsDistributionType === "total") {
      setTotalPoints((prev) => (prev > 0 ? prev : 1));
      setTotalPointsInput((prev) => (prev ? prev : "1"));
    }
  }, [resolvedPointsDistributionType, rows.length, columns.length]);
  
  // РЎРѕС…СЂР°РЅРµРЅРёРµ РёР·РјРµРЅРµРЅРёР№
  const handleSave = () => {
    // Р¤РѕСЂРјРёСЂСѓРµРј РѕР±СЉРµРєС‚ pointsPerCell С‚РѕР»СЊРєРѕ СЃ РЅРµРЅСѓР»РµРІС‹РјРё Р·РЅР°С‡РµРЅРёСЏРјРё
    const allCellPoints: Record<string, number> = {};
    selectedAnswers.forEach(cellKey => {
      const rawValue = cellPointsInput[cellKey] ?? String(cellPoints[cellKey] ?? 1);
      allCellPoints[cellKey] = parsePointInput(rawValue, cellPoints[cellKey] ?? 1);
    });
    
    // Р¤РѕСЂРјРёСЂСѓРµРј РѕР±СЉРµРєС‚ pointsPerRow С‚РѕР»СЊРєРѕ СЃ РЅРµРЅСѓР»РµРІС‹РјРё Р·РЅР°С‡РµРЅРёСЏРјРё
    const nonZeroRowPoints: Record<string, number> = {};
    if (resolvedPointsDistributionType === "row") {
      rows.forEach((_, index) => {
        const key = `${index + 1}`;
        const rawValue = rowPointsInput[key] ?? String(rowPoints[key] ?? 1);
        const parsedValue = parsePointInput(rawValue, rowPoints[key] ?? 1);
        if (parsedValue > 0) {
          nonZeroRowPoints[key] = parsedValue;
        }
      });
    }
    
    // Р¤РѕСЂРјРёСЂСѓРµРј РѕР±СЉРµРєС‚ pointsPerColumn С‚РѕР»СЊРєРѕ СЃ РЅРµРЅСѓР»РµРІС‹РјРё Р·РЅР°С‡РµРЅРёСЏРјРё
    const nonZeroColumnPoints: Record<string, number> = {};
    if (resolvedPointsDistributionType === "column") {
      columns.forEach((_, index) => {
        const key = `${index + 1}`;
        const rawValue = columnPointsInput[key] ?? String(columnPoints[key] ?? 1);
        const parsedValue = parsePointInput(rawValue, columnPoints[key] ?? 1);
        if (parsedValue > 0) {
          nonZeroColumnPoints[key] = parsedValue;
        }
      });
    }
    
    // РћРїСЂРµРґРµР»СЏРµРј С‚РёРї РїСЂРѕРІРµСЂРєРё
    let matrixValidationModeToSave: "any" | "all" | undefined;
    if (showValidationMode) {
      if (validationMode === "any") {
        matrixValidationModeToSave = "any";
      } else {
        matrixValidationModeToSave = "all";
      }
    }
    
    // РћРїСЂРµРґРµР»СЏРµРј, РєР°РєРёРµ Р±Р°Р»Р»С‹ СЃРѕС…СЂР°РЅСЏС‚СЊ РІ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё РѕС‚ РІС‹Р±СЂР°РЅРЅРѕРіРѕ С‚РёРїР° СЂР°СЃРїСЂРµРґРµР»РµРЅРёСЏ
    let pointsPerCellToSave: Record<string, number> | undefined;
    let pointsPerRowToSave: Record<string, number> | undefined;
    let pointsPerColumnToSave: Record<string, number> | undefined;
    let matrixTotalPointsToSave: number | undefined;
    
    if (resolvedPointsDistributionType === "cell") {
      pointsPerCellToSave = Object.keys(allCellPoints).length >= 0 ? allCellPoints : undefined;
    } else if (resolvedPointsDistributionType === "row") {
      pointsPerRowToSave = Object.keys(nonZeroRowPoints).length > 0 ? nonZeroRowPoints : undefined;
    } else if (resolvedPointsDistributionType === "column") {
      pointsPerColumnToSave = Object.keys(nonZeroColumnPoints).length > 0 ? nonZeroColumnPoints : undefined;
    } else if (resolvedPointsDistributionType === "total") {
      const rawValue = totalPointsInput || String(totalPoints || 1);
      const parsedValue = parsePointInput(rawValue, totalPoints || 1);
      matrixTotalPointsToSave = parsedValue > 0 ? parsedValue : undefined;
    }
    
    const updateProps: Record<string, any> = {
      correctAnswers: selectedAnswers,
      pointsPerCell: pointsPerCellToSave,
      pointsPerRow: pointsPerRowToSave,
      pointsPerColumn: pointsPerColumnToSave,
      matrixValidationMode: matrixValidationModeToSave,
      matrixTotalPoints: matrixTotalPointsToSave,
      pointsDistributionType: resolvedPointsDistributionType
    };
    
    if (matrixInputType === "number" || matrixInputType === "text") {
      updateProps.correctAnswerValues = Object.keys(correctAnswerValues).length > 0 ? correctAnswerValues : undefined;
    }
    
    updateField(field.id, {
      props: updateProps
    });
    onOpenChange(false);
  };
  
  // РћС‚РјРµРЅР° РёР·РјРµРЅРµРЅРёР№
  const handleCancel = () => {
    setSelectedAnswers(matrixCorrectAnswers);
    setCorrectAnswerValues(matrixCorrectAnswerValues);
    setCellPoints(pointsPerCell || {});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("propert.matrixCorrectAnswers")}</DialogTitle>
          <DialogDescription className="sr-only">{t("propert.matrixCorrectAnswers")}</DialogDescription>
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
                    {rows.map((row, rowIdx) => {
                      const rowPrefix = `${rowIdx + 1}:`;
                      const selectedInRow = multiplePerRow
                        ? undefined
                        : selectedAnswers.find((key) => key.startsWith(rowPrefix));

                      return (
                        <tr key={rowIdx}>
                          <td className="border border-muted-foreground/20 p-2 font-medium">
                            {row || `Row ${rowIdx + 1}`}
                          </td>
                          {columns.map((_, colIdx) => {
                            const cellKey = `${rowIdx + 1}:${colIdx + 1}`;
                            const isChecked = multiplePerRow
                              ? selectedAnswers.includes(cellKey)
                              : selectedInRow === cellKey;
                            const cellValue = correctAnswerValues[cellKey] || "";
                            
                            if (matrixInputType === "number") {
                              const min = matrixNumberMin ?? MATRIX_NUMBER_MIN_LIMIT;
                              const max = matrixNumberMax ?? MATRIX_NUMBER_MAX_LIMIT;
                              return (
                                <td key={colIdx} className="border border-muted-foreground/20 p-2">
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={cellValue}
                                    onChange={(e) => {
                                      let raw = e.target.value;
                                      const hasLeadingMinus = raw.startsWith("-");
                                      const digitsOnly = raw.replace(/-/g, "").replace(/\D/g, "");
                                      raw = (hasLeadingMinus ? "-" : "") + digitsOnly.slice(0, 7);
                                      const newValues = { ...correctAnswerValues };
                                      if (raw === "") {
                                        delete newValues[cellKey];
                                        setSelectedAnswers(selectedAnswers.filter(a => a !== cellKey));
                                      } else {
                                        newValues[cellKey] = raw;
                                        if (!selectedAnswers.includes(cellKey)) {
                                          setSelectedAnswers([...selectedAnswers, cellKey]);
                                        }
                                      }
                                      setCorrectAnswerValues(newValues);
                                    }}
                                    onBlur={(e) => {
                                      const raw = e.target.value.trim();
                                      if (raw === "" || raw === "-") return;
                                      const num = parseInt(raw, 10);
                                      if (!Number.isFinite(num)) return;
                                      const min = matrixNumberMin ?? MATRIX_NUMBER_MIN_LIMIT;
                                      const max = matrixNumberMax ?? MATRIX_NUMBER_MAX_LIMIT;
                                      const clamped = Math.min(Math.max(num, min), max);
                                      if (String(clamped) !== raw) {
                                        setCorrectAnswerValues((prev) => ({ ...prev, [cellKey]: String(clamped) }));
                                      }
                                    }}
                                    onKeyDown={(e) => handleMatrixNumberKeyDown(e, cellValue)}
                                    onPaste={handleMatrixNumberPaste}
                                    maxLength={MATRIX_NUMBER_INPUT_MAX_LENGTH}
                                    className="w-full h-8 text-sm"
                                    placeholder="-"
                                  />
                                </td>
                              );
                            }
                            
                            if (matrixInputType === "text") {
                              const maxLength = matrixTextMaxLength ?? MATRIX_TEXT_MAX_LENGTH_LIMIT; 
                              
                              return (
                                <td key={colIdx} className="border border-muted-foreground/20 p-2">
                                  <Input
                                    type="text"
                                    value={cellValue}
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      const newValues = { ...correctAnswerValues };
                                      if (newValue === "") {
                                        delete newValues[cellKey];
                                        
                                        const newAnswers = selectedAnswers.filter(a => a !== cellKey);
                                        setSelectedAnswers(newAnswers);
                                      } else {
                                        if (newValue.length <= maxLength) {
                                          newValues[cellKey] = newValue;
                                        
                                          if (!selectedAnswers.includes(cellKey)) {
                                            setSelectedAnswers([...selectedAnswers, cellKey]);
                                          }
                                        } else {
                                          return; 
                                        }
                                      }
                                      setCorrectAnswerValues(newValues);
                                    }}
                                    maxLength={maxLength}
                                    className="w-full h-8 text-sm"
                                    placeholder="-"
                                  />
                                </td>
                              );
                            }
                            
                            return (
                              <td key={colIdx} className="border border-muted-foreground/20 p-2 text-center">
                                {multiplePerRow ? (
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked) => handleAnswerChange(cellKey, Boolean(checked))}
                                    className="mx-auto"
                                    simplifiedAnimation
                                  />
                              ) : (
                              <button
                                type="button"
                                onClick={() => handleSingleRowSelection(rowIdx, cellKey)}
                                className="mx-auto inline-flex aspect-square h-4 w-4 items-center justify-center align-middle rounded-full border border-primary text-primary shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors duration-200 leading-none p-0 relative overflow-hidden"
                              >
                                {isChecked && (
                                  <span className="absolute inset-0 rounded-full bg-primary animate-in zoom-in-50 duration-200 ease-out" />
                                )}
                              </button>
                              )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Р’С‹РїР°РґР°СЋС‰РёР№ СЃРїРёСЃРѕРє РґР»СЏ С‚РёРїР° СЂР°СЃРїСЂРµРґРµР»РµРЅРёСЏ Р±Р°Р»Р»РѕРІ */}
              <div className="space-y-3 border-t pt-4">
                <Label className="text-green-600">{t("propert.pointsDistributionType")}</Label>
                
                <Select value={resolvedPointsDistributionType} onValueChange={handlePointsDistributionTypeChange}>
                  <SelectTrigger className="w-[260px] dark:!bg-slate-900 dark:!text-white dark:data-[placeholder]:!text-white/70 dark:!border-white/20">
                    <SelectValue placeholder={t("common.selectopt")} />
                  </SelectTrigger>
                  <SelectContent className="dark:!bg-slate-900 dark:!text-white dark:!border-white/20">
                    {pointsDistributionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex w-full items-center justify-between gap-2">
                          <span>{option.label}</span>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label={option.help}
                                onPointerDown={(event) => event.preventDefault()}
                                onClick={(event) => event.stopPropagation()}
                                className="h-4 w-4 shrink-0 rounded-full border border-muted-foreground/40 text-muted-foreground text-[9px] leading-none flex items-center justify-center hover:bg-muted"
                              >
                                ?
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs leading-relaxed">
                              {option.help}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Р‘Р°Р»Р»С‹ РїРѕ СЏС‡РµР№РєР°Рј (РѕС‚РѕР±СЂР°Р¶Р°РµС‚СЃСЏ С‚РѕР»СЊРєРѕ РїСЂРё РІС‹Р±РѕСЂРµ "cell") */}
                {resolvedPointsDistributionType === "cell" && (
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
                                // РћС‚РѕР±СЂР°Р¶Р°РµРј С‚РѕР»СЊРєРѕ СЏС‡РµР№РєРё, РєРѕС‚РѕСЂС‹Рµ РІС‹Р±СЂР°РЅС‹ РєР°Рє РїСЂР°РІРёР»СЊРЅС‹Рµ РѕС‚РІРµС‚С‹
                                if (!selectedAnswers.includes(cellKey)) {
                                  return (
                                    <td key={colIdx} className="border border-muted-foreground/20 p-2 bg-muted/10">
                                    </td>
                                  );
                                }
                                
                                return (
                                  <td key={colIdx} className="border border-muted-foreground/20 p-2">
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      value={getPointInputValue(cellPointsInput, cellKey, cellPoints[cellKey] ?? 1)}
                                      onChange={(e) => handleCellPointsInputChange(cellKey, e.target.value)}
                                      onBlur={() => commitCellPoints(cellKey)}
                                      onKeyDown={handlePointsKeyDown}
                                      onPaste={handlePointsPaste}
                                      className="w-full text-center border-green-200 focus-visible:ring-green-500"
                                      placeholder="1"
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
                )}
                
                {/* Р‘Р°Р»Р»С‹ РїРѕ СЃС‚СЂРѕРєР°Рј (РѕС‚РѕР±СЂР°Р¶Р°РµС‚СЃСЏ С‚РѕР»СЊРєРѕ РїСЂРё РІС‹Р±РѕСЂРµ "row") */}
                {resolvedPointsDistributionType === "row" && (
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
                                  type="text"
                                  inputMode="decimal"
                                  value={getPointInputValue(rowPointsInput, `${rowIdx + 1}`, rowPoints[`${rowIdx + 1}`] ?? 1)}
                                  onChange={(e) => handleRowPointsInputChange(rowIdx, e.target.value)}
                                  onBlur={() => commitRowPoints(rowIdx)}
                                  onKeyDown={handlePointsKeyDown}
                                  onPaste={handlePointsPaste}
                                  className="w-full text-center border-green-200 focus-visible:ring-green-500"
                                  placeholder="1"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {/* Р‘Р°Р»Р»С‹ РїРѕ СЃС‚РѕР»Р±С†Р°Рј (РѕС‚РѕР±СЂР°Р¶Р°РµС‚СЃСЏ С‚РѕР»СЊРєРѕ РїСЂРё РІС‹Р±РѕСЂРµ "column") */}
                {resolvedPointsDistributionType === "column" && (
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
                                  type="text"
                                  inputMode="decimal"
                                  value={getPointInputValue(columnPointsInput, `${colIdx + 1}`, columnPoints[`${colIdx + 1}`] ?? 1)}
                                  onChange={(e) => handleColumnPointsInputChange(colIdx, e.target.value)}
                                  onBlur={() => commitColumnPoints(colIdx)}
                                  onKeyDown={handlePointsKeyDown}
                                  onPaste={handlePointsPaste}
                                  className="w-full text-center border-green-200 focus-visible:ring-green-500"
                                  placeholder="1"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {/* Р‘Р°Р»Р»С‹ Р·Р° РІСЃСЋ РјР°С‚СЂРёС†Сѓ (РѕС‚РѕР±СЂР°Р¶Р°РµС‚СЃСЏ С‚РѕР»СЊРєРѕ РїСЂРё РІС‹Р±РѕСЂРµ "total") */}
                {resolvedPointsDistributionType === "total" && (
                  <div className="space-y-3 border-t pt-4">
                    <Label className="text-green-600">{t("propert.matrixTotalPoints")}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={totalPointsInput ?? String(totalPoints || 1)}
                        onChange={(e) => handleTotalPointsInputChange(e.target.value)}
                        onBlur={commitTotalPoints}
                        onKeyDown={handlePointsKeyDown}
                        onPaste={handlePointsPaste}
                        className="w-[120px] border-green-200 focus-visible:ring-green-500"
                        placeholder="1"
                      />
                      <span className="text-sm text-muted-foreground">{t("propert.points")}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("propert.matrixTotalPointsHelp")}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
              
        {/* Р’С‹РїР°РґР°СЋС‰РёР№ СЃРїРёСЃРѕРє РґР»СЏ СЂРµР¶РёРјР° РїСЂРѕРІРµСЂРєРё */}
        {showValidationMode && (
          <div className="space-y-3 border-t pt-4">
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
          
            <Select value={validationMode || "all"} onValueChange={handleValidationModeChange}>
            <SelectTrigger className="w-[260px] dark:!bg-slate-900 dark:!text-white dark:data-[placeholder]:!text-white/70 dark:!border-white/20">
              <SelectValue placeholder={t("common.selectopt")} />
            </SelectTrigger>
            <SelectContent className="dark:!bg-slate-900 dark:!text-white dark:!border-white/20">
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
