import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

import type { FormSchema } from "@/form/types";
import FormPreview from "@/components/form-builder/FormPreview";
import { AppBrand } from "@/components/app-brand";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { CheckCircle2, FileText, Languages } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { fetchPublicFormDetail, submitPublicFormResponse, type HttpError } from "@/lib/forms-api";
import { useAuth } from "@/lib/auth";
import { CustomLoader } from "@/components/ui/custom-loader";

export default function FormPass({ params }: { params: { id: string } }) {
  const { t, i18n } = useTranslation();
  const [location, setLocation] = useLocation();
  const { accessToken } = useAuth();
  const [form, setForm] = useState<FormSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isUnauthenticatedMode = form?.accessMode === "unauthenticated";
  const shouldShowLoginButton = !accessToken && !isLoading && !isUnauthenticatedMode;

  const linkKey = useMemo(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("key") ?? "";
    }
    const query = location.includes("?") ? location.slice(location.indexOf("?")) : "";
    return new URLSearchParams(query).get("key") ?? "";
  }, [location]);
  const startedAt = useMemo(() => new Date().toISOString(), [params.id, linkKey]);

  const redirectToAuth = () => {
    const next = typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : `/form/${params.id}`;
    setLocation(`/auth?next=${encodeURIComponent(next)}`);
  };

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setIsSubmitted(false);
    setError(null);

    (async () => {
      try {
        const detail = await fetchPublicFormDetail(params.id, linkKey || undefined);
        if (!active) return;
        if (detail.id !== params.id) {
          const nextPath = `/form/${detail.id}${linkKey ? `?key=${encodeURIComponent(linkKey)}` : ""}`;
          setLocation(nextPath);
        }
        setForm(detail);
      } catch (err: any) {
        if (!active) return;
        const httpError = err as HttpError;
        if (httpError?.status === 401) {
          redirectToAuth();
          return;
        }
        setError(err?.message ?? t("respond.loadError"));
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [linkKey, params.id, t]);

  const handleSubmit = async (payload: { answers: Record<string, unknown> }) => {
    setIsSubmitting(true);
    try {
      const targetFormId = form?.id ?? params.id;
      await submitPublicFormResponse(
        targetFormId,
        { ...payload, started_at: startedAt },
        linkKey || undefined
      );
      setIsSubmitted(true);
      toast({ title: t("respond.submitSuccess") });
    } catch (err: any) {
      const httpError = err as HttpError;
      if (httpError?.status === 401) {
        redirectToAuth();
        return;
      }
      toast({
        title: t("builder.error"),
        description: err?.message ?? t("respond.submitError"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-white flex items-center justify-between gap-2 px-3 sm:px-6 py-2">
        <div className="flex items-center min-w-0">
          <AppBrand onClick={() => setLocation("/")} showTextOnMobile className="min-w-0" />
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 h-9 px-2 sm:px-3"
            onClick={() => {
              const newLang = i18n.language.startsWith("ru") ? "en" : "ru";
              i18n.changeLanguage(newLang);
            }}
            title={i18n.language.startsWith("ru") ? "Switch to English" : "Switch to Russian"}
          >
            <Languages className="h-4 w-4" />
            <span className="text-xs font-medium">{i18n.language.startsWith("ru") ? "RU" : "EN"}</span>
          </Button>
          {accessToken ? <UserMenu /> : shouldShowLoginButton ? (
            <Button variant="outline" size="sm" onClick={redirectToAuth}>
              {t("auth.loginButton")}
            </Button>
          ) : null}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {isLoading ? (
          <Card>
            <CardContent className="py-8 flex items-center justify-center">
              <CustomLoader variant="dots" text={t("common.loading")} />
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="pt-8 pb-8">
              <Empty className="border-none p-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileText className="h-5 w-5" />
                  </EmptyMedia>
                  <EmptyTitle>{t("respond.formUnavailable")}</EmptyTitle>
                  <EmptyDescription>{error}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        ) : form ? (
          <Card>
            <CardHeader>
              <CardTitle>{form.title || t("common.untitled")}</CardTitle>
              {form.description ? <CardDescription>{form.description}</CardDescription> : null}
            </CardHeader>
            <CardContent>
              {isSubmitted ? (
                <Empty className="border border-border/60 rounded-lg p-8">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <CheckCircle2 className="h-5 w-5" />
                    </EmptyMedia>
                    <EmptyTitle>{t("respond.submittedTitle")}</EmptyTitle>
                    <EmptyDescription>{t("respond.submittedDesc")}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <FormPreview
                  form={form}
                  mode="respond"
                  submitting={isSubmitting}
                  submitLabel={t("respond.submit")}
                  onSubmitAnswers={handleSubmit}
                />
              )}
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
