// アプリのアイコン（icon-192.png・icon-512.png）を作る。藍鉄の地に、浅葱・紅・刈安の3枚の布。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    const cloth = (x, c) => `<path d="M${x} 30 h18 v40 l-3 3 -3 -2 -3 3 -3 -2 -3 3 -3 -2 z" fill="${c}"/>`;
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="g" cx="50%" cy="0%" r="110%"><stop offset="0" stop-color="#24324a"/><stop offset=".75" stop-color="#11161f"/></radialGradient></defs>
      <rect width="100" height="100" fill="url(#g)"/>
      ${cloth(20, "#33a6b8")}${cloth(41, "#cb1b45")}${cloth(62, "#e9cd4c")}
      <rect x="14" y="25" width="72" height="6" rx="3" fill="#8a6640"/></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
