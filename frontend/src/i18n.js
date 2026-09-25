import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// the translations
const resources = {
  en: {
    translation: {
      "app_title": "Samadhan",
      "subtitle": "Citizen Grievance Dashboard",
      "nav_dashboard": "Dashboard",
      "nav_all": "All Complaints",
      "nav_map": "Grievance Map",
      "nav_officers": "Officers",
      "nav_visits": "Visit Logs",
      "nav_audit": "Audit & Integrity",
      "nav_profile": "My Profile",
      "nav_logout": "Logout",
      "stats_total": "Total Complaints",
      "stats_pending": "Pending Action",
      "stats_resolved": "Resolved",
      "stats_critical": "Critical Alerts",
      "stats_false_closure": "False Closures Caught",
      "stats_overdue": "Overdue Complaints",
      "auto_pr": "Auto PR Report",
      "view_map": "View Grievance Map",
      "map_desc": "See all complaints on map with hotspots",
      "ai_insights": "AI Insights & Anomalies",
      "critical_attention": "CRITICAL complaints require immediate attention",
      "click_view": "Click to view",
      "search_placeholder": "Quick search (Ticket ID)..."
    }
  },
  hi: {
    translation: {
      "app_title": "समाधान",
      "subtitle": "नागरिक शिकायत डैशबोर्ड",
      "nav_dashboard": "डैशबोर्ड",
      "nav_all": "सभी शिकायतें",
      "nav_map": "शिकायत नक्शा",
      "nav_officers": "अधिकारी",
      "nav_visits": "दौरा लॉग",
      "nav_audit": "ऑडिट और सत्यनिष्ठा",
      "nav_profile": "मेरी प्रोफ़ाइल",
      "nav_logout": "लॉग आउट",
      "stats_total": "कुल शिकायतें",
      "stats_pending": "लंबित कार्रवाई",
      "stats_resolved": "हल किया गया",
      "stats_critical": "महत्वपूर्ण अलर्ट",
      "stats_false_closure": "फर्जी समाधान पकड़े गए",
      "stats_overdue": "अतिदेय शिकायतें",
      "auto_pr": "ऑटो पीआर रिपोर्ट",
      "view_map": "शिकायत नक्शा देखें",
      "map_desc": "नक्शे पर हॉटस्पॉट के साथ सभी शिकायतें देखें",
      "ai_insights": "एआई अंतर्दृष्टि और विसंगतियां",
      "critical_attention": "गंभीर शिकायतों पर तत्काल ध्यान देने की आवश्यकता है",
      "click_view": "देखने के लिए क्लिक करें",
      "search_placeholder": "त्वरित खोज (टिकट आईडी)..."
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('language') || 'en', // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
