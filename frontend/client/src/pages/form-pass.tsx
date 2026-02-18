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

/**
 * Вариант B: если пользователь жмёт "назад" в браузере — отправляем на "/"
 * locked=true включает блокировку.
 */
function useRedirectHomeOnBrowserBack(locked: boolean) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!locked) return;

    // Кладём "якорь" в history, чтобы Back не выкинул со страницы мгновенно.
    // На Back поймаем popstate и уйдём на "/".
    const pushAnchor = () => {
      try {
        history.pushState({ __lock_back__: true }, "", window.location.href);
      } catch {
        // ignore
      }
    };

    // Ставим якорь 1 раз при включении locked
    pushAnchor();

    const onPopState = () => {
      // Пользователь нажал назад/вперёд
      // Мы не даём уйти назад — отправляем домой
      setLocation("/", { replace: true });
    };

    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [locked, setLocation]);
}

export default function FormPass({ params }: { params: { id: string } }) {
  const { t, i18n } = useTranslation();
  const [location, setLocation] = useLocation();
  const { accessToken } = useAuth();
  const [form, setForm] = useState<FormSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageAllowBack, setPageAllowBack] = useState(true);
  const [pageIsFirst, setPageIsFirst] = useState(true);
  const [initialPageId, setInitialPageId] = useState<number | undefined>(undefined);
  const isUnauthenticatedMode = form?.accessMode === "unauthenticated";
  const shouldShowLoginButton = !accessToken && !isLoading && !isUnauthenticatedMode;
  const progressKey = (formId: string | number) => `form_progress:${formId}`;

  const savedStep = useMemo(() => {
    const raw = localStorage.getItem(progressKey(params.id));
    const n = raw ? Number(raw) : 1;
    return Number.isFinite(n) && n >= 1 ? n : 1;
  }, [params.id]);

  const linkKey = useMemo(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("key") ?? "";
    }
    const query = location.includes("?") ? location.slice(location.indexOf("?")) : "";
    return new URLSearchParams(query).get("key") ?? "";
  }, [location]);

  const initialPageNumber = useMemo(() => {
    const query = typeof window !== "undefined"
      ? window.location.search
      : location.includes("?") ? location.slice(location.indexOf("?")) : "";

    const raw = new URLSearchParams(query).get("p");
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 1; // p=1..N
  }, [location]);


  const startedAt = useMemo(() => new Date().toISOString(), [params.id, linkKey]);
  const effectiveStep = useMemo(() => {
    // 1) p из URL
    const stepFromUrl = initialPageNumber; // у тебя уже есть
    if (Number.isFinite(stepFromUrl) && stepFromUrl > 0) return stepFromUrl;

    // 2) иначе из localStorage
    return savedStep;
  }, [initialPageNumber, savedStep]);

  const redirectToAuth = () => {
    const next =
      typeof window !== "undefined"
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
        const pages = (detail.pages ?? []).slice().sort((a, b) => a.pageIndex - b.pageIndex);
        const step = Math.max(1, Math.min(pages.length || 1, effectiveStep));
        const idx = step - 1;

        setInitialPageId(pages[idx]?.id ?? pages[0]?.id ?? 1);

      } catch (err: any) {
        if (!active) return;
        const httpError = err as HttpError;
        if (httpError?.status === 401) {
          redirectToAuth();
          return;
        }
        setError(err?.message ?? t("respond.loadError"));
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [linkKey, params.id, t, setLocation, effectiveStep]);

  /**
   * ⚠️ Тут логика "когда запрещать Back".
   * Сейчас: если у формы есть хотя бы одна страница с allowBack=false — блокируем Back браузера всегда.
   *
   * Если ты можешь получить текущую страницу (pageIndex/pageId) во время прохождения,
   * лучше сделать: locked = !currentPage.allowBack
   */
  const backLocked = useMemo(() => {
    // запрещаем browser-back только если:
    // - мы не на первой странице
    // - и allowBack=false
    return !pageIsFirst && !pageAllowBack;
  }, [pageIsFirst, pageAllowBack]);

  useRedirectHomeOnBrowserBack(backLocked);

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
          {accessToken ? (
            <UserMenu />
          ) : shouldShowLoginButton ? (
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
                  initialPageId={initialPageId}
                  submitting={isSubmitting}
                  submitLabel={t("respond.submit")}
                  onSubmitAnswers={handleSubmit}
                  onActivePageChange={(info) => {
                    setPageAllowBack(info.allowBack);
                    setPageIsFirst(info.isFirst);

                    const step = info.pageIndex + 1; // pageIndex 0-based → step 1-based
                    localStorage.setItem(progressKey(params.id), String(step));
                  }}
                />
              )}
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
