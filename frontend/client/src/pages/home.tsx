import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  FileText,
  Trash2,
  MoreVertical,
  BarChart3,
  PencilLine,
  Play,
  Info,
  Languages,
  CheckCircle,
  RotateCcw,
  Users,
  UserMinus,
} from "lucide-react";
import { storage } from "@/lib/storage";
import { FormSchema } from "@/lib/form-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { UserMenu } from "@/components/user-menu";
import { FormAccessDialog } from "@/components/form-access-dialog";
import { createForm, deleteForm as deleteFormApi, fetchFormsCatalog, fetchMyResponses, leaveFormAccess, revokeResponse, type StoredFormResponse } from "@/lib/forms-api";
import { useAuth } from "@/lib/auth";
import { AppBrand } from "@/components/app-brand";
import { CustomLoader } from "@/components/ui/custom-loader";

type AccessCategory = "all" | "edit" | "responses" | "continue" | "completed";

const isSubmitted = (form: FormSchema) => form.status === "submitted";

const canEditForm = (form: FormSchema) => form.canEdit ?? true;
const canViewResponses = (form: FormSchema) => form.canViewResponses ?? (canEditForm(form) && isSubmitted(form));
const canContinuePassage = (form: FormSchema) => form.canContinuePassage ?? isSubmitted(form);
const getPrivateLinkKey = (form: FormSchema): string | null => {
  const rawSettings = form.settings_json;
  if (!rawSettings || typeof rawSettings !== "object") return null;
  const key = (rawSettings as Record<string, unknown>).privateLinkKey;
  return typeof key === "string" && key.trim() ? key.trim() : null;
};

export default function Home() {
  const [forms, setForms] = useState<FormSchema[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<AccessCategory>("continue");
  const [propertiesForm, setPropertiesForm] = useState<FormSchema | null>(null);
  const [myResponses, setMyResponses] = useState<StoredFormResponse[]>([]);
  const [isLoadingResponses, setIsLoadingResponses] = useState(false);
  const [accessForm, setAccessForm] = useState<FormSchema | null>(null);
  const { accessToken, isLoading, user } = useAuth();
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const [isLoadingForms, setIsLoadingForms] = useState(true);
  const categoryButtonClass = "w-full h-10 md:h-auto px-0 md:px-3 justify-center md:justify-start md:py-2 md:whitespace-normal md:text-left md:leading-tight";
  const canCreateForms = user?.role === "form_creator" || user?.role === "admin";
  const hasAnyRole = Boolean(user?.role);
  const continueCategoryLabel = i18n.language.startsWith("ru")
    ? "Доступные для прохождения формы"
    : t("navigation.availableForContinue");

  const formatDateTime = (value?: number) => {
    if (!value) return t("home.notAvailable");
    return new Intl.DateTimeFormat(i18n.language.startsWith("ru") ? "ru-RU" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  };

  const refreshData = async () => {
    if (isLoading || !accessToken) {
      return;
    }
    try {
      setIsLoadingForms(true);
      const remoteForms = await fetchFormsCatalog();
      const merged = storage.mergeRemoteForms(remoteForms);
      setForms(merged);
    } catch (error) {
      console.error("Failed to load forms:", error);
      setForms(storage.getForms());
    } finally {
      setIsLoadingForms(false);
    }
  };

  const refreshResponses = async () => {
    if (isLoading || !accessToken) {
      return;
    }
    try {
      setIsLoadingResponses(true);
      const responses = await fetchMyResponses();
      setMyResponses(responses);
    } catch (error) {
      console.error("Failed to load responses:", error);
      setMyResponses([]);
    } finally {
      setIsLoadingResponses(false);
    }
  };

  useEffect(() => {
    if (isLoading || !accessToken) {
      return;
    }
    void refreshData();
    if (selectedCategory === "completed") {
      void refreshResponses();
    }
  }, [isLoading, accessToken, selectedCategory]);

  useEffect(() => {
    if (!accessToken) return;
    const onVisible = () => void refreshData();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [accessToken]);

  const createNewForm = async () => {
    if (isLoading) {
      return;
    }
    if (!canCreateForms) {
      return;
    }
    if (!accessToken) {
      setLocation("/auth");
      return;
    }
    try {
      const created = await createForm({
        title: t("common.untitled"),
        description: "",
      });
      storage.saveForm({ ...created, fields: created.fields ?? [], canEdit: true });
      setForms(storage.getForms());
      setLocation(`/builder/${created.id}`);
    } catch (error) {
      console.error("Failed to create form:", error);
      toast({ title: t("actions.error"), description: t("home.createError"), variant: "destructive" });
    }
  };

  const deleteForm = async (e: MouseEvent, form: FormSchema) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canEditForm(form)) {
      toast({ title: t("actions.error"), description: t("home.noEditAccess"), variant: "destructive" });
      return;
    }
    if (confirm(t("actions.confirmDeleteForm"))) {
      try {
        await deleteFormApi(form.id);
      } catch (error) {
        console.error("Failed to delete form:", error);
      }
      storage.deleteForm(form.id);
      void refreshData();
    }
  };

  const openBuilder = (form: FormSchema) => {
    if (!canEditForm(form)) {
      toast({ title: t("actions.error"), description: t("home.noEditAccess"), variant: "destructive" });
      return;
    }
    setLocation(`/builder/${form.id}`);
  };

  const openResults = (form: FormSchema) => {
    if (!canViewResponses(form)) {
      toast({ title: t("results.openResults"), description: t("home.noResultsAccess"), variant: "destructive" });
      return;
    }
    setLocation(`/forms/${form.id}/results`);
  };

  const openPassage = (form: FormSchema) => {
    // Проверяем, что форма существует и не удалена
    if (!form || form.status !== "submitted") {
      toast({ 
        title: t("actions.error"), 
        description: t("home.formNotAvailable"), 
        variant: "destructive" 
      });
      return;
    }
    const key = getPrivateLinkKey(form);
    const href = key ? `/form/${form.id}?key=${encodeURIComponent(key)}` : `/form/${form.id}`;
    setLocation(href);
  };

  const isFormOwner = (form: FormSchema) => {
    if (!user) return false;
    return (form.ownerId ?? null) === user.user_id;
  };

  const declineAccess = async (form: FormSchema) => {
    if (isFormOwner(form)) return;
    if (!confirm(t("access.leaveAccessConfirm"))) return;
    try {
      await leaveFormAccess(form.id);
      toast({ title: t("access.leaveAccessSuccess") });
      if (accessForm?.id === form.id) {
        setAccessForm(null);
      }
      void refreshData();
    } catch (error: any) {
      toast({
        title: t("actions.error"),
        description: error?.message ?? t("access.leaveAccessFailed"),
        variant: "destructive",
      });
    }
  };

  const categoryLabel = useMemo<Record<AccessCategory, string>>(
    () => ({
      all: t("navigation.allForms"),
      edit: t("navigation.availableForEdit"),
      responses: t("navigation.availableForViewResponses"),
      continue: continueCategoryLabel,
      completed: t("navigation.completedForms"),
    }),
    [t, continueCategoryLabel]
  );

  const filteredForms = useMemo(() => {
    let current = [...forms];

    if (selectedCategory === "all") {
      current = current.filter((f) => canEditForm(f) || canViewResponses(f));
    } else if (selectedCategory === "edit") {
      current = current.filter(canEditForm);
    } else if (selectedCategory === "responses") {
      current = current.filter(canViewResponses);
    } else if (selectedCategory === "continue") {
      current = current.filter(
        (f) => canContinuePassage(f) && f.hasDraft
      );
    } else if (selectedCategory === "completed") {
      current = [];
    }

    return current;
  }, [forms, selectedCategory]);

  const handleRevokeResponse = async (response: StoredFormResponse) => {
    const form = forms.find(f => f.id === String(response.formId));
    const formTitle = form?.title || `Form ${response.formId}`;
    if (!confirm(t("home.confirmRevoke", { formTitle }))) {
      return;
    }
    
    try {
      const result = await revokeResponse(response.responseId);
      toast({
        title: t("home.responseRevoked"),
        description: t("home.responseRevokedDesc", { formTitle: result.form_title }),
      });
      
      // Обновляем список ответов
      await refreshResponses();
      
      // Предлагаем пройти форму повторно только если форма существует и не удалена
      const formAfterRevoke = forms.find(f => f.id === String(result.form_id));
      if (formAfterRevoke && formAfterRevoke.status === "submitted") {
        if (confirm(t("home.wantToRetakeForm", { formTitle: result.form_title }))) {
          const key = getPrivateLinkKey(formAfterRevoke);
          const href = key ? `/form/${result.form_id}?key=${encodeURIComponent(key)}` : `/form/${result.form_id}`;
          setLocation(href);
        }
      }
    } catch (error: any) {
      console.error("Failed to revoke response:", error);
      toast({
        title: t("home.revokeError"),
        description: error?.message ?? t("actions.error"),
        variant: "destructive",
      });
    }
  };

  const pageTitle = categoryLabel[selectedCategory];
  const isContinueCategory = selectedCategory === "continue";

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="h-19 border-b border-border bg-white flex items-center justify-between px-3 sm:px-8 shrink-0">
        <div className="flex items-center gap-3">
          <AppBrand />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 h-9 px-3"
            onClick={() => {
              const newLang = i18n.language.startsWith("ru") ? "en" : "ru";
              i18n.changeLanguage(newLang);
            }}
            title={i18n.language.startsWith("ru") ? "Переключить на Английский" : "Switch to Russian"}
          >
            <Languages className="h-4 w-4" />
            <span className="hidden sm:inline text-sm font-medium">{i18n.language.startsWith("ru") ? "RU" : "EN"}</span>
          </Button>
          {canCreateForms ? (
            <Button onClick={createNewForm} className="h-9 px-2 sm:px-3 gap-0 sm:gap-2" title={t("navigation.createNewForm")}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t("navigation.createNewForm")}</span>
            </Button>
          ) : null}
          <UserMenu />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto">
        <aside className="w-14 md:w-72 border-r border-border/50 bg-transparent p-2 md:p-6 space-y-3 md:space-y-6">
          <div className="space-y-1">
            <div className="hidden md:block px-2 text-xs uppercase tracking-wide text-muted-foreground">{t("navigation.categories")}</div>
            <Button
              variant={selectedCategory === "continue" ? "secondary" : "ghost"}
              className={categoryButtonClass}
              onClick={() => setSelectedCategory("continue")}
              title={continueCategoryLabel}
            >
              <Play className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">{continueCategoryLabel}</span>
            </Button>
            <Button
              variant={selectedCategory === "all" ? "secondary" : "ghost"}
              className={categoryButtonClass}
              onClick={() => setSelectedCategory("all")}
              title={t("navigation.allForms")}
            >
              <FileText className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">{t("navigation.allForms")}</span>
            </Button>
            <Button
              variant={selectedCategory === "edit" ? "secondary" : "ghost"}
              className={categoryButtonClass}
              onClick={() => setSelectedCategory("edit")}
              title={t("navigation.availableForEdit")}
            >
              <PencilLine className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">{t("navigation.availableForEdit")}</span>
            </Button>
            <Button
              variant={selectedCategory === "responses" ? "secondary" : "ghost"}
              className={categoryButtonClass}
              onClick={() => setSelectedCategory("responses")}
              title={t("navigation.availableForViewResponses")}
            >
              <BarChart3 className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">{t("navigation.availableForViewResponses")}</span>
            </Button>
            <Button
              variant={selectedCategory === "completed" ? "secondary" : "ghost"}
              className={categoryButtonClass}
              onClick={() => setSelectedCategory("completed")}
              title={t("navigation.completedForms")}
            >
              <CheckCircle className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">{t("navigation.completedForms")}</span>
            </Button>
          </div>

        </aside>

        <main className="flex-1 p-8 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold">{pageTitle}</h1>
          </div>
          {selectedCategory === "completed" ? (
            isLoadingResponses ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-border">
                <CustomLoader variant="dots" text={t("navigation.loadingForms")} size="lg" />
              </div>
            ) : myResponses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-dashed border-border text-center">
                <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">{t("home.noCompletedForms")}</h3>
                <p className="text-muted-foreground mt-2">{t("home.noCompletedFormsDesc")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myResponses.map((response) => {
                  const form = forms.find(f => f.id === String(response.formId));
                  const attemptsExhausted = form && form.attemptLimit != null && form.attemptLimit !== undefined && form.attemptsRemaining === 0;
                  const canRevoke = form?.settings_json && 
                    typeof form.settings_json === "object" &&
                    Boolean((form.settings_json as Record<string, unknown>).allowRevoke) &&
                    form.accessMode !== "unauthenticated" &&
                    response.status === "submitted";
                  
                  return (
                    <div key={response.responseId} className="group bg-white rounded-xl border border-border px-5 py-4 hover:border-primary/40 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
                          <CheckCircle className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-lg truncate">
                            {form?.title || `Form ${response.formId}`}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span>
                              {response.status === "submitted" 
                                ? t("home.submittedAt", { 
                                    date: formatDateTime(
                                      response.completedAt 
                                        ? new Date(response.completedAt).getTime()
                                        : new Date(response.createdAt).getTime()
                                    )
                                  })
                                : t("home.revokedAt", { 
                                    date: formatDateTime(
                                      response.completedAt 
                                        ? new Date(response.completedAt).getTime()
                                        : new Date(response.createdAt).getTime()
                                    )
                                  })}
                            </span>
                            {response.status === "cancelled" && (
                              <Badge variant="secondary">{t("home.revoked")}</Badge>
                            )}
                            {form && form.status === "submitted" && form.attemptLimit !== null && form.attemptLimit !== undefined && (
                              <span className={form.attemptsRemaining === 0 ? "text-destructive font-medium" : ""}>
                                {form.attemptsRemaining === 0
                                  ? t("home.noAttemptsRemaining")
                                  : t("home.attemptsRemaining", { 
                                      remaining: form.attemptsRemaining ?? 0,
                                      total: form.attemptLimit
                                    })}
                              </span>
                            )}
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {canRevoke && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => handleRevokeResponse(response)}
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                {t("home.revokeResponse")}
                              </Button>
                            )}
                            {!attemptsExhausted && form && form.status === "submitted" && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => {
                                  const key = getPrivateLinkKey(form);
                                  const href = key ? `/form/${response.formId}?key=${encodeURIComponent(key)}` : `/form/${response.formId}`;
                                  setLocation(href);
                                }}
                              >
                                <Play className="mr-2 h-4 w-4" />
                                {t("home.retakeForm")}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : isLoadingForms ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-border">
              <CustomLoader variant="dots" text={t("navigation.loadingForms")} size="lg" />
            </div>
          ) : filteredForms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-dashed border-border text-center">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">
                {isContinueCategory ? t("home.noContinueForms") : t("navigation.noForms")}
              </h3>
              {!isContinueCategory && canCreateForms ? (
                <>
                  <p className="text-muted-foreground mb-6">{t("navigation.noFormsDesc")}</p>
                  <Button onClick={createNewForm}>{t("navigation.createNewForm")}</Button>
                </>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredForms.map((form) => (
                <div key={form.id} className="group bg-white rounded-xl border border-border px-5 py-4 hover:border-primary/40 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-lg truncate">{form.title || t("common.untitled")}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>{t("home.author")}: {form.ownerName || t("home.unknownAuthor")}</span>
                        <span>{t("home.version")}: {form.version ?? 1}</span>
                      </div>
                      {form.description ? (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{form.description}</p>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {canEditForm(form) && (
                          <Button size="sm" variant="outline" onClick={() => openBuilder(form)}>
                            <PencilLine className="mr-2 h-4 w-4" />
                            {t("results.openBuilder")}
                          </Button>
                        )}
                        {canViewResponses(form) && (
                          <Button size="sm" variant="outline" onClick={() => openResults(form)}>
                            <BarChart3 className="mr-2 h-4 w-4" />
                            {t("results.openResults")}
                          </Button>
                        )}
                        {isContinueCategory && canContinuePassage(form) && (
                          <Button size="sm" variant="outline" onClick={() => openPassage(form)}>
                            <Play className="mr-2 h-4 w-4" />
                            {t("home.continuePassage")}
                          </Button>
                        )}
                        {hasAnyRole ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAccessForm(form)}
                            disabled={!canEditForm(form)}
                          >
                            <Users className="mr-2 h-4 w-4" />
                            {t("access.manageAccess")}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>{t("actions.act")}</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => setPropertiesForm(form)}>
                            <Info className="mr-2 h-4 w-4" /> {t("actions.properties")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {canEditForm(form) && (
                            <DropdownMenuItem onClick={() => openBuilder(form)}>
                              <PencilLine className="mr-2 h-4 w-4" /> {t("results.openBuilder")}
                            </DropdownMenuItem>
                          )}
                          {canViewResponses(form) && (
                            <DropdownMenuItem onClick={() => openResults(form)}>
                              <BarChart3 className="mr-2 h-4 w-4" /> {t("results.openResults")}
                            </DropdownMenuItem>
                          )}
                          {isContinueCategory && canContinuePassage(form) && (
                            <DropdownMenuItem onClick={() => openPassage(form)}>
                              <Play className="mr-2 h-4 w-4" /> {t("home.continuePassage")}
                            </DropdownMenuItem>
                          )}
                          {!isFormOwner(form) ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => void declineAccess(form)}
                                className="text-destructive focus:text-destructive"
                              >
                                <UserMinus className="mr-2 h-4 w-4" /> {t("access.leaveAccess")}
                              </DropdownMenuItem>
                            </>
                          ) : null}
                          {canEditForm(form) ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => deleteForm(e, form)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> {t("actions.delete")}
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <Dialog open={Boolean(propertiesForm)} onOpenChange={(open) => (!open ? setPropertiesForm(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("actions.properties")}</DialogTitle>
            <DialogDescription className="sr-only">{t("actions.properties")}</DialogDescription>
          </DialogHeader>
          {propertiesForm ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">{t("home.name")}</span>
                <span className="font-medium text-right">{propertiesForm.title || t("common.untitled")}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">{t("home.author")}</span>
                <span className="font-medium text-right">{propertiesForm.ownerName || t("home.unknownAuthor")}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">{t("home.version")}</span>
                <span className="font-medium text-right">{propertiesForm.version ?? 1}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">{t("home.createdAt")}</span>
                <span className="font-medium text-right">{formatDateTime(propertiesForm.createdAt)}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">{t("home.updatedAt")}</span>
                <span className="font-medium text-right">{formatDateTime(propertiesForm.updatedAt)}</span>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <FormAccessDialog
        form={accessForm}
        open={Boolean(accessForm)}
        onOpenChange={(next) => {
          if (!next) {
            setAccessForm(null);
          }
        }}
        canManage={Boolean(accessForm && canEditForm(accessForm))}
        onUpdated={() => {
          void refreshData();
        }}
      />
    </div>
  );
}
