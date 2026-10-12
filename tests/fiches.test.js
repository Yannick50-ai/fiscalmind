/**
 * Fiches R1–R4 + RECEVABILITÉ — Phase 8.
 *
 * Couverture : R1 complète / incomplète (champs obligatoires), R2/R3
 * (dirigeants/associés), R4 (statuts par défaut + surcharges), recevabilité
 * (bilan équilibré → ok, champ R1 manquant → ko, XI≠CJ → ko).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFiches, buildR1, buildR2, buildR3, buildR4, buildRecevabilite,
  R1_OBLIGATOIRES, NOTES_STATUTS,
} from '../src/engine/fiches.js';
import { NOTES_TITRES } from '../src/engine/notes.js';
import { bilanModele2 } from '../src/engine/bilan-modele2.js';
import { compteResultatSIG } from '../src/engine/compte-resultat-sig.js';

const L = (compte, debit, credit) => ({ compte, debit, credit });
const E = (id, date, lignes) => ({ id, date, journal: 'OD', piece: id, libelle: id, lignes });

/** Jeu équilibré : immo 244 (500 000) + vente 701 (200 000). */
const BALANCED = [
  E('e1', '2025-01-01', [L('244', 500000, 0), L('521', 0, 500000)]),
  E('e2', '2025-04-01', [L('411', 200000, 0), L('701', 0, 200000)]),
];

const COMPANY_OK = {
  nom: 'Fiches SARL', sigle: 'FS', adresse: 'Ouagadougou, Burkina Faso',
  rccm: 'BF-OUA-2025-B-12345', nif: '00123456A', regime: 'BIC',
  exerciceDebut: '2025-01-01', exerciceFin: '2025-12-31',
  telephone: '+226 70 00 00 00', email: 'contact@fiches.bf',
  expertNom: 'Cabinet Compta', expertContact: '+226 25 00 00 00',
};

/* ---------------- R1 ---------------- */

test('R1 complète : 11 champs, exercice JJ/MM/AAAA, expert présent', () => {
  const r1 = buildR1(COMPANY_OK);
  assert.equal(r1.length, 11);
  const by = Object.fromEntries(r1.map((r) => [r.champ, r]));
  assert.equal(by['Dénomination sociale'].valeur, 'Fiches SARL');
  assert.equal(by['Exercice (début – fin)'].valeur, '01/01/2025 – 31/12/2025');
  assert.equal(by['Expert-comptable — nom'].valeur, 'Cabinet Compta');
  assert.equal(by['Expert-comptable — nom'].obligatoire, false);
  assert.ok(R1_OBLIGATOIRES.includes('RCCM'));
  assert.ok(!R1_OBLIGATOIRES.includes('Expert-comptable — nom'));
});

test('R1 incomplète : champs obligatoires vides détectés', () => {
  const r1 = buildR1({ nom: 'SARL X' });
  const manquants = r1.filter((r) => r.obligatoire && !r.valeur);
  assert.ok(manquants.length >= 8, 'la plupart des champs obligatoires manquent');
  assert.ok(manquants.some((r) => r.champ === 'RCCM'));
});

test('R1 : valeurs nulles/undefined → chaîne vide, pas d’exception', () => {
  const r1 = buildR1(null);
  assert.equal(r1.length, 11);
  assert.ok(r1.every((r) => r.valeur === ''));
});

/* ---------------- R2 / R3 ---------------- */

test('R2 : dirigeants normalisés, lignes vides ignorées', () => {
  const r2 = buildR2([
    { nom: 'Yannick O.', qualite: 'Gérant', contact: '70 00 00 00' },
    { nom: '  ', qualite: '', contact: '' },
  ]);
  assert.equal(r2.length, 1);
  assert.deepEqual(r2[0], { nom: 'Yannick O.', qualite: 'Gérant', contact: '70 00 00 00' });
});

test('R3 : associés avec parts', () => {
  const r3 = buildR3([{ nom: 'Awa D.', qualite: 'Associée', part: '60 %' }]);
  assert.equal(r3.length, 1);
  assert.equal(r3[0].part, '60 %');
});

/* ---------------- R4 ---------------- */

test('R4 : une ligne par note, titres issus de NOTES_TITRES', () => {
  const r4 = buildR4();
  assert.equal(r4.length, NOTES_TITRES.length);
  assert.ok(r4.length >= 36, 'au moins les 36 notes');
  const n3a = r4.find((n) => n.numero === '3A');
  assert.ok(n3a && n3a.titre.includes('Immobilisations'), n3a && n3a.titre);
  assert.equal(n3a.statutCode, 'chiffree');
  assert.equal(n3a.statut, 'Chiffrée');
  const n1 = r4.find((n) => n.numero === '1');
  assert.equal(n1.statutCode, 'non_chiffree', 'note manuelle → Non chiffrée par défaut');
});

test('R4 : surcharge de statut via notesStatus', () => {
  const r4 = buildR4({ '3A': 'non_applicable', '1': 'chiffree', '9': 'bidon' });
  const by = Object.fromEntries(r4.map((n) => [n.numero, n]));
  assert.equal(by['3A'].statut, 'Non applicable');
  assert.equal(by['1'].statut, 'Chiffrée');
  assert.equal(by['9'].statutCode, 'chiffree', 'statut invalide → défaut calculée');
});

test('NOTES_STATUTS : trois statuts valides', () => {
  assert.deepEqual(NOTES_STATUTS, ['chiffree', 'non_chiffree', 'non_applicable']);
});

/* ---------------- RECEVABILITÉ ---------------- */

test('recevabilité : bilan équilibré → ok, XI == CJ → ok', () => {
  const bilan = bilanModele2(BALANCED, { year: 2025 });
  const cr = compteResultatSIG(BALANCED, { year: 2025 });
  assert.ok(bilan.controles.actifEqPassif, 'le jeu est équilibré');
  const fiches = buildFiches({
    company: COMPANY_OK, bilan, cr,
    dirigeants: [{ nom: 'Yannick O.', qualite: 'Gérant' }],
  });
  const by = Object.fromEntries(fiches.recevabilite.map((c) => [c.controle, c]));
  assert.equal(by['Fiche R1 — identification complète'].ok, true);
  assert.equal(by['Fiches R2/R3 — dirigeants renseignés'].ok, true);
  assert.equal(by['Bilan équilibré (Actif = Passif)'].ok, true);
  assert.equal(by['Cohérence résultat (CR XI = Bilan CJ)'].ok, true);
  assert.equal(by['Notes annexes chiffrées (R4)'].ok, true);
  assert.ok(fiches.recevabilite.every((c) => c.ok === true), 'tout est vert');
});

test('recevabilité : champ R1 manquant → ko avec détail', () => {
  const { telephone, ...sansTel } = COMPANY_OK;
  const fiches = buildFiches({ company: sansTel, bilan: null, cr: null });
  const r1 = fiches.recevabilite.find((c) => c.controle === 'Fiche R1 — identification complète');
  assert.equal(r1.ok, false);
  assert.ok(r1.detail.includes('Téléphone'), r1.detail);
  // Sans bilan/CR : contrôles non calculables (ok null), pas de plantage.
  const bil = fiches.recevabilite.find((c) => c.controle === 'Bilan équilibré (Actif = Passif)');
  assert.equal(bil.ok, null);
  assert.ok(bil.detail.includes('non calculé'));
  const coh = fiches.recevabilite.find((c) => c.controle === 'Cohérence résultat (CR XI = Bilan CJ)');
  assert.equal(coh.ok, null);
});

test('recevabilité : aucun dirigeant → ko', () => {
  const fiches = buildFiches({ company: COMPANY_OK });
  const r23 = fiches.recevabilite.find((c) => c.controle === 'Fiches R2/R3 — dirigeants renseignés');
  assert.equal(r23.ok, false);
});

test('recevabilité : écart XI≠CJ détecté', () => {
  const bilan = bilanModele2(BALANCED, { year: 2025 });
  const cr = compteResultatSIG(BALANCED, { year: 2025 });
  const coh = buildRecevabilite({
    company: COMPANY_OK,
    r4: buildR4(),
    bilan: Object.assign({}, bilan, { resNet: bilan.resNet + 1000 }),
    cr,
  });
  const c = coh.find((x) => x.controle === 'Cohérence résultat (CR XI = Bilan CJ)');
  assert.equal(c.ok, false);
  assert.ok(c.detail.includes('≠'), c.detail);
});

test('recevabilité : aucune note chiffrée → ko', () => {
  const r4 = buildR4(Object.fromEntries(NOTES_TITRES.map((t) => [t.numero, 'non_applicable'])));
  const rec = buildRecevabilite({ company: COMPANY_OK, r4 });
  const c = rec.find((x) => x.controle === 'Notes annexes chiffrées (R4)');
  assert.equal(c.ok, false);
});
