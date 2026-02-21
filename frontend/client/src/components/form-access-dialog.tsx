import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Link as LinkIcon, Trash2, UserPlus } from "lucide-react";

import type { FormSchema } from "@/form/types";
import {
  createFormAccessLink,
  deleteFormAccessUser,
  fetchFormAccessEntries,
  inviteFormAccessByEmail,
  revokeFormAccessInvite,
  type FormAccessEntry,
  type FormAccessRole,
  updateFormAccessUser,
} from "@/lib/forms-api";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type RoleFilter = "all" | FormAccessRole;

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

const toAbsoluteUrl = (value: string | null | undefined) => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (typeof window === "undefined") return value;
  return `${window.location.origin}${value.startsWith("/") ? value : `/${value}`}`;
};

const formatDateTime = (value: string | null | undefined, locale: string) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
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

const statusLabelKey = (status: FormAccessEntry["status"]) => {
  if (status === "active") return "access.statusActive";
  if (status === "pending") return "access.statusPending";
  if (status === "expired") return "access.statusExpired";
  if (status === "accepted") return "access.statusAccepted";
  return "access.statusRevoked";
};

const roleLabelKey = (role: FormAccessRole) => {
  if (role === "editor") return "access.roleEditor";
  return "access.roleParticipant";
};

export function FormAccessDialog({ form, open, onOpenChange, canManage, onUpdated }: Props) {
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<FormAccessEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<FormAccessRole>("participant");
  const [expiresOn, setExpiresOn] = useState("");
  const [requireAccept, setRequireAccept] = useState(true);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const currentFormId = form?.id ?? null;

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
    setGeneratedLink(null);
    void refreshEntries();
  }, [open, currentFormId, canManage]);

  const filteredEntries = useMemo(() => {
    if (roleFilter === "all") return entries;
    return entries.filter((entry) => entry.role === roleFilter);
  }, [entries, roleFilter]);

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

  const handleInviteByEmail = async () => {
    if (!currentFormId || !canManage) return;
    const emailValue = email.trim().toLowerCase();
    if (!emailValue) return;

    setIsSubmitting(true);
    try {
      const created = await inviteFormAccessByEmail(currentFormId, {
        email: emailValue,
        role,
        expires_at: toIsoEndOfDay(expiresOn),
        require_accept: requireAccept,
      });
      setEmail("");
      setGeneratedLink(toAbsoluteUrl(created.inviteUrl));
      await refreshEntries();
      onUpdated?.();
      toast({ title: t("access.saved") });
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

  const handleCreateLink = async () => {
    if (!currentFormId || !canManage) return;
    setIsSubmitting(true);
    try {
      const created = await createFormAccessLink(currentFormId, {
        role,
        expires_at: toIsoEndOfDay(expiresOn),
      });
      setGeneratedLink(toAbsoluteUrl(created.inviteUrl));
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

  const handleRoleChange = async (entry: FormAccessEntry, nextRole: FormAccessRole) => {
    if (!currentFormId || !canManage || entry.entryType !== "access" || entry.accessId == null) return;
    setIsSubmitting(true);
    try {
      await updateFormAccessUser(currentFormId, entry.accessId, {
        role: nextRole,
        expires_at: entry.expiresAt,
      });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
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
            <div className="grid gap-3 sm:grid-cols-[1fr_160px_170px]">
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
              <Select value={role} onValueChange={(next) => setRole(next as FormAccessRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="participant">{t("access.roleParticipant")}</SelectItem>
                  <SelectItem value="editor">{t("access.roleEditor")}</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={expiresOn}
                onChange={(event) => setExpiresOn(event.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <Switch checked={requireAccept} onCheckedChange={setRequireAccept} />
                <span>{t("access.requireAccept")}</span>
              </label>
              <Button
                variant="outline"
                onClick={() => void handleInviteByEmail()}
                disabled={isSubmitting || !email.trim()}
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" />
                {t("access.inviteByEmail")}
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleCreateLink()}
                disabled={isSubmitting}
                className="gap-2"
              >
                <LinkIcon className="h-4 w-4" />
                {t("access.generateLink")}
              </Button>
            </div>

            {generatedLink ? (
              <div className="space-y-2 rounded-md border border-border p-3">
                <div className="text-sm font-medium">{t("access.generatedLink")}</div>
                <div className="flex gap-2">
                  <Input value={generatedLink} readOnly />
                  <Button variant="outline" size="icon" onClick={() => void copyText(generatedLink)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">{t("access.listTitle")}</div>
              <Select value={roleFilter} onValueChange={(next) => setRoleFilter(next as RoleFilter)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("access.filterAll")}</SelectItem>
                  <SelectItem value="participant">{t("access.roleParticipant")}</SelectItem>
                  <SelectItem value="editor">{t("access.roleEditor")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {isLoading ? (
                <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
              ) : filteredEntries.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("access.emptyList")}</div>
              ) : (
                filteredEntries.map((entry) => {
                  const label = entry.userName || entry.userEmail || t("access.unknownUser");
                  const expiresLabel = formatDateTime(entry.expiresAt, i18n.language);
                  return (
                    <div
                      key={`${entry.entryType}-${entry.accessId ?? entry.inviteId ?? label}`}
                      className="rounded-md border border-border p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{label}</div>
                          <div className="truncate text-xs text-muted-foreground">{entry.userEmail ?? "-"}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={statusVariant(entry.status)}>
                            {t(statusLabelKey(entry.status))}
                          </Badge>
                          <Badge variant="outline">{t(roleLabelKey(entry.role))}</Badge>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {t("access.expiresAt")}: {expiresLabel}
                        </span>
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
                        {entry.entryType === "access" && entry.accessId != null ? (
                          <Select
                            value={entry.role}
                            onValueChange={(next) => void handleRoleChange(entry, next as FormAccessRole)}
                          >
                            <SelectTrigger className={cn("h-8 w-40", isSubmitting && "pointer-events-none opacity-60")}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="participant">{t("access.roleParticipant")}</SelectItem>
                              <SelectItem value="editor">{t("access.roleEditor")}</SelectItem>
                            </SelectContent>
                          </Select>
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
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
