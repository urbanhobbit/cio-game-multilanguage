import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import trTranslation from './locales/tr/translation.json';
import enTranslation from './locales/en/translation.json';

// Dil kaynaklarını tanımlıyoruz
const resources = {
  tr: {
    translation: trTranslation
  },
  en: {
    translation: enTranslation
  }
};

i18n
  .use(initReactI18next) // react-i18next'i i18next'e bağlıyoruz
  .init({
    resources,
    lng: "tr", // Varsayılan başlangıç dili Türkçe
    fallbackLng: "en", // Türkçe bulunamazsa İngilizceye düşer
    interpolation: {
      escapeValue: false // React zaten XSS koruması yapıyor
    }
  });

export default i18n;