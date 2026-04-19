import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─────────────────────────────────────────────────────────────
// CONSTANTS & DATA
// ─────────────────────────────────────────────────────────────

const APP_VERSION = "2.0.0";
const STORAGE_KEY = "fiscalmind_conversations";
const SETTINGS_KEY = "fiscalmind_settings";
const ENTRIES_KEY  = "fiscalmind_entries";
const TIERS_KEY    = "fiscalmind_tiers";
const JOURNALS_CUSTOM_KEY = "fiscalmind_journals_custom";
const PLAN_CUSTOM_KEY = "fiscalmind_plan_custom";
const USER_KEY = "fiscalmind_user";

const COMPANY_ID = "demo-company";
const FIXED_XOF_EUR = 655.957;

// ─────────────────────────────────────────────────────────────
// SUBSCRIPTION PLANS
// ─────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "Gratuit",
    priceMonthly: 0,
    icon: "🌱",
    color: "#3eca78",
    features: [
      "Copilote IA — 10 messages/jour",
      "Saisie comptable basique",
      "Balance des comptes",
      "Calendrier fiscal",
      "1 utilisateur",
    ],
    limits: { aiMessages: 10, entries: 100 },
  },
  {
    id: "pro",
    name: "Pro",
    price: "9 900 XOF/mois",
    priceMonthly: 9900,
    icon: "⚡",
    color: "#5aaccc",
    badge: "Populaire",
    features: [
      "Copilote IA — illimité",
      "Saisie multi-journaux avancée",
      "Balance & grands livres complets",
      "Audit Readiness complet",
      "Convertisseur multi-devises",
      "Export PDF / Excel",
      "3 utilisateurs",
    ],
    limits: { aiMessages: Infinity, entries: Infinity },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Sur devis",
    priceMonthly: null,
    icon: "🏢",
    color: "#d89828",
    features: [
      "Tout Pro +",
      "Consolidation multi-entités",
      "API & intégrations",
      "Support dédié",
      "Formation équipe",
      "Utilisateurs illimités",
    ],
    limits: { aiMessages: Infinity, entries: Infinity },
  },
];

// ─────────────────────────────────────────────────────────────
// PLAN COMPTABLE SYSCOHADA
// ─────────────────────────────────────────────────────────────
const SYSCOHADA_ACCOUNTS = [
  { number:"101",  label:"Capital social",            type:"passif",  statement:"bilan" },
  { number:"111",  label:"Réserve légale",             type:"passif",  statement:"bilan" },
  { number:"161",  label:"Emprunts bancaires",         type:"passif",  statement:"bilan" },
  { number:"181",  label:"Dettes de financement",      type:"passif",  statement:"bilan" },
  { number:"211",  label:"Terrains",                   type:"actif",   statement:"bilan" },
  { number:"221",  label:"Bâtiments",                  type:"actif",   statement:"bilan" },
  { number:"241",  label:"Matériel & outillage",       type:"actif",   statement:"bilan" },
  { number:"244",  label:"Matériel informatique",      type:"actif",   statement:"bilan" },
  { number:"245",  label:"Mobilier & agencement",      type:"actif",   statement:"bilan" },
  { number:"281",  label:"Amort. bâtiments",           type:"actif",   statement:"bilan" },
  { number:"284",  label:"Amort. matériel",            type:"actif",   statement:"bilan" },
  { number:"311",  label:"Marchandises",               type:"actif",   statement:"bilan" },
  { number:"321",  label:"Matières premières",         type:"actif",   statement:"bilan" },
  { number:"381",  label:"Stocks en cours",            type:"actif",   statement:"bilan" },
  { number:"401",  label:"Fournisseurs",               type:"passif",  statement:"bilan" },
  { number:"408",  label:"Fournisseurs / factures à recevoir", type:"passif", statement:"bilan" },
  { number:"411",  label:"Clients",                    type:"actif",   statement:"bilan" },
  { number:"418",  label:"Clients / produits à recevoir", type:"actif", statement:"bilan" },
  { number:"421",  label:"Personnel — rémunérations",  type:"passif",  statement:"bilan" },
  { number:"431",  label:"CNSS — cotisations",         type:"passif",  statement:"bilan" },
  { number:"441",  label:"État — impôts & taxes",      type:"passif",  statement:"bilan" },
  { number:"4451", label:"TVA collectée (18%)",        type:"passif",  statement:"bilan" },
  { number:"4452", label:"TVA déductible",             type:"actif",   statement:"bilan" },
  { number:"4454", label:"TVA à décaisser",            type:"passif",  statement:"bilan" },
  { number:"447",  label:"Impôt sur les sociétés (IS)",type:"passif",  statement:"bilan" },
  { number:"476",  label:"Différence de conversion — perte", type:"actif", statement:"bilan" },
  { number:"477",  label:"Différence de conversion — gain",  type:"passif",statement:"bilan" },
  { number:"481",  label:"Fournisseurs d'investissements",type:"passif",statement:"bilan" },
  { number:"511",  label:"Valeurs à encaisser",        type:"actif",   statement:"bilan" },
  { number:"521",  label:"Banque",                     type:"actif",   statement:"bilan" },
  { number:"531",  label:"CCP",                        type:"actif",   statement:"bilan" },
  { number:"571",  label:"Caisse",                     type:"actif",   statement:"bilan" },
  { number:"601",  label:"Achats de marchandises",     type:"charge",  statement:"resultat" },
  { number:"602",  label:"Achats de matières premières",type:"charge", statement:"resultat" },
  { number:"604",  label:"Achats de matériaux",        type:"charge",  statement:"resultat" },
  { number:"605",  label:"Autres achats",              type:"charge",  statement:"resultat" },
  { number:"611",  label:"Transports sur achats",      type:"charge",  statement:"resultat" },
  { number:"613",  label:"Locations",                  type:"charge",  statement:"resultat" },
  { number:"614",  label:"Charges locatives",          type:"charge",  statement:"resultat" },
  { number:"616",  label:"Assurances",                 type:"charge",  statement:"resultat" },
  { number:"618",  label:"Documentation & divers",     type:"charge",  statement:"resultat" },
  { number:"621",  label:"Personnel extérieur",        type:"charge",  statement:"resultat" },
  { number:"622",  label:"Honoraires",                 type:"charge",  statement:"resultat" },
  { number:"623",  label:"Publicité & communication",  type:"charge",  statement:"resultat" },
  { number:"625",  label:"Déplacements & missions",    type:"charge",  statement:"resultat" },
  { number:"628",  label:"Frais télécommunications",   type:"charge",  statement:"resultat" },
  { number:"631",  label:"Frais bancaires",            type:"charge",  statement:"resultat" },
  { number:"641",  label:"Salaires & appointements",   type:"charge",  statement:"resultat" },
  { number:"644",  label:"Rémunération du personnel",  type:"charge",  statement:"resultat" },
  { number:"645",  label:"Charges CNSS",               type:"charge",  statement:"resultat" },
  { number:"651",  label:"Pertes sur créances",        type:"charge",  statement:"resultat" },
  { number:"661",  label:"Charges d'intérêts",         type:"charge",  statement:"resultat" },
  { number:"681",  label:"Dotations amortissements",   type:"charge",  statement:"resultat" },
  { number:"701",  label:"Ventes de marchandises",     type:"produit", statement:"resultat" },
  { number:"702",  label:"Ventes de produits finis",   type:"produit", statement:"resultat" },
  { number:"706",  label:"Services vendus",            type:"produit", statement:"resultat" },
  { number:"707",  label:"Produits accessoires",       type:"produit", statement:"resultat" },
  { number:"721",  label:"Production stockée",         type:"produit", statement:"resultat" },
  { number:"741",  label:"Subventions d'exploitation", type:"produit", statement:"resultat" },
  { number:"761",  label:"Revenus des participations", type:"produit", statement:"resultat" },
  { number:"771",  label:"Produits hors activités",    type:"produit", statement:"resultat" },
  { number:"781",  label:"Reprises d'amortissement",   type:"produit", statement:"resultat" },
  { number:"801",  label:"Résultat avant impôts",      type:"résultat",statement:"resultat" },
];

const JOURNALS = [
  { id:"AC", label:"Achats",        icon:"🛒" },
  { id:"VE", label:"Ventes",        icon:"💰" },
  { id:"BQ", label:"Banque",        icon:"🏦" },
  { id:"CA", label:"Caisse",        icon:"💵" },
  { id:"OD", label:"Opérations Diverses", icon:"🔄" },
  { id:"SA", label:"Salaires",      icon:"👥" },
  { id:"TV", label:"TVA",           icon:"📊" },
];

const ENTRY_TEMPLATES = [
  {
    id:"facture_achat", label:"Facture fournisseur (TTC)", icon:"🧾",
    lines: [
      { account:"601", label:"Achats marchandises HT", debit:0, credit:0 },
      { account:"4452",label:"TVA déductible 18%",     debit:0, credit:0 },
      { account:"401", label:"Fournisseur",            debit:0, credit:0 },
    ],
    journal:"AC",
  },
  {
    id:"facture_vente", label:"Facture client (TTC)", icon:"💰",
    lines: [
      { account:"411", label:"Client",                 debit:0, credit:0 },
      { account:"701", label:"Ventes marchandises HT", debit:0, credit:0 },
      { account:"4451",label:"TVA collectée 18%",      debit:0, credit:0 },
    ],
    journal:"VE",
  },
  {
    id:"salaire", label:"Paiement salaires", icon:"👥",
    lines: [
      { account:"641", label:"Salaires bruts",         debit:0, credit:0 },
      { account:"421", label:"Personnel — nets à payer",debit:0, credit:0 },
      { account:"431", label:"CNSS cotisations",       debit:0, credit:0 },
    ],
    journal:"SA",
  },
  {
    id:"reglement_fournisseur", label:"Règlement fournisseur", icon:"🏦",
    lines: [
      { account:"401", label:"Fournisseur",            debit:0, credit:0 },
      { account:"521", label:"Banque",                 debit:0, credit:0 },
    ],
    journal:"BQ",
  },
];

const ALL_CURRENCIES = [
  { code:"XOF",name:"Franc CFA UEMOA",flag:"🌍"},{ code:"XAF",name:"Franc CFA CEMAC",flag:"🌍"},
  { code:"USD",name:"Dollar américain",flag:"🇺🇸"},{ code:"EUR",name:"Euro",flag:"🇪🇺"},
  { code:"GBP",name:"Livre sterling",flag:"🇬🇧"},{ code:"JPY",name:"Yen japonais",flag:"🇯🇵"},
  { code:"CHF",name:"Franc suisse",flag:"🇨🇭"},{ code:"CAD",name:"Dollar canadien",flag:"🇨🇦"},
  { code:"AUD",name:"Dollar australien",flag:"🇦🇺"},{ code:"CNY",name:"Yuan chinois",flag:"🇨🇳"},
  { code:"INR",name:"Roupie indienne",flag:"🇮🇳"},{ code:"BRL",name:"Réal brésilien",flag:"🇧🇷"},
  { code:"MXN",name:"Peso mexicain",flag:"🇲🇽"},{ code:"KRW",name:"Won sud-coréen",flag:"🇰🇷"},
  { code:"SGD",name:"Dollar Singapour",flag:"🇸🇬"},{ code:"HKD",name:"Dollar Hong Kong",flag:"🇭🇰"},
  { code:"NOK",name:"Couronne norvégienne",flag:"🇳🇴"},{ code:"SEK",name:"Couronne suédoise",flag:"🇸🇪"},
  { code:"ZAR",name:"Rand sud-africain",flag:"🇿🇦"},{ code:"NGN",name:"Naira nigérian",flag:"🇳🇬"},
  { code:"GHS",name:"Cedi ghanéen",flag:"🇬🇭"},{ code:"MAD",name:"Dirham marocain",flag:"🇲🇦"},
  { code:"SAR",name:"Riyal saoudien",flag:"🇸🇦"},{ code:"AED",name:"Dirham EAU",flag:"🇦🇪"},
];

const BASE_RATES = {
  XOF:FIXED_XOF_EUR,XAF:FIXED_XOF_EUR,USD:1.085,GBP:0.856,JPY:162.5,CHF:0.963,CAD:1.472,AUD:1.648,
  CNY:7.85,INR:90.2,BRL:5.42,MXN:21.8,KRW:1445,SGD:1.46,HKD:8.47,NOK:11.62,SEK:11.35,
  ZAR:20.1,NGN:1620,GHS:15.8,MAD:10.95,SAR:4.07,AED:3.98,EUR:1,
};

const COMPANY_TYPES = [
  { id:"sarl",label:"SARL / SA",icon:"🏢",desc:"Société à responsabilité limitée ou anonyme" },
  { id:"ei",label:"Entreprise Individuelle",icon:"👤",desc:"EI, artisan, commerçant indépendant" },
  { id:"asso",label:"Association / ONG",icon:"🤝",desc:"Organisation à but non lucratif" },
  { id:"holding",label:"Holding / Groupe",icon:"🏗️",desc:"Société mère avec filiales" },
];

const AUDIT_TABS = [
  { id:"Mensuel",label:"Mensuel",icon:"📅" },
  { id:"Trimestriel",label:"Trimestriel",icon:"🗓️" },
  { id:"Annuel",label:"Annuel",icon:"📆" },
  { id:"Ponctuel",label:"Ponctuel / Vérif.",icon:"🔍" },
];

const AUDIT_DATA = {
  Mensuel:{
    sarl:[
      { id:"m1",label:"TVA — Déclaration & paiement",docs:["Déclaration TVA CA3","Quittance TVA","Fichier écritures TVA"] },
      { id:"m2",label:"CNSS — Cotisations salariales & patronales",docs:["Bordereau mensuel CNSS","Quittance CNSS","Livre de paie du mois"] },
      { id:"m3",label:"IUTS — Retenues à la source",docs:["Bordereau IUTS mensuel","Quittance IUTS","État des salaires"] },
      { id:"m4",label:"Journaux comptables mensuels",docs:["Journal des achats","Journal des ventes","Journal de banque","Journal de caisse"] },
      { id:"m5",label:"Rapprochements bancaires",docs:["Relevé bancaire","État de rapprochement signé"] },
    ],
    ei:[
      { id:"m1",label:"TVA (si assujetti)",docs:["Déclaration TVA","Quittance TVA"] },
      { id:"m2",label:"Livre de caisse",docs:["Journal de caisse mensuel","Tickets & reçus"] },
    ],
    asso:[
      { id:"m1",label:"Journal de trésorerie",docs:["Relevé bancaire","Journal recettes & dépenses"] },
      { id:"m2",label:"CNSS (si salariés)",docs:["Bordereau CNSS","Quittance CNSS"] },
    ],
    holding:[
      { id:"m1",label:"TVA consolidée",docs:["Déclaration TVA groupe","Quittances TVA filiales"] },
      { id:"m2",label:"CNSS toutes entités",docs:["Bordereaux CNSS filiales","Quittances"] },
      { id:"m3",label:"Flux intragroupes",docs:["Relevés virements intragroupes","Conventions de trésorerie"] },
    ],
  },
  Trimestriel:{
    sarl:[
      { id:"t1",label:"Acomptes IS (25% IS estimé)",docs:["Déclaration acompte IS","Quittance acompte"] },
      { id:"t2",label:"TPA — Taxe Patronale d'Apprentissage",docs:["Déclaration TPA trimestrielle","Quittance TPA"] },
      { id:"t3",label:"Balance trimestrielle",docs:["Balance générale du trimestre","Grands comptes vérifiés"] },
    ],
    ei:[
      { id:"t1",label:"Acompte IRPP",docs:["Déclaration acompte IRPP","Quittance"] },
    ],
    asso:[
      { id:"t1",label:"Rapport financier trimestriel",docs:["Rapport de trésorerie","Rapprochement bancaire"] },
    ],
    holding:[
      { id:"t1",label:"Acomptes IS consolidés",docs:["Déclarations acomptes IS par entité","Quittances"] },
      { id:"t2",label:"Reporting consolidé groupe",docs:["Balance consolidée","Éliminations intragroupes"] },
    ],
  },
  Annuel:{
    sarl:[
      { id:"a1",label:"États financiers SYSCOHADA",docs:["Bilan certifié","Compte de résultat","TAFIRE","Notes annexes"] },
      { id:"a2",label:"Déclaration Statistique & Fiscale (DSF)",docs:["DSF déposée DGI","Accusé de réception","Liasse fiscale complète"] },
      { id:"a3",label:"IS — Solde annuel",docs:["Déclaration IS annuelle","Quittance solde IS","Calcul base imposable"] },
      { id:"a4",label:"Inventaire physique annuel",docs:["PV inventaire stocks","PV inventaire immobilisations"] },
      { id:"a5",label:"Grand livre & balance de clôture",docs:["Grand livre annuel","Balance de vérification finale"] },
    ],
    ei:[
      { id:"a1",label:"Déclaration IRPP annuelle",docs:["Déclaration IRPP","Quittance","BIC calculés"] },
      { id:"a2",label:"États simplifiés SYSCOHADA",docs:["Compte de résultat simplifié","Bilan simplifié"] },
    ],
    asso:[
      { id:"a1",label:"Comptes annuels",docs:["Bilan simplifié","Compte de résultat","Rapport financier AG"] },
    ],
    holding:[
      { id:"a1",label:"Comptes consolidés groupe",docs:["Bilan consolidé","CR consolidé","Méthodes de consolidation"] },
      { id:"a2",label:"DSF toutes entités",docs:["DSF société mère","DSF par filiale","Accusés de réception"] },
    ],
  },
  Ponctuel:{
    sarl:[
      { id:"p1",label:"Correspondances DGI / Brigade",docs:["Avis de vérification reçu","Réponses envoyées","Courriers recommandés"] },
      { id:"p2",label:"Contrats & conventions",docs:["Contrats fournisseurs","Contrats clients","Contrats de travail"] },
      { id:"p3",label:"Statuts & actes juridiques",docs:["Statuts à jour","RCCM","Modifications statutaires"] },
    ],
    ei:[
      { id:"p1",label:"Documents d'identification",docs:["RCCM","IFU","CNI du gérant"] },
    ],
    asso:[
      { id:"p1",label:"Agréments & récépissés",docs:["Récépissé de déclaration","Agrément ministériel"] },
    ],
    holding:[
      { id:"p1",label:"Organigramme groupe",docs:["Organigramme juridique","Table de participation"] },
      { id:"p2",label:"Documentation prix de transfert",docs:["Étude prix de transfert","Formulaire DGI prix de transfert"] },
    ],
  },
};

const FISCAL_EVENTS = [
  { date:"2026-04-20",label:"TVA Mars 2026",type:"danger",urgency:1,freq:"Mensuel" },
  { date:"2026-04-30",label:"DSF 2025 — Dépôt final",type:"danger",urgency:11,freq:"Annuel" },
  { date:"2026-04-30",label:"Acompte IS T1 2026",type:"danger",urgency:11,freq:"Trimestriel" },
  { date:"2026-05-15",label:"CNSS Avril 2026",type:"warning",urgency:26,freq:"Mensuel" },
  { date:"2026-05-20",label:"TVA Avril 2026",type:"warning",urgency:31,freq:"Mensuel" },
  { date:"2026-06-30",label:"Patente 2026 — Solde",type:"info",urgency:72,freq:"Annuel" },
  { date:"2026-07-20",label:"Acompte IS T2 2026",type:"info",urgency:92,freq:"Trimestriel" },
];

const QUICK_SUGGESTIONS = [
  { label:"✍ Créer écriture", text:"Aide-moi à créer une écriture comptable SYSCOHADA pour une facture fournisseur." },
  { label:"📊 Analyser TVA", text:"Analyse ma situation TVA et explique-moi comment calculer TVA collectée et déductible." },
  { label:"📋 Vérifier DSF", text:"Quels sont les points clés à vérifier avant de déposer la DSF ?" },
  { label:"💰 Calcul IS", text:"Comment calculer l'IS dû pour une SARL au Burkina Faso ?" },
];

// ─────────────────────────────────────────────────────────────
// ACCOUNTING UTILS
// ─────────────────────────────────────────────────────────────

function validateEntry(lines) {
  const debit  = lines.reduce((s, l) => s + (Number(l.debit)  || 0), 0);
  const credit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  return Math.abs(debit - credit) < 0.01;
}

function computeResult(entries) {
  let charges = 0, produits = 0;
  entries.forEach(entry => {
    entry.lines.forEach(line => {
      if (line.account.startsWith("6")) charges += Number(line.debit)  || 0;
      if (line.account.startsWith("7")) produits += Number(line.credit) || 0;
    });
  });
  return { charges, produits, resultat: produits - charges };
}

function suggestAccount(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("salaire") || t.includes("rémunération")) return "641";
  if (t.includes("cnss") || t.includes("cotisation")) return "645";
  if (t.includes("tva collectée")) return "4451";
  if (t.includes("tva déductible")) return "4452";
  if (t.includes("fournisseur")) return "401";
  if (t.includes("client")) return "411";
  if (t.includes("banque") || t.includes("virement")) return "521";
  if (t.includes("caisse") || t.includes("espèces")) return "571";
  if (t.includes("achat") || t.includes("marchandise")) return "601";
  if (t.includes("honoraire") || t.includes("consultant")) return "622";
  if (t.includes("loyer") || t.includes("location")) return "613";
  if (t.includes("assurance")) return "616";
  if (t.includes("vente") || t.includes("prestation")) return "701";
  if (t.includes("service")) return "706";
  return null;
}

function getAccountLabel(number) {
  return SYSCOHADA_ACCOUNTS.find(a => a.number === number)?.label || "";
}

function computeBalance(entries) {
  const bal = {};
  entries.forEach(e => {
    e.lines.forEach(l => {
      if (!bal[l.account]) bal[l.account] = { debit:0, credit:0 };
      bal[l.account].debit  += Number(l.debit)  || 0;
      bal[l.account].credit += Number(l.credit) || 0;
    });
  });
  return Object.entries(bal).map(([account, v]) => ({
    account,
    label: getAccountLabel(account),
    debit: v.debit,
    credit: v.credit,
    solde: v.debit - v.credit,
  })).sort((a, b) => a.account.localeCompare(b.account));
}

function nextPieceNum(entries, journal) {
  const year = new Date().getFullYear();
  const existing = entries.filter(e => e.journal === journal).length;
  return `${journal}${year}-${String(existing + 1).padStart(4, "0")}`;
}

// ─────────────────────────────────────────────────────────────
// AI API
// ─────────────────────────────────────────────────────────────
async function callAI(messages, systemPrompt) {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, system: systemPrompt }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.content?.[0]?.text || data.reply || "Erreur de réponse.";
    }
  } catch {}
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "Erreur de réponse.";
}

function buildSystemPrompt(settings) {
  return `Tu es FiscalMind, un expert-comptable et fiscaliste de haut niveau spécialisé en droit OHADA et fiscalité burkinabè.
Contexte entreprise : ${settings.companyName || "Non renseigné"}, type ${COMPANY_TYPES.find(c => c.id === settings.companyType)?.label || settings.companyType}, Burkina Faso, régime réel.
Domaines d'expertise : SYSCOHADA révisé 2018, CGI Burkina Faso (TVA 18%, IS 27.5%, IUTS, TPA), CNSS, UEMOA.
Comportement : Réponds toujours en français professionnel. Cite les articles de loi précis. Pour les écritures comptables, utilise les numéros de comptes SYSCOHADA. Sois concis mais complet.`;
}

// ─────────────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────────────
const loadConversations = () => { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; } };
const saveConversations = (c) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); } catch {} };
const loadSettings = () => { try { const r = localStorage.getItem(SETTINGS_KEY); return r ? JSON.parse(r) : { companyType:"sarl", companyName:"Mon entreprise" }; } catch { return { companyType:"sarl", companyName:"Mon entreprise" }; } };
const saveSettings = (s) => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {} };
const loadEntries = () => { try { const r = localStorage.getItem(ENTRIES_KEY); return r ? JSON.parse(r) : []; } catch { return []; } };
const saveEntries = (e) => { try { localStorage.setItem(ENTRIES_KEY, JSON.stringify(e)); } catch {} };
const loadTiers = () => { try { const r = localStorage.getItem(TIERS_KEY); return r ? JSON.parse(r) : []; } catch { return []; } };
const saveTiers = (t) => { try { localStorage.setItem(TIERS_KEY, JSON.stringify(t)); } catch {} };
const loadJournalsCustom = () => { try { const r = localStorage.getItem(JOURNALS_CUSTOM_KEY); return r ? JSON.parse(r) : []; } catch { return []; } };
const saveJournalsCustom = (j) => { try { localStorage.setItem(JOURNALS_CUSTOM_KEY, JSON.stringify(j)); } catch {} };
const loadPlanCustom = () => { try { const r = localStorage.getItem(PLAN_CUSTOM_KEY); return r ? JSON.parse(r) : []; } catch { return []; } };
const savePlanCustom = (p) => { try { localStorage.setItem(PLAN_CUSTOM_KEY, JSON.stringify(p)); } catch {} };
const loadUser = () => { try { const r = localStorage.getItem(USER_KEY); return r ? JSON.parse(r) : null; } catch { return null; } };
const saveUser = (u) => { try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch {} };

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────
const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const fmtDate = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });
const fmtDateShort = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day:"numeric", month:"short" });
const truncate = (s, n=42) => s.length > n ? s.slice(0,n)+"…" : s;
const fmtCfa = (n) => n.toLocaleString("fr-FR", { minimumFractionDigits:0, maximumFractionDigits:0 }) + " XOF";

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function FiscalMindAfrica() {
  // Auth
  const [user, setUser] = useState(loadUser);
  const [authView, setAuthView] = useState("login"); // "login" | "register" | "plans"
  const [authForm, setAuthForm] = useState({ email:"", password:"", name:"", confirmPassword:"" });
  const [authError, setAuthError] = useState("");
  const [showAccount, setShowAccount] = useState(false);

  // App
  const [activeModule, setActiveModule] = useState("comptabilite");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settings, setSettings] = useState(loadSettings);

  // Conversations
  const [conversations, setConversations] = useState(loadConversations);
  const [activeConvId, setActiveConvId] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingTitle, setEditingTitle] = useState(null);
  const [editTitleVal, setEditTitleVal] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [convSearch, setConvSearch] = useState("");
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Audit
  const [auditTab, setAuditTab] = useState("Mensuel");
  const [auditState, setAuditState] = useState({});
  const [auditConfigured, setAuditConfigured] = useState(false);

  // Converter
  const [amount, setAmount] = useState("");
  const [fromCur, setFromCur] = useState("USD");
  const [toCur, setToCur] = useState("XOF");
  const [converted, setConverted] = useState(null);
  const [liveRates, setLiveRates] = useState(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState(false);
  const [sfrom, setSfrom] = useState("");
  const [sto, setSto] = useState("");
  const [showSfrom, setShowSfrom] = useState(false);
  const [showSto, setShowSto] = useState(false);

  // Comptabilité
  const [entries, setEntries] = useState(loadEntries);
  const [acView, setAcView] = useState("dashboard");
  const [filterJournal, setFilterJournal] = useState("ALL");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [expandedEntry, setExpandedEntry] = useState(null);

  // Edit states
  const [editingEntry, setEditingEntry] = useState(null);
  const [editingTiers, setEditingTiers] = useState(null);
  const [editingJournal, setEditingJournal] = useState(null);

  // Delete confirm for accounting items
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null); // { type, id, label }

  // Balance & Grand Livre
  const [balanceClassFrom, setBalanceClassFrom] = useState("1");
  const [balanceClassTo, setBalanceClassTo] = useState("8");
  const [balanceType, setBalanceType] = useState("all"); // "all" | "clients" | "fournisseurs"
  const [grandLivreAccount, setGrandLivreAccount] = useState("");
  const [grandLivreView, setGrandLivreView] = useState(false);

  // Référentiel
  const [tiers, setTiers] = useState(loadTiers);
  const [journalsCustom, setJournalsCustom] = useState(loadJournalsCustom);
  const [planCustom, setPlanCustom] = useState(loadPlanCustom);
  const [refTab, setRefTab] = useState("tiers");
  const [tiersForm, setTiersForm] = useState({ code:"", nom:"", type:"fournisseur", contact:"" });
  const [tiersError, setTiersError] = useState("");
  const [journalForm, setJournalForm] = useState({ id:"", label:"", icon:"📁" });
  const [journalError, setJournalError] = useState("");
  const [planForm, setPlanForm] = useState({ number:"", label:"", type:"charge", statement:"resultat" });
  const [planError, setPlanError] = useState("");

  // Entry form
  const blankForm = () => ({
    date: new Date().toISOString().slice(0,10),
    journal: "AC", libelle: "", piece: "", document_url: "",
    lines: [
      { account:"", label:"", debit:"", credit:"" },
      { account:"", label:"", debit:"", credit:"" },
    ],
  });
  const [entryForm, setEntryForm] = useState(blankForm);
  const [entryError, setEntryError] = useState("");
  const [acctSearch, setAcctSearch] = useState({});
  const [acctOpen, setAcctOpen] = useState({});
  const libRef = useRef(null);

  // Persist
  useEffect(() => { saveConversations(conversations); }, [conversations]);
  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => { saveEntries(entries); }, [entries]);
  useEffect(() => { saveTiers(tiers); }, [tiers]);
  useEffect(() => { saveJournalsCustom(journalsCustom); }, [journalsCustom]);
  useEffect(() => { savePlanCustom(planCustom); }, [planCustom]);
  useEffect(() => { if (user) saveUser(user); }, [user]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [conversations, activeConvId]);
  useEffect(() => { if (activeModule === "convertisseur" && !liveRates) fetchRates(); }, [activeModule]);

  const activeConv = conversations.find(c => c.id === activeConvId) || null;

  // ── Auth
  const handleLogin = () => {
    if (!authForm.email.trim()) { setAuthError("Email requis."); return; }
    if (!authForm.password.trim()) { setAuthError("Mot de passe requis."); return; }
    const newUser = {
      id: genId(),
      email: authForm.email.trim(),
      name: authForm.name || authForm.email.split("@")[0],
      plan: "starter",
      createdAt: new Date().toISOString(),
    };
    setUser(newUser);
    setAuthError("");
  };

  const handleRegister = () => {
    if (!authForm.name.trim()) { setAuthError("Nom requis."); return; }
    if (!authForm.email.trim()) { setAuthError("Email requis."); return; }
    if (authForm.password.length < 6) { setAuthError("Mot de passe : 6 caractères minimum."); return; }
    if (authForm.password !== authForm.confirmPassword) { setAuthError("Les mots de passe ne correspondent pas."); return; }
    const newUser = {
      id: genId(),
      email: authForm.email.trim(),
      name: authForm.name.trim(),
      plan: "starter",
      createdAt: new Date().toISOString(),
    };
    setUser(newUser);
    setAuthError("");
  };

  const handleLogout = () => {
    setUser(null);
    setShowAccount(false);
  };

  const selectPlan = (planId) => {
    if (user) {
      setUser(u => ({ ...u, plan: planId }));
    }
    setAuthView("login");
    setShowAccount(false);
  };

  // ── Conversations
  const createConversation = useCallback((title = null) => {
    const id = genId();
    const newConv = {
      id, companyId: COMPANY_ID,
      title: title || "Nouvelle conversation",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [{ role:"assistant", content:"Bonjour ! Je suis votre copilote fiscal SYSCOHADA. Posez-moi vos questions en comptabilité, fiscalité burkinabè, ou vérification fiscale.", ts: new Date().toISOString() }],
      messageCount: 0, pinned: false, tags: [],
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConvId(id);
    setTimeout(() => inputRef.current?.focus(), 100);
    return id;
  }, []);

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText) return;
    setInput("");
    let convId = activeConvId;
    let currentConvs = conversations;
    if (!convId) {
      const id = genId();
      const newConv = {
        id, companyId: COMPANY_ID, title: truncate(userText, 38),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        messages: [{ role:"assistant", content:"Bonjour ! Je suis votre copilote fiscal SYSCOHADA.", ts: new Date().toISOString() }],
        messageCount: 0, pinned: false, tags: [],
      };
      currentConvs = [newConv, ...conversations];
      setConversations(currentConvs);
      setActiveConvId(id);
      convId = id;
    }
    const conv = currentConvs.find(c => c.id === convId);
    if (!conv) return;
    const userMsg = { role:"user", content: userText, ts: new Date().toISOString() };
    const updatedMessages = [...conv.messages, userMsg];
    const isFirstMessage = conv.messageCount === 0;
    setConversations(prev => prev.map(c => c.id === convId
      ? { ...c, messages: updatedMessages, updatedAt: new Date().toISOString(), title: isFirstMessage ? truncate(userText, 38) : c.title, messageCount: c.messageCount + 1 }
      : c
    ));
    setLoading(true);
    try {
      const apiMessages = updatedMessages.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content }));
      const reply = await callAI(apiMessages, buildSystemPrompt(settings));
      setConversations(prev => prev.map(c => c.id === convId
        ? { ...c, messages: [...c.messages, { role:"assistant", content: reply, ts: new Date().toISOString() }], updatedAt: new Date().toISOString() }
        : c
      ));
    } catch {
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, messages: [...c.messages, { role:"assistant", content:"Erreur de connexion. Veuillez réessayer.", ts: new Date().toISOString() }] } : c));
    }
    setLoading(false);
  };

  const deleteConversation = (id) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvId === id) setActiveConvId(null);
    setDeleteConfirm(null);
  };

  const startRename = (conv) => { setEditingTitle(conv.id); setEditTitleVal(conv.title); };
  const commitRename = (id) => {
    if (editTitleVal.trim()) setConversations(prev => prev.map(c => c.id === id ? { ...c, title: editTitleVal.trim() } : c));
    setEditingTitle(null);
  };
  const togglePin = (id) => setConversations(prev => prev.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c));

  // ── Audit
  const toggleDoc = (key) => setAuditState(p => ({ ...p, [key]: !p[key] }));
  const auditCats = () => AUDIT_DATA[auditTab]?.[settings.companyType] || [];
  const totalProgress = () => {
    let t=0,d=0;
    Object.values(AUDIT_DATA).forEach(tab => (tab[settings.companyType]||[]).forEach(cat => cat.docs.forEach(doc => { t++; if(auditState[`${cat.id}-${doc}`]) d++; })));
    return { t, d, pct: t>0?Math.round((d/t)*100):0 };
  };
  const tabProgress = (tab) => {
    let t=0,d=0;
    (AUDIT_DATA[tab]?.[settings.companyType]||[]).forEach(cat => cat.docs.forEach(doc => { t++; if(auditState[`${cat.id}-${doc}`]) d++; }));
    return { t, d, pct: t>0?Math.round((d/t)*100):0 };
  };

  // ── Converter
  const fetchRates = async () => {
    setRatesLoading(true); setRatesError(false);
    try {
      const res = await fetch("https://api.exchangerate-api.com/v4/latest/EUR");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLiveRates({ ...data.rates, XOF: FIXED_XOF_EUR, XAF: FIXED_XOF_EUR });
    } catch { setRatesError(true); setLiveRates(BASE_RATES); }
    setRatesLoading(false);
  };
  const R = () => liveRates || BASE_RATES;
  const convert = () => {
    const v = parseFloat(amount);
    if (isNaN(v)||v<=0) return;
    setConverted((v / (R()[fromCur]||1)) * (R()[toCur]||1));
  };
  const rateStr = (a,b) => ((R()[b]||1)/(R()[a]||1)).toFixed(4);
  const getCurr = (code) => ALL_CURRENCIES.find(c=>c.code===code)||{flag:"🌐",name:code,code};

  // ── Accounts
  const allAccounts = [...SYSCOHADA_ACCOUNTS, ...planCustom].sort((a,b)=>a.number.localeCompare(b.number));
  const allJournals = [...JOURNALS, ...journalsCustom];

  // ── Entry form helpers
  const updateLine = (idx, field, value) => {
    setEntryForm(f => {
      const lines = f.lines.map((l, i) => {
        if (i !== idx) return l;
        const updated = { ...l, [field]: value };
        if (field === "account" && value.length >= 3) {
          const acct = allAccounts.find(a => a.number === value);
          if (acct && !updated.label) updated.label = acct.label;
        }
        return updated;
      });
      return { ...f, lines };
    });
    setEntryError("");
  };

  const addLine = () => setEntryForm(f => ({ ...f, lines: [...f.lines, { account:"", label:"", debit:"", credit:"" }] }));
  const removeLine = (idx) => setEntryForm(f => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));
  const applyTemplate = (tpl) => setEntryForm(f => ({ ...f, journal: tpl.journal, lines: tpl.lines.map(l => ({ ...l, debit:"", credit:"" })) }));

  const totalDebit  = entryForm.lines.reduce((s,l) => s + (parseFloat(l.debit)  || 0), 0);
  const totalCredit = entryForm.lines.reduce((s,l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced  = entryForm.lines.length <= 1 || Math.abs(totalDebit - totalCredit) < 0.01;
  const diff        = totalDebit - totalCredit;

  const submitEntry = () => {
    if (!entryForm.libelle.trim()) { setEntryError("Le libellé général est obligatoire."); return; }
    if (entryForm.lines.length < 1) { setEntryError("Minimum 1 ligne par écriture."); return; }
    const emptyLines = entryForm.lines.filter(l => !l.account.trim());
    if (emptyLines.length > 0) { setEntryError("Tous les comptes doivent être renseignés."); return; }
    if (entryForm.lines.length > 1 && !validateEntry(entryForm.lines)) {
      setEntryError(`Écriture déséquilibrée : Débit ${fmtCfa(totalDebit)} ≠ Crédit ${fmtCfa(totalCredit)}`);
      return;
    }
    const piece = entryForm.piece.trim() || nextPieceNum(entries, entryForm.journal);
    const newEntry = {
      id: editingEntry || genId(),
      companyId: COMPANY_ID,
      date: entryForm.date, journal: entryForm.journal, libelle: entryForm.libelle.trim(),
      piece, document_url: entryForm.document_url.trim(),
      lines: entryForm.lines.map(l => ({
        account: l.account.trim(), label: l.label.trim(),
        debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0,
      })),
      createdAt: new Date().toISOString(),
    };
    if (editingEntry) {
      setEntries(prev => prev.map(e => e.id === editingEntry ? newEntry : e));
      setEditingEntry(null);
    } else {
      setEntries(prev => [newEntry, ...prev]);
    }
    setEntryForm(blankForm());
    setEntryError("");
    setAcView("journal");
  };

  // ── Delete with confirmation
  const requestDelete = (type, id, label) => setDeleteConfirmItem({ type, id, label });
  const confirmDelete = () => {
    if (!deleteConfirmItem) return;
    const { type, id } = deleteConfirmItem;
    if (type === "entry") {
      setEntries(prev => prev.filter(e => e.id !== id));
      if (expandedEntry === id) setExpandedEntry(null);
    } else if (type === "tiers") {
      setTiers(prev => prev.filter(t => t.id !== id));
    } else if (type === "journal") {
      setJournalsCustom(prev => prev.filter(j => j.id !== id));
    } else if (type === "plan") {
      setPlanCustom(prev => prev.filter(a => a.number !== id));
    } else if (type === "conversation") {
      deleteConversation(id);
    }
    setDeleteConfirmItem(null);
  };

  const startEditEntry = (entry) => {
    setEditingEntry(entry.id);
    setEntryForm({
      date: entry.date, journal: entry.journal, libelle: entry.libelle,
      piece: entry.piece, document_url: entry.document_url || "",
      lines: entry.lines.map(l => ({ ...l, debit: l.debit || "", credit: l.credit || "" })),
    });
    setAcView("saisie");
  };

  // ── Référentiel
  const addTiers = () => {
    if (!tiersForm.code.trim()) { setTiersError("Le code est obligatoire."); return; }
    if (!tiersForm.nom.trim()) { setTiersError("Le nom est obligatoire."); return; }
    if (editingTiers) {
      setTiers(prev => prev.map(t => t.id === editingTiers ? { ...tiersForm, id: editingTiers } : t));
      setEditingTiers(null);
    } else {
      if (tiers.find(t => t.code === tiersForm.code.trim())) { setTiersError("Ce code existe déjà."); return; }
      setTiers(prev => [...prev, { ...tiersForm, code: tiersForm.code.trim(), nom: tiersForm.nom.trim(), id: genId() }]);
    }
    setTiersForm({ code:"", nom:"", type:"fournisseur", contact:"" });
    setTiersError("");
  };

  const startEditTiers = (t) => {
    setEditingTiers(t.id);
    setTiersForm({ code: t.code, nom: t.nom, type: t.type, contact: t.contact || "" });
  };

  const addJournalCustom = () => {
    if (!journalForm.id.trim()) { setJournalError("Le code est obligatoire."); return; }
    if (!journalForm.label.trim()) { setJournalError("Le libellé est obligatoire."); return; }
    const code = journalForm.id.trim().toUpperCase();
    if (editingJournal) {
      setJournalsCustom(prev => prev.map(j => j.id === editingJournal ? { id: code, label: journalForm.label.trim(), icon: journalForm.icon || "📁" } : j));
      setEditingJournal(null);
    } else {
      if (allJournals.find(j => j.id === code)) { setJournalError("Ce code journal existe déjà."); return; }
      setJournalsCustom(prev => [...prev, { id: code, label: journalForm.label.trim(), icon: journalForm.icon || "📁" }]);
    }
    setJournalForm({ id:"", label:"", icon:"📁" });
    setJournalError("");
  };

  const startEditJournal = (j) => {
    setEditingJournal(j.id);
    setJournalForm({ id: j.id, label: j.label, icon: j.icon });
  };

  const addPlanCustom = () => {
    if (!planForm.number.trim()) { setPlanError("Le numéro est obligatoire."); return; }
    if (!planForm.label.trim()) { setPlanError("Le libellé est obligatoire."); return; }
    if (allAccounts.find(a => a.number === planForm.number.trim())) { setPlanError("Ce numéro de compte existe déjà."); return; }
    setPlanCustom(prev => [...prev, { number: planForm.number.trim(), label: planForm.label.trim(), type: planForm.type, statement: planForm.statement }]);
    setPlanForm({ number:"", label:"", type:"charge", statement:"resultat" });
    setPlanError("");
  };

  // ── Computed values
  const filteredEntries = entries.filter(e => {
    if (filterJournal !== "ALL" && e.journal !== filterJournal) return false;
    if (filterDateFrom && e.date < filterDateFrom) return false;
    if (filterDateTo   && e.date > filterDateTo)   return false;
    return true;
  });

  const dsfResult = computeResult(entries);
  const balance = computeBalance(entries);

  // Balance filtrée par classe de comptes
  const filteredBalance = useMemo(() => {
    return balance.filter(row => {
      const cls = row.account.charAt(0);
      if (balanceType === "clients") return row.account.startsWith("411") || row.account.startsWith("418");
      if (balanceType === "fournisseurs") return row.account.startsWith("401") || row.account.startsWith("408");
      const from = parseInt(balanceClassFrom) || 1;
      const to = parseInt(balanceClassTo) || 8;
      const clsNum = parseInt(cls) || 0;
      return clsNum >= from && clsNum <= to;
    });
  }, [balance, balanceClassFrom, balanceClassTo, balanceType]);

  // Grand livre pour un compte
  const grandLivreLines = useMemo(() => {
    if (!grandLivreAccount) return [];
    const lines = [];
    let solde = 0;
    entries.slice().sort((a,b) => a.date.localeCompare(b.date)).forEach(entry => {
      entry.lines.forEach(line => {
        if (line.account === grandLivreAccount) {
          solde += (line.debit || 0) - (line.credit || 0);
          lines.push({
            date: entry.date, journal: entry.journal, libelle: entry.libelle,
            piece: entry.piece, debit: line.debit || 0, credit: line.credit || 0, solde,
          });
        }
      });
    });
    return lines;
  }, [entries, grandLivreAccount]);

  // Filtres conversations
  const filteredConvs = conversations.filter(c =>
    c.title.toLowerCase().includes(convSearch.toLowerCase()) ||
    c.messages.some(m => m.content.toLowerCase().includes(convSearch.toLowerCase()))
  );
  const pinnedConvs = filteredConvs.filter(c=>c.pinned);
  const unpinnedConvs = filteredConvs.filter(c=>!c.pinned);
  const { t:total, d:done, pct } = totalProgress();

  // Dashboard KPIs
  const clientsBalance = balance.filter(r => r.account.startsWith("411") || r.account.startsWith("418"));
  const foursBalance = balance.filter(r => r.account.startsWith("401") || r.account.startsWith("408"));
  const totalClientsDebit = clientsBalance.reduce((s,r) => s + r.debit, 0);
  const totalClientsCredit = clientsBalance.reduce((s,r) => s + r.credit, 0);
  const totalFoursDebit = foursBalance.reduce((s,r) => s + r.debit, 0);
  const totalFoursCredit = foursBalance.reduce((s,r) => s + r.credit, 0);

  const MODULES = [
    { id:"copilote",      label:"Copilote IA",    icon:"🧠" },
    { id:"comptabilite",  label:"Comptabilité",   icon:"📒" },
    { id:"audit",         label:"Audit Readiness",icon:"📋" },
    { id:"calendrier",    label:"Calendrier Fiscal",icon:"🗓️" },
    { id:"convertisseur", label:"Convertisseur",  icon:"💱" },
  ];

  // ─────────────────────────────────────────────────────────────
  // AUTH SCREEN
  // ─────────────────────────────────────────────────────────────
  if (!user && authView !== "plans") {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#070d1c", color:"#cfc9bc", fontFamily:"'Crimson Pro', Georgia, serif", padding:"16px" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap');
          *{box-sizing:border-box;margin:0;padding:0}
          :root{--bg0:#070d1c;--bg1:#0b1424;--bg2:#0f1c30;--bg3:#142038;--border:#162640;--border2:#1e3050;--text0:#cfc9bc;--text1:#8a9aac;--text2:#4a5e74;--text3:#2a3e54;--accent:#5aaccc;--accent2:#3a8aaa;--green:#3eca78;--red:#e05858;--amber:#d89828;--mono:'JetBrains Mono',monospace}
          .inp{background:var(--bg1);border:1px solid var(--border);border-radius:9px;padding:10px 13px;color:var(--text0);font-family:inherit;font-size:14px;outline:none;width:100%;transition:border-color .2s}
          .inp:focus{border-color:var(--border2)}
          .inp::placeholder{color:var(--text3)}
          .btn-primary{background:linear-gradient(135deg,#183858,#0d2438);border:1px solid var(--border2);border-radius:9px;padding:11px 20px;color:var(--accent);font-size:14px;cursor:pointer;font-family:inherit;transition:all .18s;width:100%}
          .btn-primary:hover{background:linear-gradient(135deg,#1e4870,#142840)}
          .btn-ghost{background:none;color:var(--text1);border:none;cursor:pointer;font-family:inherit;font-size:13px;padding:6px}
          .btn-ghost:hover{color:var(--text0)}
        `}</style>
        <div style={{ width:"100%", maxWidth:400 }}>
          <div style={{ textAlign:"center", marginBottom:32 }}>
            <div style={{ width:52, height:52, borderRadius:12, background:"linear-gradient(135deg,#1a4a68,#0a2030)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, border:"1px solid #1e3050", margin:"0 auto 12px" }}>⚖</div>
            <h1 style={{ fontSize:22, fontWeight:600 }}><span style={{ color:"#cfc9bc" }}>FiscalMind </span><span style={{ color:"#5aaccc" }}>Africa</span></h1>
            <p style={{ fontSize:13, color:"#4a5e74", marginTop:4 }}>Comptabilité & Fiscalité SYSCOHADA</p>
          </div>

          <div style={{ background:"#0b1424", border:"1px solid #162640", borderRadius:14, padding:24 }}>
            <div style={{ display:"flex", gap:4, marginBottom:24, background:"#070d1c", borderRadius:9, padding:4 }}>
              {[["login","Connexion"],["register","Créer un compte"]].map(([v,l]) => (
                <button key={v} onClick={() => { setAuthView(v); setAuthError(""); }}
                  style={{ flex:1, padding:"8px", borderRadius:7, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13,
                    background:authView===v?"#0f1c30":"none",
                    color:authView===v?"#5aaccc":"#4a5e74",
                    transition:"all .15s" }}>{l}</button>
              ))}
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {authView === "register" && (
                <div>
                  <label style={{ fontSize:10, color:"#2a3e54", fontFamily:"monospace", textTransform:"uppercase", letterSpacing:".1em", display:"block", marginBottom:6 }}>Nom complet</label>
                  <input className="inp" placeholder="Votre nom" value={authForm.name} onChange={e => setAuthForm(f => ({...f, name:e.target.value}))} />
                </div>
              )}
              <div>
                <label style={{ fontSize:10, color:"#2a3e54", fontFamily:"monospace", textTransform:"uppercase", letterSpacing:".1em", display:"block", marginBottom:6 }}>Email</label>
                <input className="inp" type="email" placeholder="vous@exemple.com" value={authForm.email} onChange={e => setAuthForm(f => ({...f, email:e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize:10, color:"#2a3e54", fontFamily:"monospace", textTransform:"uppercase", letterSpacing:".1em", display:"block", marginBottom:6 }}>Mot de passe</label>
                <input className="inp" type="password" placeholder="••••••••" value={authForm.password} onChange={e => setAuthForm(f => ({...f, password:e.target.value}))} onKeyDown={e => { if(e.key==="Enter") authView==="login" ? handleLogin() : handleRegister(); }} />
              </div>
              {authView === "register" && (
                <div>
                  <label style={{ fontSize:10, color:"#2a3e54", fontFamily:"monospace", textTransform:"uppercase", letterSpacing:".1em", display:"block", marginBottom:6 }}>Confirmer le mot de passe</label>
                  <input className="inp" type="password" placeholder="••••••••" value={authForm.confirmPassword} onChange={e => setAuthForm(f => ({...f, confirmPassword:e.target.value}))} />
                </div>
              )}
              {authError && <div style={{ fontSize:12, color:"#e05858", fontFamily:"monospace", padding:"8px 12px", background:"#0f0404", border:"1px solid #3e1010", borderRadius:7 }}>⚠ {authError}</div>}
              <button className="btn-primary" onClick={authView === "login" ? handleLogin : handleRegister}>
                {authView === "login" ? "Se connecter →" : "Créer mon compte →"}
              </button>
            </div>

            <div style={{ marginTop:16, textAlign:"center" }}>
              <button className="btn-ghost" onClick={() => setAuthView("plans")} style={{ fontSize:12, color:"#5aaccc" }}>
                Voir les abonnements →
              </button>
            </div>

            {authView === "login" && (
              <div style={{ marginTop:12, padding:"10px 12px", background:"#070d1c", borderRadius:8, fontSize:11, color:"#2a3e54", fontFamily:"monospace", textAlign:"center" }}>
                Demo : entrez n'importe quel email/mot de passe
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // PLANS SCREEN
  // ─────────────────────────────────────────────────────────────
  if (authView === "plans") {
    return (
      <div style={{ minHeight:"100vh", background:"#070d1c", color:"#cfc9bc", fontFamily:"'Crimson Pro', Georgia, serif", padding:"24px 16px" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap');
          *{box-sizing:border-box;margin:0;padding:0}
          :root{--bg0:#070d1c;--bg1:#0b1424;--bg2:#0f1c30;--bg3:#142038;--border:#162640;--border2:#1e3050;--text0:#cfc9bc;--text1:#8a9aac;--text2:#4a5e74;--text3:#2a3e54;--accent:#5aaccc;--green:#3eca78;--red:#e05858;--amber:#d89828;--mono:'JetBrains Mono',monospace}
        `}</style>
        <div style={{ maxWidth:900, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:32 }}>
            <div style={{ fontSize:28, marginBottom:8 }}>⚖ FiscalMind Africa</div>
            <h2 style={{ fontSize:22, fontWeight:500, marginBottom:8 }}>Choisissez votre abonnement</h2>
            <p style={{ color:"#4a5e74", fontSize:14 }}>Toutes les fonctionnalités SYSCOHADA selon vos besoins</p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(250px, 1fr))", gap:16, marginBottom:28 }}>
            {PLANS.map(plan => (
              <div key={plan.id} style={{
                background:"#0b1424", border:`2px solid ${user?.plan === plan.id ? plan.color : "#162640"}`,
                borderRadius:14, padding:24, position:"relative", transition:"border-color .2s"
              }}>
                {plan.badge && (
                  <div style={{ position:"absolute", top:-10, left:"50%", transform:"translateX(-50%)", background:plan.color, color:"#070d1c", fontSize:11, fontFamily:"monospace", padding:"2px 12px", borderRadius:20, fontWeight:600 }}>{plan.badge}</div>
                )}
                <div style={{ fontSize:28, marginBottom:10 }}>{plan.icon}</div>
                <div style={{ fontSize:18, fontWeight:600, marginBottom:4, color:plan.color }}>{plan.name}</div>
                <div style={{ fontSize:15, fontFamily:"monospace", color:"#cfc9bc", marginBottom:16 }}>{plan.price}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:7, marginBottom:20 }}>
                  {plan.features.map((f,i) => (
                    <div key={i} style={{ fontSize:13, color:"#8a9aac", display:"flex", gap:7, alignItems:"flex-start" }}>
                      <span style={{ color:plan.color, flexShrink:0, marginTop:2 }}>✓</span>{f}
                    </div>
                  ))}
                </div>
                <button onClick={() => selectPlan(plan.id)}
                  style={{ width:"100%", padding:"10px", border:`1px solid ${plan.color}`, borderRadius:9, background:"transparent", color:plan.color, cursor:"pointer", fontFamily:"inherit", fontSize:13, transition:"all .18s" }}
                  onMouseEnter={e => { e.target.style.background = plan.color + "22"; }}
                  onMouseLeave={e => { e.target.style.background = "transparent"; }}>
                  {user?.plan === plan.id ? "✓ Plan actuel" : plan.priceMonthly === null ? "Nous contacter" : "Choisir ce plan"}
                </button>
              </div>
            ))}
          </div>
          <div style={{ textAlign:"center" }}>
            <button onClick={() => setAuthView(user ? "login" : "login")}
              style={{ background:"none", border:"1px solid #162640", borderRadius:9, padding:"10px 20px", color:"#5aaccc", cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>
              ← {user ? "Retour à l'application" : "Retour à la connexion"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // MAIN APP
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", background:"#070d1c", color:"#cfc9bc", fontFamily:"'Crimson Pro', Georgia, serif", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#1a2e48;border-radius:2px}
        :root{
          --bg0:#070d1c;--bg1:#0b1424;--bg2:#0f1c30;--bg3:#142038;
          --border:#162640;--border2:#1e3050;
          --text0:#cfc9bc;--text1:#8a9aac;--text2:#4a5e74;--text3:#2a3e54;
          --accent:#5aaccc;--accent2:#3a8aaa;--green:#3eca78;--red:#e05858;--amber:#d89828;
          --mono:'JetBrains Mono',monospace;
        }
        .btn{border:none;cursor:pointer;font-family:inherit;transition:all .18s;outline:none}
        .btn-ghost{background:none;color:var(--text1);border-radius:7px;padding:6px 10px;font-size:13px;border:none;cursor:pointer;font-family:inherit}
        .btn-ghost:hover{background:var(--bg3);color:var(--text0)}
        .btn-primary{background:linear-gradient(135deg,#183858,#0d2438);border:1px solid var(--border2);border-radius:9px;padding:11px 20px;color:var(--accent);font-size:14px;cursor:pointer;font-family:inherit;transition:all .18s}
        .btn-primary:hover{background:linear-gradient(135deg,#1e4870,#142840)}
        .btn-primary:disabled{opacity:.35;cursor:not-allowed}
        .btn-icon{background:none;border:none;cursor:pointer;padding:5px;border-radius:6px;color:var(--text2);transition:all .15s;font-size:14px;line-height:1}
        .btn-icon:hover{background:var(--bg3);color:var(--text0)}
        .btn-danger:hover{background:#2a0a0a!important;color:var(--red)!important}
        .btn-sm{padding:6px 12px;font-size:12px;border-radius:7px}
        .inp{background:var(--bg1);border:1px solid var(--border);border-radius:9px;padding:10px 13px;color:var(--text0);font-family:inherit;font-size:14px;outline:none;width:100%;transition:border-color .2s}
        .inp:focus{border-color:var(--border2)}
        .inp::placeholder{color:var(--text3)}
        .inp-sm{padding:7px 10px;font-size:13px;border-radius:7px}
        .nav-tab{background:none;border:none;cursor:pointer;padding:7px 10px;border-radius:7px;font-family:inherit;font-size:12px;color:var(--text2);display:flex;align-items:center;gap:5px;transition:all .18s;white-space:nowrap}
        .nav-tab:hover{background:var(--bg2);color:var(--text0)}
        .nav-tab.on{background:linear-gradient(135deg,var(--bg3),var(--bg2));color:var(--accent);border:1px solid var(--border2)}
        .conv-item{padding:10px 12px;border-radius:9px;cursor:pointer;transition:all .18s;border:1px solid transparent;display:flex;gap:10px;align-items:flex-start}
        .conv-item:hover{background:var(--bg2)}
        .conv-item.active{background:var(--bg3);border-color:var(--border2)}
        .conv-item-actions{display:none;gap:2px}
        .conv-item:hover .conv-item-actions{display:flex}
        .bubble-user{background:linear-gradient(135deg,#163258,#101e38);border:1px solid #1e3a60;border-radius:16px 16px 4px 16px;padding:12px 15px;max-width:84%;margin-left:auto;font-size:15px;line-height:1.65}
        .bubble-ai{background:linear-gradient(135deg,#0d1826,#141e2e);border:1px solid #162436;border-radius:16px 16px 16px 4px;padding:14px 17px;max-width:90%;font-size:15px;line-height:1.85}
        .pill{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:20px;font-size:11px;cursor:pointer;transition:all .15s;border:1px solid transparent;margin:3px;font-family:var(--mono)}
        .pill-done{background:#061e0e;border-color:#0e3818;color:var(--green)}
        .pill-todo{background:#101620;border-color:#1a2230;color:var(--text2)}
        .pill:hover{transform:translateY(-1px)}
        .tab-btn{background:none;border:1px solid transparent;cursor:pointer;padding:7px 13px;border-radius:8px;font-family:inherit;font-size:13px;color:var(--text2);display:flex;align-items:center;gap:6px;transition:all .18s;white-space:nowrap}
        .tab-btn.on{background:var(--bg2);color:var(--accent);border-color:var(--border2)}
        .tab-btn:hover:not(.on){color:var(--text0)}
        .card{background:var(--bg1);border:1px solid var(--border);border-radius:12px;padding:16px}
        .card-sm{background:var(--bg1);border:1px solid var(--border);border-radius:10px;padding:12px}
        .prog-bg{background:var(--bg3);border-radius:10px;height:4px;overflow:hidden}
        .prog-fill{height:100%;border-radius:10px;background:linear-gradient(90deg,#0e3820,var(--green));transition:width .5s ease}
        .mono{font-family:var(--mono)}
        .label{font-size:10px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;display:block}
        .section-header{font-size:11px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em;padding:4px 12px;margin:4px 0}
        @keyframes fadeUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        .fade-up{animation:fadeUp .22s ease}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}
        .dot{animation:blink 1.1s infinite;width:5px;height:5px;border-radius:50%;background:var(--accent2);display:inline-block}
        .dropdown{position:absolute;top:calc(100% + 4px);left:0;right:0;max-height:210px;overflow-y:auto;background:var(--bg2);border:1px solid var(--border2);border-radius:10px;z-index:300;box-shadow:0 12px 32px rgba(0,0,0,.6)}
        .drop-opt{padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:13px;transition:background .12s}
        .drop-opt:hover,.drop-opt.sel{background:var(--bg3)}
        .ev-row{display:flex;align-items:flex-start;gap:10px;padding:10px 13px;border-radius:9px;margin-bottom:5px;border-left:3px solid;flex-wrap:wrap}
        .ev-d{background:#0f0707;border-color:#8a2828}
        .ev-w{background:#0f0a02;border-color:#8a5c08}
        .ev-i{background:#070b14;border-color:#143a5c}
        .co-card{background:var(--bg1);border:2px solid var(--border);border-radius:12px;padding:16px;cursor:pointer;transition:all .2s}
        .co-card:hover{border-color:var(--border2)}
        .co-card.sel{border-color:var(--accent2);background:var(--bg2)}
        .scroll{overflow-y:auto;flex:1}
        .app-body{display:flex;flex:1;overflow:hidden;min-height:0}
        .sidebar{width:240px;min-width:240px;display:flex;flex-direction:column;background:var(--bg1);border-right:1px solid var(--border);overflow:hidden;transition:width .2s,min-width .2s,transform .2s}
        .sidebar.closed{width:0;min-width:0;overflow:hidden}
        .main-area{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
        .chat-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:14px}
        .chat-input-bar{padding:10px 12px;border-top:1px solid var(--border);display:flex;gap:8px;background:var(--bg0)}
        .send-btn{background:linear-gradient(135deg,#183858,#0d2438);border:1px solid var(--border2);border-radius:9px;padding:10px 14px;color:var(--accent);cursor:pointer;font-size:17px;transition:all .18s;flex-shrink:0}
        .send-btn:hover{background:linear-gradient(135deg,#1e4870,#142840)}
        .send-btn:disabled{opacity:.3;cursor:not-allowed}
        .module-content{flex:1;overflow-y:auto;padding:16px}
        .hamburger{background:none;border:1px solid var(--border);border-radius:7px;padding:5px 8px;color:var(--text0);cursor:pointer;font-size:14px;flex-shrink:0}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal-box{background:var(--bg2);border:1px solid var(--border2);border-radius:14px;padding:24px;max-width:400px;width:100%;text-align:center}
        .kpi-card{background:var(--bg1);border:1px solid var(--border);border-radius:10px;padding:14px;flex:1;min-width:120px}
        .ac-subtab{background:none;border:none;cursor:pointer;padding:9px 12px;font-family:inherit;font-size:12px;color:var(--text2);border-bottom:2px solid transparent;display:flex;align-items:center;gap:4px;transition:all .15s;white-space:nowrap}
        .ac-subtab.on{color:var(--accent);border-bottom-color:var(--accent)}
        .ac-subtab:hover:not(.on){color:var(--text0)}
        .account-badge{font-family:var(--mono);display:inline-block;padding:1px 6px;border-radius:4px;font-size:9px;background:var(--bg3);color:var(--text2)}
        @media(max-width:768px){
          .sidebar{position:fixed;top:0;left:0;bottom:0;z-index:200;transform:translateX(-100%);width:240px!important;min-width:240px!important}
          .sidebar.open{transform:translateX(0)}
          .sidebar.closed{transform:translateX(-100%)}
          .topbar-nav{display:none!important}
          .mobile-nav{display:flex!important}
          .hide-mobile{display:none!important}
        }
        @media(min-width:769px){
          .mobile-nav{display:none!important}
          .sidebar{transform:none!important}
          .sidebar.closed{width:0!important;min-width:0!important}
        }
        .topbar-nav{display:flex;gap:2px;flex:1;overflow-x:auto}
        .mobile-nav{display:none;gap:2px;padding:0 10px 8px;overflow-x:auto;border-top:1px solid var(--border);background:var(--bg1)}
        .mobile-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:199}
        @media(max-width:768px){.mobile-overlay.visible{display:block}}
        .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
        .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
        @media(max-width:900px){.grid-4{grid-template-columns:1fr 1fr!important}}
        @media(max-width:600px){.grid-2{grid-template-columns:1fr!important}.grid-3{grid-template-columns:1fr!important}.grid-4{grid-template-columns:1fr 1fr!important}}
        .entry-grid{display:grid;grid-template-columns:200px 1fr 120px 120px 28px;gap:0}
        @media(max-width:700px){.entry-grid{grid-template-columns:130px 1fr 90px 90px 24px}}
        @media(max-width:500px){.entry-grid{grid-template-columns:100px 1fr 80px 80px 20px}}
        .balance-grid{display:grid;grid-template-columns:80px 1fr 120px 120px 100px}
        @media(max-width:650px){.balance-grid{grid-template-columns:60px 1fr 90px 90px 80px}}
        @media(max-width:450px){.balance-grid{grid-template-columns:55px 1fr 80px 80px 70px}}
        .gl-grid{display:grid;grid-template-columns:90px 50px 1fr 100px 100px 100px}
        @media(max-width:650px){.gl-grid{grid-template-columns:80px 40px 1fr 80px 80px 80px}}
        @media(max-width:450px){.gl-grid{grid-template-columns:70px 36px 1fr 70px 70px 70px}}
        .journal-header-grid{display:grid;grid-template-columns:90px 50px 1fr auto auto auto auto;gap:8px}
        @media(max-width:600px){.journal-header-grid{grid-template-columns:70px 40px 1fr auto auto}}
        .entry-form-header{display:grid;grid-template-columns:140px 120px 1fr 120px;gap:10px}
        @media(max-width:700px){.entry-form-header{grid-template-columns:1fr 1fr}}
        @media(max-width:450px){.entry-form-header{grid-template-columns:1fr}}
        .tiers-grid{display:grid;grid-template-columns:100px 1fr 120px 1fr 28px 28px}
        @media(max-width:600px){.tiers-grid{grid-template-columns:80px 1fr 90px 0px 28px 28px}}
        .acc-panel{display:flex;gap:12px;flex-wrap:wrap}
        .acc-panel>*{flex:1;min-width:200px}
      `}</style>

      {/* ══ TOPBAR ══ */}
      <div style={{ background:"var(--bg1)", borderBottom:"1px solid var(--border)", flexShrink:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", height:50, padding:"0 12px", gap:8 }}>
          <button className="hamburger" onClick={() => setSidebarOpen(o=>!o)} title="Menu">☰</button>
          <div style={{ display:"flex", alignItems:"center", gap:7, flexShrink:0 }}>
            <div style={{ width:28, height:28, borderRadius:7, background:"linear-gradient(135deg,#1a4a68,#0a2030)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, border:"1px solid var(--border2)" }}>⚖</div>
            <div style={{ fontSize:14, fontWeight:600 }}>
              <span style={{ color:"var(--text0)" }}>FiscalMind </span>
              <span style={{ color:"var(--accent)" }}>Africa</span>
              <span style={{ fontSize:9, color:"var(--text3)", fontFamily:"var(--mono)", marginLeft:6 }}>{APP_VERSION}</span>
            </div>
          </div>
          <div className="topbar-nav">
            {MODULES.map(m => (
              <button key={m.id} className={`nav-tab${activeModule===m.id?" on":""}`} onClick={()=>setActiveModule(m.id)}>
                <span>{m.icon}</span><span>{m.label}</span>
              </button>
            ))}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0, marginLeft:"auto" }}>
            <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:7, padding:"4px 8px", fontSize:11, color:"var(--text1)", display:"flex", alignItems:"center", gap:5 }}
              className="hide-mobile">
              <span>{COMPANY_TYPES.find(c=>c.id===settings.companyType)?.icon}</span>
              <span style={{ fontFamily:"var(--mono)", fontSize:10, maxWidth:100, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{settings.companyName}</span>
            </div>
            {/* User menu */}
            <div style={{ position:"relative" }}>
              <button onClick={() => setShowAccount(o=>!o)}
                style={{ background:"var(--bg2)", border:"1px solid var(--border2)", borderRadius:8, padding:"5px 10px", cursor:"pointer", display:"flex", alignItems:"center", gap:6, color:"var(--text0)", fontFamily:"inherit", fontSize:12 }}>
                <span style={{ fontSize:16 }}>👤</span>
                <span className="hide-mobile">{user?.name?.split(" ")[0] || "Compte"}</span>
                <span style={{ fontSize:9, fontFamily:"var(--mono)", color:"var(--accent)", background:"var(--bg3)", borderRadius:4, padding:"1px 5px" }}>
                  {PLANS.find(p => p.id === user?.plan)?.name || "Starter"}
                </span>
              </button>
              {showAccount && (
                <div style={{ position:"absolute", right:0, top:"calc(100% + 6px)", width:220, background:"var(--bg2)", border:"1px solid var(--border2)", borderRadius:12, boxShadow:"0 12px 32px rgba(0,0,0,.6)", zIndex:400, overflow:"hidden" }}>
                  <div style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)" }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{user?.name}</div>
                    <div style={{ fontSize:11, color:"var(--text3)", fontFamily:"var(--mono)" }}>{user?.email}</div>
                    <div style={{ marginTop:4, display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:9, fontFamily:"var(--mono)", color:"var(--accent)", background:"var(--bg3)", borderRadius:4, padding:"2px 7px", textTransform:"uppercase" }}>
                        Plan {PLANS.find(p => p.id === user?.plan)?.name}
                      </span>
                    </div>
                  </div>
                  <div style={{ padding:"6px" }}>
                    <button onClick={() => { setAuthView("plans"); setShowAccount(false); }}
                      style={{ width:"100%", padding:"8px 10px", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, color:"var(--accent)", textAlign:"left", borderRadius:7, display:"flex", gap:7, alignItems:"center" }}>
                      <span>⚡</span> Gérer l'abonnement
                    </button>
                    <button onClick={() => setShowAccount(false)}
                      style={{ width:"100%", padding:"8px 10px", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, color:"var(--text1)", textAlign:"left", borderRadius:7, display:"flex", gap:7, alignItems:"center" }}>
                      <span>⚙</span> Paramètres
                    </button>
                    <button onClick={handleLogout}
                      style={{ width:"100%", padding:"8px 10px", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, color:"var(--red)", textAlign:"left", borderRadius:7, display:"flex", gap:7, alignItems:"center" }}>
                      <span>⎋</span> Déconnexion
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Mobile nav */}
        <div className="mobile-nav">
          {MODULES.map(m=>(
            <button key={m.id} className={`nav-tab${activeModule===m.id?" on":""}`} style={{ fontSize:11, padding:"5px 8px" }} onClick={()=>setActiveModule(m.id)}>
              <span>{m.icon}</span><span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ══ BODY ══ */}
      <div className="app-body" onClick={() => { if(showAccount) setShowAccount(false); }}>

        {/* Mobile overlay */}
        <div className={`mobile-overlay${sidebarOpen?" visible":""}`} onClick={() => setSidebarOpen(false)} />

        {/* ── SIDEBAR — copilote only ── */}
        {activeModule === "copilote" && (
          <div className={`sidebar${sidebarOpen?" open":""}`}>
            <div style={{ padding:"10px 8px 6px", flexShrink:0 }}>
              <button className="btn-primary" style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8, fontSize:12 }}
                onClick={() => { createConversation(); setSidebarOpen(false); }}>
                <span>✦</span> Nouvelle conversation
              </button>
            </div>
            <div style={{ padding:"0 8px 6px", flexShrink:0 }}>
              <input className="inp inp-sm" placeholder="🔍 Rechercher..." value={convSearch} onChange={e=>setConvSearch(e.target.value)} />
            </div>
            <div className="scroll" style={{ padding:"0 6px 10px" }}>
              {conversations.length === 0 && (
                <div style={{ padding:"20px 12px", textAlign:"center", color:"var(--text3)", fontSize:13 }}>
                  <div style={{ fontSize:24, marginBottom:8 }}>💬</div>
                  Aucune conversation.
                </div>
              )}
              {pinnedConvs.length > 0 && (
                <>
                  <div className="section-header">📌 Épinglées</div>
                  {pinnedConvs.map(conv => <ConvItem key={conv.id} conv={conv} active={activeConvId===conv.id}
                    onSelect={()=>{ setActiveConvId(conv.id); setSidebarOpen(false); }}
                    onRename={()=>startRename(conv)}
                    onDelete={()=>requestDelete("conversation", conv.id, conv.title)}
                    onPin={()=>togglePin(conv.id)}
                    editing={editingTitle===conv.id} editVal={editTitleVal}
                    onEditChange={setEditTitleVal} onEditCommit={()=>commitRename(conv.id)} />)}
                </>
              )}
              {unpinnedConvs.length > 0 && (
                <>
                  {pinnedConvs.length > 0 && <div className="section-header" style={{marginTop:6}}>Récentes</div>}
                  {unpinnedConvs.map(conv => <ConvItem key={conv.id} conv={conv} active={activeConvId===conv.id}
                    onSelect={()=>{ setActiveConvId(conv.id); setSidebarOpen(false); }}
                    onRename={()=>startRename(conv)}
                    onDelete={()=>requestDelete("conversation", conv.id, conv.title)}
                    onPin={()=>togglePin(conv.id)}
                    editing={editingTitle===conv.id} editVal={editTitleVal}
                    onEditChange={setEditTitleVal} onEditCommit={()=>commitRename(conv.id)} />)}
                </>
              )}
            </div>
          </div>
        )}

        {/* ══ COPILOTE ══ */}
        {activeModule === "copilote" && (
          <div className="main-area">
            {!activeConv ? (
              <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:20, flexDirection:"column", gap:18, textAlign:"center", overflow:"auto" }}>
                <div style={{ width:50, height:50, borderRadius:12, background:"linear-gradient(135deg,#1a4a68,#0a2030)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, border:"1px solid var(--border2)" }}>⚖</div>
                <div>
                  <h2 style={{ fontSize:20, fontWeight:500, marginBottom:6 }}>Copilote Fiscal SYSCOHADA</h2>
                  <p style={{ fontSize:13, color:"var(--text2)", maxWidth:360 }}>Expert-comptable IA spécialisé en droit OHADA et fiscalité burkinabè.</p>
                </div>
                <div style={{ width:"100%", maxWidth:500 }}>
                  <div className="label" style={{textAlign:"center",marginBottom:10}}>Suggestions rapides</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:7, justifyContent:"center" }}>
                    {QUICK_SUGGESTIONS.map((s,i)=>(
                      <button key={i} style={{ background:"var(--bg2)", border:"1px solid var(--border2)", borderRadius:8, padding:"7px 12px", fontSize:12, color:"var(--accent)", cursor:"pointer", fontFamily:"inherit" }}
                        onClick={()=>sendMessage(s.text)}>{s.label}</button>
                    ))}
                  </div>
                </div>
                <button className="btn-primary" style={{ fontSize:13, padding:"10px 22px" }} onClick={()=>createConversation()}>
                  <span>✦</span> Démarrer une conversation
                </button>
              </div>
            ) : (
              <>
                <div style={{ padding:"8px 14px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:10, flexShrink:0, background:"var(--bg0)" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{activeConv.title}</div>
                    <div style={{ fontSize:10, color:"var(--text3)", fontFamily:"var(--mono)" }}>{activeConv.messageCount} échanges · {fmtDate(activeConv.updatedAt)}</div>
                  </div>
                  <div style={{ display:"flex", gap:2, flexShrink:0 }}>
                    <button className="btn-icon" title="Épingler" onClick={()=>togglePin(activeConvId)}>{activeConv.pinned?"📌":"📍"}</button>
                    <button className="btn-icon" title="Renommer" onClick={()=>startRename(activeConv)}>✏️</button>
                    <button className="btn-icon btn-danger" title="Supprimer" onClick={()=>requestDelete("conversation", activeConvId, activeConv.title)}>🗑️</button>
                  </div>
                </div>
                <div className="chat-messages">
                  {activeConv.messages.map((msg, i) => (
                    <div key={i} className="fade-up" style={{ display:"flex", flexDirection:"column", alignItems:msg.role==="user"?"flex-end":"flex-start", gap:3 }}>
                      <div className={msg.role==="user"?"bubble-user":"bubble-ai"}>
                        {msg.role==="assistant" && <div style={{ fontSize:9, color:"var(--text3)", marginBottom:5, fontFamily:"var(--mono)", letterSpacing:".06em" }}>FISCALMIND IA · SYSCOHADA</div>}
                        <div style={{ whiteSpace:"pre-wrap" }}>{msg.content}</div>
                      </div>
                      <div style={{ fontSize:10, color:"var(--text3)", fontFamily:"var(--mono)", padding:"0 4px" }}>{msg.ts ? fmtDate(msg.ts) : ""}</div>
                    </div>
                  ))}
                  {loading && (
                    <div className="bubble-ai fade-up" style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"12px 16px" }}>
                      <div className="dot" style={{animationDelay:"0s"}}></div>
                      <div className="dot" style={{animationDelay:".18s"}}></div>
                      <div className="dot" style={{animationDelay:".36s"}}></div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="chat-input-bar">
                  <input ref={inputRef} className="inp" value={input} onChange={e=>setInput(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMessage()}
                    placeholder="Posez votre question fiscale ou comptable..." style={{ fontSize:14 }} />
                  <button className="send-btn" onClick={()=>sendMessage()} disabled={loading||!input.trim()}>➤</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ COMPTABILITÉ ══ */}
        {activeModule === "comptabilite" && (
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            {/* Sous-nav */}
            <div style={{background:"var(--bg1)",borderBottom:"1px solid var(--border)",padding:"0 10px",flexShrink:0,display:"flex",alignItems:"center",overflowX:"auto"}}>
              {[
                { id:"dashboard",  label:"Tableau de bord", icon:"📊" },
                { id:"journal",    label:"Journal",         icon:"📋" },
                { id:"saisie",     label:"Saisie",          icon:"✍️" },
                { id:"balance",    label:"Balance & GL",    icon:"⚖️" },
                { id:"referentiel",label:"Référentiel",     icon:"🗂️" },
              ].map(v => (
                <button key={v.id} className={`ac-subtab${acView===v.id?" on":""}`}
                  onClick={()=>setAcView(v.id)}>
                  <span>{v.icon}</span><span>{v.label}</span>
                </button>
              ))}
              <div style={{flex:1}}/>
              {/* KPIs rapides */}
              <div style={{display:"flex",gap:10,padding:"4px 0",flexShrink:0}} className="hide-mobile">
                {[
                  {label:"Produits",val:fmtCfa(dsfResult.produits),c:"var(--green)"},
                  {label:"Charges", val:fmtCfa(dsfResult.charges), c:"var(--red)"},
                  {label:"Résultat",val:fmtCfa(dsfResult.resultat),c:dsfResult.resultat>=0?"var(--green)":"var(--red)"},
                ].map(k=>(
                  <div key={k.label} style={{textAlign:"right"}}>
                    <div style={{fontSize:8,color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase"}}>{k.label}</div>
                    <div style={{fontSize:11,fontFamily:"var(--mono)",color:k.c,fontWeight:600}}>{k.val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── TABLEAU DE BORD ── */}
            {acView === "dashboard" && (
              <div className="module-content">
                <div style={{marginBottom:18}}>
                  <h2 style={{fontSize:17,fontWeight:600,marginBottom:4}}>📊 Tableau de bord — {settings.companyName}</h2>
                  <p style={{fontSize:12,color:"var(--text2)"}}>{entries.length} écriture{entries.length>1?"s":""} enregistrée{entries.length>1?"s":""}</p>
                </div>
                {/* KPI cards */}
                <div className="grid-4" style={{marginBottom:16}}>
                  {[
                    { icon:"💰", label:"Produits totaux", val:fmtCfa(dsfResult.produits), color:"var(--green)" },
                    { icon:"📦", label:"Charges totales", val:fmtCfa(dsfResult.charges), color:"var(--red)" },
                    { icon:"📈", label:"Résultat net", val:fmtCfa(dsfResult.resultat), color:dsfResult.resultat>=0?"var(--green)":"var(--red)" },
                    { icon:"📒", label:"Écritures", val:entries.length, color:"var(--accent)" },
                  ].map(k => (
                    <div key={k.label} className="kpi-card">
                      <div style={{fontSize:18,marginBottom:6}}>{k.icon}</div>
                      <div style={{fontSize:10,color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
                      <div style={{fontSize:16,fontFamily:"var(--mono)",color:k.color,fontWeight:600}}>{k.val}</div>
                    </div>
                  ))}
                </div>

                <div className="grid-2" style={{marginBottom:16}}>
                  {/* Clients */}
                  <div className="card">
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                      <div style={{fontSize:13,fontWeight:500}}>👥 Clients (Cpt 411/418)</div>
                      <button style={{background:"none",border:"1px solid var(--border)",borderRadius:7,padding:"3px 9px",fontSize:11,color:"var(--accent)",cursor:"pointer",fontFamily:"inherit"}}
                        onClick={()=>{setAcView("balance");setBalanceType("clients");}}>Voir →</button>
                    </div>
                    {clientsBalance.length === 0 ? (
                      <div style={{color:"var(--text3)",fontSize:12}}>Aucun mouvement client</div>
                    ) : (
                      <>
                        <div style={{display:"flex",gap:16,marginBottom:10}}>
                          <div>
                            <div className="label">Débit total</div>
                            <div style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--text0)"}}>{totalClientsDebit.toLocaleString("fr-FR")}</div>
                          </div>
                          <div>
                            <div className="label">Crédit total</div>
                            <div style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--text0)"}}>{totalClientsCredit.toLocaleString("fr-FR")}</div>
                          </div>
                          <div>
                            <div className="label">Solde</div>
                            <div style={{fontFamily:"var(--mono)",fontSize:13,color:(totalClientsDebit-totalClientsCredit)>=0?"var(--green)":"var(--red)",fontWeight:600}}>
                              {(totalClientsDebit-totalClientsCredit).toLocaleString("fr-FR")}
                            </div>
                          </div>
                        </div>
                        <div style={{fontSize:11,color:"var(--text3)"}}>
                          {clientsBalance.length} compte{clientsBalance.length>1?"s":""}
                          {clientsBalance.slice(0,3).map(r => (
                            <span key={r.account} style={{marginLeft:8,fontFamily:"var(--mono)",color:"var(--accent)",fontSize:10}}>
                              {r.account}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Fournisseurs */}
                  <div className="card">
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                      <div style={{fontSize:13,fontWeight:500}}>🏪 Fournisseurs (Cpt 401/408)</div>
                      <button style={{background:"none",border:"1px solid var(--border)",borderRadius:7,padding:"3px 9px",fontSize:11,color:"var(--accent)",cursor:"pointer",fontFamily:"inherit"}}
                        onClick={()=>{setAcView("balance");setBalanceType("fournisseurs");}}>Voir →</button>
                    </div>
                    {foursBalance.length === 0 ? (
                      <div style={{color:"var(--text3)",fontSize:12}}>Aucun mouvement fournisseur</div>
                    ) : (
                      <>
                        <div style={{display:"flex",gap:16,marginBottom:10}}>
                          <div>
                            <div className="label">Débit total</div>
                            <div style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--text0)"}}>{totalFoursDebit.toLocaleString("fr-FR")}</div>
                          </div>
                          <div>
                            <div className="label">Crédit total</div>
                            <div style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--text0)"}}>{totalFoursCredit.toLocaleString("fr-FR")}</div>
                          </div>
                          <div>
                            <div className="label">Solde</div>
                            <div style={{fontFamily:"var(--mono)",fontSize:13,color:(totalFoursDebit-totalFoursCredit)>=0?"var(--green)":"var(--red)",fontWeight:600}}>
                              {(totalFoursDebit-totalFoursCredit).toLocaleString("fr-FR")}
                            </div>
                          </div>
                        </div>
                        <div style={{fontSize:11,color:"var(--text3)"}}>
                          {foursBalance.length} compte{foursBalance.length>1?"s":""}
                          {foursBalance.slice(0,3).map(r => (
                            <span key={r.account} style={{marginLeft:8,fontFamily:"var(--mono)",color:"var(--accent)",fontSize:10}}>
                              {r.account}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Dernières écritures */}
                <div className="card" style={{marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                    <div style={{fontSize:13,fontWeight:500}}>📋 Dernières écritures</div>
                    <button style={{background:"none",border:"1px solid var(--border)",borderRadius:7,padding:"3px 9px",fontSize:11,color:"var(--accent)",cursor:"pointer",fontFamily:"inherit"}}
                      onClick={()=>setAcView("journal")}>Tout voir →</button>
                  </div>
                  {entries.length === 0 ? (
                    <div style={{color:"var(--text3)",fontSize:12,textAlign:"center",padding:"20px 0"}}>
                      <div style={{fontSize:28,marginBottom:8}}>📒</div>
                      Aucune écriture. <button style={{background:"none",border:"none",color:"var(--accent)",cursor:"pointer",fontFamily:"inherit",fontSize:12}} onClick={()=>setAcView("saisie")}>Créer la première →</button>
                    </div>
                  ) : (
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      {entries.slice(0,5).map(e => {
                        const tot = e.lines.reduce((s,l)=>s+l.debit,0);
                        const j = allJournals.find(j=>j.id===e.journal);
                        return (
                          <div key={e.id} style={{display:"flex",gap:10,alignItems:"center",padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
                            <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--text3)",minWidth:80}}>{e.date}</div>
                            <div style={{fontSize:10,fontFamily:"var(--mono)",color:"var(--text2)",background:"var(--bg3)",borderRadius:4,padding:"1px 5px",flexShrink:0}}>
                              {j?.icon||""} {e.journal}
                            </div>
                            <div style={{fontSize:12,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.libelle}</div>
                            <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--accent)",flexShrink:0}}>{tot.toLocaleString("fr-FR")}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Répartition par journal */}
                {entries.length > 0 && (
                  <div className="card">
                    <div style={{fontSize:13,fontWeight:500,marginBottom:12}}>📊 Répartition par journal</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                      {allJournals.map(j => {
                        const cnt = entries.filter(e=>e.journal===j.id).length;
                        if (!cnt) return null;
                        const tot = entries.filter(e=>e.journal===j.id).reduce((s,e)=>s+e.lines.reduce((ss,l)=>ss+l.debit,0),0);
                        return (
                          <div key={j.id} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:9,padding:"10px 14px",cursor:"pointer",minWidth:120}}
                            onClick={()=>{setFilterJournal(j.id);setAcView("journal");}}>
                            <div style={{fontSize:16,marginBottom:4}}>{j.icon}</div>
                            <div style={{fontSize:12,fontWeight:500,marginBottom:2}}>{j.label}</div>
                            <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--accent)"}}>{cnt} écriture{cnt>1?"s":""}</div>
                            <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--text2)"}}>{tot.toLocaleString("fr-FR")}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── JOURNAL ── */}
            {acView === "journal" && (
              <div className="module-content">
                <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
                  <div style={{display:"flex",gap:3,background:"var(--bg1)",border:"1px solid var(--border)",borderRadius:8,padding:3,overflowX:"auto",flexShrink:0}}>
                    <button style={{background:filterJournal==="ALL"?"var(--bg3)":"none",border:"none",cursor:"pointer",padding:"3px 8px",borderRadius:5,fontSize:11,color:filterJournal==="ALL"?"var(--accent)":"var(--text2)",fontFamily:"inherit",whiteSpace:"nowrap"}}
                      onClick={()=>setFilterJournal("ALL")}>Tous</button>
                    {allJournals.map(j=>(
                      <button key={j.id} style={{background:filterJournal===j.id?"var(--bg3)":"none",border:"none",cursor:"pointer",padding:"3px 8px",borderRadius:5,fontSize:11,color:filterJournal===j.id?"var(--accent)":"var(--text2)",fontFamily:"inherit",display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap"}}
                        onClick={()=>setFilterJournal(j.id)}>
                        <span style={{fontSize:10}}>{j.icon}</span>{j.id}
                      </button>
                    ))}
                  </div>
                  <input className="inp inp-sm" type="date" value={filterDateFrom}
                    onChange={e=>setFilterDateFrom(e.target.value)} style={{maxWidth:130}} title="Du" />
                  <input className="inp inp-sm" type="date" value={filterDateTo}
                    onChange={e=>setFilterDateTo(e.target.value)} style={{maxWidth:130}} title="Au" />
                  {(filterDateFrom||filterDateTo||filterJournal!=="ALL") && (
                    <button className="btn-ghost" style={{fontSize:11,padding:"3px 7px"}} onClick={()=>{setFilterJournal("ALL");setFilterDateFrom("");setFilterDateTo("");}}>
                      ✕ Effacer
                    </button>
                  )}
                  <span style={{fontSize:11,color:"var(--text3)",fontFamily:"var(--mono)",marginLeft:"auto"}}>{filteredEntries.length} écriture{filteredEntries.length>1?"s":""}</span>
                  <button className="btn-primary" style={{padding:"6px 12px",fontSize:12}} onClick={()=>{setEntryForm(blankForm());setEditingEntry(null);setAcView("saisie");}}>
                    + Nouvelle écriture
                  </button>
                </div>

                {filteredEntries.length === 0 ? (
                  <div style={{textAlign:"center",padding:"50px 20px",color:"var(--text3)"}}>
                    <div style={{fontSize:36,marginBottom:12}}>📒</div>
                    <div style={{fontSize:14,marginBottom:6}}>Aucune écriture{filterJournal!=="ALL" ? ` dans le journal ${filterJournal}` : ""}.</div>
                    <button className="btn-primary" onClick={()=>setAcView("saisie")}>Créer une écriture →</button>
                  </div>
                ) : (
                  <div style={{display:"flex",flexDirection:"column",gap:5}}>
                    {filteredEntries.map(entry => {
                      const tot = entry.lines.reduce((s,l)=>s+l.debit,0);
                      const bal = validateEntry(entry.lines);
                      const expanded = expandedEntry === entry.id;
                      const j = allJournals.find(j=>j.id===entry.journal);
                      return (
                        <div key={entry.id} style={{ background:"var(--bg1)",border:`1px solid ${expanded?"var(--border2)":"var(--border)"}`,borderRadius:10,overflow:"hidden" }}>
                          <div className="journal-header-grid" style={{padding:"8px 10px",alignItems:"center",cursor:"pointer",userSelect:"none"}}
                            onClick={()=>setExpandedEntry(expanded?null:entry.id)}>
                            <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--text3)"}}>{entry.date}</div>
                            <div style={{background:"var(--bg3)",borderRadius:5,padding:"1px 5px",fontSize:9,color:"var(--text2)",fontFamily:"var(--mono)",textAlign:"center",display:"flex",alignItems:"center",gap:2}}>
                              <span>{j?.icon||""}</span>{entry.journal}
                            </div>
                            <div style={{fontSize:12,color:"var(--text0)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{entry.libelle}</div>
                            <div style={{fontSize:11,fontFamily:"var(--mono)",color:"var(--accent)",textAlign:"right",whiteSpace:"nowrap"}} className="hide-mobile">{tot.toLocaleString("fr-FR")}</div>
                            <div style={{fontSize:9,fontFamily:"var(--mono)",padding:"1px 6px",borderRadius:20,
                              background:bal?"#061e0e":"#1e0606",color:bal?"var(--green)":"var(--red)",
                              border:`1px solid ${bal?"#0e3818":"#3e1010"}`,whiteSpace:"nowrap"}} className="hide-mobile">
                              {bal?"✓ Éq.":"✗ Déséq."}
                            </div>
                            <div style={{display:"flex",gap:2}}>
                              <button className="btn-icon" style={{fontSize:10}} title="Modifier" onClick={e=>{e.stopPropagation();startEditEntry(entry);}}>✏️</button>
                              <button className="btn-icon" style={{fontSize:10}} title="Dupliquer" onClick={e=>{e.stopPropagation();setEntryForm({date:new Date().toISOString().slice(0,10),journal:entry.journal,libelle:entry.libelle+" (copie)",piece:"",document_url:entry.document_url||"",lines:entry.lines.map(l=>({...l,debit:l.debit||"",credit:l.credit||""}))});setEditingEntry(null);setAcView("saisie");}}>⎘</button>
                              <button className="btn-icon btn-danger" style={{fontSize:10}} title="Supprimer" onClick={e=>{e.stopPropagation();requestDelete("entry",entry.id,entry.libelle);}}>🗑️</button>
                            </div>
                            <div style={{color:"var(--text3)",fontSize:9}}>{expanded?"▲":"▼"}</div>
                          </div>
                          {expanded && (
                            <div style={{borderTop:"1px solid var(--border)",padding:"8px 10px",background:"var(--bg0)"}}>
                              {entry.piece && (
                                <div style={{fontSize:10,color:"var(--text3)",fontFamily:"var(--mono)",marginBottom:6}}>
                                  Pièce : <span style={{color:"var(--accent)"}}>{entry.piece}</span>
                                  {entry.document_url && <span style={{marginLeft:10}}>📎 {entry.document_url}</span>}
                                </div>
                              )}
                              <div style={{display:"grid",gridTemplateColumns:"65px 45px 1fr 110px 110px",gap:4,fontSize:9,color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:4}}>
                                <div>Compte</div><div></div><div>Libellé</div><div style={{textAlign:"right"}}>Débit XOF</div><div style={{textAlign:"right"}}>Crédit XOF</div>
                              </div>
                              {entry.lines.map((line, i) => (
                                <div key={i} style={{display:"grid",gridTemplateColumns:"65px 45px 1fr 110px 110px",gap:4,padding:"3px 0",borderTop:"1px solid var(--border)",alignItems:"center"}}>
                                  <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--accent)",fontWeight:600}}>{line.account}</div>
                                  <div style={{fontSize:9,color:"var(--text3)",fontFamily:"var(--mono)"}}>{SYSCOHADA_ACCOUNTS.find(a=>a.number===line.account)?.type||""}</div>
                                  <div style={{fontSize:12,color:"var(--text1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{line.label || getAccountLabel(line.account)}</div>
                                  <div style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:11,color:line.debit>0?"var(--text0)":"var(--text3)"}}>{line.debit>0?line.debit.toLocaleString("fr-FR"):"—"}</div>
                                  <div style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:11,color:line.credit>0?"var(--text0)":"var(--text3)"}}>{line.credit>0?line.credit.toLocaleString("fr-FR"):"—"}</div>
                                </div>
                              ))}
                              <div style={{display:"grid",gridTemplateColumns:"65px 45px 1fr 110px 110px",gap:4,marginTop:5,paddingTop:5,borderTop:"1px solid var(--border2)"}}>
                                <div/><div/><div style={{fontSize:9,color:"var(--text3)",fontFamily:"var(--mono)",textAlign:"right",textTransform:"uppercase"}}>Totaux</div>
                                <div style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:11,color:"var(--accent)",fontWeight:600}}>{entry.lines.reduce((s,l)=>s+l.debit,0).toLocaleString("fr-FR")}</div>
                                <div style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:11,color:"var(--accent)",fontWeight:600}}>{entry.lines.reduce((s,l)=>s+l.credit,0).toLocaleString("fr-FR")}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── SAISIE ── */}
            {acView === "saisie" && (
              <div className="module-content">
                <div style={{maxWidth:820,margin:"0 auto"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,flexWrap:"wrap",gap:8}}>
                    <div>
                      <h2 style={{fontSize:16,fontWeight:600,marginBottom:2}}>
                        {editingEntry ? "✏️ Modifier l'écriture" : "Saisie d'écriture SYSCOHADA"}
                      </h2>
                      <p style={{fontSize:11,color:"var(--text2)"}}>{settings.companyName} · Partie double obligatoire</p>
                    </div>
                    <button className="btn-ghost" style={{fontSize:12}} onClick={()=>{setAcView("journal");setEditingEntry(null);}}>← Retour journal</button>
                  </div>

                  {/* Modèles rapides */}
                  {!editingEntry && (
                    <div style={{marginBottom:16}}>
                      <div className="label">Modèles rapides</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {ENTRY_TEMPLATES.map(tpl=>(
                          <button key={tpl.id}
                            style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:7,padding:"5px 10px",fontSize:11,color:"var(--text1)",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}
                            onClick={()=>applyTemplate(tpl)}>
                            <span>{tpl.icon}</span>{tpl.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* En-tête */}
                  <div className="entry-form-header" style={{marginBottom:12}}>
                    <div>
                      <label className="label">Date</label>
                      <input className="inp inp-sm" type="date" value={entryForm.date}
                        onChange={e=>setEntryForm(f=>({...f,date:e.target.value}))} />
                    </div>
                    <div>
                      <label className="label">Journal</label>
                      <select className="inp inp-sm" value={entryForm.journal}
                        onChange={e=>setEntryForm(f=>({...f,journal:e.target.value}))}
                        style={{cursor:"pointer"}}>
                        {allJournals.map(j=>(
                          <option key={j.id} value={j.id}>{j.icon} {j.id} — {j.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Libellé général *</label>
                      <input ref={libRef} className="inp inp-sm" placeholder="Ex: Achat fournitures bureau"
                        value={entryForm.libelle} onChange={e=>setEntryForm(f=>({...f,libelle:e.target.value}))}
                        autoFocus />
                    </div>
                    <div>
                      <label className="label">N° Pièce</label>
                      <input className="inp inp-sm" placeholder={`Auto: ${nextPieceNum(entries, entryForm.journal)}`}
                        value={entryForm.piece} onChange={e=>setEntryForm(f=>({...f,piece:e.target.value}))}
                        style={{fontFamily:"var(--mono)"}} />
                    </div>
                  </div>
                  <div style={{marginBottom:14}}>
                    <label className="label">Pièce justificative (réf. ou URL)</label>
                    <input className="inp inp-sm" placeholder="FA-2026-042 ou /docs/facture.pdf"
                      value={entryForm.document_url} onChange={e=>setEntryForm(f=>({...f,document_url:e.target.value}))} />
                  </div>

                  {/* Lignes */}
                  <div style={{background:"var(--bg1)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden",marginBottom:10}}>
                    <div className="entry-grid" style={{background:"var(--bg0)",borderBottom:"1px solid var(--border)",padding:"6px 10px",fontSize:8,color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",letterSpacing:".07em"}}>
                      <div>Compte SYSCOHADA</div>
                      <div style={{paddingLeft:6}}>Libellé de ligne</div>
                      <div style={{textAlign:"right",paddingRight:6}}>Débit (XOF)</div>
                      <div style={{textAlign:"right",paddingRight:6}}>Crédit (XOF)</div>
                      <div/>
                    </div>

                    {entryForm.lines.map((line, idx) => {
                      const matchedAcct = allAccounts.find(a => a.number === line.account);
                      const search = acctSearch[idx] !== undefined ? acctSearch[idx] : line.account;
                      const isOpen = acctOpen[idx];
                      const filteredAccts = isOpen
                        ? (search.length === 0 ? allAccounts.slice(0,40) : allAccounts.filter(a =>
                            a.number.startsWith(search) || a.number.includes(search) ||
                            a.label.toLowerCase().includes(search.toLowerCase())
                          ).slice(0,40))
                        : [];
                      return (
                        <div key={idx} style={{borderBottom:"1px solid var(--border)",position:"relative"}}>
                          <div className="entry-grid" style={{alignItems:"start",padding:"5px 10px"}}>
                            <div style={{position:"relative",paddingRight:4}}>
                              <input className="inp inp-sm"
                                placeholder="Compte..."
                                value={acctSearch[idx] !== undefined ? acctSearch[idx] : line.account}
                                style={{fontFamily:"var(--mono)",fontSize:11,width:"100%"}}
                                onChange={e=>{
                                  const v = e.target.value;
                                  setAcctSearch(s=>({...s,[idx]:v}));
                                  setAcctOpen(o=>({...o,[idx]:true}));
                                  updateLine(idx,"account",v);
                                }}
                                onFocus={()=>{ setAcctSearch(s=>({...s,[idx]:s[idx]!==undefined?s[idx]:""})); setAcctOpen(o=>({...o,[idx]:true})); }}
                                onBlur={()=>setTimeout(()=>setAcctOpen(o=>({...o,[idx]:false})),200)}
                              />
                              {matchedAcct && (
                                <div style={{display:"flex",alignItems:"center",gap:4,marginTop:2}}>
                                  <span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--accent)",fontWeight:700}}>{matchedAcct.number}</span>
                                  <span style={{fontSize:9,color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{matchedAcct.label}</span>
                                </div>
                              )}
                              {isOpen && filteredAccts.length > 0 && (
                                <div style={{position:"absolute",top:"calc(100% + 2px)",left:0,zIndex:500,background:"var(--bg2)",border:"1px solid var(--accent2)",borderRadius:10,boxShadow:"0 12px 36px rgba(0,0,0,.7)",minWidth:280,maxHeight:200,overflowY:"auto"}}>
                                  {filteredAccts.map(a=>(
                                    <div key={a.number}
                                      style={{padding:"5px 10px",cursor:"pointer",display:"flex",gap:8,alignItems:"center",fontSize:11,borderBottom:"1px solid var(--border)"}}
                                      onMouseEnter={e=>e.currentTarget.style.background="var(--bg3)"}
                                      onMouseLeave={e=>e.currentTarget.style.background=""}
                                      onMouseDown={()=>{
                                        updateLine(idx,"account",a.number);
                                        if(!line.label) updateLine(idx,"label",a.label);
                                        setAcctSearch(s=>{const n={...s};n[idx]=a.number;return n;});
                                        setAcctOpen(o=>({...o,[idx]:false}));
                                      }}>
                                      <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--accent)",fontWeight:700,minWidth:40}}>{a.number}</span>
                                      <span style={{color:"var(--text0)",flex:1}}>{a.label}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div style={{paddingLeft:6,paddingRight:6}}>
                              <input className="inp inp-sm" placeholder="Description..."
                                value={line.label}
                                onChange={e=>{ updateLine(idx,"label",e.target.value); const s=suggestAccount(e.target.value); if(s&&!line.account){updateLine(idx,"account",s);setAcctSearch(prev=>{const n={...prev};n[idx]=s;return n;});} }}
                                style={{width:"100%",fontSize:11}}
                              />
                            </div>
                            <div style={{paddingRight:6}}>
                              <input className="inp inp-sm" type="number" min="0" step="1" placeholder="0"
                                value={line.debit} onChange={e=>updateLine(idx,"debit",e.target.value)}
                                style={{fontFamily:"var(--mono)",fontSize:11,textAlign:"right",width:"100%"}}
                                onFocus={e=>{if(e.target.value==="0"||e.target.value==="")e.target.select();}}
                              />
                            </div>
                            <div style={{paddingRight:6}}>
                              <input className="inp inp-sm" type="number" min="0" step="1" placeholder="0"
                                value={line.credit} onChange={e=>updateLine(idx,"credit",e.target.value)}
                                style={{fontFamily:"var(--mono)",fontSize:11,textAlign:"right",width:"100%"}}
                                onFocus={e=>{if(e.target.value==="0"||e.target.value==="")e.target.select();}}
                              />
                            </div>
                            <button className="btn-icon btn-danger" style={{fontSize:10,padding:2,marginTop:4}}
                              disabled={entryForm.lines.length<=1}
                              onClick={()=>removeLine(idx)} title="Supprimer ligne">✕</button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Totaux */}
                    <div className="entry-grid" style={{background:"var(--bg0)",padding:"6px 10px",borderTop:"2px solid var(--border2)"}}>
                      <div/>
                      <div style={{paddingLeft:6,fontSize:10,color:"var(--text2)"}}>
                        <button style={{background:"none",border:"1px dashed var(--border2)",borderRadius:5,padding:"2px 8px",color:"var(--text2)",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}
                          onClick={addLine}>+ Ligne</button>
                      </div>
                      <div style={{textAlign:"right",paddingRight:6}}>
                        <div style={{fontSize:8,color:"var(--text3)",fontFamily:"var(--mono)",marginBottom:1}}>TOTAL DÉBIT</div>
                        <div style={{fontSize:13,fontFamily:"var(--mono)",color:"var(--accent)",fontWeight:600}}>{totalDebit.toLocaleString("fr-FR")}</div>
                      </div>
                      <div style={{textAlign:"right",paddingRight:6}}>
                        <div style={{fontSize:8,color:"var(--text3)",fontFamily:"var(--mono)",marginBottom:1}}>TOTAL CRÉDIT</div>
                        <div style={{fontSize:13,fontFamily:"var(--mono)",color:"var(--accent)",fontWeight:600}}>{totalCredit.toLocaleString("fr-FR")}</div>
                      </div>
                      <div/>
                    </div>
                  </div>

                  {/* Équilibre */}
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,padding:"8px 12px",borderRadius:8,
                    background:isBalanced?"#040f07":"#0f0404",border:`1px solid ${isBalanced?"#0e3018":"#3e1010"}`}}>
                    <div style={{fontSize:16}}>{isBalanced?"✅":"⚠️"}</div>
                    <div style={{fontSize:12,fontWeight:500,color:isBalanced?"var(--green)":"var(--red)"}}>
                      {isBalanced?"Écriture équilibrée — prête à enregistrer":`Déséquilibre de ${fmtCfa(Math.abs(diff))}`}
                    </div>
                  </div>

                  {entryError && (
                    <div style={{padding:"8px 12px",background:"#0f0404",border:"1px solid #3e1010",borderRadius:7,fontSize:11,color:"var(--red)",fontFamily:"var(--mono)",marginBottom:10}}>
                      ⚠ {entryError}
                    </div>
                  )}
                  <div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}}>
                    <button className="btn-ghost" onClick={()=>{setEntryForm(blankForm());setEntryError("");}}>Réinitialiser</button>
                    <button className="btn-ghost" onClick={()=>{setAcView("journal");setEditingEntry(null);}}>Annuler</button>
                    <button className="btn-primary" style={{padding:"9px 20px",fontSize:13}}
                      onClick={submitEntry} disabled={!isBalanced||totalDebit===0}>
                      {editingEntry ? "Enregistrer les modifications ✓" : "Enregistrer l'écriture ✓"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── BALANCE & GRAND LIVRE ── */}
            {acView === "balance" && (
              <div className="module-content">
                {/* Sous-onglets balance/GL */}
                <div style={{display:"flex",gap:4,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
                  <div style={{display:"flex",gap:4,background:"var(--bg1)",border:"1px solid var(--border)",borderRadius:9,padding:4}}>
                    {[
                      {id:"all",label:"Balance générale",icon:"⚖️"},
                      {id:"clients",label:"Balance clients",icon:"👥"},
                      {id:"fournisseurs",label:"Balance fournisseurs",icon:"🏪"},
                    ].map(t => (
                      <button key={t.id}
                        style={{background:balanceType===t.id?"var(--bg3)":"none",border:"none",cursor:"pointer",padding:"5px 10px",borderRadius:7,fontSize:11,color:balanceType===t.id?"var(--accent)":"var(--text2)",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap",transition:"all .15s"}}
                        onClick={()=>setBalanceType(t.id)}>
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>

                  {balanceType === "all" && (
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      <span style={{fontSize:11,color:"var(--text2)"}}>Classes :</span>
                      <select className="inp inp-sm" value={balanceClassFrom}
                        onChange={e=>setBalanceClassFrom(e.target.value)}
                        style={{width:60,cursor:"pointer",fontFamily:"var(--mono)"}}>
                        {[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n}</option>)}
                      </select>
                      <span style={{fontSize:11,color:"var(--text3)"}}>à</span>
                      <select className="inp inp-sm" value={balanceClassTo}
                        onChange={e=>setBalanceClassTo(e.target.value)}
                        style={{width:60,cursor:"pointer",fontFamily:"var(--mono)"}}>
                        {[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  )}

                  <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{fontSize:11,color:"var(--text3)",fontFamily:"var(--mono)"}}>{filteredBalance.length} compte{filteredBalance.length>1?"s":""}</span>
                    <button
                      style={{background:"none",border:"1px solid var(--border)",borderRadius:7,padding:"4px 10px",fontSize:11,color:"var(--accent)",cursor:"pointer",fontFamily:"inherit"}}
                      onClick={()=>setGrandLivreView(!grandLivreView)}>
                      {grandLivreView?"← Balance":"Grand livre →"}
                    </button>
                  </div>
                </div>

                {!grandLivreView ? (
                  /* Balance */
                  <>
                    <div style={{marginBottom:8,fontSize:13,fontWeight:500,color:"var(--text1)"}}>
                      {balanceType === "all" && `Balance des comptes — Classes ${balanceClassFrom} à ${balanceClassTo}`}
                      {balanceType === "clients" && "Balance clients — Comptes 411 / 418"}
                      {balanceType === "fournisseurs" && "Balance fournisseurs — Comptes 401 / 408"}
                    </div>
                    {filteredBalance.length === 0 ? (
                      <div style={{textAlign:"center",padding:"40px",color:"var(--text3)"}}>
                        <div style={{fontSize:30,marginBottom:10}}>⚖️</div>
                        <div>Aucun mouvement pour cette sélection.</div>
                      </div>
                    ) : (
                      <div style={{background:"var(--bg1)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
                        <div className="balance-grid" style={{padding:"7px 12px",background:"var(--bg0)",borderBottom:"1px solid var(--border2)",fontSize:8,color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",letterSpacing:".06em"}}>
                          <div>Compte</div><div>Libellé</div>
                          <div style={{textAlign:"right"}}>Débit</div>
                          <div style={{textAlign:"right"}}>Crédit</div>
                          <div style={{textAlign:"right"}}>Solde</div>
                        </div>
                        <div style={{maxHeight:"calc(100vh - 320px)",overflowY:"auto"}}>
                          {filteredBalance.map((row, i) => (
                            <div key={row.account} className="balance-grid" style={{padding:"6px 12px",borderBottom:i<filteredBalance.length-1?"1px solid var(--border)":"none",alignItems:"center",cursor:"pointer"}}
                              onClick={()=>{setGrandLivreAccount(row.account);setGrandLivreView(true);}}>
                              <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--accent)",fontWeight:600}}>{row.account}</div>
                              <div style={{fontSize:11,color:"var(--text1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.label || "—"}</div>
                              <div style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:11,color:"var(--text0)"}}>{row.debit.toLocaleString("fr-FR")}</div>
                              <div style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:11,color:"var(--text0)"}}>{row.credit.toLocaleString("fr-FR")}</div>
                              <div style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:11,fontWeight:600,color:row.solde>0?"var(--green)":row.solde<0?"var(--red)":"var(--text3)"}}>
                                {row.solde !== 0 ? (row.solde>0?"+":"")+row.solde.toLocaleString("fr-FR") : "—"}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="balance-grid" style={{padding:"8px 12px",background:"var(--bg0)",borderTop:"2px solid var(--border2)"}}>
                          <div/><div style={{fontSize:10,color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase"}}>Totaux</div>
                          <div style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:12,color:"var(--accent)",fontWeight:700}}>{filteredBalance.reduce((s,r)=>s+r.debit,0).toLocaleString("fr-FR")}</div>
                          <div style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:12,color:"var(--accent)",fontWeight:700}}>{filteredBalance.reduce((s,r)=>s+r.credit,0).toLocaleString("fr-FR")}</div>
                          <div style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:12,color:dsfResult.resultat>=0?"var(--green)":"var(--red)",fontWeight:700}}>
                            {(filteredBalance.reduce((s,r)=>s+r.solde,0)).toLocaleString("fr-FR")}
                          </div>
                        </div>
                        <div style={{padding:"6px 12px",background:"var(--bg0)",fontSize:9,color:"var(--text3)",fontFamily:"var(--mono)"}}>
                          💡 Cliquer sur un compte pour accéder à son grand livre
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* Grand livre */
                  <>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
                      <button className="btn-ghost" style={{fontSize:11}} onClick={()=>setGrandLivreView(false)}>← Balance</button>
                      <div style={{flex:1,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <label style={{fontSize:10,color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase"}}>Compte</label>
                        <div style={{position:"relative"}}>
                          <input className="inp inp-sm" value={grandLivreAccount}
                            onChange={e=>setGrandLivreAccount(e.target.value)}
                            style={{fontFamily:"var(--mono)",width:120}}
                            placeholder="Ex: 411" />
                        </div>
                        {grandLivreAccount && (
                          <span style={{fontSize:12,color:"var(--text1)"}}>
                            — {allAccounts.find(a=>a.number===grandLivreAccount)?.label || "Compte personnalisé"}
                          </span>
                        )}
                      </div>
                      <span style={{fontSize:10,fontFamily:"var(--mono)",color:"var(--text3)"}}>{grandLivreLines.length} ligne{grandLivreLines.length>1?"s":""}</span>
                    </div>

                    {!grandLivreAccount ? (
                      <div style={{textAlign:"center",padding:"40px",color:"var(--text3)"}}>
                        <div style={{fontSize:30,marginBottom:8}}>📖</div>
                        <div>Sélectionnez un compte pour voir son grand livre.</div>
                      </div>
                    ) : grandLivreLines.length === 0 ? (
                      <div style={{textAlign:"center",padding:"40px",color:"var(--text3)"}}>
                        <div style={{fontSize:30,marginBottom:8}}>📖</div>
                        <div>Aucun mouvement sur ce compte.</div>
                      </div>
                    ) : (
                      <div style={{background:"var(--bg1)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
                        <div style={{padding:"8px 12px",background:"var(--bg0)",borderBottom:"1px solid var(--border2)"}}>
                          <span style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--accent)",fontWeight:700,marginRight:10}}>{grandLivreAccount}</span>
                          <span style={{fontSize:12,color:"var(--text1)"}}>{allAccounts.find(a=>a.number===grandLivreAccount)?.label || ""}</span>
                        </div>
                        <div className="gl-grid" style={{padding:"6px 12px",background:"var(--bg0)",borderBottom:"1px solid var(--border2)",fontSize:8,color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",letterSpacing:".06em"}}>
                          <div>Date</div><div>Jnl</div><div>Libellé</div>
                          <div style={{textAlign:"right"}}>Débit</div>
                          <div style={{textAlign:"right"}}>Crédit</div>
                          <div style={{textAlign:"right"}}>Solde cumulé</div>
                        </div>
                        <div style={{maxHeight:"calc(100vh - 340px)",overflowY:"auto"}}>
                          {grandLivreLines.map((l, i) => (
                            <div key={i} className="gl-grid" style={{padding:"6px 12px",borderBottom:i<grandLivreLines.length-1?"1px solid var(--border)":"none",alignItems:"center"}}>
                              <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--text3)"}}>{l.date}</div>
                              <div style={{fontSize:9,fontFamily:"var(--mono)",color:"var(--text2)",background:"var(--bg3)",borderRadius:3,padding:"0px 4px",textAlign:"center"}}>{l.journal}</div>
                              <div style={{fontSize:11,color:"var(--text1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.libelle}</div>
                              <div style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:11,color:l.debit>0?"var(--text0)":"var(--text3)"}}>{l.debit>0?l.debit.toLocaleString("fr-FR"):"—"}</div>
                              <div style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:11,color:l.credit>0?"var(--text0)":"var(--text3)"}}>{l.credit>0?l.credit.toLocaleString("fr-FR"):"—"}</div>
                              <div style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:11,fontWeight:600,color:l.solde>0?"var(--green)":l.solde<0?"var(--red)":"var(--text3)"}}>
                                {l.solde!==0?(l.solde>0?"+":"")+l.solde.toLocaleString("fr-FR"):"0"}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="gl-grid" style={{padding:"8px 12px",background:"var(--bg0)",borderTop:"2px solid var(--border2)"}}>
                          <div/><div/><div style={{fontSize:9,color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase"}}>Totaux</div>
                          <div style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:11,color:"var(--accent)",fontWeight:700}}>{grandLivreLines.reduce((s,l)=>s+l.debit,0).toLocaleString("fr-FR")}</div>
                          <div style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:11,color:"var(--accent)",fontWeight:700}}>{grandLivreLines.reduce((s,l)=>s+l.credit,0).toLocaleString("fr-FR")}</div>
                          <div style={{textAlign:"right",fontFamily:"var(--mono)",fontSize:11,fontWeight:700,color:grandLivreLines[grandLivreLines.length-1]?.solde>0?"var(--green)":"var(--red)"}}>
                            {grandLivreLines[grandLivreLines.length-1]?.solde?.toLocaleString("fr-FR") || "0"}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── RÉFÉRENTIEL ── */}
            {acView === "referentiel" && (
              <div className="module-content">
                <div style={{marginBottom:16}}>
                  <h2 style={{fontSize:16,fontWeight:600,marginBottom:4}}>🗂️ Référentiel comptable</h2>
                  <p style={{fontSize:12,color:"var(--text2)"}}>Gérez vos comptes tiers, codes journaux et plan comptable.</p>
                </div>

                <div style={{display:"flex",gap:4,marginBottom:18,borderBottom:"1px solid var(--border)",paddingBottom:0,overflowX:"auto"}}>
                  {[
                    { id:"tiers",    label:"Comptes tiers",  icon:"👥" },
                    { id:"journaux", label:"Codes journaux", icon:"📓" },
                    { id:"plan",     label:"Plan comptable", icon:"📊" },
                  ].map(t=>(
                    <button key={t.id}
                      style={{background:"none",border:"none",cursor:"pointer",padding:"8px 14px",fontFamily:"inherit",fontSize:12,
                        color:refTab===t.id?"var(--accent)":"var(--text2)",
                        borderBottom:refTab===t.id?"2px solid var(--accent)":"2px solid transparent",
                        display:"flex",alignItems:"center",gap:4,transition:"all .15s",whiteSpace:"nowrap",marginBottom:-1}}
                      onClick={()=>{setRefTab(t.id);setEditingTiers(null);setEditingJournal(null);}}>
                      <span>{t.icon}</span>{t.label}
                    </button>
                  ))}
                </div>

                {/* TIERS */}
                {refTab === "tiers" && (
                  <div style={{maxWidth:720}}>
                    <div style={{background:"var(--bg1)",border:"1px solid var(--border)",borderRadius:12,padding:14,marginBottom:16}}>
                      <div className="label" style={{marginBottom:10}}>{editingTiers ? "✏️ Modifier le tiers" : "Nouveau compte tiers"}</div>
                      <div className="grid-2" style={{marginBottom:10}}>
                        <div>
                          <label className="label">Code *</label>
                          <input className="inp inp-sm" placeholder="Ex: F-001" value={tiersForm.code}
                            onChange={e=>setTiersForm(f=>({...f,code:e.target.value.toUpperCase()}))}
                            style={{fontFamily:"var(--mono)"}} disabled={!!editingTiers} />
                        </div>
                        <div>
                          <label className="label">Nom *</label>
                          <input className="inp inp-sm" placeholder="Raison sociale" value={tiersForm.nom}
                            onChange={e=>setTiersForm(f=>({...f,nom:e.target.value}))} />
                        </div>
                        <div>
                          <label className="label">Type</label>
                          <select className="inp inp-sm" value={tiersForm.type}
                            onChange={e=>setTiersForm(f=>({...f,type:e.target.value}))} style={{cursor:"pointer"}}>
                            <option value="fournisseur">Fournisseur</option>
                            <option value="client">Client</option>
                            <option value="personnel">Personnel</option>
                            <option value="etat">État / Organisme</option>
                            <option value="autre">Autre</option>
                          </select>
                        </div>
                        <div>
                          <label className="label">Contact / IFU</label>
                          <input className="inp inp-sm" placeholder="Téléphone ou IFU" value={tiersForm.contact}
                            onChange={e=>setTiersForm(f=>({...f,contact:e.target.value}))} />
                        </div>
                      </div>
                      {tiersError && <div style={{fontSize:11,color:"var(--red)",fontFamily:"var(--mono)",marginBottom:8}}>⚠ {tiersError}</div>}
                      <div style={{display:"flex",gap:8}}>
                        <button className="btn-primary" style={{padding:"6px 16px",fontSize:12}} onClick={addTiers}>
                          {editingTiers ? "Enregistrer les modifications" : "+ Ajouter le tiers"}
                        </button>
                        {editingTiers && <button className="btn-ghost" style={{fontSize:12}} onClick={()=>{setEditingTiers(null);setTiersForm({code:"",nom:"",type:"fournisseur",contact:""});setTiersError("");}}>Annuler</button>}
                      </div>
                    </div>
                    {tiers.length === 0 ? (
                      <div style={{textAlign:"center",padding:"30px",color:"var(--text3)"}}>
                        <div style={{fontSize:28,marginBottom:8}}>👥</div>
                        <div>Aucun compte tiers créé.</div>
                      </div>
                    ) : (
                      <div style={{background:"var(--bg1)",border:"1px solid var(--border)",borderRadius:10,overflow:"auto"}}>
                        <div style={{display:"grid",gridTemplateColumns:"90px 1fr 110px 1fr 28px 28px",padding:"6px 12px",background:"var(--bg0)",borderBottom:"1px solid var(--border2)",fontSize:8,color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",letterSpacing:".06em",minWidth:500}}>
                          <div>Code</div><div>Nom</div><div>Type</div><div>Contact</div><div/><div/>
                        </div>
                        {tiers.map((t,i)=>(
                          <div key={t.id} style={{display:"grid",gridTemplateColumns:"90px 1fr 110px 1fr 28px 28px",padding:"8px 12px",borderBottom:i<tiers.length-1?"1px solid var(--border)":"none",alignItems:"center",minWidth:500}}>
                            <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--accent)",fontWeight:700}}>{t.code}</div>
                            <div style={{fontSize:12,color:"var(--text0)"}}>{t.nom}</div>
                            <div><span style={{fontSize:9,fontFamily:"var(--mono)",background:"var(--bg3)",borderRadius:20,padding:"1px 7px",color:"var(--text2)"}}>{t.type}</span></div>
                            <div style={{fontSize:11,color:"var(--text2)"}}>{t.contact||"—"}</div>
                            <button className="btn-icon" style={{fontSize:11}} title="Modifier" onClick={()=>startEditTiers(t)}>✏️</button>
                            <button className="btn-icon btn-danger" style={{fontSize:11}} title="Supprimer" onClick={()=>requestDelete("tiers",t.id,t.nom)}>🗑️</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* JOURNAUX */}
                {refTab === "journaux" && (
                  <div style={{maxWidth:650}}>
                    <div style={{background:"var(--bg1)",border:"1px solid var(--border)",borderRadius:12,padding:14,marginBottom:16}}>
                      <div className="label" style={{marginBottom:10}}>{editingJournal ? "✏️ Modifier le journal" : "Nouveau code journal"}</div>
                      <div style={{display:"grid",gridTemplateColumns:"100px 1fr 60px",gap:10,marginBottom:10}}>
                        <div>
                          <label className="label">Code *</label>
                          <input className="inp inp-sm" placeholder="Ex: IM" value={journalForm.id}
                            onChange={e=>setJournalForm(f=>({...f,id:e.target.value.toUpperCase().slice(0,4)}))}
                            style={{fontFamily:"var(--mono)"}} maxLength={4} disabled={!!editingJournal} />
                        </div>
                        <div>
                          <label className="label">Libellé *</label>
                          <input className="inp inp-sm" placeholder="Ex: Immobilisations" value={journalForm.label}
                            onChange={e=>setJournalForm(f=>({...f,label:e.target.value}))} />
                        </div>
                        <div>
                          <label className="label">Icône</label>
                          <input className="inp inp-sm" placeholder="📁" value={journalForm.icon}
                            onChange={e=>setJournalForm(f=>({...f,icon:e.target.value}))} style={{textAlign:"center"}} />
                        </div>
                      </div>
                      {journalError && <div style={{fontSize:11,color:"var(--red)",fontFamily:"var(--mono)",marginBottom:8}}>⚠ {journalError}</div>}
                      <div style={{display:"flex",gap:8}}>
                        <button className="btn-primary" style={{padding:"6px 16px",fontSize:12}} onClick={addJournalCustom}>
                          {editingJournal ? "Enregistrer les modifications" : "+ Ajouter le journal"}
                        </button>
                        {editingJournal && <button className="btn-ghost" style={{fontSize:12}} onClick={()=>{setEditingJournal(null);setJournalForm({id:"",label:"",icon:"📁"});setJournalError("");}}>Annuler</button>}
                      </div>
                    </div>
                    <div style={{background:"var(--bg1)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
                      <div style={{padding:"6px 12px",background:"var(--bg0)",borderBottom:"1px solid var(--border2)",fontSize:8,color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",letterSpacing:".06em",display:"grid",gridTemplateColumns:"60px 1fr 46px 28px 28px"}}>
                        <div>Code</div><div>Libellé</div><div>Icône</div><div/><div/>
                      </div>
                      {allJournals.map((j,i)=>{
                        const isBase = JOURNALS.some(b=>b.id===j.id);
                        return (
                          <div key={j.id} style={{display:"grid",gridTemplateColumns:"60px 1fr 46px 28px 28px",padding:"8px 12px",borderBottom:i<allJournals.length-1?"1px solid var(--border)":"none",alignItems:"center"}}>
                            <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--accent)",fontWeight:700}}>{j.id}</div>
                            <div style={{fontSize:12,color:"var(--text0)"}}>{j.label}
                              {isBase && <span style={{marginLeft:7,fontSize:8,fontFamily:"var(--mono)",color:"var(--text3)",background:"var(--bg3)",borderRadius:4,padding:"1px 5px"}}>SYSTÈME</span>}
                            </div>
                            <div style={{fontSize:16,textAlign:"center"}}>{j.icon}</div>
                            {isBase
                              ? <div style={{fontSize:9,color:"var(--text3)",textAlign:"center"}}>—</div>
                              : <button className="btn-icon" style={{fontSize:11}} title="Modifier" onClick={()=>startEditJournal(j)}>✏️</button>
                            }
                            {isBase
                              ? <div/>
                              : <button className="btn-icon btn-danger" style={{fontSize:11}} onClick={()=>requestDelete("journal",j.id,j.label)} title="Supprimer">🗑️</button>
                            }
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* PLAN COMPTABLE */}
                {refTab === "plan" && (
                  <div style={{maxWidth:780}}>
                    <div style={{background:"var(--bg1)",border:"1px solid var(--border)",borderRadius:12,padding:14,marginBottom:16}}>
                      <div className="label" style={{marginBottom:10}}>Nouveau compte au plan comptable</div>
                      <div style={{display:"grid",gridTemplateColumns:"100px 1fr 120px 130px",gap:10,marginBottom:10}}>
                        <div>
                          <label className="label">Numéro *</label>
                          <input className="inp inp-sm" placeholder="Ex: 6281" value={planForm.number}
                            onChange={e=>setPlanForm(f=>({...f,number:e.target.value.replace(/\D/g,"")}))}
                            style={{fontFamily:"var(--mono)"}} />
                        </div>
                        <div>
                          <label className="label">Libellé *</label>
                          <input className="inp inp-sm" placeholder="Intitulé du compte" value={planForm.label}
                            onChange={e=>setPlanForm(f=>({...f,label:e.target.value}))} />
                        </div>
                        <div>
                          <label className="label">Type</label>
                          <select className="inp inp-sm" value={planForm.type}
                            onChange={e=>setPlanForm(f=>({...f,type:e.target.value}))} style={{cursor:"pointer"}}>
                            <option value="actif">Actif</option>
                            <option value="passif">Passif</option>
                            <option value="charge">Charge</option>
                            <option value="produit">Produit</option>
                            <option value="résultat">Résultat</option>
                          </select>
                        </div>
                        <div>
                          <label className="label">État financier</label>
                          <select className="inp inp-sm" value={planForm.statement}
                            onChange={e=>setPlanForm(f=>({...f,statement:e.target.value}))} style={{cursor:"pointer"}}>
                            <option value="bilan">Bilan</option>
                            <option value="resultat">Résultat</option>
                          </select>
                        </div>
                      </div>
                      {planError && <div style={{fontSize:11,color:"var(--red)",fontFamily:"var(--mono)",marginBottom:8}}>⚠ {planError}</div>}
                      <button className="btn-primary" style={{padding:"6px 16px",fontSize:12}} onClick={addPlanCustom}>+ Ajouter au plan comptable</button>
                    </div>

                    <div style={{marginBottom:10}}>
                      <input className="inp inp-sm" placeholder="🔍 Rechercher dans le plan comptable..."
                        value={acctSearch["plan"]||""}
                        onChange={e=>setAcctSearch(s=>({...s,plan:e.target.value}))}
                        style={{maxWidth:320}} />
                    </div>

                    <div style={{background:"var(--bg1)",border:"1px solid var(--border)",borderRadius:10,overflow:"auto"}}>
                      <div style={{padding:"6px 12px",background:"var(--bg0)",borderBottom:"1px solid var(--border2)",fontSize:8,color:"var(--text3)",fontFamily:"var(--mono)",textTransform:"uppercase",letterSpacing:".06em",display:"grid",gridTemplateColumns:"65px 1fr 90px 90px 28px",minWidth:500}}>
                        <div>N°</div><div>Libellé</div><div>Type</div><div>État fin.</div><div/>
                      </div>
                      <div style={{maxHeight:380,overflowY:"auto"}}>
                        {allAccounts
                          .filter(a=>{const q=(acctSearch["plan"]||"").toLowerCase();return !q||a.number.includes(q)||a.label.toLowerCase().includes(q);})
                          .map((a,i,arr)=>{
                            const isBase = SYSCOHADA_ACCOUNTS.some(b=>b.number===a.number);
                            return (
                              <div key={a.number} style={{display:"grid",gridTemplateColumns:"65px 1fr 90px 90px 28px",padding:"6px 12px",borderBottom:i<arr.length-1?"1px solid var(--border)":"none",alignItems:"center",minWidth:500}}>
                                <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--accent)",fontWeight:700}}>{a.number}</div>
                                <div style={{fontSize:11,color:"var(--text0)"}}>{a.label}</div>
                                <div style={{fontSize:9,fontFamily:"var(--mono)",color:"var(--text2)",background:"var(--bg3)",borderRadius:4,padding:"1px 5px",display:"inline-block"}}>{a.type}</div>
                                <div style={{fontSize:9,color:"var(--text3)",fontFamily:"var(--mono)"}}>{a.statement}</div>
                                {isBase
                                  ? <div style={{fontSize:9,color:"var(--text3)",textAlign:"center"}}>—</div>
                                  : <button className="btn-icon btn-danger" style={{fontSize:10}} onClick={()=>requestDelete("plan",a.number,a.label)} title="Supprimer">🗑️</button>
                                }
                              </div>
                            );
                          })}
                      </div>
                      <div style={{padding:"5px 12px",background:"var(--bg0)",borderTop:"1px solid var(--border2)",fontSize:9,color:"var(--text3)",fontFamily:"var(--mono)"}}>
                        {allAccounts.length} comptes ({SYSCOHADA_ACCOUNTS.length} SYSCOHADA + {planCustom.length} personnalisés)
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ AUDIT READINESS ══ */}
        {activeModule === "audit" && (
          <div className="module-content">
            {!auditConfigured ? (
              <div style={{ maxWidth:600, margin:"0 auto" }}>
                <h2 style={{ fontSize:18, fontWeight:600, marginBottom:6 }}>Configurer la structure</h2>
                <p style={{ fontSize:13, color:"var(--text2)", marginBottom:20 }}>Adaptez le tableau de bord à vos obligations fiscales.</p>
                <div className="grid-2" style={{marginBottom:18}}>
                  {COMPANY_TYPES.map(ct=>(
                    <div key={ct.id} className={`co-card${settings.companyType===ct.id?" sel":""}`}
                      onClick={()=>setSettings(s=>({...s,companyType:ct.id}))}>
                      <div style={{fontSize:20,marginBottom:6}}>{ct.icon}</div>
                      <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>{ct.label}</div>
                      <div style={{fontSize:11,color:"var(--text2)"}}>{ct.desc}</div>
                      {settings.companyType===ct.id&&<div style={{fontSize:10,color:"var(--accent)",marginTop:7,fontFamily:"var(--mono)"}}>✓ Sélectionné</div>}
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom:14 }}>
                  <label className="label">Nom de l'entreprise</label>
                  <input className="inp" value={settings.companyName} onChange={e=>setSettings(s=>({...s,companyName:e.target.value}))} placeholder="Ex : SARL Ouédraogo & Associés" />
                </div>
                <button className="btn-primary" style={{width:"100%"}} onClick={()=>{saveSettings(settings);setAuditConfigured(true);}}>
                  Accéder au tableau de bord →
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display:"flex", flexWrap:"wrap", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:16 }}>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                      <h2 style={{ fontSize:16, fontWeight:600 }}>Audit Readiness — Brigade DGI</h2>
                      <button className="btn-ghost" style={{fontSize:11,padding:"3px 8px"}} onClick={()=>setAuditConfigured(false)}>
                        {COMPANY_TYPES.find(c=>c.id===settings.companyType)?.icon} {settings.companyName} ✎
                      </button>
                    </div>
                    <p style={{ fontSize:11, color:"var(--text2)", marginTop:3 }}>Exercices 2023–2025 · Déclarations mensuelles, trimestrielles & annuelles</p>
                  </div>
                  <div className="card-sm" style={{ textAlign:"center", minWidth:90 }}>
                    <div style={{ fontSize:24, fontWeight:300, color:pct>=80?"var(--green)":pct>=50?"var(--amber)":"var(--red)", fontFamily:"var(--mono)" }}>{pct}%</div>
                    <div style={{ fontSize:9, color:"var(--text3)", fontFamily:"var(--mono)" }}>{done}/{total}</div>
                    <div className="prog-bg" style={{marginTop:5}}><div className="prog-fill" style={{width:`${pct}%`}}></div></div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:4, marginBottom:14, overflowX:"auto", paddingBottom:2 }}>
                  <div style={{ display:"flex", gap:4, background:"var(--bg1)", padding:4, borderRadius:10, border:"1px solid var(--border)" }}>
                    {AUDIT_TABS.map(tab=>{
                      const tp=tabProgress(tab.id);
                      return (
                        <button key={tab.id} className={`tab-btn${auditTab===tab.id?" on":""}`} onClick={()=>setAuditTab(tab.id)}>
                          <span>{tab.icon}</span><span>{tab.label}</span>
                          <span style={{fontSize:9,fontFamily:"var(--mono)",color:tp.pct===100?"var(--green)":tp.d>0?"var(--amber)":"var(--text3)"}}>{tp.d}/{tp.t}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid-2">
                  {auditCats().map(cat=>{
                    const cd=cat.docs.filter(d=>auditState[`${cat.id}-${d}`]).length;
                    const cp=cat.docs.length>0?(cd/cat.docs.length)*100:0;
                    return (
                      <div key={cat.id} className="card" style={{padding:12}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:7}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0}}>
                            <span style={{background:"var(--bg3)",borderRadius:4,padding:"1px 6px",fontSize:9,fontFamily:"var(--mono)",color:"var(--text3)",flexShrink:0}}>#{cat.id}</span>
                            <span style={{fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat.label}</span>
                          </div>
                          <span style={{fontSize:9,color:cd===cat.docs.length?"var(--green)":"var(--text3)",fontFamily:"var(--mono)",flexShrink:0,marginLeft:5}}>{cd}/{cat.docs.length}</span>
                        </div>
                        <div className="prog-bg" style={{marginBottom:8}}><div className="prog-fill" style={{width:`${cp}%`}}></div></div>
                        <div style={{display:"flex",flexWrap:"wrap"}}>
                          {cat.docs.map(doc=>{
                            const k=`${cat.id}-${doc}`;
                            return (
                              <button key={doc} className={`pill ${auditState[k]?"pill-done":"pill-todo"}`} onClick={()=>toggleDoc(k)}>
                                {auditState[k]?"✓":"○"} {doc}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ CALENDRIER ══ */}
        {activeModule === "calendrier" && (
          <div className="module-content">
            <h2 style={{fontSize:17,fontWeight:600,marginBottom:4}}>Calendrier Fiscal 2026</h2>
            <p style={{fontSize:12,color:"var(--text2)",marginBottom:20}}>Échéances fiscales & sociales — Burkina Faso</p>
            <div style={{maxWidth:700}}>
              {["danger","warning","info"].map(type=>{
                const evs=FISCAL_EVENTS.filter(e=>e.type===type).sort((a,b)=>a.urgency-b.urgency);
                if(!evs.length) return null;
                return (
                  <div key={type} style={{marginBottom:20}}>
                    <div className="label" style={{marginBottom:7}}>{type==="danger"?"🔴 Urgent (< 14 j)":type==="warning"?"🟡 Proche (< 45 j)":"🔵 À venir"}</div>
                    {evs.map((ev,i)=>(
                      <div key={i} className={`ev-row ev-${type[0]}`}>
                        <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--text2)",minWidth:80,paddingTop:2}}>{ev.date}</div>
                        <div style={{flex:1,fontSize:13}}>{ev.label}</div>
                        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                          <span style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:20,padding:"1px 7px",fontSize:9,color:"var(--text2)",fontFamily:"var(--mono)"}}>{ev.freq}</span>
                          <span style={{borderRadius:20,padding:"1px 7px",fontSize:9,fontFamily:"var(--mono)",background:type==="danger"?"#200a0a":type==="warning"?"#201408":"#071428",color:type==="danger"?"#d05050":type==="warning"?"#c08020":"#3a80a8"}}>J-{ev.urgency}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <div style={{marginTop:20,maxWidth:700}} className="card">
              <div className="label">Pénalités de retard — CGI Burkina Faso</div>
              {[["Dépôt tardif DSF","5% des droits + 1%/mois"],["Non-paiement TVA","25% majoration + 2%/mois"],["Retard IS","10% + intérêts moratoires"],["CNSS hors délai","5% + 1%/mois supplémentaire"]].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,padding:"8px 0",borderBottom:"1px solid var(--border)",fontSize:12}}>
                  <span style={{color:"var(--text1)"}}>{k}</span>
                  <span style={{color:"#c05840",fontFamily:"var(--mono)",fontSize:11}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ CONVERTISSEUR ══ */}
        {activeModule === "convertisseur" && (
          <div className="module-content">
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4,flexWrap:"wrap"}}>
              <h2 style={{fontSize:17,fontWeight:600}}>Convertisseur de devises</h2>
              {ratesLoading && <span style={{fontSize:10,color:"var(--text3)",fontFamily:"var(--mono)"}}>⟳ Actualisation...</span>}
              {!ratesLoading&&liveRates&&!ratesError&&<span style={{fontSize:10,color:"var(--green)",fontFamily:"var(--mono)"}}>✓ Taux en temps réel</span>}
              {ratesError&&<span style={{fontSize:10,color:"var(--amber)",fontFamily:"var(--mono)"}}>⚠ Taux de référence</span>}
            </div>
            <p style={{fontSize:11,color:"var(--text3)",fontFamily:"var(--mono)",marginBottom:16}}>
              Taux fixe XOF/EUR : 1 EUR = {FIXED_XOF_EUR.toLocaleString("fr-FR")} XOF (UMOA)
            </p>

            <div style={{maxWidth:600}} className="card">
              <div style={{marginBottom:16}}>
                <label className="label">Montant</label>
                <input className="inp" type="number" value={amount} min="0"
                  onChange={e=>{setAmount(e.target.value);setConverted(null);}}
                  placeholder="Ex : 1 000 000" style={{fontSize:16}} />
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 36px 1fr",gap:10,alignItems:"start",marginBottom:16}}>
                <CurrencyPicker label="Devise source" value={fromCur} search={sfrom} setSearch={setSfrom}
                  show={showSfrom} setShow={setShowSfrom} allCurrencies={ALL_CURRENCIES}
                  onChange={c=>{setFromCur(c);setSfrom("");setShowSfrom(false);setConverted(null);}} getCurr={getCurr} />
                <button className="btn-ghost" style={{marginTop:26,padding:"7px",justifyContent:"center",display:"flex",borderRadius:7,border:"1px solid var(--border)"}}
                  title="Inverser" onClick={()=>{const t=fromCur;setFromCur(toCur);setToCur(t);setConverted(null);}}>⇄</button>
                <CurrencyPicker label="Devise cible" value={toCur} search={sto} setSearch={setSto}
                  show={showSto} setShow={setShowSto} allCurrencies={ALL_CURRENCIES}
                  onChange={c=>{setToCur(c);setSto("");setShowSto(false);setConverted(null);}} getCurr={getCurr} />
              </div>
              <button className="btn-primary" style={{width:"100%"}} disabled={ratesLoading||!amount} onClick={convert}>
                {ratesLoading?"⟳ Chargement...":amount?`Convertir ${parseFloat(amount).toLocaleString("fr-FR")} ${fromCur} → ${toCur}`:"Convertir"}
              </button>
              {converted !== null && (
                <div className="fade-up" style={{marginTop:14,padding:16,background:"linear-gradient(135deg,#060f08,#07101a)",border:"1px solid #102018",borderRadius:10,textAlign:"center"}}>
                  <div className="label" style={{marginBottom:6}}>Résultat</div>
                  <div style={{fontSize:22,fontWeight:300,color:"var(--green)",fontFamily:"var(--mono)",wordBreak:"break-all"}}>
                    {converted.toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2})} {toCur}
                  </div>
                  <div style={{fontSize:11,color:"var(--text2)",marginTop:5}}>1 {fromCur} = {rateStr(fromCur,toCur)} {toCur}</div>
                </div>
              )}
            </div>

            <div style={{marginTop:20,maxWidth:600}}>
              <div className="label">Taux clés vs XOF</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:6}}>
                {["USD","EUR","GBP","NGN","GHS","MAD","CNY","SAR","AED"].map(code=>{
                  const r=R();
                  const v=(code==="EUR")?FIXED_XOF_EUR:(r["XOF"]||FIXED_XOF_EUR)/(r[code]||1);
                  const c=getCurr(code);
                  return (
                    <div key={code} className="card-sm" style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer"}}
                      onClick={()=>{setFromCur(code);setToCur("XOF");}}>
                      <span style={{fontSize:15}}>{c.flag}</span>
                      <div>
                        <div style={{fontSize:9,color:"var(--text3)",fontFamily:"var(--mono)"}}>{code}</div>
                        <div style={{fontSize:12,color:"var(--accent)",fontFamily:"var(--mono)"}}>{v.toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ DELETE CONFIRM MODAL ══ */}
      {deleteConfirmItem && (
        <div className="modal-overlay" onClick={()=>setDeleteConfirmItem(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:28,marginBottom:12}}>⚠️</div>
            <h3 style={{fontSize:15,marginBottom:8,color:"var(--amber)"}}>Confirmation de suppression</h3>
            <p style={{fontSize:13,color:"var(--text2)",marginBottom:6}}>
              Vous êtes sur le point de supprimer :
            </p>
            <p style={{fontSize:13,color:"var(--text0)",marginBottom:8,padding:"8px 12px",background:"var(--bg3)",borderRadius:7,wordBreak:"break-all"}}>
              « {deleteConfirmItem.label} »
            </p>
            <p style={{fontSize:11,color:"var(--red)",marginBottom:20,fontFamily:"var(--mono)"}}>
              ⚠ Cette action est irréversible.
            </p>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button className="btn-ghost" onClick={()=>setDeleteConfirmItem(null)}>Annuler</button>
              <button style={{background:"linear-gradient(135deg,#3a0a0a,#280808)",border:"1px solid #5a2020",color:"var(--red)",borderRadius:9,padding:"9px 18px",cursor:"pointer",fontFamily:"inherit",fontSize:13}}
                onClick={confirmDelete}>Supprimer définitivement</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

function ConvItem({ conv, active, onSelect, onRename, onDelete, onPin, editing, editVal, onEditChange, onEditCommit }) {
  return (
    <div className={`conv-item${active?" active":""}`} onClick={onSelect}>
      <div style={{ flex:1, minWidth:0 }}>
        {editing ? (
          <input
            style={{ background:"transparent", border:"none", outline:"1px solid var(--border2)", borderRadius:4, color:"var(--text0)", fontFamily:"inherit", fontSize:12, width:"100%", padding:"2px 4px" }}
            value={editVal} onChange={e=>onEditChange(e.target.value)}
            onBlur={onEditCommit} onKeyDown={e=>{ if(e.key==="Enter") onEditCommit(); if(e.key==="Escape") onEditCommit(); }}
            autoFocus onClick={e=>e.stopPropagation()} />
        ) : (
          <div style={{ fontSize:12, fontWeight:active?500:400, color:active?"var(--text0)":"var(--text1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {conv.pinned && <span style={{marginRight:4,fontSize:10}}>📌</span>}
            {conv.title}
          </div>
        )}
        <div style={{ fontSize:9, color:"var(--text3)", fontFamily:"var(--mono)", marginTop:2 }}>
          {fmtDateShort(conv.updatedAt)} · {conv.messageCount} msg
        </div>
      </div>
      <div className="conv-item-actions" onClick={e=>e.stopPropagation()}>
        <button className="btn-icon" style={{fontSize:11}} title="Épingler" onClick={onPin}>{conv.pinned?"📌":"📍"}</button>
        <button className="btn-icon" style={{fontSize:11}} title="Renommer" onClick={onRename}>✏️</button>
        <button className="btn-icon btn-danger" style={{fontSize:11}} title="Supprimer" onClick={onDelete}>🗑️</button>
      </div>
    </div>
  );
}

function CurrencyPicker({ label, value, search, setSearch, show, setShow, allCurrencies, onChange, getCurr }) {
  const filtered = allCurrencies.filter(c =>
    c.code.toLowerCase().includes(search.toLowerCase()) || c.name.toLowerCase().includes(search.toLowerCase())
  );
  const curr = getCurr(value);
  return (
    <div style={{ position:"relative" }}>
      <label style={{ fontSize:10, color:"var(--text3)", fontFamily:"var(--mono)", textTransform:"uppercase", letterSpacing:".1em", marginBottom:6, display:"block" }}>{label}</label>
      <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:8, padding:"7px 10px", marginBottom:5, display:"flex", alignItems:"center", gap:6 }}>
        <span style={{fontSize:14}}>{curr.flag}</span>
        <span style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--accent)"}}>{curr.code}</span>
        <span style={{fontSize:11,color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{curr.name}</span>
      </div>
      <input style={{ background:"var(--bg1)", border:"1px solid var(--border)", borderRadius:7, padding:"7px 10px", color:"var(--text0)", fontFamily:"inherit", fontSize:12, outline:"none", width:"100%" }}
        placeholder="🔍 Rechercher..." value={search}
        onChange={e=>{setSearch(e.target.value);setShow(true);}}
        onFocus={()=>setShow(true)} />
      {show && search && (
        <div className="dropdown">
          {filtered.slice(0,24).map(c=>(
            <div key={c.code} className={`drop-opt${value===c.code?" sel":""}`} onMouseDown={()=>onChange(c.code)}>
              <span style={{fontSize:14}}>{c.flag}</span>
              <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--accent)",minWidth:32}}>{c.code}</span>
              <span style={{fontSize:11,color:"var(--text2)"}}>{c.name}</span>
            </div>
          ))}
          {filtered.length===0&&<div style={{padding:"10px 12px",fontSize:12,color:"var(--text3)"}}>Aucun résultat</div>}
        </div>
      )}
    </div>
  );
}
