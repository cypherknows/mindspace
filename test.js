// Logicatests zonder browser:  node test.js
if (!globalThis.crypto) globalThis.crypto = require('crypto').webcrypto;
const A = require('./app.js');
let fails = 0;
function ok(cond, name) { console.log((cond ? 'OK   ' : 'FOUT ') + name); if (!cond) fails++; }
const near = (a, b) => Math.abs(a - b) < 1e-9;

// Batches
let g = A.generateOutcomes(1000, 1000);
ok(g.total === 1000 && g.red + g.blue === 1000 && g.batches === 1, '1. batch van 1000 telt alle 1000 uitkomsten mee');
g = A.generateOutcomes(123457, 1000);
ok(g.total === 123457 && g.red + g.blue === g.total && g.batches === 124, '2. meerdere batches: tellers kloppen');
for (const bs of [1, 7, 1000, 524288]) {
  const r = A.generateOutcomes(100000, bs);
  ok(r.total === 100000 && r.red + r.blue === 100000, '4. batchgrootte ' + bs + ' verandert de definitie van een uitkomst niet');
}
ok(A.countRedBits(32) <= 32 && A.countRedBits(1) <= 1 && A.countRedBits(0) === 0, 'randgevallen countRedBits');
// Eerlijkheid: 2 miljoen bits, verwacht |z| < 5
const big = A.generateOutcomes(2000000, 100000);
const zb = A.computeStats(big.red, big.blue, 1000).z;
ok(Math.abs(zb) < 5, 'generator 50/50 bij 2 mln uitkomsten (z = ' + zb.toFixed(2) + ')');

// Statistiek
const s = A.computeStats(506, 494, 2000);
ok(near(s.redPct, 50.6) && near(s.redPct + s.bluePct, 100) && s.total === 1000, '5. percentages correct, som 100');
ok(near(s.dev, 0.6) && near(s.relDev, 1.2) && s.rate === 500, 'afwijking, relatieve afwijking en snelheid');
ok(near(s.z, 6 / Math.sqrt(250)), 'z-score volgens formule');
ok(A.computeStats(0, 0, 0).z === null && A.computeStats(0, 0, 0).redPct === null, 'geen deling door nul bij 0 uitkomsten');
ok(Math.abs(A.twoSidedP(1.96) - 0.05) < 0.0005 && near(A.twoSidedP(0), 1), 'p-waarde benadering');

// Visualisatie
let v = A.visualSplit(50.6, 10);
ok(Math.abs(v.red - 56) < 1e-9 && Math.abs(v.blue - 44) < 1e-9, '9/5. 50,6% rood, factor 10 → 56% / 44%');
v = A.visualSplit(49.4, 10);
ok(Math.abs(v.red - 44) < 1e-9 && Math.abs(v.blue - 56) < 1e-9, '6. symmetrisch onder 50%');
const table = [[50, 50], [50.1, 51], [51, 60], [49, 40]];
ok(table.every(([r, e]) => Math.abs(A.visualSplit(r, 10).red - e) < 1e-9), 'voorbeeldtabel uit de opdracht');
ok([[90, 50], [10, 50], [100, 1000], [0, 1000]].every(([r, f]) => { const x = A.visualSplit(r, f); return x.red >= 0 && x.red <= 100 && x.red + x.blue === 100; }), '7. visuele verdeling blijft binnen 0–100%');
ok(A.visualSplit(60, 1).red === 60, '7b. factor 1 = werkelijke verhouding');
const before = A.computeStats(5060, 4940, 1000);
A.visualSplit(before.redPct, 50);
ok(JSON.stringify(before) === JSON.stringify(A.computeStats(5060, 4940, 1000)), '8. werkelijke percentages onafhankelijk van gevoeligheid');
ok(A.autoFactor(0.6) === 50 && A.autoFactor(10) === 2 && A.autoFactor(0.001) === 1000, 'automatische factor');

// Configuratie
const D = A.DEFAULT_CONFIG;
ok(JSON.stringify(A.validateConfig(D)) === JSON.stringify(A.validateConfig({})), '10. lege invoer = standaardinstellingen');
const bad = A.validateConfig({ targetRate: -5, batchSize: 1e12, maxTargetRate: Infinity, durationSec: 'abc', blinkRate: 100, viewScale: 'x', useWorker: 'ja' });
ok(bad.targetRate === 1 && bad.batchSize === D.maxBatchSize && bad.maxTargetRate === D.maxTargetRate && bad.durationSec === D.durationSec
  && bad.blinkRate === 8 && bad.viewScale === D.viewScale && bad.useWorker === D.useWorker, '11. ongeldige instellingen worden begrensd/geweigerd');
ok(A.validateConfig({ maxTargetRate: 5000, targetRate: 100000 }).targetRate === 5000, '11b. afhankelijke grens (targetRate ≤ maxTargetRate)');
ok(Object.keys(D).every(k => A.CONFIG_SCHEMA.some(f => f.key === k)), 'elke instelling in DEFAULT_CONFIG heeft een schema-regel');

// Rekenlus (dezelfde code als in de Web Worker), met nep-"self"
function runEngine() {
  return new Promise(resolve => {
    const msgs = [];
    const self = { postMessage: m => msgs.push(m) };
    A.engineMain(self);
    self.onmessage({ data: { type: 'start', sid: 1, rate: 50000, batch: 1000, budget: 10, deadlineMs: 400 } });
    setTimeout(() => {
      // Sessie 1 stoppen, sessie 2 starten: berichten van sessie 1 mogen daarna niet meer komen
      self.onmessage({ data: { type: 'stop' } });
      const n1 = msgs.length;
      self.onmessage({ data: { type: 'start', sid: 2, rate: 10000, batch: 500, budget: 10, deadlineMs: 300 } });
      setTimeout(() => resolve({ msgs, n1 }), 500);
    }, 600);
  });
}
runEngine().then(({ msgs, n1 }) => {
  const s1 = msgs.slice(0, n1), s2 = msgs.slice(n1);
  const tot1 = s1.filter(m => m.type === 'delta').reduce((a, m) => a + m.n, 0);
  const tot2 = s2.filter(m => m.type === 'delta').reduce((a, m) => a + m.n, 0);
  ok(s1.some(m => m.type === 'done') && Math.abs(tot1 - 20000) <= 1, 'engine: vaste tijd stopt zelf, aantal ≈ tempo × tijd (' + tot1 + ')');
  ok(s1.filter(m => m.type === 'delta').length < tot1 / 100, '3. minder berichten/updates dan uitkomsten');
  ok(s2.length > 0 && s2.every(m => m.sid === 2), '13. na stop + nieuwe sessie komen geen oude resultaten mee');
  ok(Math.abs(tot2 - 3000) <= 1, 'engine sessie 2: tempo aangehouden (' + tot2 + ')');
  console.log(fails ? `\n${fails} test(s) mislukt` : '\nAlle tests geslaagd');
  process.exit(fails ? 1 : 0);
});
