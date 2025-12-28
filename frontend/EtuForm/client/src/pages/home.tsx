import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Calendar, Clock, Trash2, Folder, FolderPlus, MoreVertical, X, Check } from "lucide-react";
import { storage } from "@/lib/storage";
import { useEffect, useState } from "react";
import { FormSchema, FormFolder } from "@/lib/form-types";
import { formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';
import { Languages } from "lucide-react";

export default function Home() {
  const [forms, setForms] = useState<FormSchema[]>([]);
  const [folders, setFolders] = useState<FormFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { t, i18n } = useTranslation();

  const refreshData = () => {
    setForms(storage.getForms());
    setFolders(storage.getFolders());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const createNewForm = () => {
    const newForm = storage.createForm(selectedFolderId || undefined);
    window.location.href = `/builder/${newForm.id}`;
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
    refreshData();
    setIsDialogOpen(false);
  };

  const deleteFolder = (id: string) => {
    if (confirm(t("actions.confirmDeleteFolder"))) {
      storage.deleteFolder(id);
      if (selectedFolderId === id) setSelectedFolderId(null);
      refreshData();
    }
  };

  const deleteForm = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(t("actions.confirmDeleteForm"))) {
      storage.deleteForm(id);
      refreshData();
    }
  };

  const moveForm = (e: React.MouseEvent, formId: string, folderId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    const form = forms.find(f => f.id === formId);
    if (form) {
      storage.saveForm({ ...form, folderId });
      refreshData();
    }
  };

  const filteredForms = selectedFolderId 
    ? forms.filter(f => f.folderId === selectedFolderId)
    : forms;

  return (
    // Шапка
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="h-19 border-b border-border bg-white flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-16 w-16  rounded-lg flex items-center justify-center">
              <img src="/logo_etu.png" alt="ETU_LOGO" />
          </div>
          <div className="color-txt">
            <span className="font-bold text-xl">ETU-Form</span>
          </div>
        </div>
          <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 h-9 px-3"
            onClick={() => {
              const newLang = i18n.language.startsWith('ru') ? 'en' : 'ru';
              i18n.changeLanguage(newLang);
            }}
            title={i18n.language.startsWith('ru') ? 'Переключить на Английский' : 'Switch to Russian'}>
            <Languages className="h-4 w-4" />
            <span className="hidden sm:inline text-sm font-medium">
              {i18n.language.startsWith('ru') ? 'RU' : 'EN'}
            </span>
          </Button>
          <Button onClick={createNewForm} className="gap-2">
            <Plus className="h-4 w-4" /> {t('navigation.createNewForm')}
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto">
        {/* Боковая панель */}
        <aside className="w-64 border-r border-border/50 bg-transparent p-6 space-y-6">
          <div className="space-y-1">
             <Button 
               variant={selectedFolderId === null ? "secondary" : "ghost"} 
               className="w-full justify-start"
               onClick={() => setSelectedFolderId(null)}
             >
               <FileText className="mr-2 h-4 w-4" /> {t('navigation.allForms')}
             </Button>
             {folders.map(folder => (
               <div key={folder.id} className="group flex items-center">
                 <Button 
                   variant={selectedFolderId === folder.id ? "secondary" : "ghost"} 
                   className="w-full justify-start truncate"
                   onClick={() => setSelectedFolderId(folder.id)}
                 >
                   <Folder className="mr-2 h-4 w-4" /> 
                   <span className="truncate">{folder.name}</span>
                 </Button>
                 <Button
                   variant="ghost"
                   size="icon"
                   className="h-8 w-8 opacity-0 group-hover:opacity-100 -ml-8 z-10 hover:bg-destructive/10 hover:text-destructive"
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
                <Button variant="outline" className="w-full justify-start">
                  <FolderPlus className="mr-2 h-4 w-4" />{t('navigation.newFolder')}
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

        {/* Main Content */}
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold">
              {selectedFolderId ? folders.find(f => f.id === selectedFolderId)?.name || "Folder" : t("navigation.allForms")}
            </h1>
          </div>

          {filteredForms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-dashed border-border">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">{t("navigation.noForms")}</h3>
              <p className="text-muted-foreground mb-6">{t("navigation.noFormsDesc")}</p>
              <Button onClick={createNewForm}>{t("navigation.createNewForm")}</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredForms.map(form => (
                <Link key={form.id} href={`/builder/${form.id}`}>
                  <div className="group bg-white rounded-xl border border-border p-6 hover:shadow-md transition-all cursor-pointer hover:border-primary/50 relative">
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>{t("actions.act")}</DropdownMenuLabel>
                          <DropdownMenuItem onClick={(e) => deleteForm(e, form.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> {t("actions.delete")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>{t("actions.moveTo")}</DropdownMenuLabel>
                          <DropdownMenuItem onClick={(e) => moveForm(e, form.id, undefined)}>
                             {t("navigation.allForms")}
                          </DropdownMenuItem>
                          {folders.map(folder => (
                             <DropdownMenuItem key={folder.id} onClick={(e) => moveForm(e, form.id, folder.id)}>
                               {folder.name}
                             </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-start justify-between mb-4">
                      <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                        <FileText className="h-5 w-5" />
                      </div>
                      <span className="text-xs text-muted-foreground pr-8">
                        {form.updatedAt ? formatDistanceToNow(form.updatedAt, { addSuffix: true }) : 'Just now'}
                      </span>
                    </div>
                    <h3 className="font-semibold text-lg mb-1 truncate">{form.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 h-10">
                      {form.description || "No description"}
                    </p>
                    <div className="mt-4 pt-4 border-t flex items-center gap-4 text-sm text-muted-foreground">
                       <div className="flex items-center gap-1">
                         <span className="font-medium text-foreground">{form.fields.length}</span> Fields
                       </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
