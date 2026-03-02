import { useEffect, useMemo, useState } from "react";
import type { Locale } from "date-fns";
import { ru } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, Check, Copy, Link as LinkIcon, Trash2, UserPlus } from "lucide-react";

import type { FormSchema } from "@/form/types";
import {
  clearFormAccessEntries,
  createFormAccessLink,
  deleteFormAccessUser,
  fetchFormAccessEntries,
  inviteFormAccessByEmail,
  revokeAllActiveFormAccessLinks,
  revokeFormAccessInvite,
  type FormAccessEntry,
  type FormAccessRole,
  updateFormAccessUser,
} from "@/lib/forms-api";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type RoleFilter = "all" | FormAccessRole;
type AccessSortField = "name" | "startsAt" | "expiresAt";
type AccessSortDirection = "asc" | "desc";
const MAX_LINK_ACCEPT_LIMIT = 999999;

type Props = {
  form: Pick<FormSchema, "id" | "title"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  onUpdated?: () => void;
};

const toIsoEndOfDay = (value: string) => {
  if (!value) return null;
  const parsed = new Date(`${value}T23:59:59`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const toIsoStartOfDay = (value: string) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const isValidEmail = (value: string) => /.+@.+\..+/.test(value);

const formatDateForInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const dateInputFromIso = (value: string | null | undefined) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return formatDateForInput(parsed);
};

const toAbsoluteUrl = (value: string | null | undefined) => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (typeof window === "undefined") return value;
  return `${window.location.origin}${value.startsWith("/") ? value : `/${value}`}`;
};

const formatDateTime = (value: string | null | undefined, locale: string, fallback: string) => {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale.startsWith("ru") ? "ru-RU" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
};

const statusVariant = (status: FormAccessEntry["status"]) => {
  if (status === "active") return "default";
  if (status === "pending") return "secondary";
  return "outline";
};

const statusBadgeClassName = (status: FormAccessEntry["status"]) => {
  if (status === "active") return "cursor-text select-text transition-none hover:bg-primary";
  if (status === "pending") return "cursor-text select-text transition-none hover:bg-secondary";
  return "cursor-text select-text transition-none";
};

const statusLabelKey = (status: FormAccessEntry["status"]) => {
  if (status === "active") return "access.statusActive";
  if (status === "pending") return "access.statusPending";
  if (status === "expired") return "access.statusExpired";
  if (status === "accepted") return "access.statusAccepted";
  return "access.statusRevoked";
};

const sanitizeAcceptLimitInput = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const withoutLeadingZeros = digits.replace(/^0+(?=\d)/, "");
  return withoutLeadingZeros.slice(0, 6);
};

const roleLabelKey = (role: FormAccessRole) => {
  if (role === "editor") return "access.roleEditor";
  return "access.roleParticipant";
};

type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  locale?: Locale;
  className?: string;
};

function ExpiryDateField({ value, onChange, disabled, locale, className }: DateFieldProps) {
  return (
    <DatePickerInput
      value={value}
      onChange={onChange}
      disabled={disabled}
      locale={locale}
      className={className}
    />
  );
}

function HintIcon({ text }: { text: string }) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  return (
    <Tooltip open={isTooltipOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={text}
          onPointerEnter={() => setIsTooltipOpen(true)}
          onPointerLeave={() => setIsTooltipOpen(false)}
          onFocus={() => setIsTooltipOpen(false)}
          onBlur={() => setIsTooltipOpen(false)}
          className="h-5 w-5 rounded-full border border-muted-foreground/40 text-muted-foreground text-[11px] leading-none flex items-center justify-center hover:bg-muted"
        >
          ?
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-sm text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function RoleSelectItemLabel({ label, hint }: { label: string; hint: string }) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <Tooltip open={isTooltipOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={hint}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onPointerEnter={(event) => {
              event.stopPropagation();
              setIsTooltipOpen(true);
            }}
            onPointerLeave={(event) => {
              event.stopPropagation();
              setIsTooltipOpen(false);
            }}
            onFocus={(event) => {
              event.stopPropagation();
              setIsTooltipOpen(false);
            }}
            onBlur={(event) => {
              event.stopPropagation();
              setIsTooltipOpen(false);
            }}
            className="h-5 w-5 rounded-full border border-muted-foreground/40 text-muted-foreground text-[11px] leading-none flex items-center justify-center hover:bg-muted"
          >
            ?
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-sm text-xs leading-relaxed">
          {hint}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

export function FormAccessDialog({ form, open, onOpenChange, canManage, onUpdated }: Props) {
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<FormAccessEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [emailRole, setEmailRole] = useState<FormAccessRole>("participant");
  const [emailStartsOn, setEmailStartsOn] = useState("");
  const [emailExpiresOn, setEmailExpiresOn] = useState("");
  const [emailNoExpiry, setEmailNoExpiry] = useState(true);
  const [linkRole, setLinkRole] = useState<FormAccessRole>("participant");
  const [linkStartsOn, setLinkStartsOn] = useState("");
  const [linkExpiresOn, setLinkExpiresOn] = useState("");
  const [linkNoExpiry, setLinkNoExpiry] = useState(true);
  const [linkUnlimitedAccepts, setLinkUnlimitedAccepts] = useState(true);
  const [linkMaxAccepts, setLinkMaxAccepts] = useState("");
  const [linkMaxAcceptsTouched, setLinkMaxAcceptsTouched] = useState(false);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortField, setSortField] = useState<AccessSortField>("name");
  const [sortDirection, setSortDirection] = useState<AccessSortDirection>("asc");
  const [entryStartDrafts, setEntryStartDrafts] = useState<Record<number, string>>({});
  const [entryDateDrafts, setEntryDateDrafts] = useState<Record<number, string>>({});
  const [entryRoleDrafts, setEntryRoleDrafts] = useState<Record<number, FormAccessRole>>({});
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const calendarLocale = i18n.language.startsWith("ru") ? ru : undefined;

  const currentFormId = form?.id ?? null;

  const resetEntryDrafts = () => {
    setEntryStartDrafts({});
    setEntryDateDrafts({});
    setEntryRoleDrafts({});
  };

  const refreshEntries = async () => {
    if (!currentFormId) return;
    setIsLoading(true);
    try {
      const data = await fetchFormAccessEntries(currentFormId);
      setEntries(data);
    } catch (error: any) {
      toast({
        title: t("actions.error"),
        description: error?.message ?? t("access.loadFailed"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !currentFormId || !canManage) return;
    setEntryStartDrafts({});
    setEntryDateDrafts({});
    setEntryRoleDrafts({});
    setLinkMaxAcceptsTouched(false);
    void refreshEntries();
  }, [open, currentFormId, canManage]);

  const isLinkMaxAcceptsInvalid = useMemo(() => {
    if (linkUnlimitedAccepts) return false;
    const parsed = Number.parseInt(linkMaxAccepts, 10);
    return !Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LINK_ACCEPT_LIMIT;
  }, [linkUnlimitedAccepts, linkMaxAccepts]);

  const currentDateInput = useMemo(() => formatDateForInput(new Date()), []);
  const currentDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language.startsWith("ru") ? "ru-RU" : "en-US", {
        dateStyle: "medium",
      }).format(new Date()),
    [i18n.language]
  );

  const filteredEntries = useMemo(() => {
    const withoutUniversalLinks = entries.filter(
      (entry) => !(entry.entryType === "invite" && !entry.userEmail)
    );
    const roleFiltered = roleFilter === "all"
      ? withoutUniversalLinks
      : withoutUniversalLinks.filter((entry) => entry.role === roleFilter);

    const sorted = [...roleFiltered].sort((a, b) => {
      let left: string | number;
      let right: string | number;
      if (sortField === "name") {
        left = (a.userName || a.userEmail || "").toLowerCase();
        right = (b.userName || b.userEmail || "").toLowerCase();
      } else if (sortField === "startsAt") {
        left = a.startsAt ? new Date(a.startsAt).getTime() : new Date(`${currentDateInput}T00:00:00`).getTime();
        right = b.startsAt ? new Date(b.startsAt).getTime() : new Date(`${currentDateInput}T00:00:00`).getTime();
      } else {
        left = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.POSITIVE_INFINITY;
        right = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.POSITIVE_INFINITY;
      }

      if (left < right) return sortDirection === "asc" ? -1 : 1;
      if (left > right) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [entries, roleFilter, sortField, sortDirection, currentDateInput]);

  const activeUniversalLinks = useMemo(() => {
    return entries.filter(
      (entry) =>
        entry.entryType === "invite" &&
        !entry.userEmail &&
        entry.status === "pending" &&
        Boolean(entry.inviteUrl)
    );
  }, [entries]);

  const pendingAccessEntries = useMemo(() => {
    return entries
      .filter((entry) => entry.entryType === "access" && entry.accessId != null)
      .map((entry) => {
        const accessId = entry.accessId as number;
        const currentRole = entry.role;
        const draftRole = entryRoleDrafts[accessId] ?? currentRole;
        const currentStartRaw = dateInputFromIso(entry.startsAt);
        const draftStartRaw = entryStartDrafts[accessId] ?? currentStartRaw;
        const currentStart = currentStartRaw || currentDateInput;
        const draftStart = draftStartRaw || currentDateInput;
        const currentDate = dateInputFromIso(entry.expiresAt);
        const draftDate = entryDateDrafts[accessId] ?? currentDate;
        const roleChanged = draftRole !== currentRole;
        const startChanged = draftStart !== currentStart;
        const dateChanged = draftDate !== currentDate;
        const hasPendingChanges = roleChanged || startChanged || dateChanged;
        return {
          accessId,
          draftRole,
          draftStart,
          draftDate,
          hasPendingChanges,
        };
      })
      .filter((entry) => entry.hasPendingChanges);
  }, [entries, entryRoleDrafts, entryStartDrafts, entryDateDrafts, currentDateInput]);

  const hasPendingAccessChanges = pendingAccessEntries.length > 0;

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: t("results.copied") });
    } catch {
      toast({
        title: t("builder.error"),
        description: t("results.copyFailed"),
        variant: "destructive",
      });
    }
  };

  const normalizeErrorMessage = (raw: string | undefined) => {
    const text = (raw ?? "").toLowerCase();
    if (text.includes("email") && (text.includes("valid") || text.includes("value_error"))) {
      return t("access.invalidEmail");
    }
    if (text.includes("user not found")) {
      return t("access.userNotFoundForAutoGrant");
    }
    return raw ?? t("access.saveFailed");
  };

  const hasInvalidRange = (start: string, end: string, noEnd: boolean) => {
    if (!start || noEnd || !end) return false;
    const startValue = new Date(`${start}T00:00:00`).getTime();
    const endValue = new Date(`${end}T23:59:59`).getTime();
    if (Number.isNaN(startValue) || Number.isNaN(endValue)) return false;
    return startValue > endValue;
  };

  const handleInviteByEmail = async () => {
    if (!currentFormId || !canManage) return;
    const emailValue = email.trim().toLowerCase();
    const startInput = emailStartsOn || currentDateInput;
    if (!emailValue) return;
    if (!isValidEmail(emailValue)) {
      toast({
        title: t("actions.error"),
        description: t("access.invalidEmail"),
        variant: "destructive",
      });
      return;
    }
    if (hasInvalidRange(startInput, emailExpiresOn, emailNoExpiry)) {
      toast({
        title: t("actions.error"),
        description: t("access.invalidDateRange"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await inviteFormAccessByEmail(currentFormId, {
        email: emailValue,
        role: emailRole,
        starts_at: toIsoStartOfDay(startInput),
        expires_at: emailNoExpiry ? null : toIsoEndOfDay(emailExpiresOn),
        require_accept: false,
      });
      setEmail("");
      await refreshEntries();
      onUpdated?.();
      toast({ title: t("access.saved") });
    } catch (error: any) {
      toast({
        title: t("actions.error"),
        description: normalizeErrorMessage(error?.message),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateLink = async () => {
    if (!currentFormId || !canManage) return;
    const startInput = linkStartsOn || currentDateInput;
    if (hasInvalidRange(startInput, linkExpiresOn, linkNoExpiry)) {
      toast({
        title: t("actions.error"),
        description: t("access.invalidDateRange"),
        variant: "destructive",
      });
      return;
    }
    const parsedMaxAccepts = Number.parseInt(linkMaxAccepts, 10);
    if (!linkUnlimitedAccepts && isLinkMaxAcceptsInvalid) {
      setLinkMaxAcceptsTouched(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await createFormAccessLink(currentFormId, {
        role: linkRole,
        starts_at: toIsoStartOfDay(startInput),
        expires_at: linkNoExpiry ? null : toIsoEndOfDay(linkExpiresOn),
        max_accepts: linkUnlimitedAccepts ? null : parsedMaxAccepts,
      });
      if (!linkUnlimitedAccepts) setLinkMaxAccepts("");
      setLinkMaxAcceptsTouched(false);
      await refreshEntries();
      onUpdated?.();
      toast({ title: t("access.linkGenerated") });
    } catch (error: any) {
      toast({
        title: t("actions.error"),
        description: error?.message ?? t("access.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntry = async (entry: FormAccessEntry) => {
    if (!currentFormId || !canManage) return;
    setIsSubmitting(true);
    try {
      if (entry.entryType === "access" && entry.accessId != null) {
        await deleteFormAccessUser(currentFormId, entry.accessId);
      } else if (entry.entryType === "invite" && entry.inviteId != null) {
        await revokeFormAccessInvite(currentFormId, entry.inviteId);
      }
      await refreshEntries();
      onUpdated?.();
    } catch (error: any) {
      toast({
        title: t("actions.error"),
        description: error?.message ?? t("access.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAllActiveLinks = async () => {
    if (!currentFormId || !canManage) return;
    if (!window.confirm(t("access.deleteAllActiveLinksConfirm"))) return;
    setIsSubmitting(true);
    try {
      await revokeAllActiveFormAccessLinks(currentFormId);
      await refreshEntries();
      onUpdated?.();
      toast({ title: t("access.deleteAllActiveLinksSuccess") });
    } catch (error: any) {
      toast({
        title: t("actions.error"),
        description: error?.message ?? t("access.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearAllEntries = async () => {
    if (!currentFormId || !canManage) return;
    if (!window.confirm(t("access.clearAllEntriesConfirm"))) return;
    setIsSubmitting(true);
    try {
      await clearFormAccessEntries(currentFormId);
      await refreshEntries();
      onUpdated?.();
      toast({ title: t("access.clearAllEntriesSuccess") });
    } catch (error: any) {
      toast({
        title: t("actions.error"),
        description: error?.message ?? t("access.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEntryRoleChange = (entry: FormAccessEntry, nextRole: FormAccessRole) => {
    if (entry.entryType !== "access" || entry.accessId == null) return;
    setEntryRoleDrafts((prev) => ({ ...prev, [entry.accessId as number]: nextRole }));
  };

  const handleEntryDateChange = (entry: FormAccessEntry, value: string) => {
    if (entry.entryType !== "access" || entry.accessId == null) return;
    setEntryDateDrafts((prev) => ({ ...prev, [entry.accessId as number]: value }));
  };

  const handleEntryStartChange = (entry: FormAccessEntry, value: string) => {
    if (entry.entryType !== "access" || entry.accessId == null) return;
    setEntryStartDrafts((prev) => ({ ...prev, [entry.accessId as number]: value }));
  };

  const handleSaveEntry = async (entry: FormAccessEntry) => {
    if (!currentFormId || !canManage || entry.entryType !== "access" || entry.accessId == null) return;
    const currentRole = entry.role;
    const draftRole = entryRoleDrafts[entry.accessId] ?? currentRole;
    const currentStartRaw = dateInputFromIso(entry.startsAt);
    const draftStartRaw = entryStartDrafts[entry.accessId] ?? currentStartRaw;
    const currentStart = currentStartRaw || currentDateInput;
    const draftStart = draftStartRaw || currentDateInput;
    const currentDate = dateInputFromIso(entry.expiresAt);
    const draftDate = entryDateDrafts[entry.accessId] ?? currentDate;
    if (hasInvalidRange(draftStart, draftDate, draftDate === "")) {
      toast({
        title: t("actions.error"),
        description: t("access.invalidDateRange"),
        variant: "destructive",
      });
      return;
    }
    const roleChanged = draftRole !== currentRole;
    const startChanged = draftStart !== currentStart;
    const dateChanged = draftDate !== currentDate;
    if (!roleChanged && !startChanged && !dateChanged) return;

    setIsSubmitting(true);
    try {
      await updateFormAccessUser(currentFormId, entry.accessId, {
        role: draftRole,
        starts_at: toIsoStartOfDay(draftStart),
        expires_at: toIsoEndOfDay(draftDate),
      });
      await refreshEntries();
      setEntryStartDrafts((prev) => {
        const next = { ...prev };
        delete next[entry.accessId as number];
        return next;
      });
      setEntryDateDrafts((prev) => {
        const next = { ...prev };
        delete next[entry.accessId as number];
        return next;
      });
      setEntryRoleDrafts((prev) => {
        const next = { ...prev };
        delete next[entry.accessId as number];
        return next;
      });
      onUpdated?.();
    } catch (error: any) {
      toast({
        title: t("actions.error"),
        description: error?.message ?? t("access.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSavePendingEntries = async () => {
    if (!currentFormId || !canManage) return false;
    if (pendingAccessEntries.length === 0) return true;

    for (const entry of pendingAccessEntries) {
      if (hasInvalidRange(entry.draftStart, entry.draftDate, entry.draftDate === "")) {
        toast({
          title: t("actions.error"),
          description: t("access.invalidDateRange"),
          variant: "destructive",
        });
        return false;
      }
    }

    setIsSubmitting(true);
    try {
      for (const entry of pendingAccessEntries) {
        await updateFormAccessUser(currentFormId, entry.accessId, {
          role: entry.draftRole,
          starts_at: toIsoStartOfDay(entry.draftStart),
          expires_at: toIsoEndOfDay(entry.draftDate),
        });
      }
      await refreshEntries();
      resetEntryDrafts();
      onUpdated?.();
      toast({ title: t("access.saved") });
      return true;
    } catch (error: any) {
      toast({
        title: t("actions.error"),
        description: error?.message ?? t("access.saveFailed"),
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (isSubmitting) return;
    if (hasPendingAccessChanges) {
      setIsCloseConfirmOpen(true);
      return;
    }
    onOpenChange(false);
  };

  const handleCloseWithoutSaving = () => {
    setIsCloseConfirmOpen(false);
    resetEntryDrafts();
    onOpenChange(false);
  };

  const handleSaveAndClose = async () => {
    setIsCloseConfirmOpen(false);
    const saved = await handleSavePendingEntries();
    if (!saved) return;
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("access.title")}</DialogTitle>
          <DialogDescription>
            {form?.title
              ? t("access.subtitleWithForm", { form: form.title })
              : t("access.subtitle")}
          </DialogDescription>
        </DialogHeader>

        {!canManage ? (
          <div className="text-sm text-muted-foreground">{t("access.noManagePermission")}</div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span>{t("access.inviteByEmail")}</span>
                <HintIcon text={t("access.emailInviteGrantHint")} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t("auth.email")}</label>
                  <Input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        if (!isSubmitting) {
                          void handleInviteByEmail();
                        }
                      }
                    }}
                    placeholder={t("access.emailPlaceholder")}
                    type="email"
                    autoComplete="off"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t("access.role")}</label>
                  <Select value={emailRole} onValueChange={(next) => setEmailRole(next as FormAccessRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="participant">
                        <RoleSelectItemLabel
                          label={t("access.roleParticipant")}
                          hint={t("access.roleParticipantHint")}
                        />
                      </SelectItem>
                      <SelectItem value="editor">
                        <RoleSelectItemLabel
                          label={t("access.roleEditor")}
                          hint={t("access.roleEditorHint")}
                        />
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t("access.startDateLabel")}</label>
                  <ExpiryDateField
                    value={emailStartsOn}
                    onChange={setEmailStartsOn}
                    disabled={isSubmitting}
                    locale={calendarLocale}
                  />
                </div>
                <label className="inline-flex items-end gap-2 pb-2 text-xs text-muted-foreground">
                  <Checkbox
                    simplifiedAnimation
                    checked={emailNoExpiry}
                    onCheckedChange={(checked) => {
                      const next = Boolean(checked);
                      setEmailNoExpiry(next);
                      if (next) setEmailExpiresOn("");
                    }}
                    disabled={isSubmitting}
                  />
                  <span>{t("access.permanentAccess")}</span>
                </label>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t("access.expireDateLabel")}</label>
                  <ExpiryDateField
                    value={emailExpiresOn}
                    onChange={(value) => {
                      setEmailExpiresOn(value);
                      if (value) setEmailNoExpiry(false);
                    }}
                    disabled={isSubmitting || emailNoExpiry}
                    locale={calendarLocale}
                  />
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => void handleInviteByEmail()}
                disabled={isSubmitting || !email.trim()}
                className="w-full gap-2"
              >
                <UserPlus className="h-4 w-4" />
                {t("access.inviteByEmail")}
              </Button>
            </div>

            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span>{t("access.generateLink")}</span>
                <HintIcon text={t("access.linkUniversalHint")} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t("access.role")}</label>
                  <Select value={linkRole} onValueChange={(next) => setLinkRole(next as FormAccessRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="participant">
                        <RoleSelectItemLabel
                          label={t("access.roleParticipant")}
                          hint={t("access.roleParticipantHint")}
                        />
                      </SelectItem>
                      <SelectItem value="editor">
                        <RoleSelectItemLabel
                          label={t("access.roleEditor")}
                          hint={t("access.roleEditorHint")}
                        />
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-end">
                    <label className="inline-flex min-w-fit items-center gap-2 pb-2 text-xs text-muted-foreground">
                      <Checkbox
                        simplifiedAnimation
                        checked={linkUnlimitedAccepts}
                        onCheckedChange={(checked) => {
                          const next = Boolean(checked);
                          setLinkUnlimitedAccepts(next);
                          if (next) {
                            setLinkMaxAccepts("");
                            setLinkMaxAcceptsTouched(false);
                          }
                        }}
                        disabled={isSubmitting}
                      />
                      <span>{t("access.unlimited")}</span>
                    </label>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t("access.acceptLimitLabel")}</label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={linkMaxAccepts}
                        onChange={(event) => setLinkMaxAccepts(sanitizeAcceptLimitInput(event.target.value))}
                        onBlur={() => setLinkMaxAcceptsTouched(true)}
                        disabled={isSubmitting || linkUnlimitedAccepts}
                        aria-invalid={linkMaxAcceptsTouched && isLinkMaxAcceptsInvalid}
                        placeholder="10"
                        className="w-full"
                      />
                      {!linkUnlimitedAccepts && linkMaxAcceptsTouched && isLinkMaxAcceptsInvalid ? (
                        <div className="text-xs text-destructive">{t("access.invalidAcceptLimit")}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t("access.startDateLabel")}</label>
                  <ExpiryDateField
                    value={linkStartsOn}
                    onChange={setLinkStartsOn}
                    disabled={isSubmitting}
                    locale={calendarLocale}
                  />
                </div>
                <label className="inline-flex items-end gap-2 pb-2 text-xs text-muted-foreground">
                  <Checkbox
                    simplifiedAnimation
                    checked={linkNoExpiry}
                    onCheckedChange={(checked) => {
                      const next = Boolean(checked);
                      setLinkNoExpiry(next);
                      if (next) setLinkExpiresOn("");
                    }}
                    disabled={isSubmitting}
                  />
                  <span>{t("access.permanentAccess")}</span>
                </label>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t("access.linkExpireDateLabel")}</label>
                  <ExpiryDateField
                    value={linkExpiresOn}
                    onChange={(value) => {
                      setLinkExpiresOn(value);
                      if (value) setLinkNoExpiry(false);
                    }}
                    disabled={isSubmitting || linkNoExpiry}
                    locale={calendarLocale}
                  />
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => void handleCreateLink()}
                disabled={isSubmitting}
                className="w-full gap-2"
              >
                <LinkIcon className="h-4 w-4" />
                {t("access.generateLink")}
              </Button>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">{t("access.activeLinks")}</div>
                {activeUniversalLinks.length === 0 ? (
                  <div className="text-xs text-muted-foreground">{t("access.emptyLinks")}</div>
                ) : (
                  <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                    {activeUniversalLinks.map((entry) => {
                      const link = toAbsoluteUrl(entry.inviteUrl);
                      const startsLabel = formatDateTime(entry.startsAt, i18n.language, currentDateLabel);
                      const expiresLabel = formatDateTime(entry.expiresAt, i18n.language, t("access.noExpiry"));
                      return (
                        <div key={`active-link-${entry.inviteId ?? link}`} className="space-y-2 rounded-md border border-border p-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span>{t(roleLabelKey(entry.role))}</span>
                            <span>{t("access.acceptedUsage")}: {entry.acceptedCount} / {entry.maxAccepts ?? t("access.unlimited")}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("access.startsAt")}: {startsLabel}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("access.expiresAt")}: {expiresLabel}
                          </div>
                          <div className="flex gap-2">
                            <Input value={link} readOnly className="h-8 text-xs" />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => void copyText(link)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => void handleDeleteEntry(entry)}
                              disabled={isSubmitting}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={() => void handleDeleteAllActiveLinks()}
                  disabled={isSubmitting || activeUniversalLinks.length === 0}
                  className="w-full text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("access.deleteAllActiveLinks")}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-medium">{t("access.listTitle")}</div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={sortField} onValueChange={(next) => setSortField(next as AccessSortField)}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">{t("results.sortName")}</SelectItem>
                    <SelectItem value="startsAt">{t("access.startsAt")}</SelectItem>
                    <SelectItem value="expiresAt">{t("access.expiresAt")}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  title={sortDirection === "asc" ? t("results.sortAsc") : t("results.sortDesc")}
                  onClick={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
                >
                  {sortDirection === "asc" ? (
                    <ArrowUp className="h-4 w-4" />
                  ) : (
                    <ArrowDown className="h-4 w-4" />
                  )}
                </Button>
                <Select value={roleFilter} onValueChange={(next) => setRoleFilter(next as RoleFilter)}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("access.filterAll")}</SelectItem>
                    <SelectItem value="participant">
                      <RoleSelectItemLabel
                        label={t("access.roleParticipant")}
                        hint={t("access.roleParticipantHint")}
                      />
                    </SelectItem>
                    <SelectItem value="editor">
                      <RoleSelectItemLabel
                        label={t("access.roleEditor")}
                        hint={t("access.roleEditorHint")}
                      />
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {isLoading ? (
                <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
              ) : filteredEntries.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("access.emptyList")}</div>
              ) : (
                filteredEntries.map((entry) => {
                  const isUniversalInvite = entry.entryType === "invite" && !entry.userEmail;
                  const label = isUniversalInvite
                    ? t("access.universalInvite")
                    : (entry.userName || entry.userEmail || t("access.unknownUser"));
                  const subtitle = isUniversalInvite
                    ? t("access.anyAuthorizedUser")
                    : (entry.userEmail ?? "-");
                  const startsLabel = formatDateTime(entry.startsAt, i18n.language, currentDateLabel);
                  const expiresLabel = formatDateTime(entry.expiresAt, i18n.language, t("access.noExpiry"));
                  const currentRoleValue = entry.role;
                  const draftRoleValue =
                    entry.entryType === "access" && entry.accessId != null && entryRoleDrafts[entry.accessId] !== undefined
                      ? entryRoleDrafts[entry.accessId]
                      : currentRoleValue;
                  const currentStartValue = dateInputFromIso(entry.startsAt);
                  const draftStartValue =
                    entry.entryType === "access" && entry.accessId != null && entryStartDrafts[entry.accessId] !== undefined
                      ? entryStartDrafts[entry.accessId]
                      : currentStartValue;
                  const currentDateValue = dateInputFromIso(entry.expiresAt);
                  const draftDateValue =
                    entry.entryType === "access" && entry.accessId != null && entryDateDrafts[entry.accessId] !== undefined
                      ? entryDateDrafts[entry.accessId]
                      : currentDateValue;
                  const isRoleChanged = draftRoleValue !== currentRoleValue;
                  const isStartChanged = draftStartValue !== currentStartValue;
                  const isDateChanged = draftDateValue !== currentDateValue;
                  const hasPendingChanges = isRoleChanged || isStartChanged || isDateChanged;
                  const isDraftNoExpiry = draftDateValue === "";
                  return (
                    <div
                      key={`${entry.entryType}-${entry.accessId ?? entry.inviteId ?? label}`}
                      className="rounded-md border border-border p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{label}</div>
                          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={statusVariant(entry.status)} className={statusBadgeClassName(entry.status)}>
                            {t(statusLabelKey(entry.status))}
                          </Badge>
                          <Badge variant="outline">{t(roleLabelKey(entry.role))}</Badge>
                        </div>
                      </div>

                      <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                        <span>{t("access.startsAt")}: {startsLabel}</span>
                        <span>{t("access.expiresAt")}: {expiresLabel}</span>
                      </div>

                      {entry.entryType === "access" && entry.accessId != null ? (
                        <>
                          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_1fr]">
                            <ExpiryDateField
                              value={draftStartValue}
                              onChange={(value) => handleEntryStartChange(entry, value)}
                              disabled={isSubmitting}
                              locale={calendarLocale}
                            />
                            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                              <Checkbox
                                simplifiedAnimation
                                checked={isDraftNoExpiry}
                                onCheckedChange={(checked) => {
                                  const next = Boolean(checked);
                                  handleEntryDateChange(
                                    entry,
                                    next ? "" : (draftDateValue || formatDateForInput(new Date()))
                                  );
                                }}
                                disabled={isSubmitting}
                              />
                              <span>{t("access.permanentAccess")}</span>
                            </label>
                            <ExpiryDateField
                              value={draftDateValue}
                              onChange={(value) => handleEntryDateChange(entry, value)}
                              disabled={isSubmitting || isDraftNoExpiry}
                              locale={calendarLocale}
                            />
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Select
                              value={draftRoleValue}
                              onValueChange={(next) => handleEntryRoleChange(entry, next as FormAccessRole)}
                            >
                              <SelectTrigger className={cn("h-8 w-44", isSubmitting && "pointer-events-none opacity-60")}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="participant">
                                  <RoleSelectItemLabel
                                    label={t("access.roleParticipant")}
                                    hint={t("access.roleParticipantHint")}
                                  />
                                </SelectItem>
                                <SelectItem value="editor">
                                  <RoleSelectItemLabel
                                    label={t("access.roleEditor")}
                                    hint={t("access.roleEditorHint")}
                                  />
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="outline"
                              className={cn(
                                "h-8 px-2 ring-0 transition-shadow duration-300 ease-out",
                                hasPendingChanges && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                              )}
                              disabled={isSubmitting || !hasPendingChanges}
                              onClick={() => void handleSaveEntry(entry)}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-destructive hover:text-destructive"
                              onClick={() => void handleDeleteEntry(entry)}
                              disabled={isSubmitting}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              {t("actions.delete")}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {entry.entryType === "invite" ? (
                            <span className="text-xs text-muted-foreground">
                              {t("access.acceptedUsage")}: {entry.acceptedCount} / {entry.maxAccepts ?? t("access.unlimited")}
                            </span>
                          ) : null}
                          {entry.inviteUrl ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2"
                              onClick={() => void copyText(toAbsoluteUrl(entry.inviteUrl))}
                            >
                              <Copy className="mr-1 h-3.5 w-3.5" />
                              {t("results.copyLink")}
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-destructive hover:text-destructive"
                            onClick={() => void handleDeleteEntry(entry)}
                            disabled={isSubmitting}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            {t("actions.delete")}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => void handleClearAllEntries()}
              disabled={isSubmitting || filteredEntries.length === 0}
              className="w-full text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("access.clearAllEntries")}
            </Button>
          </div>
        )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={isCloseConfirmOpen} onOpenChange={setIsCloseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("access.unsavedChangesTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("access.unsavedChangesDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
            <Button variant="outline" onClick={handleCloseWithoutSaving}>
              {t("access.closeWithoutSaving")}
            </Button>
            <AlertDialogAction onClick={() => void handleSaveAndClose()}>
              {t("access.saveAndClose")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
