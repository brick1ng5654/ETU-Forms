"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmDialogOptions = {
  // заголовок окна
  title?: string;
  // описание
  description: string;
  // текст кнопки
  confirmLabel?: string;
  // текст кнопки отмены
  cancelLabel?: string;
  
  variant?: "default" | "destructive";
};

type OpenFn = (options: ConfirmDialogOptions) => Promise<boolean>;

const confirmDialogRef: { current: OpenFn | null } = { current: null };

//
// Показывает диалог подтверждения в стиле приложения (не нативный браузерный).
// Возвращает Promise<true> при нажатии "Подтвердить", Promise<false> при отмене.
//  
export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  if (confirmDialogRef.current) {
    return confirmDialogRef.current(options);
  }
  return Promise.resolve(false);
}

export function ConfirmDialogRoot() {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<ConfirmDialogOptions>({
    description: "",
  });
  const resolveRef = React.useRef<(value: boolean) => void>(() => {});

  React.useEffect(() => {
    confirmDialogRef.current = (opts: ConfirmDialogOptions) => {
      return new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setOptions(opts);
        setOpen(true);
      });
    };
    return () => {
      confirmDialogRef.current = null;
    };
  }, []);

  const handleConfirm = () => {
    resolveRef.current(true);
    setOpen(false);
  };

  const handleCancel = () => {
    resolveRef.current(false);
    setOpen(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      resolveRef.current(false);
      setOpen(false);
    }
  };

  const isDestructive = options.variant === "destructive";

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          {options.title != null && options.title !== "" && (
            <AlertDialogTitle>{options.title}</AlertDialogTitle>
          )}
          <AlertDialogDescription>{options.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {options.cancelLabel ?? t("actions.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={isDestructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
          >
            {options.confirmLabel ?? t("actions.confirmButton")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
