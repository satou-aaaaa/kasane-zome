// SNS で貼られたときの絵（og.png 1200×630）を作る。今日の5色（答え）は入れない。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const cols = ["#33a6b8", "#cb1b45", "#e9cd4c", "#7ba23f", "#77428d"];
  const cloth = (c, i) => `<div style="width:84px;height:300px;background:${c};clip-path:polygon(0 0,100% 0,100% 92%,80% 97%,60% 93%,40% 98%,20% 94%,0 97%);transform:rotate(${(i % 2 ? 1 : -1) * 1.5}deg);transform-origin:top"></div>`;
  await p.setContent(`<body style="margin:0;font-family:'Noto Serif CJK JP','IPAPMincho','Noto Sans CJK JP',serif">
  <div style="width:1200px;height:630px;box-sizing:border-box;padding:70px 80px;background:radial-gradient(circle at 50% 0,#24324a,#11161f 75%);color:#efe8da;position:relative;overflow:hidden">
    <div style="font-size:34px;color:#d8b26a;letter-spacing:.1em">だれでも同じ 1日5色・3分</div>
    <div style="font-size:110px;font-weight:900;margin-top:20px;letter-spacing:.12em">重ね染め</div>
    <div style="font-size:42px;margin-top:24px;line-height:1.5">染め液を重ねて、<br>見本の伝統色を染める。</div>
    <div style="position:absolute;right:70px;top:150px;width:520px">
      <div style="height:14px;border-radius:7px;background:#8a6640;margin-left:-20px"></div>
      <div style="display:flex;gap:14px;justify-content:flex-end;margin-top:-2px">${cols.map(cloth).join("")}</div>
    </div>
  </div></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();
