import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Languages, ShieldCheck } from "lucide-react";

import { acceptAccessInvite, fetchAccessInvite, type AccessInviteResolveResult } from "@/lib/forms-api";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { AppBrand } from "@/components/app-brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomLoader } from "@/components/ui/custom-loader";

const roleLabel = (role: "editor" | "participant", t: (key: string) => string) => {
  if (role === "editor") return t("access.roleEditor");
  return t("access.roleParticipant");
};

const statusLabel = (status: "pending" | "accepted" | "revoked", t: (key: string) => string) => {
  if (status === "pending") return t("access.statusPending");
  if (status === "accepted") return t("access.statusAccepted");
  return t("access.statusRevoked");
};

export default function FormAccessInvitePage({ params }: { params: { token: string } }) {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { accessToken, isLoading } = useAuth();

  const [invite, setInvite] = useState<AccessInviteResolveResult | null>(null);
  const [isInviteLoading, setIsInviteLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const expiresAtLabel = useMemo(() => {
    if (!invite?.expiresAt) return t("access.noExpiry");
    const date = new Date(invite.expiresAt);
    if (Number.isNaN(date.getTime())) return t("access.noExpiry");
    return new Intl.DateTimeFormat(i18n.language.startsWith("ru") ? "ru-RU" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }, [invite?.expiresAt, i18n.language, t]);

  const currentDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language.startsWith("ru") ? "ru-RU" : "en-US", {
        dateStyle: "medium",
      }).format(new Date()),
    [i18n.language]
  );

  const startsAtLabel = useMemo(() => {
    if (!invite?.startsAt) return currentDateLabel;
    const date = new Date(invite.startsAt);
    if (Number.isNaN(date.getTime())) return currentDateLabel;
    return new Intl.DateTimeFormat(i18n.language.startsWith("ru") ? "ru-RU" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }, [invite?.startsAt, i18n.language, currentDateLabel]);

  useEffect(() => {
    if (isLoading) return;
    if (accessToken) return;
    const next = typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : `/forms/access-invite/${params.token}`;
    setLocation(`/auth?next=${encodeURIComponent(next)}`);
  }, [accessToken, isLoading, params.token, setLocation]);

  useEffect(() => {
    if (isLoading || !accessToken) return;
    let active = true;
    setIsInviteLoading(true);
    setError(null);

    (async () => {
      try {
        const result = await fetchAccessInvite(params.token);
        if (!active) return;
        setInvite(result);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message ?? t("access.loadFailed"));
      } finally {
        if (active) setIsInviteLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [accessToken, isLoading, params.token, t]);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await acceptAccessInvite(params.token);
      setAccepted(true);
      toast({ title: t("access.acceptSuccess") });
    } catch (err: any) {
      toast({
        title: t("actions.error"),
        description: err?.message ?? t("access.acceptFailed"),
        variant: "destructive",
      });
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="h-19 border-b border-border bg-white flex items-center justify-between px-3 sm:px-8 shrink-0">
        <AppBrand onClick={() => setLocation("/")} />
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 h-9 px-3"
          onClick={() => {
            const newLang = i18n.language.startsWith("ru") ? "en" : "ru";
            i18n.changeLanguage(newLang);
          }}
        >
          <Languages className="h-4 w-4" />
          <span className="text-xs font-medium">{i18n.language.startsWith("ru") ? "RU" : "EN"}</span>
        </Button>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{t("access.invitePageTitle")}</CardTitle>
            <CardDescription>{t("access.invitePageSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isInviteLoading ? (
              <CustomLoader variant="dots" text={t("common.loading")} />
            ) : error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : accepted ? (
              <div className="space-y-2 rounded-md border border-border p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {t("access.acceptSuccess")}
                </div>
                <Button onClick={() => setLocation("/")}>{t("access.openHome")}</Button>
              </div>
            ) : invite ? (
              <div className="space-y-4 rounded-md border border-border p-4">
                <div className="flex items-center gap-2 text-sm">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span>{t("access.inviteToForm", { form: invite.formTitle })}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("access.role")}: {roleLabel(invite.role, t)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("access.status")}: {statusLabel(invite.status, t)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("access.startsAt")}: {startsAtLabel}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("access.expiresAt")}: {expiresAtLabel}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("access.acceptedUsage")}: {invite.acceptedCount} / {invite.maxAccepts ?? t("access.unlimited")}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => void handleAccept()}
                    disabled={isAccepting || invite.status !== "pending"}
                  >
                    {isAccepting ? t("results.saving") : t("access.acceptInvite")}
                  </Button>
                  <Button variant="outline" onClick={() => setLocation("/")}>
                    {t("access.declineInvite")}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
