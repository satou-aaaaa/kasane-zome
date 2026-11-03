// data.js を作る。伝統色ごとに「いちばん近く染められる染め方（お手本）」と、その色の差（ΔE2000）を計算して書く。
// 使い方: node tools/make-data.cjs   色を足すときは tools/colors-raw.json に [名前, 読み, 色] を足す。
// 色の値は資料により少しずつ違う。ここでは nipponcolors.com などで広く使われている値を使う。
const fs = require("fs"), path = require("path"), C = require("./color.cjs");
const BASE = "#f6f3ec", MAX = 12, LIMIT = 3.6;
const VATS = [
  { n: "藍", y: "あい", t: [0.507, 0.86, 0.995] },
  { n: "紅花", y: "べにばな", t: [0.995, 0.491, 0.797] },
  { n: "刈安", y: "かりやす", t: [0.995, 0.952, 0.603] },
  { n: "紫根", y: "しこん", t: [0.908, 0.712, 0.812] },
];
const base = C.hex2rgb(BASE).map(C.lin);
const dye = (n) => C.rgb2hex(base.map((v, i) => C.gam(v * VATS.reduce((m, V, k) => m * V.t[i] ** n[k], 1))));
const combos = []; for (let a = 0; a <= MAX; a++) for (let b = 0; a + b <= MAX; b++) for (let c = 0; a + b + c <= MAX; c++) for (let d = 0; a + b + c + d <= MAX; d++) combos.push([a, b, c, d]);
const labs = combos.map((n) => C.lab(C.hex2rgb(dye(n))));
function family([L, a, b]) {
  const ch = Math.hypot(a, b), h = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
  if (ch < 12) return "gray";
  if (L < 52 && h > 25 && h < 95 && ch < 45) return "brown";
  if (h < 40 || h >= 345) return "red";
  if (h < 70) return "orange";
  if (h < 105) return "yellow";
  if (h < 190) return "green";
  if (h < 285) return "blue";
  return "purple";
}
const out = [];
for (const [n, y, hex] of require("./colors-raw.json")) {
  const t = C.lab(C.hex2rgb(hex)); let best = 1e9, bi = 0;
  labs.forEach((l, i) => { const d = C.de2000(t, l); if (d < best - 1e-9 || (Math.abs(d - best) < 1e-9 && combos[i].reduce((s, x) => s + x) < combos[bi].reduce((s, x) => s + x))) { best = d; bi = i; } });
  if (best > LIMIT) continue;
  out.push({ n, y, c: hex.toLowerCase(), r: combos[bi], d: +best.toFixed(2), f: family(t) });
}
const js = `// 重ね染めのデータ。tools/make-data.cjs が作る（手で直さない）。
// COLORS: n 名前・y 読み・c 色・r お手本の染め方（${VATS.map((v) => v.n).join("・")}の回数）・d お手本の色の差（ΔE2000）・f 色の仲間
window.KZ_DATA = ${JSON.stringify({ BASE, MAX, VATS, COLORS: out }).replace(/\{"n"/g, '\n {"n"')};
`;
fs.writeFileSync(path.join(__dirname, "..", "data.js"), js);
console.log(out.length, "colors", Object.entries(out.reduce((m, c) => (m[c.f] = (m[c.f] || 0) + 1, m), {})));
