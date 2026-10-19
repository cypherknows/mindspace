'use strict';
/* Rood vs Blauw — Random Experiment
 * Volledig client-side, zonder afhankelijkheden of buildstap.
 * Bovenaan staan configuratie en pure rekenfuncties (ook getest met test.js in Node),
 * onderaan de koppeling met de pagina (initApp). */

// ---------------------------------------------------------------- Configuratie

var HARD_LIMITS = { maxTargetRate: 20000000, maxBatchSize: 524288, maxDurationSec: 86400 };

// Standaardwaarden in de broncode. Opgeslagen gebruikersinstellingen overschrijven deze.
var DEFAULT_CONFIG = {
  // Randomgenerator
  targetRate: 10000,          // gewenste uitkomsten per seconde (doel, geen garantie)
  batchSize: 1000,            // uitkomsten per batch
  maxBatchSize: 100000,
  maxTargetRate: 1000000,
  useWorker: true,
  maxDurationSec: 3600,
  // Animatie
  blinkRate: 4,               // wisselingen per seconde
  animationEnabled: true,
  respectReducedMotion: true,
  transitionMs: 250,
  // Livevisualisatie
  viewScale: 'amplified',     // 'actual' | 'amplified'
  visualSensitivity: 10,
  autoSensitivity: false,
  renderIntervalMs: 33,
  showMidline: true,
  showNumbers: true,
  // Sessie
  runMode: 'continuous',      // 'continuous' | 'fixed'
  durationSec: 60,
  autoStop: true,
  defaultVisual: 'blink'      // 'blink' | 'bar'
};

// Beschrijving per instelling: type, grenzen, label en uitleg. Het instellingenscherm wordt hieruit opgebouwd.
// max mag een getal zijn of de naam van een andere instelling. next: true = geldt pas bij een nieuwe sessie.
var CONFIG_SCHEMA = [
  { key: 'targetRate', group: 'gen', type: 'int', min: 1, max: 'maxTargetRate', presets: [100, 1000, 10000, 100000, 1000000], unit: ' /s',
    label: 'Gewenste berekeningen per seconde', help: 'Doelwaarde, geen garantie. De werkelijk behaalde snelheid wordt apart getoond. Aanbevolen: 10.000.' },
  { key: 'batchSize', group: 'gen', type: 'int', min: 1, max: 'maxBatchSize', presets: [100, 1000, 10000, 100000],
    label: 'Batchgrootte', help: 'Aantal uitkomsten dat per keer wordt gegenereerd en volledig meegeteld. Beïnvloedt alleen de efficiëntie, niet de statistiek. Aanbevolen: 1.000.' },
  { key: 'maxBatchSize', group: 'gen', type: 'int', min: 1000, max: HARD_LIMITS.maxBatchSize,
    label: 'Maximale batchgrootte', help: 'Veiligheidsgrens (hoogstens 524.288).' },
  { key: 'maxTargetRate', group: 'gen', type: 'int', min: 1000, max: HARD_LIMITS.maxTargetRate,
    label: 'Maximale gewenste rekensnelheid (/s)', help: 'Veiligheidsgrens (hoogstens 20.000.000).' },
  { key: 'useWorker', group: 'gen', type: 'bool', next: true,
    label: 'Web Worker gebruiken', help: 'Rekent in een aparte thread zodat de interface soepel blijft. Aanbevolen: aan.' },
  { key: 'maxDurationSec', group: 'gen', type: 'int', min: 60, max: HARD_LIMITS.maxDurationSec,
    label: 'Maximale looptijd bij vaste tijd (s)', help: 'Bovengrens voor de instelbare duur.' },

  { key: 'blinkRate', group: 'anim', type: 'num', min: 0.5, max: 8, presets: [2, 4, 8],
    presetLabels: { 2: 'Rustig (2/s)', 4: 'Normaal (4/s)', 8: 'Snel (8/s)' },
    label: 'Knippersnelheid (wisselingen per seconde)', help: 'Staat los van de rekensnelheid. Maximaal 8 per seconde. Wees voorzichtig bij gevoeligheid voor flitsend licht.' },
  { key: 'animationEnabled', group: 'anim', type: 'bool', label: 'Knipperanimatie aan' },
  { key: 'respectReducedMotion', group: 'anim', type: 'bool',
    label: 'Systeeminstelling "verminderde beweging" respecteren', help: 'Als die instelling aan staat: hoogstens 1 zachte wisseling per seconde.' },
  { key: 'transitionMs', group: 'anim', type: 'int', min: 0, max: 2000,
    label: 'Overgangsduur kleurbalk (ms)', help: 'Vloeiende overgang naar de nieuwste verdeling. Aanbevolen: 250.' },

  { key: 'viewScale', group: 'vis', type: 'enum', options: [['actual', 'Werkelijke verhouding'], ['amplified', 'Versterkte afwijking']],
    label: 'Weergave kleurbalk', help: 'Werkelijk: breedtes = echte percentages. Versterkt: de afwijking van 50% wordt vergroot.' },
  { key: 'visualSensitivity', group: 'vis', type: 'num', min: 1, max: 1000, presets: [1, 2, 5, 10, 20, 50], unit: '×',
    label: 'Visuele gevoeligheidsfactor', help: 'Afwijking van 50% × factor. Bij 10×: 50,6% rood wordt 56% rood in beeld. Factor 1 = werkelijke verhouding.' },
  { key: 'autoSensitivity', group: 'vis', type: 'bool',
    label: 'Automatische gevoeligheid', help: 'Kiest zelf een factor zodat kleine afwijkingen zichtbaar blijven. Standaard uit, zodat sessies vergelijkbaar blijven.' },
  { key: 'renderIntervalMs', group: 'vis', type: 'int', min: 16, max: 1000,
    label: 'Interval tussen schermupdates (ms)', help: '33 ms ≈ 30 updates per seconde.' },
  { key: 'showMidline', group: 'vis', type: 'bool', label: 'Middenlijn (50%) tonen' },
  { key: 'showNumbers', group: 'vis', type: 'bool', label: 'Aantallen en percentages in de balk tonen' },

  { key: 'runMode', group: 'session', type: 'enum', next: true, options: [['continuous', 'Doorlopend'], ['fixed', 'Vaste tijd']],
    label: 'Berekeningsmodus' },
  { key: 'durationSec', group: 'session', type: 'int', next: true, min: 5, max: 'maxDurationSec', presets: [10, 30, 60, 300, 600, 3600], unit: ' s',
    label: 'Duur bij vaste tijd (seconden)' },
  { key: 'autoStop', group: 'session', type: 'bool', next: true, label: 'Automatisch stoppen na de vaste tijd' },
  { key: 'defaultVisual', group: 'session', type: 'enum', options: [['blink', 'Knipperende vierkanten'], ['bar', 'Live kleurverdeling']],
    label: 'Standaardvisualisatie bij openen' }
];

var GROUP_TITLES = { gen: 'Randomgenerator', anim: 'Animatie', vis: 'Livevisualisatie', session: 'Sessie' };

// Controleert en begrenst alle waarden. Ongeldige of ontbrekende waarden worden de standaardwaarde.
function validateConfig(input) {
  var src = input || {}, out = {};
  var ordered = CONFIG_SCHEMA.filter(function (f) { return typeof f.max !== 'string'; })
    .concat(CONFIG_SCHEMA.filter(function (f) { return typeof f.max === 'string'; }));
  ordered.forEach(function (f) {
    var v = src[f.key], d = DEFAULT_CONFIG[f.key];
    if (f.type === 'bool') {
      out[f.key] = typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : d;
    } else if (f.type === 'enum') {
      out[f.key] = f.options.some(function (o) { return o[0] === v; }) ? v : d;
    } else {
      var x = (v === '' || v === null || v === undefined || typeof v === 'boolean') ? NaN : Number(v);
      if (!isFinite(x)) x = d;
      if (f.type === 'int') x = Math.round(x);
      var max = typeof f.max === 'string' ? out[f.max] : f.max;
      out[f.key] = Math.min(max, Math.max(f.min, x));
    }
  });
  return out;
}

// ---------------------------------------------------------------- Randomgenerator

// Telt het aantal rode uitkomsten in n onafhankelijke 50/50-trekkingen.
// Elke bit uit crypto.getRandomValues() is uniform en onafhankelijk: 1 = rood, 0 = blauw.
// Er wordt niet met modulo gerekend, dus er is geen modulo-bias.
function countRedBits(n) {
  function pop(x) {
    x = x - ((x >>> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
    return Math.imul((x + (x >>> 4)) & 0x0F0F0F0F, 0x01010101) >>> 24;
  }
  var red = 0;
  while (n > 0) {
    var bits = Math.min(n, 524288);            // 65.536 bytes: maximum per getRandomValues-aanroep
    var words = Math.ceil(bits / 32);
    var a = crypto.getRandomValues(new Uint32Array(words));
    for (var i = 0; i < words - 1; i++) red += pop(a[i]);
    var rest = bits - (words - 1) * 32;        // 1..32 bits uit het laatste woord
    red += pop(a[words - 1] >>> (32 - rest));
    n -= bits;
  }
  return red;
}

// Genereert n uitkomsten in batches van batchSize. Alle uitkomsten worden meegeteld.
function generateOutcomes(n, batchSize) {
  var red = 0, done = 0, batches = 0;
  while (done < n) {
    var k = Math.min(batchSize, n - done);
    red += countRedBits(k);
    done += k;
    batches++;
  }
  return { red: red, blue: done - red, total: done, batches: batches };
}

// Rekenlus. Draait in een Web Worker (via een Blob, zonder extra bestand) of op de hoofdthread
// met een nep-"self". Houdt het tempo vast met de klok en stuurt per tick de tellingen (delta's) terug.
function engineMain(self) {
  var sid = 0, running = false, rate = 0, batch = 1000, budget = 10, deadline = Infinity;
  var t0 = 0, scheduled = 0, timer = null, TICK = 20;
  function clock() { return performance.now(); }
  function tick() {
    timer = null;
    if (!running) return;
    var elapsed = Math.min(clock() - t0, deadline);
    var due = Math.floor(elapsed / 1000 * rate) - scheduled;
    if (due > rate * 2) { scheduled += due - rate * 2; due = rate * 2; }  // max. 2 s achterstand inhalen
    var end = clock() + budget, red = 0, n = 0, batches = 0;
    while (due > 0 && clock() < end) {
      var k = Math.min(batch, due);
      red += countRedBits(k);
      n += k; due -= k; batches++;
    }
    scheduled += n;
    if (n > 0) self.postMessage({ type: 'delta', sid: sid, red: red, n: n, batches: batches });
    if (elapsed >= deadline && due <= 0) {
      running = false;
      self.postMessage({ type: 'done', sid: sid });
      return;
    }
    timer = setTimeout(tick, due > 0 ? 0 : TICK);
  }
  self.onmessage = function (e) {
    var m = e.data;
    if (m.type === 'start') {
      clearTimeout(timer);
      sid = m.sid; rate = m.rate; batch = m.batch; budget = m.budget;
      deadline = m.deadlineMs == null ? Infinity : m.deadlineMs;
      t0 = clock(); scheduled = 0; running = true;
      tick();
    } else if (m.type === 'config') {
      if (running) { var el = clock() - t0; deadline -= el; t0 = clock(); scheduled = 0; }
      rate = m.rate; batch = m.batch;
    } else if (m.type === 'stop') {
      running = false; clearTimeout(timer); timer = null;
    }
  };
}

function createEngine(useWorker, onMsg, onError) {
  if (useWorker && typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
    try {
      var src = countRedBits.toString() + '\n(' + engineMain.toString() + ')(self);';
      var url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      var w = new Worker(url);
      w.onmessage = function (e) { onMsg(e.data); };
      w.onerror = function (e) { if (e.preventDefault) e.preventDefault(); onError(e); };
      return {
        kind: 'worker',
        post: function (m) { w.postMessage(m); },
        kill: function () { w.terminate(); URL.revokeObjectURL(url); }
      };
    } catch (err) { /* geen worker mogelijk: val terug op de hoofdthread */ }
  }
  var fake = { postMessage: onMsg, onmessage: null };
  engineMain(fake);
  return {
    kind: 'main',
    post: function (m) { fake.onmessage({ data: m }); },
    kill: function () { fake.onmessage({ data: { type: 'stop' } }); }
  };
}

// ---------------------------------------------------------------- Statistiek en visualisatie

// Tweezijdige p-waarde onder de normale benadering: erfc(|z|/√2),
// erfc volgens Abramowitz & Stegun 7.1.26 (absolute fout < 1,5·10⁻⁷).
function twoSidedP(z) {
  var x = Math.abs(z) / Math.SQRT2;
  var t = 1 / (1 + 0.3275911 * x);
  var y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
  return Math.min(1, Math.max(0, y));
}

function computeStats(red, blue, elapsedMs) {
  var total = red + blue, has = total > 0;
  var redPct = has ? red / total * 100 : null;
  var bluePct = has ? blue / total * 100 : null;
  var dev = has ? redPct - 50 : null;
  var z = has ? (red - total / 2) / Math.sqrt(total / 4) : null;
  return {
    red: red, blue: blue, total: total,
    redPct: redPct, bluePct: bluePct,
    diff: red - blue,
    dev: dev,                                   // procentpunten t.o.v. 50%
    relDev: has ? dev / 50 * 100 : null,        // relatieve afwijking t.o.v. de helft, in %
    z: z, p: z === null ? null : twoSidedP(z),
    rate: elapsedMs > 0 ? total / (elapsedMs / 1000) : null
  };
}

// Visuele verdeling: 50 + (rood% − 50) × factor, begrensd tot 0–100. Rood + blauw is altijd 100.
function visualSplit(redPct, factor) {
  if (redPct === null || redPct === undefined) return { red: 50, blue: 50 };
  var r = Math.min(100, Math.max(0, 50 + (redPct - 50) * factor));
  return { red: r, blue: 100 - r };
}

// Automatische factor: de grootste "nette" factor waarbij de afwijking hoogstens 35 procentpunt verschuift.
var AUTO_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
function autoFactor(absDev) {
  if (!(absDev > 0)) return AUTO_STEPS[AUTO_STEPS.length - 1];
  var f = 1;
  AUTO_STEPS.forEach(function (s) { if (absDev * s <= 35) f = s; });
  return f;
}

// ---------------------------------------------------------------- Interface

function initApp() {
  var $ = function (id) { return document.getElementById(id); };
  var STORE_KEY = 'rood-vs-blauw-instellingen-v1';
  var STATUS_TEXT = { ready: 'Klaar', running: 'Bezig', stopped: 'Gestopt', done: 'Voltooid' };
  var SCHEMA = {};
  CONFIG_SCHEMA.forEach(function (f) { SCHEMA[f.key] = f; });

  var nf = new Intl.NumberFormat('nl-NL');
  function num(x, d) { return x.toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function pct(x) { return x === null ? '–' : num(x, 3) + '%'; }
  function signed(x, d, unit) { return x === null ? '–' : (x > 0 ? '+' : '') + num(x, d) + (unit || ''); }
  function time(ms) {
    var t = Math.floor(ms / 100), s = Math.floor(t / 10), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0') + ',' + (t % 10);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // Drie lagen configuratie: DEFAULT_CONFIG (broncode), saved (localStorage), cfg (actief).
  function loadSaved() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return validateConfig(Object.assign({}, DEFAULT_CONFIG, JSON.parse(raw)));
    } catch (e) { /* geen of ongeldige opslag */ }
    return clone(DEFAULT_CONFIG);
  }
  var saved = loadSaved();
  var cfg = clone(saved);

  // Sessiestatus. totalCount is altijd redCount + blueCount.
  var S = {
    status: 'ready', redCount: 0, blueCount: 0, totalCount: 0,
    startTime: null, elapsedTime: 0, elapsedBefore: 0, segStart: 0,
    selectedDuration: null, targetRate: cfg.targetRate, actualRate: 0,
    sid: 0, sessionCfg: null, autoF: AUTO_STEPS[AUTO_STEPS.length - 1], renders: 0, batches: 0
  };
  var engine = null, renderTimer = null, blinkTimer = null, blinkPhase = 0;
  window.rvb = { state: S, config: function () { return cfg; } };  // handig voor controle in de console

  // ---------- Instellingenvelden (opgebouwd uit CONFIG_SCHEMA)
  var widgets = [], customMode = {}, uid = 0;

  function fieldEl(f) {
    var wrap = document.createElement('div');
    wrap.className = 'field';
    var id = 'f-' + f.key + '-' + (++uid);
    var lab = document.createElement('label');
    lab.htmlFor = id;
    lab.textContent = f.label;
    if (f.next) {
      var nx = document.createElement('span');
      nx.className = 'next';
      nx.textContent = ' (geldt vanaf de volgende sessie)';
      lab.appendChild(nx);
    }
    var w = { f: f };
    if (f.type === 'bool') {
      wrap.classList.add('check');
      w.el = document.createElement('input');
      w.el.type = 'checkbox';
      w.el.id = id;
      w.el.addEventListener('change', function () { setValue(f.key, w.el.checked); });
      wrap.appendChild(w.el);
      wrap.appendChild(lab);
    } else if (f.type === 'enum') {
      w.el = document.createElement('select');
      w.el.id = id;
      f.options.forEach(function (o) { w.el.add(new Option(o[1], o[0])); });
      w.el.addEventListener('change', function () { setValue(f.key, w.el.value); });
      wrap.appendChild(lab);
      wrap.appendChild(w.el);
    } else {
      w.num = document.createElement('input');
      w.num.type = 'number';
      w.num.inputMode = 'decimal';
      w.num.min = f.min;
      w.num.step = f.type === 'int' ? 1 : 'any';
      w.num.addEventListener('change', function () { setValue(f.key, w.num.value); });
      wrap.appendChild(lab);
      var row = document.createElement('div');
      row.className = 'row';
      if (f.presets) {
        w.sel = document.createElement('select');
        w.sel.id = id;
        f.presets.forEach(function (p) {
          w.sel.add(new Option((f.presetLabels && f.presetLabels[p]) || nf.format(p) + (f.unit || ''), String(p)));
        });
        w.sel.add(new Option('Aangepast…', 'custom'));
        w.sel.addEventListener('change', function () {
          customMode[f.key] = w.sel.value === 'custom';
          if (customMode[f.key]) { sync(); w.num.focus(); } else setValue(f.key, w.sel.value);
        });
        w.num.id = id + '-n';
        w.num.setAttribute('aria-label', f.label + ' (aangepaste waarde)');
        row.appendChild(w.sel);
      } else {
        w.num.id = id;
      }
      row.appendChild(w.num);
      wrap.appendChild(row);
    }
    if (f.help) {
      var h = document.createElement('small');
      h.textContent = f.help;
      wrap.appendChild(h);
    }
    widgets.push(w);
    return wrap;
  }

  // Snelle instellingen op de hoofdpagina gebruiken dezelfde velden.
  document.querySelectorAll('[data-fields]').forEach(function (box) {
    box.dataset.fields.split(',').forEach(function (k) { box.appendChild(fieldEl(SCHEMA[k])); });
  });
  var form = $('settingsGroups');
  Object.keys(GROUP_TITLES).forEach(function (g) {
    var fs = document.createElement('fieldset');
    var lg = document.createElement('legend');
    lg.textContent = GROUP_TITLES[g];
    fs.appendChild(lg);
    CONFIG_SCHEMA.forEach(function (f) { if (f.group === g) fs.appendChild(fieldEl(f)); });
    form.appendChild(fs);
  });

  function sync() {
    widgets.forEach(function (w) {
      var f = w.f, v = cfg[f.key];
      if (f.type === 'bool') w.el.checked = v;
      else if (f.type === 'enum') w.el.value = v;
      else {
        w.num.max = typeof f.max === 'string' ? cfg[f.max] : f.max;
        if (document.activeElement !== w.num) w.num.value = v;
        if (w.sel) {
          var preset = f.presets.indexOf(v) >= 0 && !customMode[f.key];
          w.sel.value = preset ? String(v) : 'custom';
          w.num.hidden = preset;
        }
      }
    });
    $('dirty').hidden = JSON.stringify(cfg) === JSON.stringify(saved);
  }

  function msg(text) {
    $('settingsMsg').textContent = text;
  }

  function setValue(key, raw) {
    var next = Object.assign({}, cfg);
    next[key] = raw;
    var v = validateConfig(next), f = SCHEMA[key];
    if ((f.type === 'int' || f.type === 'num') && Number(raw) !== v[key]) {
      msg(f.label + ': ongeldige waarde, begrensd op ' + nf.format(v[key]) + '.');
    } else msg('');
    cfg = v;
    applyLive();
    sync();
    render();
  }

  // Past instellingen toe die tijdens een sessie direct mogen wijzigen. Tellers blijven ongemoeid.
  // Instellingen met next: true (modus, duur, autostop, worker) worden per sessie vastgelegd in S.sessionCfg.
  function applyLive() {
    S.targetRate = cfg.targetRate;
    document.documentElement.style.setProperty('--t', cfg.transitionMs + 'ms');
    if (S.status === 'running') {
      if (engine) engine.post({ type: 'config', rate: cfg.targetRate, batch: cfg.batchSize });
      startTimers();
    }
  }

  $('saveBtn').addEventListener('click', function () {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(cfg));
      saved = clone(cfg);
      msg('Instellingen opgeslagen.');
    } catch (e) { msg('Opslaan is niet gelukt: deze browser staat lokale opslag niet toe.'); }
    sync();
  });
  $('defaultsBtn').addEventListener('click', function () {
    cfg = clone(DEFAULT_CONFIG);
    customMode = {};
    try { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); saved = clone(cfg); } catch (e) { /* alleen actief */ }
    msg('Standaardinstellingen hersteld en opgeslagen.');
    applyLive(); sync(); render();
  });
  $('undoBtn').addEventListener('click', function () {
    cfg = clone(saved);
    customMode = {};
    msg('Wijzigingen ongedaan gemaakt: terug naar de laatst opgeslagen instellingen.');
    applyLive(); sync(); render();
  });

  // ---------- Tabbladen
  var tabs = document.querySelectorAll('[role=tab]');
  function showTab(name) {
    tabs.forEach(function (t) {
      var on = t.dataset.tab === name;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      $('panel-' + t.dataset.tab).hidden = !on;
    });
    $('statsWrap').hidden = name === 'settings';
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { showTab(t.dataset.tab); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      var n = tabs[(i + d + tabs.length) % tabs.length];
      n.focus();
      showTab(n.dataset.tab);
    });
  });

  // ---------- Sessie

  function capMs() {
    var sc = S.sessionCfg;
    return sc && sc.runMode === 'fixed' && sc.autoStop ? sc.durationSec * 1000 : null;
  }
  function elapsedMs() {
    var e = S.elapsedBefore + (S.status === 'running' ? performance.now() - S.segStart : 0);
    var cap = capMs();
    return cap === null ? e : Math.min(e, cap);
  }

  function startEngine(useWorker) {
    var sid = ++S.sid, cap = capMs();
    var e = createEngine(useWorker, function (m) {
      if (m.sid !== S.sid || S.status !== 'running') return;   // oude of te late berichten negeren
      if (m.type === 'delta') {
        S.redCount += m.red;
        S.blueCount += m.n - m.red;
        S.totalCount = S.redCount + S.blueCount;
        S.batches += m.batches;
      } else if (m.type === 'done') finish('done');
    }, function () {
      if (engine !== e || S.status !== 'running') return;
      e.kill();                                                  // worker mislukt: verder op de hoofdthread
      S.elapsedBefore = elapsedMs();
      S.segStart = performance.now();
      startEngine(false);
    });
    engine = e;
    e.post({
      type: 'start', sid: sid, rate: cfg.targetRate, batch: cfg.batchSize,
      budget: e.kind === 'worker' ? 15 : 6,
      deadlineMs: cap === null ? null : Math.max(0, cap - S.elapsedBefore)
    });
  }

  function stopEngine() {
    if (engine) { engine.kill(); engine = null; }
    S.sid++;
  }

  function startTimers() {
    clearInterval(renderTimer);
    renderTimer = setInterval(render, cfg.renderIntervalMs);
    startBlink();
  }
  function stopTimers() {
    clearInterval(renderTimer);
    renderTimer = null;
    startBlink();
  }

  function reducedMotion() {
    return cfg.respectReducedMotion && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  // De knipperanimatie heeft een eigen timer en wordt niet door de randomgenerator gestuurd.
  function startBlink() {
    clearInterval(blinkTimer);
    blinkTimer = null;
    var sq = $('squares');
    if (S.status !== 'running' || !cfg.animationEnabled) {
      sq.className = 'squares static' + (S.status === 'running' ? ' on' : '');
      return;
    }
    var rm = reducedMotion();
    sq.className = 'squares blinking' + (rm ? ' soft' : '');
    var step = function () { blinkPhase ^= 1; sq.dataset.phase = blinkPhase; };
    step();
    blinkTimer = setInterval(step, 1000 / (rm ? Math.min(cfg.blinkRate, 1) : cfg.blinkRate));
  }

  function newSession() {
    S.redCount = S.blueCount = S.totalCount = 0;
    S.elapsedBefore = S.elapsedTime = S.actualRate = S.batches = 0;
    S.startTime = Date.now();
    S.sessionCfg = { runMode: cfg.runMode, durationSec: cfg.durationSec, autoStop: cfg.autoStop, useWorker: cfg.useWorker };
    S.selectedDuration = cfg.runMode === 'fixed' ? cfg.durationSec : null;
    S.autoF = AUTO_STEPS[AUTO_STEPS.length - 1];
  }

  function start() {
    if (S.status === 'running') return;                        // geen dubbele loops
    if (S.status !== 'stopped') newSession();                  // na Gestopt: hervatten
    S.status = 'running';
    S.segStart = performance.now();
    $('results').hidden = true;
    startEngine(S.sessionCfg.useWorker);
    startTimers();
    render();
  }

  function finish(kind) {
    if (S.status !== 'running') return;
    S.elapsedBefore = elapsedMs();
    stopEngine();
    S.status = kind;
    stopTimers();
    render();
    showResults();
  }

  function reset() {
    stopEngine();
    S.status = 'ready';
    stopTimers();
    newSession();
    S.sessionCfg = null;
    S.startTime = null;
    S.selectedDuration = null;
    $('results').hidden = true;
    render();
  }

  $('startBtn').addEventListener('click', start);
  $('stopBtn').addEventListener('click', function () { finish('stopped'); });
  $('resetBtn').addEventListener('click', reset);

  // ---------- Weergave (beperkte frequentie, los van de randomgenerator)

  function currentFactor(st) {
    if (cfg.viewScale === 'actual') return 1;
    if (cfg.autoSensitivity) {
      if (st.dev !== null && st.dev !== 0) S.autoF = autoFactor(Math.abs(st.dev));
      return S.autoF;
    }
    return cfg.visualSensitivity;
  }

  function set(id, text) { $(id).textContent = text; }

  function render() {
    S.renders++;
    var el = elapsedMs();
    S.elapsedTime = el;
    var st = computeStats(S.redCount, S.blueCount, el);
    S.actualRate = st.rate || 0;
    var running = S.status === 'running';

    set('sRed', nf.format(st.red));
    set('sBlue', nf.format(st.blue));
    set('sRedPct', pct(st.redPct));
    set('sBluePct', pct(st.bluePct));
    set('sTotal', nf.format(st.total));
    set('sDiff', (st.diff > 0 ? '+' : '') + nf.format(st.diff));
    set('sDev', signed(st.dev, 3, ' pp'));
    set('sRelDev', st.relDev === null ? '' : 'relatief: ' + signed(st.relDev, 3, '%'));
    set('sElapsed', time(el));
    var sc = S.sessionCfg || cfg;
    set('sRemaining', sc.runMode === 'fixed' ? time(Math.max(0, sc.durationSec * 1000 - el)) : '–');
    set('sRate', st.rate === null ? '–' : nf.format(Math.round(st.rate)));
    set('sTarget', 'doel: ' + nf.format(cfg.targetRate) + ' /s');

    var factor = currentFactor(st);
    var vs = visualSplit(st.redPct, factor);
    $('barRed').style.width = vs.red + '%';
    $('barBlue').style.width = vs.blue + '%';
    $('midline').hidden = !cfg.showMidline;
    $('bar').classList.toggle('nonums', !cfg.showNumbers);
    set('barRedLbl', 'Rood ' + pct(st.redPct) + ' · ' + nf.format(st.red));
    set('barBlueLbl', 'Blauw ' + pct(st.bluePct) + ' · ' + nf.format(st.blue));
    var scaleText, legend;
    if (factor === 1) {
      scaleText = 'Werkelijk (1×)';
      legend = 'Werkelijke verhouding: de breedtes zijn precies de echte percentages.';
    } else if (cfg.autoSensitivity) {
      scaleText = 'Automatisch (' + nf.format(factor) + '×)';
      legend = 'Automatisch geschaalde afwijking, nu ' + nf.format(factor) + '×. De factor past zich aan; dit is níet de echte verhouding.';
    } else {
      scaleText = 'Versterkt (' + nf.format(factor) + '×)';
      legend = 'Versterkte afwijking: de afwijking van 50% is ' + nf.format(factor) + '× vergroot. Dit is níet de echte verhouding.';
    }
    set('sScale', scaleText);
    set('legend', legend);
    $('legend').className = 'legend ' + (factor === 1 ? 'actual' : 'amplified');

    var b = $('statusBadge');
    b.textContent = STATUS_TEXT[S.status];
    b.className = 'badge ' + S.status;
    $('activeInd').hidden = !running;
    set('activeKind', engine && engine.kind === 'worker' ? 'Web Worker' : 'hoofdthread');
    $('startBtn').disabled = running;
    $('startBtn').textContent = S.status === 'stopped' ? 'Hervatten' : 'Start';
    $('stopBtn').disabled = !running;
    $('resetBtn').disabled = S.status === 'ready';

    // Reservecontrole als de generator zijn eindsignaal niet (op tijd) stuurt.
    var cap = capMs();
    if (running && cap !== null && S.elapsedBefore + performance.now() - S.segStart > cap + 750) finish('done');
  }

  function showResults() {
    var el = S.elapsedTime, st = computeStats(S.redCount, S.blueCount, el);
    var rows = [
      ['Totale looptijd', time(el)],
      ['Totaal aantal uitkomsten', nf.format(st.total)],
      ['Rood', nf.format(st.red) + ' (' + pct(st.redPct) + ')'],
      ['Blauw', nf.format(st.blue) + ' (' + pct(st.bluePct) + ')'],
      ['Absoluut verschil', nf.format(Math.abs(st.diff))],
      ['Afwijking van 50/50 (rood)', signed(st.dev, 4, ' procentpunt')],
      ['Gemiddeld per seconde', st.rate === null ? '–' : nf.format(Math.round(st.rate))],
      ['Standaardscore z', st.z === null ? '–' : signed(st.z, 3)],
      ['Tweezijdige p-waarde (benadering)', st.p === null ? '–' : st.p < 0.0001 ? '< 0,0001' : num(st.p, 4)]
    ];
    var interp;
    if (st.z === null) interp = 'Er zijn geen uitkomsten verwerkt, dus er valt niets te beoordelen.';
    else if (Math.abs(st.z) < 1.96) interp = 'Deze uitslag valt binnen de marge die een eerlijke 50/50-generator vaak oplevert (|z| < 1,96).';
    else if (Math.abs(st.z) < 3) interp = 'Opvallend (|z| ≥ 1,96), maar zo’n uitslag komt bij toeval ongeveer 1 op de 20 keer voor.';
    else interp = 'Sterk afwijkend (|z| ≥ 3). Ook dit kan toeval zijn, zeker na veel sessies.';
    $('resultsBody').innerHTML = '<dl>' + rows.map(function (r) {
      return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>';
    }).join('') + '</dl><p class="interp">' + interp + '</p>';
    set('resultsTitle', S.status === 'done' ? 'Eindresultaten — voltooid' : 'Resultaten — gestopt');
    $('results').hidden = false;
  }

  // ---------- Start van de pagina
  applyLive();
  sync();
  showTab(cfg.defaultVisual);
  render();
  startBlink();
}

// ---------------------------------------------------------------- Opstarten / export voor tests

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    HARD_LIMITS: HARD_LIMITS, DEFAULT_CONFIG: DEFAULT_CONFIG, CONFIG_SCHEMA: CONFIG_SCHEMA,
    validateConfig: validateConfig, countRedBits: countRedBits, generateOutcomes: generateOutcomes,
    engineMain: engineMain, createEngine: createEngine, twoSidedP: twoSidedP,
    computeStats: computeStats, visualSplit: visualSplit, autoFactor: autoFactor
  };
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
  else initApp();
}
