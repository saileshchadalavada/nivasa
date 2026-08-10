/* Internationalization — English + Telugu.
   Admin sets language in building config; fallback to English.
   Usage: const t = useT(config); t("water") → "నీరు" or "Water" */

const translations = {
  en: {
    welcome: "Welcome,",
    welcomeSub: "What would you like to manage today?",
    water: "Water",
    maintenance: "Maintenance",
    overview: "Overview",
    myFlat: "My Flat",
    community: "Community",
    history: "History",
    members: "Members",
    home: "Home",
    billsPayments: "Bills & payments",
    pastMonths: "Past months",
    rolesFlats: "Roles & flats",
    pollsUpdates: "Polls & updates",
    current: "Current",
    view: "View",
    manage: "Manage",
    recentActivity: "recent",
    signOut: "Sign out",
    saveChanges: "Save changes",
    undo: "Undo",
    unsavedChanges: "Unsaved changes — residents see them once you save.",
    totalMaintenanceSpent: "Total maintenance spent",
    calculatedSplit: "Calculated split",
    actualAmountCollected: "Actual amount collected per flat",
    owedToMembers: "Owed to members",
    surplusThisPeriod: "Surplus this period",
    deficitThisPeriod: "Deficit this period",
    carryFrom: "Carry from",
    deficitFrom: "Deficit from",
    meterReadings: "Meter readings",
    expenseItems: "Expense items",
    perFlatStatement: "Per-flat statement",
    broadcastBills: "Broadcast bills",
    publishShare: "Publish & share",
    language: "Language",
    flat: "Flat",
    name: "Name",
    total: "Total",
    previous: "Previous",
    used: "Used",
    waterBill: "Water bill",
    amount: "Amount",
    paidBy: "Paid by",
    announcementLabel: "Announcement",
    pollLabel: "Poll",
    meetingLabel: "Meeting",
  },
  te: {
    welcome: "స్వాగతం,",
    welcomeSub: "ఈరోజు మీరు ఏమి నిర్వహించాలనుకుంటున్నారు?",
    water: "నీరు",
    maintenance: "నిర్వహణ",
    overview: "సారాంశం",
    myFlat: "నా ఫ్లాట్",
    community: "సమాజం",
    history: "చరిత్ర",
    members: "సభ్యులు",
    home: "హోమ్",
    billsPayments: "బిల్లులు & చెల్లింపులు",
    pastMonths: "గత నెలలు",
    rolesFlats: "పాత్రలు & ఫ్లాట్లు",
    pollsUpdates: "పోల్స్ & నవీకరణలు",
    current: "ప్రస్తుతం",
    view: "చూడండి",
    manage: "నిర్వహించు",
    recentActivity: "ఇటీవల",
    signOut: "సైన్ అవుట్",
    saveChanges: "మార్పులు సేవ్ చేయండి",
    undo: "రద్దు చేయండి",
    unsavedChanges: "సేవ్ చేయని మార్పులు — మీరు సేవ్ చేసిన తర్వాత నివాసితులు చూస్తారు.",
    totalMaintenanceSpent: "మొత్తం నిర్వహణ ఖర్చు",
    calculatedSplit: "లెక్కించిన విభజన",
    actualAmountCollected: "ఫ్లాట్‌కు వసూలు చేసిన మొత్తం",
    owedToMembers: "సభ్యులకు బాకీ",
    surplusThisPeriod: "ఈ కాలంలో మిగులు",
    deficitThisPeriod: "ఈ కాలంలో లోటు",
    carryFrom: "నుండి బదిలీ",
    deficitFrom: "నుండి లోటు",
    meterReadings: "మీటర్ రీడింగ్‌లు",
    expenseItems: "ఖర్చు అంశాలు",
    perFlatStatement: "ఫ్లాట్-వారీ స్టేట్‌మెంట్",
    broadcastBills: "బిల్లులు ప్రసారం చేయండి",
    publishShare: "ప్రచురించు & పంచుకో",
    language: "భాష",
    flat: "ఫ్లాట్",
    name: "పేరు",
    total: "మొత్తం",
    previous: "మునుపటి",
    used: "వాడిన",
    waterBill: "నీటి బిల్లు",
    amount: "మొత్తం",
    paidBy: "చెల్లించినది",
    announcementLabel: "ప్రకటన",
    pollLabel: "పోల్",
    meetingLabel: "సమావేశం",
  },
};

/* Get the language code from building config. Default: "en" */
export function getLang(config) {
  return config?.language || "en";
}

/* Translation function — returns translated string or key as fallback */
export function t(config, key) {
  const lang = getLang(config);
  return translations[lang]?.[key] || translations.en[key] || key;
}

/* Hook-style: returns a bound t function for the current config */
export function useT(config) {
  const lang = getLang(config);
  return (key) => translations[lang]?.[key] || translations.en[key] || key;
}

export const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
];

export default translations;
