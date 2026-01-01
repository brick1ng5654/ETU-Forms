import { FormSchema, FormFolder } from "./form-types";
import { nanoid } from "nanoid";
import { useTranslation } from 'react-i18next';
import { Languages } from "lucide-react";
import { t } from "i18next";

const STORAGE_KEY_FORMS = "etu_forms";
const STORAGE_KEY_FOLDERS = "etu_folders";

export const storage = {

/** 
  Функция извлекает все сохраненные формы из localStorage
*/
  getForms: (): FormSchema[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY_FORMS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

/**
  Функция извлекает все сохраненные папки из localStorage
*/
  getFolders: (): FormFolder[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY_FOLDERS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

/**
  Функция проверяет, существует ли папка с таким именем в пространстве
*/
  folderExists: (name: string): boolean => {
    const folders = storage.getFolders();
    return folders.some(f => f.name.toLowerCase() === name.toLowerCase());
  },

/**
  Функция сохранения формы.
*/
  saveForm: (form: FormSchema) => {
    const forms = storage.getForms();
    const existingIndex = forms.findIndex(f => f.id === form.id);
    
    const updatedForm = { ...form, updatedAt: Date.now() };
    
    if (existingIndex >= 0) {
      forms[existingIndex] = updatedForm;
    } else {
      forms.push(updatedForm);
    }
    
    localStorage.setItem(STORAGE_KEY_FORMS, JSON.stringify(forms));
    return updatedForm;
  },

/**
  Функция удаление формы.
*/
  deleteForm: (id: string) => {
    const forms = storage.getForms().filter(f => f.id !== id);
    localStorage.setItem(STORAGE_KEY_FORMS, JSON.stringify(forms));
  },

/**
  Функция сохранения папки.
*/
  saveFolder: (folder: FormFolder) => {
    const folders = storage.getFolders();
    if (!folders.find(f => f.id === folder.id)) {
      folders.push(folder);
      localStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(folders));
    }
  },

/**
  Функция удаленя папки с домашней страницы.
*/ 
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

/**
  Функция создание формы.
  Создает форму, которая дает наименование файлу в title,
  пустое описание в плейсхолдере,
  нынешнее время создание.
*/
  createForm: (folderId?: string): FormSchema => {
    const newForm: FormSchema = {
      id: nanoid(),
      folderId,
      title: t("common.untitled"),
      description: "",
      fields: [],
      updatedAt: Date.now()
    };
    storage.saveForm(newForm);
    return newForm;
  },

/**
  Функция создания папки на домашней странице.
*/
  createFolder: (name: string): FormFolder => {
    const newFolder = { id: nanoid(), name };
    storage.saveFolder(newFolder);
    return newFolder;
  }
};
