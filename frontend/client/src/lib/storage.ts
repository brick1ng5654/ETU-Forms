import type { FormElementModel, FormFolder, FormSchema } from "@/form/types";
import { nanoid } from "nanoid";
import { t } from "i18next";
import { fromStructureJson } from "@/form/adapters/fromStructureJson";

const STORAGE_KEY_FORMS = "etu_forms";
const STORAGE_KEY_FOLDERS = "etu_folders";

export const storage = {
  normalizeFields: (fields: unknown): FormElementModel[] => {
    if (!Array.isArray(fields)) return [];
    const first = fields[0] as { widgetType?: string; type?: string } | undefined;
    const normalized = first?.widgetType
      ? (fields as FormElementModel[])
      : first?.type
        ? fromStructureJson({ fields: fields as any })
        : (fields as FormElementModel[]);

    return normalized.map((element, index) => ({
      ...element,
      props: (element as FormElementModel).props ?? {},
      sortIndex:
        typeof (element as FormElementModel).sortIndex === "number"
          ? (element as FormElementModel).sortIndex
          : index,
    }));
  },

  getForms: (): FormSchema[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY_FORMS);
      const parsed = data ? JSON.parse(data) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.map((form: any) => {
        const rawFields = Array.isArray(form.fields)
          ? form.fields
          : Array.isArray(form.structure_json?.fields)
            ? form.structure_json.fields
            : [];
        return {
          ...form,
          fields: storage.normalizeFields(rawFields),
        } as FormSchema;
      });
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

    const updatedForm = { ...form, fields: storage.normalizeFields(form.fields), updatedAt: Date.now() };

    if (existingIndex >= 0) {
      forms[existingIndex] = updatedForm;
    } else {
      forms.push(updatedForm);
    }

    localStorage.setItem(STORAGE_KEY_FORMS, JSON.stringify(forms));
    return updatedForm;
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
    const newForm: FormSchema = {
      id: nanoid(),
      folderId,
      title: t("common.untitled"),
      description: "",
      fields: [],
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
