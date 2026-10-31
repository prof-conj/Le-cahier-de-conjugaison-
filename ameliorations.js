/* ameliorations.js — à charger APRÈS le script principal de index.html
   1) Niveaux scolaires (3e à 6e année) qui limitent les temps et groupes proposés
   2) Séries de 10 ou 20 questions avec écran de résultat détaillé
   3) Mode « Écrire la réponse » (saisie au clavier au lieu du QCM)
   4) Mode « Mes erreurs » : révision des questions ratées (mémorisées sur l'appareil)
   5) Futur proche retiré (on garde le futur simple)
   6) Rappel de la règle quand l'élève se trompe
   7) Bouton « Écouter » (synthèse vocale du téléphone, voix française) */
(function () {
  'use strict';

  /* =====================================================
     RÉGLAGES À ADAPTER AU PROGRAMME
     temps : present, futur, imparfait, passeCompose
     groupes : g1 (-er), g2 (-ir), g3 (autres verbes)
     g3Restreint : si présent, seuls ces verbes du 3e groupe sont proposés
     ===================================================== */
  var NIVEAUX = [
    { cle: '3', court: '3e', label: '3e année', temps: ['present'], groupes: ['g1', 'g3'], g3Restreint: ['être', 'avoir', 'aller'] },
    { cle: '4', court: '4e', label: '4e année', temps: ['present'], groupes: ['g1', 'g3'], g3Restreint: ['être', 'avoir', 'aller'] },
    { cle: '5', court: '5e', label: '5e année', temps: ['present', 'futur'], groupes: ['g1', 'g2', 'g3'] },
    { cle: '6', court: '6e', label: '6e année', temps: ['present', 'futur', 'imparfait', 'passeCompose'], groupes: ['g1', 'g2', 'g3'] }
  ];
  var LONGUEURS = [10, 20];

  var CLE_ERR = 'conj-erreurs';
  var CLE_REG = 'conj-reglages';

  var mode = { saisie: false, erreurs: false, vide: false };
  var serie = null;
  var derniere = null;

  // copie complète des verbes (les niveaux filtrent VERBS sur place)
  var TOUS_VERBES = {};
  Object.keys(VERBS).forEach(function (g) { TOUS_VERBES[g] = VERBS[g].slice(); });

  /* ---------- Outils ---------- */
  function lireJSON(cle, defaut) {
    try { var v = JSON.parse(localStorage.getItem(cle)); return v === null || v === undefined ? defaut : v; }
    catch (e) { return defaut; }
  }
  function ecrireJSON(cle, v) {
    try { localStorage.setItem(cle, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ }
  }
  function lire() { return lireJSON(CLE_ERR, []); }
  function alea(tab) { return tab[Math.floor(Math.random() * tab.length)]; }
  function melanger(tab) { return tab.slice().sort(function () { return Math.random() - 0.5; }); }
  function echapper(t) {
    return String(t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function norm(s) {
    return String(s).trim().toLowerCase().replace(/\s+/g, ' ').replace(/[’‘`]/g, "'");
  }
  // « allé(e)s » accepte allé, allée, allés, allées
  function correspond(saisie, correct) {
    var attendu = norm(correct);
    if (attendu.indexOf('(') < 0) return norm(saisie) === attendu;
    var motif = attendu.replace(/\(e\)/g, '§E').replace(/\(s\)/g, '§S')
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/§E/g, 'e?').replace(/§S/g, 's?');
    return new RegExp('^' + motif + '$').test(norm(saisie));
  }
  function trouver(inf) {
    var g, j;
    for (g in TOUS_VERBES) {
      for (j = 0; j < TOUS_VERBES[g].length; j++) if (TOUS_VERBES[g][j].inf === inf) return TOUS_VERBES[g][j];
    }
    return null;
  }
  function groupeDe(inf) {
    var g, j;
    for (g in TOUS_VERBES) {
      for (j = 0; j < TOUS_VERBES[g].length; j++) if (TOUS_VERBES[g][j].inf === inf) return g;
    }
    return null;
  }

  /* ---------- Futur proche retiré + copies complètes des listes ---------- */
  var k = TENSES.findIndex(function (t) { return t.key === 'futurProche'; });
  if (k >= 0) TENSES.splice(k, 1);
  var TOUS_TEMPS = TENSES.slice();
  var TOUS_GROUPES = GROUPS.slice();

  function libelle(cle) {
    var t = TOUS_TEMPS.filter(function (x) { return x.key === cle; })[0];
    return t ? t.label.toLowerCase() : cle;
  }

  /* ---------- Réglages mémorisés ---------- */
  var reglages = lireJSON(CLE_REG, {});
  if (!NIVEAUX.some(function (n) { return n.cle === reglages.niveau; })) reglages.niveau = '6';
  if (LONGUEURS.indexOf(reglages.longueur) < 0) reglages.longueur = 10;
  function niveauActuel() {
    return NIVEAUX.filter(function (n) { return n.cle === reglages.niveau; })[0];
  }

  function appliquerNiveau() {
    var niv = niveauActuel();
    TENSES.length = 0;
    TOUS_TEMPS.forEach(function (t) { if (niv.temps.indexOf(t.key) >= 0) TENSES.push(t); });
    GROUPS.length = 0;
    TOUS_GROUPES.forEach(function (g) {
      if (niv.groupes.indexOf(g.key) < 0) return;
      if (g.key === 'g3' && niv.g3Restreint) GROUPS.push({ key: 'g3', label: niv.g3Restreint.join(' · ') });
      else GROUPS.push(g);
    });
    VERBS.g3.length = 0;
    TOUS_VERBES.g3.forEach(function (v) {
      if (!niv.g3Restreint || niv.g3Restreint.indexOf(v.inf) >= 0) VERBS.g3.push(v);
    });
    if (!TENSES.some(function (t) { return t.key === state.tense; })) state.tense = TENSES[0].key;
    if (!GROUPS.some(function (g) { return g.key === state.group; })) state.group = GROUPS[0].key;
    var sous = document.querySelector('.subtitle');
    if (sous) sous.textContent = niv.label + " — s'entraîner avec les verbes";
    renderTabs();
    renderGroups();
  }

  /* ---------- Mémoire des erreurs ---------- */
  function noter(ok) {
    var q = state.current;
    if (!q || !q.inf) return;
    var l = lire(), pos = -1, j;
    for (j = 0; j < l.length; j++) {
      if (l[j].inf === q.inf && l[j].tense === q.tense && l[j].i === q.i) { pos = j; break; }
    }
    if (ok && pos >= 0) l.splice(pos, 1);
    if (!ok && pos < 0) l.push({ inf: q.inf, tense: q.tense, i: q.i });
    ecrireJSON(CLE_ERR, l);
    majChips();
  }

  function erreursValides() {
    return lire().filter(function (e) {
      var v = trouver(e.inf);
      return v && v.forms[e.tense];
    });
  }

  function questionErreur(e) {
    var v = trouver(e.inf);
    var formes = v.forms[e.tense];
    var bonne = formes[e.i];
    var pool = formes.filter(function (f, i, a) { return f !== bonne && a.indexOf(f) === i; });
    var essais = 0, autre, f;
    while (pool.length < 3 && essais++ < 60) {
      autre = alea(TOUS_VERBES[alea(Object.keys(TOUS_VERBES))]);
      f = alea(autre.forms[e.tense]);
      if (f !== bonne && pool.indexOf(f) < 0) pool.push(f);
    }
    pool = melanger(pool).slice(0, 3);
    return { verb: v.inf, pronoun: PRONOUNS[e.i], correct: bonne, choices: melanger(pool.concat(bonne)) };
  }

  /* ---------- Séries de questions ---------- */
  function signature() {
    return [reglages.niveau, state.tense, state.group, mode.erreurs ? 1 : 0, reglages.longueur].join('|');
  }

  function initSerie() {
    serie = { n: reglages.longueur, done: 0, file: null, erreurs: [] };
    if (mode.erreurs) {
      var file = melanger(erreursValides()).slice(0, reglages.longueur);
      if (file.length) {
        serie.file = file;
        serie.n = file.length;
      } else {
        mode.erreurs = false;
        mode.vide = true;
        majChips();
      }
    }
    state.score = 0;
    state.total = 0;
    updateScore();
  }

  var buildOrig = buildQuestion;
  window.buildQuestion = function () {
    var q;
    if (mode.erreurs && serie && serie.file) {
      var e = serie.file[serie.done];
      q = questionErreur(e);
      q.tense = e.tense; q.i = e.i; q.inf = e.inf;
      return q;
    }
    q = buildOrig();
    q.tense = state.tense;
    q.i = PRONOUNS.indexOf(q.pronoun);
    q.inf = q.verb;
    return q;
  };

  /* ---------- Rappel de la règle ---------- */
  function expliquer(q) {
    var g = groupeDe(q.inf);
    var irregulier = ['être', 'avoir', 'aller'].indexOf(q.inf) >= 0;
    if (q.tense === 'present') {
      if (irregulier) return '« être », « avoir » et « aller » sont irréguliers : il faut les apprendre par cœur.';
      if (g === 'g1') return 'Au présent, les verbes en -er (1er groupe) se terminent par -e, -es, -e, -ons, -ez, -ent.';
      if (g === 'g2') return 'Au présent, les verbes du 2e groupe (-ir) se terminent par -is, -is, -it, -issons, -issez, -issent.';
      return 'Les verbes du 3e groupe sont irréguliers : il faut les apprendre par cœur.';
    }
    if (q.tense === 'futur') {
      var t = 'Au futur simple, on garde l\'infinitif du verbe et on ajoute : -ai, -as, -a, -ons, -ez, -ont (je parlerai, tu finiras).';
      if (g === 'g3') t += ' Attention : certains verbes changent de radical (être → je serai, aller → j\'irai, avoir → j\'aurai).';
      return t;
    }
    if (q.tense === 'imparfait') {
      if (q.inf === 'être') return '« être » est irrégulier à l\'imparfait : j\'étais, tu étais, il était, nous étions, vous étiez, ils étaient.';
      return 'À l\'imparfait, on part de « nous » au présent (nous parlons → parl-) et on ajoute : -ais, -ais, -ait, -ions, -iez, -aient.';
    }
    if (q.inf === 'aller' || q.inf === 'venir') {
      return 'Avec « aller » et « venir », l\'auxiliaire est « être » (je suis allé(e)) et le participe passé s\'accorde avec le sujet.';
    }
    return 'Passé composé = « avoir » au présent + participe passé (j\'ai parlé, tu as fini). Avec « avoir », le participe passé ne change pas.';
  }

  /* ---------- Écouter la bonne réponse ---------- */
  var voixOk = typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
  function phrase(q) {
    var forme = String(q.correct).replace(/\(e\)/g, '').replace(/\(s\)/g, '');
    var p = q.pronoun === 'il/elle' ? 'il' : q.pronoun === 'ils/elles' ? 'ils' : q.pronoun;
    if (p === 'je' && /^[aeiouhéèêâ]/i.test(forme)) return 'j\'' + forme;
    return p + ' ' + forme;
  }
  function parler(texte) {
    if (!voixOk) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(texte);
      u.lang = 'fr-FR';
      u.rate = 0.85;
      speechSynthesis.speak(u);
    } catch (e) { /* voix indisponible */ }
  }

  function compter(ok, repondu) {
    var q = state.current;
    serie.done++;
    if (!ok) {
      serie.erreurs.push({ pronoun: q.pronoun, verb: q.verb, tense: q.tense, correct: q.correct, repondu: repondu });
    }
    document.getElementById('nextBtn').textContent =
      serie.done >= serie.n ? 'Voir mon résultat →' : 'Question suivante →';
    if (!ok) {
      explication.textContent = expliquer(q);
      explication.style.display = 'block';
    }
    if (ecouter) ecouter.style.display = 'block';
  }

  var selectOrig = selectAnswer;
  window.selectAnswer = function (choix, bouton) {
    if (state.answered) return;
    var avant = state.score;
    selectOrig(choix, bouton);
    var ok = state.score > avant;
    noter(ok);
    compter(ok, choix);
  };

  var timeoutOrig = handleTimeout;
  window.handleTimeout = function () {
    if (state.answered) return;
    timeoutOrig();
    noter(false);
    compter(false, 'temps écoulé');
    bloquerSaisie();
  };

  /* ---------- Mode écriture ---------- */
  function bloquerSaisie() {
    var champ = document.getElementById('saisie');
    var bouton = document.getElementById('saisieOk');
    if (champ) champ.disabled = true;
    if (bouton) bouton.disabled = true;
  }

  function valider() {
    if (state.answered) return;
    var champ = document.getElementById('saisie');
    if (!champ) return;
    if (!champ.value.trim()) { champ.focus(); return; }
    var ok = correspond(champ.value, state.current.correct);
    bloquerSaisie();
    window.selectAnswer(ok ? state.current.correct : champ.value, null);
  }

  function afficherSaisie() {
    var zone = document.getElementById('choices');
    zone.innerHTML = '';
    var champ = document.createElement('input');
    champ.id = 'saisie';
    champ.type = 'text';
    champ.placeholder = 'Écris la forme conjuguée';
    champ.autocomplete = 'off';
    champ.setAttribute('autocapitalize', 'off');
    champ.setAttribute('autocorrect', 'off');
    champ.spellcheck = false;
    champ.setAttribute('aria-label', 'Ta réponse');
    champ.style.cssText = "width:100%;font-family:'Nunito',sans-serif;font-size:1.2rem;font-weight:700;" +
      'text-align:center;padding:12px;border:2px solid #c9bd93;border-radius:10px;background:#fff;color:#33302A';
    champ.onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); valider(); } };

    var ok = document.createElement('button');
    ok.id = 'saisieOk';
    ok.type = 'button';
    ok.textContent = 'Valider';
    ok.style.cssText = 'display:block;margin:12px auto 0;background:#2C4A7C;color:#fff;border:none;' +
      'padding:10px 24px;border-radius:999px;font-weight:800;font-size:0.95rem;cursor:pointer';
    ok.onclick = valider;

    zone.appendChild(champ);
    zone.appendChild(ok);
    champ.focus();
  }

  /* ---------- Interface : progression, résultat, boutons ---------- */
  function bouton(texte, clic, plein) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = texte;
    b.onclick = clic;
    b.style.cssText = 'border-radius:999px;padding:10px 20px;font-weight:800;font-size:0.95rem;cursor:pointer;' +
      'border:2px solid #2C4A7C;' + (plein ? 'background:#2C4A7C;color:#fff' : 'background:transparent;color:#2C4A7C');
    return b;
  }

  var carte = document.querySelector('.card');

  var prog = document.createElement('div');
  prog.style.cssText = 'margin:0 0 10px';
  var progTexte = document.createElement('div');
  progTexte.style.cssText = 'font-weight:700;font-size:0.9rem;color:#6b6353;margin-bottom:4px';
  var progBarre = document.createElement('div');
  progBarre.style.cssText = 'height:8px;background:#e6ddc0;border-radius:999px;overflow:hidden';
  var progRempli = document.createElement('div');
  progRempli.style.cssText = 'height:100%;width:0;background:#2C4A7C;border-radius:999px;transition:width .3s';
  progBarre.appendChild(progRempli);
  prog.appendChild(progTexte);
  prog.appendChild(progBarre);
  var minuteur = document.getElementById('timerWrap');
  minuteur.parentNode.insertBefore(prog, minuteur);

  var resultat = document.createElement('div');
  resultat.id = 'resultat';
  resultat.style.cssText = 'display:none;background:rgba(255,255,255,0.5);border:2px dashed #cabf99;' +
    'border-radius:14px;padding:22px 18px;text-align:center';
  carte.parentNode.insertBefore(resultat, carte.nextSibling);

  var retour = document.getElementById('feedback');
  var explication = document.createElement('div');
  explication.id = 'explication';
  explication.style.cssText = 'display:none;margin-top:8px;font-size:0.9rem;font-weight:600;color:#6b6353;line-height:1.4';
  retour.parentNode.insertBefore(explication, retour.nextSibling);
  var ecouter = null;
  if (voixOk) {
    ecouter = bouton('🔊 Écouter', function () { if (state.current) parler(phrase(state.current)); });
    ecouter.id = 'ecouter';
    ecouter.style.display = 'none';
    ecouter.style.margin = '8px auto 0';
    retour.parentNode.insertBefore(ecouter, explication.nextSibling);
  }

  function majProgression() {
    progTexte.textContent = serie.done >= serie.n
      ? 'Série terminée'
      : (mode.erreurs ? 'Révision · ' : '') + 'Question ' + (serie.done + 1) + ' / ' + serie.n;
    progRempli.style.width = Math.round(100 * serie.done / serie.n) + '%';
  }

  function cacherResultat() {
    resultat.style.display = 'none';
    carte.style.display = '';
  }

  function afficherResultat() {
    clearTimer();
    var n = serie.n, s = state.score, pct = Math.round(100 * s / n);
    var msg = pct >= 90 ? 'Excellent travail !' : pct >= 70 ? 'Très bien !'
      : pct >= 50 ? 'Bien, continue tes efforts.' : 'Courage, on révise ensemble !';
    var html = "<div style=\"font-family:'Patrick Hand',cursive;font-size:2.6rem;color:#2C4A7C;line-height:1.1\">" +
      s + ' / ' + n + '</div>' +
      '<div style="font-weight:800;margin:4px 0 14px;color:#33302A">' + pct + ' % — ' + msg + '</div>';
    if (serie.erreurs.length) {
      html += '<div style="font-weight:800;text-align:left;margin-bottom:6px">À revoir :</div>' +
        '<ul style="text-align:left;padding-left:18px;margin:0 0 6px;line-height:1.7;font-size:0.95rem">' +
        serie.erreurs.map(function (e) {
          return '<li><b>' + echapper(e.pronoun) + '</b> (' + echapper(e.verb) + ', ' + libelle(e.tense) +
            ') → <b style="color:#5C8A5C">' + echapper(e.correct) + '</b> ' +
            '<span style="color:#D6534A">(ta réponse : ' + echapper(e.repondu) + ')</span></li>';
        }).join('') + '</ul>';
    } else {
      html += '<div style="font-weight:700;color:#5C8A5C">Aucune erreur, bravo !</div>';
    }
    resultat.innerHTML = html;

    var zone = document.createElement('div');
    zone.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:16px';
    zone.appendChild(bouton('Rejouer', function () { derniere = null; window.newQuestion(); }, true));
    if (mode.erreurs) {
      zone.appendChild(bouton('Retour aux exercices', function () {
        mode.erreurs = false; majChips(); window.newQuestion();
      }));
    } else if (lire().length) {
      zone.appendChild(bouton('Réviser mes erreurs (' + lire().length + ')', function () {
        mode.erreurs = true; majChips(); window.newQuestion();
      }));
    }
    resultat.appendChild(zone);
    carte.style.display = 'none';
    resultat.style.display = 'block';
  }

  /* ---------- Enchaînement des questions ---------- */
  var newOrig = newQuestion;
  window.newQuestion = function () {
    if (!serie || signature() !== derniere) {
      initSerie();
      derniere = signature();
    }
    if (serie.done >= serie.n) {
      afficherResultat();
      majProgression();
      return;
    }
    cacherResultat();
    explication.style.display = 'none';
    explication.textContent = '';
    if (ecouter) ecouter.style.display = 'none';
    if (voixOk) { try { speechSynthesis.cancel(); } catch (e) { /* ignoré */ } }
    newOrig();
    var zone = document.getElementById('choices');
    zone.style.display = mode.saisie ? 'block' : '';
    document.getElementById('promptLabel').textContent =
      (mode.erreurs && state.current && state.current.tense)
        ? 'Révision · ' + libelle(state.current.tense)
        : 'Conjugue le verbe';
    if (mode.saisie) afficherSaisie();
    if (mode.vide) {
      document.getElementById('feedback').textContent = 'Aucune erreur à réviser pour le moment.';
      mode.vide = false;
    }
    document.getElementById('nextBtn').textContent = 'Question suivante →';
    majProgression();
  };
  // ces boutons gardaient l'ancienne version
  document.getElementById('nextBtn').onclick = window.newQuestion;
  document.getElementById('resetBtn').onclick = function () { derniere = null; window.newQuestion(); };

  /* ---------- Boutons de réglage ---------- */
  function chip(texte, clic) {
    var b = document.createElement('button');
    b.className = 'chip';
    b.textContent = texte;
    b.onclick = clic;
    return b;
  }
  function ligne(etiquette) {
    var d = document.createElement('div');
    d.className = 'groupSelect';
    var s = document.createElement('span');
    s.textContent = etiquette;
    s.style.cssText = 'font-weight:700;font-size:0.85rem;color:#6b6353';
    d.appendChild(s);
    return d;
  }

  var chipsNiveau = NIVEAUX.map(function (n) {
    return chip(n.court, function () {
      reglages.niveau = n.cle;
      ecrireJSON(CLE_REG, reglages);
      appliquerNiveau();
      majChips();
      window.newQuestion();
    });
  });
  var chipsLongueur = LONGUEURS.map(function (l) {
    return chip(l + ' questions', function () {
      reglages.longueur = l;
      ecrireJSON(CLE_REG, reglages);
      majChips();
      window.newQuestion();
    });
  });
  var chipSaisie = chip('', function () {
    mode.saisie = !mode.saisie;
    majChips();
    window.newQuestion();
  });
  var chipErreurs = chip('', function () {
    if (mode.erreurs) mode.erreurs = false;
    else if (lire().length) mode.erreurs = true;
    else mode.vide = true;
    majChips();
    window.newQuestion();
  });

  function majChips() {
    chipsNiveau.forEach(function (c, i) { c.classList.toggle('active', NIVEAUX[i].cle === reglages.niveau); });
    chipsLongueur.forEach(function (c, i) { c.classList.toggle('active', LONGUEURS[i] === reglages.longueur); });
    chipSaisie.textContent = '✍ Écrire la réponse';
    chipSaisie.classList.toggle('active', mode.saisie);
    chipErreurs.textContent = '↻ Mes erreurs (' + lire().length + ')';
    chipErreurs.classList.toggle('active', mode.erreurs);
  }

  var rangNiveau = ligne('Niveau :');
  chipsNiveau.forEach(function (c) { rangNiveau.appendChild(c); });
  var rangLongueur = ligne('Série :');
  chipsLongueur.forEach(function (c) { rangLongueur.appendChild(c); });
  var onglets = document.getElementById('tabs');
  onglets.parentNode.insertBefore(rangNiveau, onglets);
  onglets.parentNode.insertBefore(rangLongueur, onglets);

  var ligneDefi = document.getElementById('challengeToggle').parentNode;
  var rangModes = document.createElement('div');
  rangModes.className = 'groupSelect';
  rangModes.appendChild(chipSaisie);
  rangModes.appendChild(chipErreurs);
  ligneDefi.parentNode.insertBefore(rangModes, ligneDefi.nextSibling);

  /* ---------- Démarrage ---------- */
  appliquerNiveau();
  majChips();
  window.newQuestion();
})();
