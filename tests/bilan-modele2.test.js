/**
 * Tests de src/engine/bilan-modele2.js (Bilan modèle 2 OHADA, Phase 1) —
 * node:test, zéro dépendance.
 *
 * Couvre :
 *  1. les ventilations critiques du classeur DSF sur un montage comptable
 *     synthétique équilibré (40 déb/créd, 41 déb/créd, 419→DI, 478→BU,
 *     479→DV, 28/29 en colonne Amort, soustractions 2181 / 245 / 2495,
 *     52/53 créditeur→DR) ;
 *  2. les sous-totaux AD/AI/AQ/AZ/BG/BK/BT/BZ et CP/DD/DF/DP/DT/DZ ;
 *  3. le Net N-1 calculé depuis les à-nouveaux 2024 des données de démo
 *     réelles (demo-data-2024-2025.json) ;
 *  4. le contrôle Actif = Passif (vrai sur données équilibrées ; l'écart
 *     constaté sur la démo 2025 est documenté : les à-nouveaux 2024
 *     reprennent des comptes 6/7/8 non soldés).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { bilanModele2 } from '../src/engine/bilan-modele2.js';

const L = (compte, debit, credit) => ({ compte, debit, credit });

// Montage comptable équilibré (débits = crédits = 3 300 000) conçu pour
// exercer chaque ventilation du classeur.
const ENTRIES = [{
  id: 't1', date: '2025-06-15', journal: 'OD', piece: 'T1', libelle: 'Test ventilation modèle 2',
  lignes: [
    L('521', 1000000, 0), L('101', 0, 1000000),
    L('211', 500000, 0), L('521', 0, 500000),
    L('681', 100000, 0), L('2811', 0, 100000),
    L('2451', 800000, 0), L('521', 0, 800000),
    L('681', 200000, 0), L('2845', 0, 200000),
    L('2444', 300000, 0), L('521', 0, 300000),
    L('681', 50000, 0), L('2844', 0, 50000),
    L('401', 25000, 0), L('521', 0, 25000),
    L('601', 60000, 0), L('404', 0, 60000),
    L('411', 100000, 0), L('701', 0, 100000),
    L('701', 30000, 0), L('419', 0, 30000),
    L('471', 20000, 0), L('521', 0, 20000),
    L('478', 10000, 0), L('471', 0, 10000),
    L('621', 50000, 0), L('467', 0, 50000),
    L('657', 15000, 0), L('479', 0, 15000),
    L('601', 40000, 0), L('521', 0, 40000),
  ],
}];

const byRef = (rows) => Object.fromEntries(rows.map((r) => [r.ref, r]));

// Résultat net attendu du montage : Σ(mc−md) 6/7/8
// = (100000−30000) − (100000+50000+15000+350000) = −445000
const RES_NET = -445000;

describe('bilanModele2 — immobilisations (Brut / Amort / Net)', () => {
  const b = bilanModele2(ENTRIES, { year: 2025 });
  const A = byRef(b.actif);

  it('AE : 211+2181 en brut, 2811+2911 en amort', () => {
    assert.equal(A.AE.brut, 500000);
    assert.equal(A.AE.amort, 100000);
    assert.equal(A.AE.netN, 400000);
  });
  it('AN : 245/2495 isolés du 24 (brut et amort)', () => {
    assert.equal(A.AN.brut, 800000);
    assert.equal(A.AN.amort, 200000);
    assert.equal(A.AN.netN, 600000);
  });
  it('AM : 24 − 245 − 2495 (2444 reste en AM)', () => {
    assert.equal(A.AM.brut, 300000);
    assert.equal(A.AM.amort, 50000); // 2844 : 284 − 2845
    assert.equal(A.AM.netN, 250000);
  });
  it('AD = AE+AF+AG+AH et AI = AJ+AK+AL+AM+AN (détail exposé)', () => {
    assert.deepEqual(A.AD.detail, ['AE', 'AF', 'AG', 'AH']);
    assert.equal(A.AD.netN, A.AE.netN + A.AF.netN + A.AG.netN + A.AH.netN);
    assert.deepEqual(A.AI.detail, ['AJ', 'AK', 'AL', 'AM', 'AN']);
    assert.equal(A.AI.netN, 850000);
    assert.equal(A.AZ.netN, A.AD.netN + A.AP.netN + A.AI.netN + A.AQ.netN);
    assert.equal(A.AZ.netN, 1250000);
  });
  it('AZ = AD+AP+AI+AQ sur les colonnes Brut et Amort aussi', () => {
    assert.equal(A.AZ.brut, 500000 + 300000 + 800000);
    assert.equal(A.AZ.amort, 100000 + 50000 + 200000);
  });
});

describe('bilanModele2 — ventilations par sens (actif circulant)', () => {
  const b = bilanModele2(ENTRIES, { year: 2025 });
  const A = byRef(b.actif);
  const P = byRef(b.passif);

  it('40 débiteur → BH, 40 créditeur → DJ', () => {
    assert.equal(A.BH.netN, 25000);
    assert.equal(P.DJ.netN, 60000);
  });
  it('41 débiteur → BI, 419 exclu de BI et basculé en DI', () => {
    assert.equal(A.BI.netN, 100000); // 419 créditeur exclu
    assert.equal(P.DI.netN, 30000); // 419 créditeur
  });
  it('478 exclu de BJ et isolé en BU', () => {
    assert.equal(A.BJ.netN, 10000); // 471 : 20000 − 10000
    assert.equal(A.BU.netN, 10000);
    assert.equal(A.BU.brut, 10000);
    assert.equal(A.BU.amort, 0);
  });
  it('479 exclu de DM et isolé en DV', () => {
    assert.equal(P.DM.netN, 50000); // 467 seul
    assert.equal(P.DV.netN, 15000);
  });
  it('52/53 créditeur → DR (trésorerie-passif), pas en BS', () => {
    assert.equal(A.BS.brut, 0); // 521 créditeur : pas de sfd
    assert.equal(P.DR.netN, 685000);
  });
  it('BG = BH+BI+BJ, BK = BA+BB+BG, BT = BQ+BR+BS, BZ = AZ+BK+BT+BU', () => {
    assert.equal(A.BG.netN, 25000 + 100000 + 10000);
    assert.equal(A.BK.netN, A.BA.netN + A.BB.netN + A.BG.netN);
    assert.equal(A.BT.netN, A.BQ.netN + A.BR.netN + A.BS.netN);
    assert.equal(A.BZ.netN, A.AZ.netN + A.BK.netN + A.BT.netN + A.BU.netN);
    assert.equal(A.BZ.netN, 1395000);
  });
});

describe('bilanModele2 — passif et contrôle Actif = Passif', () => {
  const b = bilanModele2(ENTRIES, { year: 2025 });
  const P = byRef(b.passif);

  it('CJ = résultat net injecté ; défaut = resultatNet(mouvN)', () => {
    assert.equal(P.CJ.netN, RES_NET);
    assert.equal(b.resNet, RES_NET);
    const b2 = bilanModele2(ENTRIES, { year: 2025, resNet: 12345 });
    assert.equal(byRef(b2.passif).CJ.netN, 12345);
  });
  it('CP = Σ(CA:CM), DD = DA+DB+DC, DF = CP+DD', () => {
    assert.equal(P.CA.netN, 1000000);
    assert.equal(P.CP.netN, 1000000 + RES_NET);
    assert.equal(P.DD.netN, 0);
    assert.equal(P.DF.netN, P.CP.netN + P.DD.netN);
    assert.deepEqual(P.CP.detail, ['CA', 'CB', 'CD', 'CE', 'CF', 'CG', 'CH', 'CJ', 'CL', 'CM']);
  });
  it('DP = Σ(DH:DN), DT = DQ+DR, DZ = DF+DP+DT+DV', () => {
    assert.equal(P.DP.netN, P.DH.netN + P.DI.netN + P.DJ.netN + P.DK.netN + P.DM.netN + P.DN.netN);
    assert.equal(P.DP.netN, 30000 + 60000 + 50000);
    assert.equal(P.DT.netN, P.DQ.netN + P.DR.netN);
    assert.equal(P.DZ.netN, P.DF.netN + P.DP.netN + P.DT.netN + P.DV.netN);
    assert.equal(P.DZ.netN, 1395000);
  });
  it('contrôle Actif = Passif vrai sur données équilibrées', () => {
    assert.equal(b.controles.actifEqPassif, true);
    assert.equal(b.controles.ecart, 0);
    assert.equal(b.totaux.netAN, b.totaux.netPN);
    assert.equal(b.totaux.netAN, 1395000);
  });
});

describe('bilanModele2 — Net N-1 depuis les à-nouveaux 2024 (données de démo)', () => {
  const demoPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'demo-data-2024-2025.json');
  const demoEntries = JSON.parse(readFileSync(demoPath, 'utf8')).ecritures;
  const b = bilanModele2(demoEntries, { year: 2025 });
  const A = byRef(b.actif);
  const P = byRef(b.passif);

  it('CA netN1 = capital 2024 (101 créditeur)', () => {
    assert.equal(P.CA.netN1, 254834213);
  });
  it('BI netN1 = clients débiteurs 2024 ; BH netN1 = 0 (401 créditeur)', () => {
    assert.equal(A.BI.netN1, 903115);
    assert.equal(A.BH.netN1, 0);
  });
  it('DJ netN1 = fournisseurs créditeurs 2024', () => {
    assert.equal(P.DJ.netN1, 80237721);
  });
  it('BB netN1 = stocks 2024 (31→38)', () => {
    assert.equal(A.BB.netN1, 254058144);
  });
  it('BS netN1 = disponibilités 2024 (521, 5211, 5215 débiteurs)', () => {
    assert.equal(A.BS.netN1, 69074810);
  });
  it('AK totalement amorti : brut = amort (N et N-1)', () => {
    assert.equal(A.AK.brut, A.AK.amort);
    assert.equal(A.AK.netN, 0);
    assert.equal(A.AK.netN1, 0);
  });
  it('BZ netN1 = DZ netN1 (2024 équilibré), écart 2025 documenté', () => {
    assert.equal(A.BZ.netN1, 350251714);
    assert.equal(P.DZ.netN1, 350251714);
    assert.equal(b.controles.actifEqPassifN1, true);
    // 2025 : les à-nouveaux 2024 reprennent des 6/7/8 non soldés → l'écart
    // vaut exactement le résultat 2024 (6 655 943). Comportement identique
    // au bilanData actuel ; pas un bug du moteur.
    assert.equal(b.controles.actifEqPassif, false);
    assert.equal(b.controles.ecart, 6655943);
    assert.equal(b.resNetN1, 6655943);
  });
});

describe('bilanModele2 — robustesse', () => {
  it('year invalide → erreur explicite', () => {
    assert.throws(() => bilanModele2([], { year: 'abc' }), /year/);
    assert.throws(() => bilanModele2([], {}), /year/);
  });
  it('aucune écriture → zéros et bilan équilibré', () => {
    const b = bilanModele2([], { year: 2025 });
    assert.equal(b.totaux.netAN, 0);
    assert.equal(b.totaux.netPN, 0);
    assert.equal(b.controles.actifEqPassif, true);
    assert.equal(b.actif.length, 29);
    assert.equal(b.passif.length, 28);
  });
  it('ordre officiel des refs (actif AE→BZ, passif CA→DZ)', () => {
    const b = bilanModele2([], { year: 2025 });
    assert.deepEqual(b.actif.map((r) => r.ref).slice(0, 5), ['AE', 'AF', 'AG', 'AH', 'AD']);
    assert.equal(b.actif[b.actif.length - 1].ref, 'BZ');
    assert.deepEqual(b.passif.map((r) => r.ref).slice(0, 3), ['CA', 'CB', 'CD']);
    assert.equal(b.passif[b.passif.length - 1].ref, 'DZ');
  });
});
