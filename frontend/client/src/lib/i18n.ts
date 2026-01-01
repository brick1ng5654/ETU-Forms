import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Импорт файлов переводов
import enTranslations from '../locales/en.json';
import ruTranslations from '../locales/ru.json';

/**
 Ресурсы переводов для каждого языка
 Ключи 'en' и 'ru' - коды языков по ISO 639-1
*/
const resources = {
  en: {
    translation: enTranslations // Английские переводы
  },
  ru: {
    translation: ruTranslations // Русские переводы
  }
};

/**
 Инициализация библиотеки i18next для локализации
  
 Порядок плагинов:
  1. LanguageDetector - автоматическое определение языка
  2. initReactI18next - интеграция с React
*/
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ru',  // Язык по умолчанию, если не удалось определить
    debug: true,
    
    /**
     Настройки локализации (подстановки значений в строки)
     Пример: "Hello {{name}}" -> "Hello John"
    */
    interpolation: {
      escapeValue: false,
    },
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],  // Порядок проверки источников
      caches: ['localStorage'],                         // Где кэшировать выбранный язык
      lookupLocalStorage: 'i18nextLng',                 // Ключ в localStorage для хранения выбранного языка
    },
    
    /**
     Настройки интеграции с React
    */
    react: {
      useSuspense: false
    }
  });

export default i18n;