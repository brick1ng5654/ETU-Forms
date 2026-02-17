import type { FormElementModel, FormFolder, FormSchema, FormPageModel } from "@/form/types";
import { nanoid } from "nanoid";
import { t } from "i18next";

const STORAGE_KEY_FORMS = "etu_forms";
const STORAGE_KEY_FOLDERS = "etu_folders";

export const storage = {
  normalizeFields: (fields: unknown): FormElementModel[] => {
    return normalizeFieldsWithMeta(fields).fields;
  },

  getForms: (): FormSchema[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY_FORMS);
      const parsed = data ? JSON.parse(data) : [];
      if (!Array.isArray(parsed)) return [];
      let didMutate = false;
      const normalizedForms = parsed.map((form: any) => {
        const rawFields = Array.isArray(form.fields) ? form.fields : [];
        const rawPages = Array.isArray(form.pages) ? form.pages : [];
        const normalizedPages = normalizePages(rawPages);
        const normalized = normalizeFieldsWithMeta(rawFields);
        if (normalized.didMutate) {
          didMutate = true;
        }
        return {
          ...form,
          pages: normalizedPages,
          fields: normalized.fields,
        } as FormSchema;
      });
      if (didMutate) {
        localStorage.setItem(STORAGE_KEY_FORMS, JSON.stringify(normalizedForms));
      }
      return normalizedForms;
    } catch (e) {
      return [];
    }
  },

  getFolders: (): FormFolder[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY_FOLDERS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  folderExists: (name: string): boolean => {
    const folders = storage.getFolders();
    return folders.some(f => f.name.toLowerCase() === name.toLowerCase());
  },

  saveForm: (form: FormSchema) => {
    const forms = storage.getForms();
    const existingIndex = forms.findIndex(f => f.id === form.id);

    const normalizedPages = normalizePages(form.pages);
    const normalized = normalizeFieldsWithMeta(form.fields);
    const existing = existingIndex >= 0 ? forms[existingIndex] : undefined;
    const updatedForm = {
      ...form,
      folderId: form.folderId ?? existing?.folderId,
      pages: normalizedPages,
      fields: normalized.fields,
      fieldCount: form.fieldCount ?? normalized.fields.length,
      updatedAt: form.updatedAt ?? Date.now(),
    };

    if (existingIndex >= 0) {
      forms[existingIndex] = updatedForm;
    } else {
      forms.push(updatedForm);
    }

    localStorage.setItem(STORAGE_KEY_FORMS, JSON.stringify(forms));
    return updatedForm;
  },

  setForms: (forms: FormSchema[]) => {
    localStorage.setItem(STORAGE_KEY_FORMS, JSON.stringify(forms));
  },

  mergeRemoteForms: (remoteForms: FormSchema[]): FormSchema[] => {
    const localForms = storage.getForms();
    const folderById = new Map(localForms.map(form => [form.id, form.folderId]));
    const localById = new Map(localForms.map(form => [form.id, form]));
    const merged = remoteForms.map(form => {
      const localForm = localById.get(form.id);
      const fields = form.fields.length > 0 ? form.fields : (localForm?.fields ?? form.fields);
      const pages = form.pages.length > 0 ? form.pages : (localForm?.pages ?? form.pages);
      return {
        ...form,
        pages,
        fields,
        fieldCount: form.fieldCount ?? localForm?.fieldCount,
        folderId: folderById.get(form.id),
      };
    });
    storage.setForms(merged);
    return merged;
  },

  deleteForm: (id: string) => {
    const forms = storage.getForms().filter(f => f.id !== id);
    localStorage.setItem(STORAGE_KEY_FORMS, JSON.stringify(forms));
  },

  saveFolder: (folder: FormFolder) => {
    const folders = storage.getFolders();
    if (!folders.find(f => f.id === folder.id)) {
      folders.push(folder);
      localStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(folders));
    }
  },

  deleteFolder: (id: string) => {
    const folders = storage.getFolders().filter(f => f.id !== id);
    localStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(folders));

    const forms = storage.getForms().map(f => {
      if (f.folderId === id) {
        return { ...f, folderId: undefined };
      }
      return f;
    });
    localStorage.setItem(STORAGE_KEY_FORMS, JSON.stringify(forms));
  },

  createForm: (folderId?: string): FormSchema => {
    const pages = normalizePages([]);
    const newForm: FormSchema = {
      id: nanoid(),
      folderId,
      title: t("common.untitled"),
      description: "",
      pages,
      fields: [],
      fieldCount: 0,
      status: "temp",
      startAt: null,
      endAt: null,
      accessMode: "private",
      updatedAt: Date.now(),
    };
    storage.saveForm(newForm);
    return newForm;
  },

  createFormWithId: (id: string, folderId?: string): FormSchema => {
    const existing = storage.getForms().find(form => form.id === id);
    if (existing) return existing;
    const pages = normalizePages([]);
    const newForm: FormSchema = {
      id,
      folderId,
      title: t("common.untitled"),
      description: "",
      pages,
      fields: [],
      fieldCount: 0,
      status: "temp",
      startAt: null,
      endAt: null,
      accessMode: "private",
      updatedAt: Date.now(),
    };
    storage.saveForm(newForm);
    return newForm;
  },

  createFolder: (name: string): FormFolder => {
    const newFolder = { id: nanoid(), name };
    storage.saveFolder(newFolder);
    return newFolder;
  }
};

const normalizeFieldsWithMeta = (fields: unknown): {
  fields: FormElementModel[];
  didMutate: boolean;
} => {
  if (!Array.isArray(fields)) return { fields: [], didMutate: false };
  const normalized = fields as FormElementModel[];
  let didMutate = false;

  const normalizedFields = normalized.map((element, index) => {
    const nextProps = (element as FormElementModel).props ?? {};
    const nextSortIndex =
      typeof (element as FormElementModel).sortIndex === "number"
        ? (element as FormElementModel).sortIndex
        : index;
    const rawPageId = (element as FormElementModel).pageId;
    const nextPageId = typeof rawPageId === "number" && Number.isFinite(rawPageId) ? rawPageId : 1;
    const rawId = (element as FormElementModel).id;
    const nextId = rawId != null && String(rawId).trim() !== "" ? String(rawId).trim() : nanoid();

    if ((element as FormElementModel).props !== nextProps) {
      didMutate = true;
    }
    if ((element as FormElementModel).sortIndex !== nextSortIndex) {
      didMutate = true;
    }
    if ((element as FormElementModel).pageId !== nextPageId) {
      didMutate = true;
    }
    if ((element as FormElementModel).id !== nextId) {
      didMutate = true;
    }

    return {
      ...element,
      id: nextId,
      pageId: nextPageId,
      props: nextProps,
      sortIndex: nextSortIndex,
    };
  });

  return { fields: normalizedFields, didMutate };
};

const normalizePages = (pages: FormPageModel[] | unknown): FormPageModel[] => {
  if (!Array.isArray(pages) || pages.length === 0) {
    return [{ id: 1, title: "Страница 1", pageIndex: 0, allowBack: true }];
  }

  return pages
    .map((page, index) => ({
      id: typeof page.id === "number" ? page.id : index + 1,
      title: typeof page.title === "string" ? page.title : `Страница ${index + 1}`,
      pageIndex: typeof page.pageIndex === "number" ? page.pageIndex : index,
      allowBack: typeof page.allowBack === "boolean" ? page.allowBack : true,
    }))
    .sort((a, b) => a.pageIndex - b.pageIndex);
};
