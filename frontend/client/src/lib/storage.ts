import type { FormElementModel, FormFolder, FormSchema } from "@/form/types";
import { nanoid } from "nanoid";
import { t } from "i18next";
import { fromStructureJsonWithMeta } from "@/form/adapters/fromStructureJson";

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
        const rawFields = Array.isArray(form.fields)
          ? form.fields
          : Array.isArray(form.structure_json?.fields)
            ? form.structure_json.fields
            : [];
        const normalized = normalizeFieldsWithMeta(rawFields);
        if (normalized.didMutate) {
          didMutate = true;
        }
        return {
          ...form,
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

    const normalized = normalizeFieldsWithMeta(form.fields);
    const updatedForm = { ...form, fields: normalized.fields, updatedAt: Date.now() };

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
    const newForm: FormSchema = {
      id,
      folderId,
      title: t("common.untitled"),
      description: "",
      fields: [],
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
  const first = fields[0] as { widgetType?: string; type?: string } | undefined;
  const normalized = first?.widgetType
    ? (fields as FormElementModel[])
    : first?.type
      ? fromStructureJsonWithMeta({ fields: fields as any }).fields
      : (fields as FormElementModel[]);
  let didMutate = Boolean(first?.type && !first?.widgetType);

  const normalizedFields = normalized.map((element, index) => {
    const nextProps = (element as FormElementModel).props ?? {};
    const nextSortIndex =
      typeof (element as FormElementModel).sortIndex === "number"
        ? (element as FormElementModel).sortIndex
        : index;
    const rawId = (element as FormElementModel).id;
    const nextId = rawId != null && String(rawId).trim() !== "" ? String(rawId).trim() : nanoid();

    if ((element as FormElementModel).props !== nextProps) {
      didMutate = true;
    }
    if ((element as FormElementModel).sortIndex !== nextSortIndex) {
      didMutate = true;
    }
    if ((element as FormElementModel).id !== nextId) {
      didMutate = true;
    }

    return {
      ...element,
      id: nextId,
      props: nextProps,
      sortIndex: nextSortIndex,
    };
  });

  return { fields: normalizedFields, didMutate };
};
