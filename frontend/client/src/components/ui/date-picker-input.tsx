import { useEffect, useState } from "react";
import type { FocusEventHandler } from "react";
import type { Locale } from "date-fns";
import { CalendarDays } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const padDatePart = (value: number) => String(value).padStart(2, "0");

export const formatDateForInput = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

export const isValidDateInput = (value: string) => {
  if (value.length !== 10) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return false;
  if (month < 1 || month > 12) return false;
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
};

export const parseDateInput = (value: string | null | undefined) => {
  if (!value || !isValidDateInput(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

type DatePickerInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  disabled?: boolean;
  locale?: Locale;
  title?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  popoverContentClassName?: string;
  popoverPortalled?: boolean;
};

export function DatePickerInput({
  value,
  onChange,
  onBlur,
  disabled,
  locale,
  title,
  placeholder,
  className,
  inputClassName,
  buttonClassName,
  popoverContentClassName,
  popoverPortalled,
}: DatePickerInputProps) {
  const [month, setMonth] = useState<Date>(() => parseDateInput(value) ?? new Date());

  useEffect(() => {
    const parsed = parseDateInput(value);
    if (parsed) {
      setMonth(parsed);
    }
  }, [value]);

  return (
    <div className={cn("relative", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "absolute left-1 top-1/2 h-8 w-8 -translate-y-1/2",
              buttonClassName
            )}
            disabled={disabled}
            title={title}
          >
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn("w-auto p-0", popoverContentClassName)}
          align="start"
          portalled={popoverPortalled}
        >
          <Calendar
            mode="single"
            selected={parseDateInput(value)}
            month={month}
            onMonthChange={setMonth}
            locale={locale}
            onSelect={(date) => {
              if (!date) {
                onChange("");
                return;
              }
              setMonth(date);
              onChange(formatDateForInput(date));
            }}
          />
        </PopoverContent>
      </Popover>
      <Input
        type="date"
        value={value}
        onBlur={onBlur}
        disabled={disabled}
        className={cn("pl-10", inputClassName)}
        placeholder={placeholder}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "") {
            onChange("");
            return;
          }
          if (!isValidDateInput(next)) return;
          const parsed = parseDateInput(next);
          if (parsed) {
            setMonth(parsed);
          }
          onChange(next);
        }}
      />
    </div>
  );
}
