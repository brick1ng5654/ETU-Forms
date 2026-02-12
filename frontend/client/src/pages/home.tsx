import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Plus,
  FileText,
  Trash2,
  Folder,
  FolderPlus,
  MoreVertical,
  X,
  BarChart3,
  PencilLine,
  Play,
  Info,
  Languages,
} from "lucide-react";
import { storage } from "@/lib/storage";
import { FormSchema, FormFolder } from "@/lib/form-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { createForm, deleteForm as deleteFormApi, fetchFormsCatalog } from "@/lib/forms-api";
import { useAuth } from "@/lib/auth";
import { AppBrand } from "@/components/app-brand";
import { CustomLoader } from "@/components/ui/custom-loader";

type AccessCategory = "all" | "edit" | "responses" | "continue";

const isSubmitted = (form: FormSchema) => form.status === "submitted";

const canEditForm = (form: FormSchema) => form.canEdit ?? true;
const canViewResponses = (form: FormSchema) => form.canViewResponses ?? (canEditForm(form) && isSubmitted(form));
const getPrivateLinkKey = (form: FormSchema): string | null => {
  const rawSettings = form.settings_json;
  if (!rawSettings || typeof rawSettings !== "object") return null;
  const key = (rawSettings as Record<string, unknown>).privateLinkKey;
  return typeof key === "string" && key.trim() ? key.trim() : null;
};

export default function Home() {
  const [forms, setForms] = useState<FormSchema[]>([]);
  const [folders, setFolders] = useState<FormFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<AccessCategory>("all");
  const [newFolderName, setNewFolderName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [propertiesForm, setPropertiesForm] = useState<FormSchema | null>(null);
  const { accessToken, isLoading } = useAuth();
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const [isLoadingForms, setIsLoadingForms] = useState(true);
  const categoryButtonClass = "w-full h-10 md:h-auto px-0 md:px-3 justify-center md:justify-start md:py-2 md:whitespace-normal md:text-left md:leading-tight";
  const folderButtonClass = "w-full h-10 px-0 md:px-3 justify-center md:justify-start";

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
      setFolders(storage.getFolders());
    } catch (error) {
      console.error("Failed to load forms:", error);
      setForms(storage.getForms());
      setFolders(storage.getFolders());
    } finally {
      setIsLoadingForms(false);
    }
  };

  useEffect(() => {
    if (isLoading || !accessToken) {
      return;
    }
    void refreshData();
  }, [isLoading, accessToken]);

  const createNewForm = async () => {
    if (isLoading) {
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

  const createFolder = () => {
    if (!newFolderName.trim()) {
      toast({ title: t("actions.error"), description: t("descerr.empty"), variant: "destructive" });
      return;
    }

    if (storage.folderExists(newFolderName.trim())) {
      toast({ title: t("actions.error"), description: t("descerr.query"), variant: "destructive" });
      return;
    }

    storage.createFolder(newFolderName.trim());
    setNewFolderName("");
    void refreshData();
    setIsDialogOpen(false);
  };

  const deleteFolder = (id: string) => {
    if (confirm(t("actions.confirmDeleteFolder"))) {
      storage.deleteFolder(id);
      if (selectedFolderId === id) setSelectedFolderId(null);
      void refreshData();
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

  const moveForm = (e: MouseEvent, form: FormSchema, folderId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canEditForm(form)) {
      toast({ title: t("actions.error"), description: t("home.noEditAccess"), variant: "destructive" });
      return;
    }
    storage.saveForm({ ...form, folderId });
    void refreshData();
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
    const key = getPrivateLinkKey(form);
    const href = key ? `/form/${form.id}?key=${encodeURIComponent(key)}` : `/form/${form.id}`;
    setLocation(href);
  };

  const categoryLabel = useMemo<Record<AccessCategory, string>>(
    () => ({
      all: t("navigation.allForms"),
      edit: t("navigation.availableForEdit"),
      responses: t("navigation.availableForViewResponses"),
      continue: t("navigation.availableForContinue"),
    }),
    [t]
  );

  const filteredForms = useMemo(() => {
    let current = [...forms];

    if (selectedCategory === "edit") {
      current = current.filter(canEditForm);
    } else if (selectedCategory === "responses") {
      current = current.filter(canViewResponses);
    } else if (selectedCategory === "continue") {
      current = [];
    }

    if (selectedFolderId) {
      current = current.filter((form) => form.folderId === selectedFolderId);
    }

    return current;
  }, [forms, selectedCategory, selectedFolderId]);

  const selectedFolderName = selectedFolderId ? folders.find((f) => f.id === selectedFolderId)?.name : null;
  const pageTitle = selectedFolderName ? `${categoryLabel[selectedCategory]} / ${selectedFolderName}` : categoryLabel[selectedCategory];
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
          <Button onClick={createNewForm} className="h-9 px-2 sm:px-3 gap-0 sm:gap-2" title={t("navigation.createNewForm")}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t("navigation.createNewForm")}</span>
          </Button>
          <UserMenu />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto">
        <aside className="w-14 md:w-72 border-r border-border/50 bg-transparent p-2 md:p-6 space-y-3 md:space-y-6">
          <div className="space-y-1">
            <div className="hidden md:block px-2 text-xs uppercase tracking-wide text-muted-foreground">{t("navigation.categories")}</div>
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
              variant={selectedCategory === "continue" ? "secondary" : "ghost"}
              className={categoryButtonClass}
              onClick={() => setSelectedCategory("continue")}
              title={t("navigation.availableForContinue")}
            >
              <Play className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">{t("navigation.availableForContinue")}</span>
            </Button>
          </div>

          <div className="space-y-1 pt-4 border-t border-border/50">
            <div className="hidden md:block px-2 text-xs uppercase tracking-wide text-muted-foreground">{t("navigation.folders")}</div>
            <Button
              variant={selectedFolderId === null ? "secondary" : "ghost"}
              className={folderButtonClass}
              onClick={() => setSelectedFolderId(null)}
              title={t("navigation.allFolders")}
            >
              <Folder className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">{t("navigation.allFolders")}</span>
            </Button>
            {folders.map((folder) => (
              <div key={folder.id} className="group flex items-center">
                <Button
                  variant={selectedFolderId === folder.id ? "secondary" : "ghost"}
                  className={folderButtonClass}
                  onClick={() => setSelectedFolderId(folder.id)}
                  title={folder.name}
                >
                  <Folder className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline truncate">{folder.name}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden md:inline-flex h-8 w-8 opacity-0 group-hover:opacity-100 -ml-8 z-10 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => deleteFolder(folder.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-border/50">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className={folderButtonClass} title={t("navigation.newFolder")}>
                  <FolderPlus className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">{t("navigation.newFolder")}</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("navigation.createNewFolder")}</DialogTitle>
                </DialogHeader>
                <div className="flex items-center gap-2 pt-4">
                  <Input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder={t("placeholders.folderName")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        createFolder();
                      }
                    }}
                  />
                  <Button onClick={createFolder}>{t("navigation.create")}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </aside>

        <main className="flex-1 p-8 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold">{pageTitle}</h1>
          </div>
          {isLoadingForms ? (
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
              {!isContinueCategory ? (
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
                        <Button size="sm" variant="outline" onClick={() => openBuilder(form)} disabled={!canEditForm(form)}>
                          <PencilLine className="mr-2 h-4 w-4" />
                          {t("results.openBuilder")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openResults(form)} disabled={!canViewResponses(form)}>
                          <BarChart3 className="mr-2 h-4 w-4" />
                          {t("results.openResults")}
                        </Button>
                        {isContinueCategory ? (
                          <Button size="sm" variant="outline" onClick={() => openPassage(form)}>
                            <Play className="mr-2 h-4 w-4" />
                            {t("home.continuePassage")}
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
                          <DropdownMenuItem onClick={() => openBuilder(form)} disabled={!canEditForm(form)}>
                            <PencilLine className="mr-2 h-4 w-4" /> {t("results.openBuilder")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openResults(form)} disabled={!canViewResponses(form)}>
                            <BarChart3 className="mr-2 h-4 w-4" /> {t("results.openResults")}
                          </DropdownMenuItem>
                          {isContinueCategory ? (
                            <DropdownMenuItem onClick={() => openPassage(form)}>
                              <Play className="mr-2 h-4 w-4" /> {t("home.continuePassage")}
                            </DropdownMenuItem>
                          ) : null}
                          {canEditForm(form) ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel>{t("actions.moveTo")}</DropdownMenuLabel>
                              <DropdownMenuItem onClick={(e) => moveForm(e, form, undefined)}>
                                {t("navigation.allFolders")}
                              </DropdownMenuItem>
                              {folders.map((folder) => (
                                <DropdownMenuItem key={folder.id} onClick={(e) => moveForm(e, form, folder.id)}>
                                  {folder.name}
                                </DropdownMenuItem>
                              ))}
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
    </div>
  );
}
