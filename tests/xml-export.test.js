/**
 * Tests de src/engine/xml-export.js — node:test, zéro dépendance.
 *
 * Règles vérifiées (inspirées du XmlMap EDI_Mappage, IKA Conseil) :
 *  - seuls les champs non vides sont exportés (zéros omis) ;
 *  - montants en FCFA entiers (arrondis) ;
 *  - dates au format jj/mm/aaaa ;
 *  - nom de fichier NO-{exercice}-{ncc}-{aaaammjj}.xml ;
 *  - XML bien formé (contrôle d'équilibre des balises).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDgiXml, buildNote, dgiFilename, escXml, intFcfa, isEmptyAmount,
  fmtDateFR, fmtDateFile, sanitizeNcc,
} from '../src/engine/xml-export.js';

/** Contrôle simple de bonne formation : équilibre des balises ouvrantes/fermantes. */
function checkWellFormed(xml) {
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'déclaration XML');
  const tags = xml.match(/<\/?[A-Za-z][A-Za-z0-9]*(\s[^>]*)?>/g) || [];
  const stack = [];
  for (const t of tags) {
    if (t.startsWith('</')) {
      const name = t.slice(2, -1);
      assert.ok(stack.length > 0, 'fermeture sans ouverture : ' + name);
      assert.equal(stack.pop(), name, 'balises imbriquées correctement');
    } else if (!t.endsWith('/>')) {
      stack.push(t.slice(1, t.includes(' ') ? t.indexOf(' ') : -1));
    }
  }
  assert.equal(stack.length, 0, 'toutes les balises sont fermées : ' + stack.join(','));
}

const COMPANY = { name: 'ETS AFRICATEX', ncc: 'BF OUA 2025 B00123', rccm: 'BF OUA 2003 A 3167', regime: 'BIC', country: 'BF' };
const BILAN = {
  actif: [
    { ref: 'AA', label: 'Immobilisations', brut: 600000, amort: 60000, netN: 540000, netN1: 0 },
    { ref: 'AB', label: 'Vide', brut: 0, amort: 0, netN: 0, netN1: 0 },
  ],
  passif: [
    { ref: 'CA', label: 'Capital', brut: null, amort: null, netN: 2000000, netN1: 0 },
  ],
};
const CR = { lignes: [
  { ref: 'TA', label: 'Ventes', n: 1000000.4, n1: 0 },
  { ref: 'TB', label: 'Nul', n: 0, n1: 0 },
] };
const TFT = { lignes: [{ ref: 'ZA', label: 'Tréso début', n: 700000, n1: -200000 }] };
const NOTES = [{
  numero: '3A', titre: 'Immobilisations', statut: 'calculee', formulaire: [],
  lignes: [
    { label: 'Machines', compte: '244', ouverture: 600000, plus: 0, moins: 0, cloture: 600000 },
    { label: 'Rien', compte: '245', ouverture: 0, plus: 0, moins: 0, cloture: 0 },
  ],
}];

describe('helpers', () => {
  it('escXml échappe les caractères spéciaux', () => {
    assert.equal(escXml('A&B <C> "D"'), 'A&amp;B &lt;C&gt; &quot;D&quot;');
  });
  it('intFcfa : entiers arrondis, null pour vide/nul', () => {
    assert.equal(intFcfa(1000000.4), '1000000');
    assert.equal(intFcfa(1000000.5), '1000001');
    assert.equal(intFcfa(-180000.2), '-180000');
    assert.equal(intFcfa(0), null);
    assert.equal(intFcfa(null), null);
    assert.equal(intFcfa(''), null);
  });
  it('isEmptyAmount : vide / nul / non numérique', () => {
    assert.ok(isEmptyAmount(0));
    assert.ok(isEmptyAmount(''));
    assert.ok(isEmptyAmount(null));
    assert.ok(!isEmptyAmount(12));
    assert.ok(!isEmptyAmount(-3));
  });
  it('fmtDateFR : jj/mm/aaaa', () => {
    assert.equal(fmtDateFR(new Date(2026, 9, 8)), '08/10/2026');
    assert.equal(fmtDateFR('2025-01-05'), '05/01/2025');
  });
  it('fmtDateFile : aaaammjj', () => {
    assert.equal(fmtDateFile(new Date(2026, 9, 8)), '20261008');
  });
  it('sanitizeNcc : alphanumérique, zéros conservés', () => {
    assert.equal(sanitizeNcc('BF OUA 2025 B00123'), 'BFOUA2025B00123');
    assert.equal(sanitizeNcc(''), 'SANSNCC');
  });
  it('dgiFilename : NO-{exercice}-{ncc}-{aaaammjj}.xml', () => {
    const f = dgiFilename({ year: 2025, ncc: 'BF OUA 2025 B00123', date: new Date(2026, 9, 8) });
    assert.equal(f, 'NO-2025-BFOUA2025B00123-20261008.xml');
  });
});

describe('buildDgiXml', () => {
  const res = buildDgiXml({ company: COMPANY, year: 2025, bilan: BILAN, cr: CR, tft: TFT, notes: NOTES, date: '2026-10-08' });

  it('XML bien formé', () => { checkWellFormed(res.xml); });
  it('nom de fichier conforme', () => {
    assert.equal(res.filename, 'NO-2025-BFOUA2025B00123-20261008.xml');
  });
  it('en-tête : identification exportée, exercice/devise/date présents', () => {
    assert.ok(res.xml.includes('<RaisonSociale>ETS AFRICATEX</RaisonSociale>'));
    assert.ok(res.xml.includes('<NCC>BF OUA 2025 B00123</NCC>'), 'zéros initiaux conservés en texte');
    assert.ok(res.xml.includes('<Exercice>2025</Exercice>'));
    assert.ok(res.xml.includes('<Devise>XOF</Devise>'));
    assert.ok(res.xml.includes('<DateGeneration>08/10/2026</DateGeneration>'));
  });
  it('lignes nulles omises (bilan AA exportée, AB omise)', () => {
    assert.ok(res.xml.includes('ref="AA"'));
    assert.ok(!res.xml.includes('ref="AB"'), 'ligne AB (tous zéros) omise');
    assert.ok(res.xml.includes('ref="CA"'));
  });
  it('montants en FCFA entiers, sous-champs nuls omis dans la ligne', () => {
    const aa = res.xml.match(/<Ligne ref="AA"[^>]*>.*?<\/Ligne>/)[0];
    assert.ok(aa.includes('<Brut>600000</Brut>'));
    assert.ok(aa.includes('<NetN1>') === false, 'NetN1 = 0 omis dans la ligne AA');
    assert.ok(res.xml.includes('<N>1000000</N>'), '1000000.4 arrondi à 1000000');
  });
  it('CR : TA exportée, TB (nulle) omise ; TFT : ZA exportée avec N et N1', () => {
    assert.ok(res.xml.includes('ref="TA"'));
    assert.ok(!res.xml.includes('ref="TB"'));
    assert.ok(res.xml.includes('<N>700000</N><N1>-200000</N1>'));
  });
  it('notes : ligne vide omise, ligne non vide exportée', () => {
    assert.ok(res.xml.includes('<Note numero="3A"'));
    assert.ok(res.xml.includes('compte="244"'));
    assert.ok(!res.xml.includes('compte="245"'), 'ligne note à zéro omise');
  });
  it('stats cohérentes', () => {
    assert.equal(res.stats.lignesBilan, 2);
    assert.equal(res.stats.lignesCR, 1);
    assert.equal(res.stats.lignesTFT, 1);
    assert.equal(res.stats.notes, 1);
    assert.ok(res.stats.champsOmits > 0);
  });
  it('champs d’identification vides omis', () => {
    const r = buildDgiXml({ company: { name: 'X', ncc: '' }, year: 2025, date: '2026-10-08' });
    assert.ok(!r.xml.includes('<RCCM>'));
    assert.ok(!r.xml.includes('<NCC>'));
    checkWellFormed(r.xml);
  });
  it('échappement dans les libellés', () => {
    const r = buildDgiXml({
      company: { name: 'A & B <SARL>' }, year: 2025, date: '2026-10-08',
      bilan: { actif: [{ ref: 'AA', label: 'X', brut: 1, amort: 0, netN: 1, netN1: 0 }], passif: [] },
    });
    assert.ok(r.xml.includes('<RaisonSociale>A &amp; B &lt;SARL&gt;</RaisonSociale>'));
    checkWellFormed(r.xml);
  });
});

describe('buildNote', () => {
  it('note manuelle : champs remplis exportés, vides omis', () => {
    const el = buildNote({
      numero: '1', titre: 'Dettes', statut: 'manuelle', lignes: [],
      formulaire: [
        { key: 'cap', label: 'Capital', type: 'text', value: 'SARL' },
        { key: 'vide', label: 'Vide', type: 'text', value: '' },
      ],
    }, { count: 0 });
    assert.ok(el.includes('<Champ cle="cap"'));
    assert.ok(!el.includes('cle="vide"'));
  });
  it('note entièrement vide → null', () => {
    assert.equal(buildNote({ numero: '5', titre: 'T', statut: 'manuelle', lignes: [], formulaire: [] }, { count: 0 }), null);
  });
});
