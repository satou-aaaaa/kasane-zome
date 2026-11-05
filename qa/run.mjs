// 重ね染めの検査。データ（お手本が本当にいちばん近いか）・5色の組み方（何千回）・通しで遊ぶ・記録・続きから・上級・色帳・見立て・実績・カレンダー・あとから遊ぶ日・スマホ幅・PWA を確かめる。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = pathToFileURL(path.join(root, "index.html")).href; // # などを含むフォルダ名でも開ける
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
const C = createRequire(import.meta.url)(path.join(root, "tools/color.cjs"));

// 1. データ（ブラウザを使わない）
const sb = { window: {} }; vm.runInNewContext(readFileSync(path.join(root, "data.js"), "utf8"), sb);
const { BASE, MAX, VATS, COLORS } = sb.window.KZ_DATA;
check("伝統色は45色以上・名前が重ならない", COLORS.length >= 45 && new Set(COLORS.map((c) => c.n)).size === COLORS.length, `${COLORS.length}色`);
check("染め液は4つ（藍・紅花・刈安・紫根）", VATS.map((v) => v.n).join() === "藍,紅花,刈安,紫根");
const fams = new Set(COLORS.map((c) => c.f));
check("色の仲間が6種類以上（毎日いろいろな色が出る）", fams.size >= 6, [...fams].join(","));
check("どの色もお手本で近く染められる（色の差3.6以内・回数は上限以内）", COLORS.every((c) => c.d <= 3.6 && c.r.reduce((s, x) => s + x, 0) <= MAX && c.r.length === 4));
check("色の名前は6字以内・読みがある・色は #rrggbb", COLORS.every((c) => [...c.n].length <= 6 && c.y && /^#[0-9a-f]{6}$/.test(c.c)));
{ // お手本が本当にいちばん近い染め方か、すべての組み合わせを計算し直して確かめる（データの作り忘れ・式のずれを見つける）
  const base = C.hex2rgb(BASE).map(C.lin);
  const dye = (n) => C.rgb2hex(base.map((v, i) => C.gam(v * VATS.reduce((m, V, k) => m * V.t[i] ** n[k], 1))));
  const labs = []; for (let a = 0; a <= MAX; a++) for (let b = 0; a + b <= MAX; b++) for (let c = 0; a + b + c <= MAX; c++) for (let d = 0; a + b + c + d <= MAX; d++) labs.push(C.lab(C.hex2rgb(dye([a, b, c, d]))));
  const bad = COLORS.filter((c) => { const t = C.lab(C.hex2rgb(c.c)); const best = Math.min(...labs.map((l) => C.de2000(t, l))); return Math.abs(best - c.d) > 0.01 || Math.abs(C.de2000(t, C.lab(C.hex2rgb(dye(c.r)))) - c.d) > 0.01; });
  check("お手本の染め方は、ほかのどの組み合わせよりも見本に近い（全部計算し直し）", bad.length === 0, bad.map((c) => c.n).join(","));
}

const html = readFileSync(path.join(root, "index.html"), "utf8");
check("終えた回を消すのは同じ回のときだけ・0時を過ぎたホームの「今日」のボタンは描き直す（2026-11-04 CodeRabbit）", /c\.date === run\.date && c\.id === run\.id\) s2\.runs\[MODE\] = null/.test(html) && /\$\("go-d"\)\.onclick = \(\) => \(k !== todayKey\(\) \? home\(\)/.test(html));
check("別のタブで今日の分を終えたあと、古い画面から今日・上級をもう一度始めない（2026-11-04 CodeRabbit）", /\(mode === "d" && s\.days\[k\]\) \|\| \(mode === "h" && s\.hdays\[k\]\)\) return;/.test(html));
check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む。2026-11-04）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readFileSync(new URL("../README.md", import.meta.url), "utf8").replace(/\]\(https?:\/\/[^)\s]+\)/g, "").replace(/<https?:\/\/[^>\s]+>/g, "")));
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$/.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない", ext.length === 0, ext.join(","));
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("Math.random は練習・とことんの色選びだけ（今日の5色・上級は日付の乱数）", (html.match(/Math\.random/g) || []).length === 2);
{ const silly = /お笑い|ギャグ|ボケ|ツッコミ|なんでやねん|（うそ）/;
  check("画面にお笑いの言葉を入れない（本物っぽく）", !silly.test(html)); }
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/kasane-zome/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームの name が3字以上（「感想」の2字だと GitHub がフォームを出さず白紙の Issue になる。shared-workflows incidents/2026-11-05-feedback-form-not-shown.md）", [...((fy.match(/^name:\s*(.+)$/m) || [])[1] || "").trim()].length >= 3 && /^description:\s*\S/m.test(fy), (fy.match(/^name:.*$/m) || [""])[0]);
  check("感想フォームは名前・メールを聞かない（楽しさ・よかった所・直してほしい所だけ）", /id: fun/.test(fy) && /id: good/.test(fy) && /id: fix/.test(fy) && !/id: (name|email|mail)/.test(fy) && /labels: \["感想"\]/.test(fy)); }
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
  const need = ["./index.html", "./data.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
  check("PWA：ネットの返事の保存は、イベントの中で waitUntil に預ける（遅れて届いた新しい版も保存できる）", /e\.waitUntil\(Promise\.race\(\[net\.then[^\n]*Promise\.race\(\[caches\.open[^\n]*wait\(15000\)\]\); \}, \(\) => \{\}\)\.catch\(\(\) => \{\}\), wait\(60000\)\]\)\);/.test(sw) && !/\.then\([^\n]*e\.waitUntil/.test(sw));
  check("PWA：sw.js は画面のファイルを全部保存し、外へ何も送らない", need.every((f) => shell.includes(f)) && !/https?:\/\//.test(sw.replace(/^\/\/.*$/gm, "")));
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "重ね染め" && mf.icons.length >= 2 && mf.start_url === "./"); }

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const isNoise = (t) => /fonts\.(googleapis|gstatic)\.com|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|net::ERR_/.test(t);
const errors = [];
async function newPage(w = 390, h = 844) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("pageerror", (e) => errors.push(e.stack));
  page.on("console", (m) => { if (m.type() === "error" && !isNoise(m.text())) errors.push(m.text()); });
  await page.goto(url);
  await page.evaluate(() => localStorage.clear()); await page.reload();
  return page;
}
// お手本どおりに桶を押す
async function dyeRecipe(page) {
  const r = await page.evaluate(() => { const r = window.__kz.load().runs[window.__kz.mode()]; return window.__kz.D.COLORS[r.list[r.res.length]].r; });
  for (let k = 0; k < 4; k++) for (let j = 0; j < r[k]; j++) await page.click(`.vat[data-k="${k}"]`);
  return r;
}
try {
  const page = await newPage();

  // 2. 5色の組み方を何千回も作って毎回確かめる（2026-10-31 乱数の組み方を1回しか見ず0人の村ができた。shared-workflows incidents/2026-10-31-roppo-empty-village.md）
  const b = await page.evaluate(() => {
    const { pick, D } = window.__kz, bad = []; let same = 0;
    for (let s = 1; s <= 3000; s++) {
      const seed = (s * 2654435761) >>> 0;
      for (const hard of [false, true]) {
        const ex = hard ? pick(seed ^ 77) : [], l = pick(seed, hard, ex), cs = l.map((i) => D.COLORS[i]);
        const used = (c) => c.r.filter((x) => x > 0).length;
        if (l.length !== 5 || new Set(l).size !== 5) bad.push(`${s}:5色でない`);
        if (new Set(cs.map((c) => c.f)).size !== 5) bad.push(`${s}:仲間が重なる`);
        if (cs.filter((c) => used(c) >= (hard ? 3 : 2)).length < 2) bad.push(`${s}:やさしすぎる`);
        if (hard && l.some((i) => ex.includes(i))) bad.push(`${s}:上級に今日の色`);
        if (JSON.stringify(pick(seed, hard, ex)) === JSON.stringify(l)) same++;
      }
    }
    return { bad: bad.slice(0, 5), n: bad.length, same };
  });
  check("3000日分×2（今日・上級）組んで、毎回5色・仲間が重ならない・2液以上の色が入る・上級は今日の色と別", b.n === 0, b.bad.join(" | "));
  check("同じ日（同じ種）なら、だれでも同じ5色になる", b.same === 6000);
  const days = await page.evaluate(() => { const set = new Set(); for (let d = 1; d <= 60; d++) { const k = new Date(Date.UTC(2026, 10, 3 + d)).toISOString().slice(0, 10); set.add(window.__kz.dailyList(k).join()); } return set.size; });
  check("60日分の「今日の5色」がすべてちがう（飽きない）", days === 60, `${days}/60`);
  const same = await page.evaluate(() => { const { D, dyeHex, pctOf } = window.__kz; return D.COLORS.filter((c) => pctOf(c.r, c) !== 100).map((c) => c.n); });
  check("お手本どおりに染めると100%になる（画面の式とデータが同じ）", same.length === 0, same.join(","));
  { // 画面の染めの式を、検査側（tools/color.cjs）で別に計算した色と突き合わせる
    const base = C.hex2rgb(BASE).map(C.lin), want = (n) => C.rgb2hex(base.map((v, i) => C.gam(v * VATS.reduce((m, V, k) => m * V.t[i] ** n[k], 1))));
    const cases = [[0, 0, 0, 0], [2, 1, 3, 0], [5, 0, 0, 2], [0, 6, 1, 4], [12, 0, 0, 0]];
    const got = await page.evaluate((cs) => cs.map((n) => window.__kz.dyeHex(n)), cases);
    check("画面の染めの色が、検査側で別に計算した色と同じ（白い布は生成りのまま）", cases.every((n, i) => got[i] === want(n)) && got[0] === BASE, got.join(",")); }

  // 3. はじめての画面：遊び方が開く・Ko-fi のひとことは出ない
  check("はじめて開くと遊び方が出る", await page.locator("#howto[open]").count() === 1);
  await page.click("#howto-ok");
  check("遊ぶ前の画面に Ko-fi のひとことが無い", (await page.locator(".kofi").count()) === 0);
  check("遊び方・メニューに感想を送るリンクがある", (await page.getAttribute("#f-fb", "href")) === "https://github.com/satou-aaaaa/kasane-zome/issues/new?template=feedback.yml");

  // 4. 通しで遊ぶ：今日の5色をお手本どおりに染める（途中で読み込み直しても続きから）
  await page.click("#go-d");
  check("染める前は「決める」「戻す」が押せない", await page.isDisabled("#decide") && await page.isDisabled("#undo"));
  // 戻す・はじめから・上限
  await page.click('.vat[data-k="0"]'); await page.click('.vat[data-k="2"]'); await page.waitForTimeout(300);
  check("2回染めると回数が2になり、布の色が白から変わる", (await page.textContent("#cnum")).startsWith("2") && (await page.evaluate(() => getComputedStyle(document.getElementById("mine")).getPropertyValue("--col").trim())) !== "#f6f3ec");
  await page.click("#undo");
  check("ひとつ戻すと1回に戻る", (await page.textContent("#cnum")).startsWith("1") && (await page.textContent("#b2")) === "");
  await page.click("#reset");
  check("はじめからで白い布に戻る", (await page.textContent("#cnum")).startsWith("0") && (await page.textContent("#mine-r")) === "まだ白い布");
  for (let j = 0; j < 14; j++) await page.click('.vat[data-k="2"]');
  check("布が染まるのは12回まで", (await page.textContent("#cnum")).startsWith("12 "));
  await page.click("#reset");
  for (let i = 0; i < 5; i++) {
    if (i === 2) { await page.reload(); await page.click("#go-d"); }
    await dyeRecipe(page);
    await page.waitForTimeout(260);
    await page.click("#decide");
    const pct = await page.textContent(".verdict .pct");
    if (!pct.startsWith("100")) check(`${i + 1}色目をお手本どおりに染めると100%`, false, pct);
    check(i === 0 ? "決めたあとは染め液が押せない" : "", i !== 0 || await page.isDisabled('.vat[data-k="0"]'));
    await page.click("#next");
  }
  results.splice(0, results.length, ...results.filter((r) => r.name));
  check("5色お手本どおりで平均100%・星が15こ", (await page.textContent(".big")) === "平均 100%" && (await page.locator(".line .stars").evaluateAll((els) => els.map((e) => e.textContent).join(""))).replace(/[^★]/g, "").length >= 15);
  check("途中で読み込み直しても続きから（3色目から）で、結果は5色", (await page.locator(".line .it").count()) === 5);
  const share = await page.textContent(".share");
  check("シェアの文に番号・色の絵文字・星・平均があり、色の名前（答え）は出さない", /重ね染め #\d+/.test(share) && /[🟥🟧🟨🟩🟦🟪🟫⬜]{5}/u.test(share) && /平均 100%/.test(share) && !(await page.evaluate(() => { const k = window.__kz.todayKey(); return window.__kz.dailyList(k).some((i) => document.querySelector(".share").textContent.includes(window.__kz.D.COLORS[i].n)); })));
  check("X・LINE は押したときに開くリンクだけ", /^https:\/\/twitter\.com\/intent\/tweet\?text=/.test(await page.getAttribute("#toX", "href")) && /^https:\/\/line\.me\/R\/share\?text=/.test(await page.getAttribute("#toLine", "href")));
  check("初めて今日の5色を終えて平均80%以上なら、結果の下に Ko-fi のひとことが1行", (await page.locator(".kofi").count()) === 1);
  check("結果の画面に感想を送るリンク", (await page.locator("#fb").count()) === 1);
  check("今日の5色の結果に「続けて遊ぶ：とことん」の大きなボタン", (await page.locator("#go-e.main").count()) === 1);
  await page.click("#back");
  check("ホームで連続1日・今日の結果を見るに変わる（やり直しで結果を変えられない）", (await page.textContent(".stats")).includes("1連続") && (await page.textContent("#go-d")).includes("今日の結果を見る"));
  await page.click("#go-d");
  check("結果を見直しても Ko-fi のひとことは出ない（1回だけ）", (await page.locator(".kofi").count()) === 0 && (await page.textContent(".big")) === "平均 100%");
  await page.click("#back");

  // 5. 上級：見本は最初だけ。覚えるまで染められない・覚えたら隠れる・途中から続き
  await page.click("#go-h");
  check("上級は「覚えた」を押すまで染め液が押せない", await page.isDisabled('.vat[data-k="0"]') && await page.locator("#hid").isHidden());
  await page.click("#memo");
  check("覚えたら見本が隠れて、染め液が押せる", await page.locator("#hid").isVisible() && !(await page.isDisabled('.vat[data-k="0"]')));
  await page.click('.vat[data-k="1"]'); await page.click("#decide");
  check("決めたあとは見本をもう一度見せて比べる", await page.locator("#hid").isHidden());
  const hl = await page.evaluate(() => { const k = window.__kz.todayKey(); return { h: window.__kz.hardList(k), d: window.__kz.dailyList(k) }; });
  check("上級の5色は今日の5色と重ならない", !hl.h.some((i) => hl.d.includes(i)));
  await page.reload(); await page.click("#howto-ok").catch(() => {});
  check("上級も途中で閉じたら続きから", (await page.textContent("#go-h")).includes("続きから"));
  await page.click("#go-h");
  check("続きは2色目から", (await page.textContent("header")).includes("2/5"));
  await page.click("#memo"); await page.reload(); await page.click("#go-h");
  check("上級で「覚えた」を押したあと開き直しても、見本は隠れたまま・すぐ染められる", await page.locator("#hid").isVisible() && (await page.locator("#memo").count()) === 0 && !(await page.isDisabled('.vat[data-k="0"]')));
  // 別のタブで同じ色を先に決めていたら、この画面の答えは入れない
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("kasane-v1")); s.runs.h.res.push({ n: [1, 0, 0, 0], p: 50 }); localStorage.setItem("kasane-v1", JSON.stringify(s)); });
  await page.click('.vat[data-k="0"]'); await page.click("#decide");
  check("別のタブで先に進んでいたら、古い画面の答えは足さず今の色を出し直す", (await page.evaluate(() => window.__kz.load().runs.h.res.length)) === 2 && (await page.textContent("header")).includes("3/5"));
  await page.click("#back");
  // 練習を始めても上級の途中経過は消えない
  await page.click("#go-p"); await page.click("#back");
  check("練習を始めても、上級の途中経過は消えない（続きから）", (await page.textContent("#go-h")).includes("続きから") && (await page.evaluate(() => window.__kz.load().runs.h.res.length)) === 2);

  // 6. 練習と色帳
  const before = await page.evaluate(() => Object.keys(window.__kz.load().days).length);
  await page.click("#go-p");
  // 別のタブで練習を作り直していたら、古い練習の画面の答えは新しい練習に入れない
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("kasane-v1")); s.runs.p.id = "other-tab"; s.runs.p.list = s.runs.p.list.slice().reverse(); localStorage.setItem("kasane-v1", JSON.stringify(s)); });
  await page.click('.vat[data-k="3"]'); await page.click("#decide");
  check("別のタブで練習を作り直していたら、古い練習の答えは入れない", (await page.evaluate(() => window.__kz.load().runs.p.res.length)) === 0);
  await page.click("#back"); await page.click("#go-p");
  for (let i = 0; i < 5; i++) { await page.click('.vat[data-k="3"]'); await page.click("#decide"); await page.click("#next"); }
  check("練習は今日の記録を増やさず、シェアと Ko-fi を出さない", (await page.evaluate(() => Object.keys(window.__kz.load().days).length)) === before && (await page.locator(".kofi, #share").count()) === 0);
  await page.click("#go-dex");
  // 練習の5色は乱数なので今日の色と重なることがある（2026-11-04 CI で「10色以上」が8色で落ちた）。決まって載る色だけを数える
  const dexOk = await page.evaluate(() => { const { load, dailyList, hardList, todayKey, D } = window.__kz, s = load(), k = todayKey(); return { n: Object.keys(s.dex).length, must: [...dailyList(k), hardList(k)[0]].every((i) => D.COLORS[i].n in s.dex) }; });
  const seen = dexOk.n;
  check("色帳に出会った色が載る（今日の5色・上級の1色目・練習）", dexOk.must && seen >= 6 && (await page.locator(".dex .cloth").count()) === seen, `${seen}色`);
  await page.locator(".dex button:has(.cloth)").first().click();
  check("色帳の色を押すと名前と、その色だけの練習が出る", (await page.locator(".sheet h3").count()) === 1 && (await page.locator("#prac").count()) === 1);
  await page.click("#prac");
  check("その色だけの練習は1色", (await page.textContent("header")).includes("1/1"));
  await page.close();

  // 7. 低い点のときは Ko-fi を出さない
  { const p2 = await newPage(); await p2.click("#howto-ok"); await p2.click("#go-d");
    for (let i = 0; i < 5; i++) { await p2.click('.vat[data-k="3"]'); await p2.click("#decide"); await p2.click("#next"); }
    check("平均が80%に届かないときは Ko-fi のひとことを出さない", (await p2.locator(".kofi").count()) === 0);
    await p2.close(); }
  { // とことん：次々に出る・使う液の少ない色から多い色へ・見立てと85%未満の色で🎫を使う・降りると自己ベスト（2026-11-05 satou さん「一日で遊べる量が少なすぎる」）
    const pe = await newPage(); await pe.click("#howto-ok");
    const L = await pe.evaluate(() => { const g = window.__kz, n = g.D.COLORS.length; for (let r = 0; r < 500; r++) { const L = g.endlessList(); if (L.length !== n || new Set(L).size !== n) return "全部の色を1回ずつでない"; const t = L.map((i) => g.vatsUsed(g.D.COLORS[i])); if (t.some((x, i) => i && x < t[i - 1])) return "難しさが下がる"; } return g.endlessList().join() === g.endlessList().join() ? "毎回同じ並び" : "ok"; });
    check("とことんの並び（500回）：全部の色を1回ずつ・使う液の少ない色から多い色へ・毎回ちがう並び", L === "ok", L);
    check("ホームに「とことん」の大きなボタン", (await pe.locator("#go-e.main").count()) === 1);
    const bad = async () => { const k = await pe.evaluate(() => { const g = window.__kz, r = g.load().runs.e, c = g.D.COLORS[r.list[r.res.length]]; for (let k = 0; k < 4; k++) { const n = [0, 0, 0, 0]; n[k] = 1; if (g.pctOf(n, c) < g.EPASS) return k; } return -1; }); await pe.click(`.vat[data-k="${k}"]`); await pe.waitForTimeout(260); await pe.click("#decide"); return k; };
    await pe.click("#go-e");
    for (let j = 0; j < 2; j++) { await dyeRecipe(pe); await pe.waitForTimeout(260); await pe.click("#decide"); await pe.click("#next"); }
    check("とことんは何色目かを出し、🎫が3枚・お手本どおりなら🎫は減らない", (await pe.textContent("header")).includes("3色目") && (await pe.evaluate(() => window.__kz.load().runs.e.life)) === 3);
    const k1 = await bad();
    check("とことんで85%に届かない色は🎫を1枚使う", k1 >= 0 && (await pe.evaluate(() => window.__kz.load().runs.e.life)) === 2 && (await pe.locator("#etk").count()) === 1);
    await pe.click("#next");
    await pe.click('.vat[data-k="0"]'); await pe.waitForTimeout(260); await pe.click("#mitate");
    check("とことんの見立ても🎫を1枚使う", (await pe.evaluate(() => window.__kz.load().runs.e.life)) === 1 && (await pe.locator(".mitate").count()) === 1 && (await pe.textContent("#life")).startsWith("🎫"));
    await pe.reload(); await pe.click("#go-e");
    check("とことんは途中で閉じても続きから（4色目・🎫1のまま）", (await pe.textContent("header")).includes("4色目") && (await pe.evaluate(() => window.__kz.load().runs.e.life)) === 1);
    await pe.click("#quit");
    check("降りると染めた色の数と自己ベスト更新が出て、記録に残る（今日の記録・連続には入らない）", (await pe.textContent("#eres")).includes("3色") && (await pe.textContent("#ebest")).includes("自己ベスト更新") && (await pe.evaluate(() => { const s = window.__kz.load(); return s.ebest === 3 && !s.runs.e && Object.keys(s.days).length === 0 && Object.keys(s.dex).length >= 3; })));
    check("とことんの終わりにシェア・Ko-fi を出さない", (await pe.locator("#share, .kofi").count()) === 0);
    await pe.click("#go-e"); await pe.click("#quit");
    check("ベストに届かないと、ベストと「あと何色で更新」を出し、ベストは下げない", (await pe.textContent("#ebest")).includes("あと4色で更新") && (await pe.evaluate(() => window.__kz.load().ebest)) === 3);
    await pe.click("#back");
    check("ホームのとことんのボタンに自己ベスト", (await pe.textContent("#go-e")).includes("自己ベスト 3色"));
    await pe.click("#go-e");
    await pe.evaluate(() => { const s = JSON.parse(localStorage.getItem("kasane-v1")); s.runs.e.life = 0; localStorage.setItem("kasane-v1", JSON.stringify(s)); }); await pe.click("#back"); await pe.click("#go-e");
    await pe.click('.vat[data-k="0"]'); await pe.waitForTimeout(260);
    check("🎫が無いと見立ては押せない", await pe.isDisabled("#mitate"));
    await pe.click("#reset"); await dyeRecipe(pe); await pe.waitForTimeout(260); await pe.click("#decide"); await pe.click("#next");
    await bad();
    check("🎫が無いときに85%に届かないと終わりを知らせ、ボタンは「結果を見る」", (await pe.textContent("#etk")).includes("ここまで") && (await pe.textContent("#next")) === "結果を見る" && (await pe.locator("#quit").count()) === 0);
    await pe.click("#next");
    check("終わりの画面は届かなかった色を数に入れない（1色）・ベストは下げない", (await pe.locator("#eout").count()) === 1 && (await pe.textContent("#eres")).includes("1色") && (await pe.evaluate(() => window.__kz.load().ebest)) === 3 && (await pe.locator("#go-e.main").count()) === 1);
    await pe.close(); }

  // 8. スマホ幅：横にはみ出さない・押せる所は44px以上
  for (const w of [320, 390]) {
    const p3 = await newPage(w, 700); const fb2 = await p3.evaluate(() => { const a = document.querySelector("#howto #fb2"); return a ? a.getBoundingClientRect().height : 0; }); check(`幅${w}px：遊び方の「感想を送る」も高さ44px以上`, fb2 >= 44, `${fb2}px`); await p3.click("#howto-ok");
    const homeOk = await p3.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    await p3.click("#go-d");
    const r = await p3.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth, small: [...document.querySelectorAll("button, a")].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim() || e.id) }));
    check(`幅${w}px：横にはみ出さず、押せる所は高さ44px以上`, homeOk && !r.over && r.small.length === 0, r.small.join(","));
    await p3.close();
  }
  { // 保存できないブラウザでも遊べる（開いているあいだは途中経過を覚えている）
    const pb = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pb.on("pageerror", (e) => errors.push(e.message));
    await pb.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error("blocked"); }; });
    await pb.goto(url); await pb.click("#howto-ok"); await pb.click("#go-d");
    check("保存できないブラウザでも、今日の1問目が始まる", (await pb.textContent("header")).includes("1/5"));
    await pb.click("#back");
    check("保存できないブラウザでも、遊び方が何度も開かない", !(await pb.locator("#howto[open]").count()));
    await pb.close(); }
  { // 前の記録が残っていて、書き込みだけ失敗する（容量いっぱいなど）ときも、メモリの新しい進み具合を使う
    const pq = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pq.on("pageerror", (e) => errors.push(e.message));
    await pq.addInitScript(() => { const orig = Storage.prototype.setItem; orig.call(localStorage, "kasane-v1", JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, dex: {}, kofi: {}, runs: {} })); Storage.prototype.setItem = () => { throw new Error("full"); }; });
    await pq.goto(url); await pq.click("#go-d");
    check("前の記録があり書き込みだけ失敗しても、今日の1問目が始まる", (await pq.textContent("header")).includes("1/5"));
    await pq.close(); }
  { // 0時の前に最後の1問を終えて閉じ、翌日に開いても、終えた日の記録として残る
    { // 今日の結果を開いたまま0時を過ぎてから「上級」を押しても、翌日の上級は始めない
    const pm = await newPage();
    await pm.evaluate(() => { const g = window.__kz, k = new Date(Date.parse(g.todayKey())).toISOString().slice(0, 10); localStorage.setItem("kasane-v1", JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, dex: {}, kofi: {}, runs: { d: { mode: "d", date: k, list: g.dailyList(k), res: [0, 1, 2, 3, 4].map(() => ({ n: [1, 0, 0, 0], p: 90 })) } } })); });
    await pm.reload();
    const had = await pm.locator("#go-h").count();
    await pm.evaluate(() => { const RD = Date, off = 864e5; window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }; }); // 時計を1日進める
    if (had) await pm.click("#go-h");
    check("結果を開いたまま日付が変わったら、上級のボタンを押しても翌日の上級は始まらない", had > 0 && (await pm.evaluate(() => window.__kz.mode())) !== "h");
    await pm.close(); }
    const pn = await newPage();
    await pn.evaluate(() => { const g = window.__kz, k = new Date(Date.parse(g.todayKey()) - 864e5).toISOString().slice(0, 10); localStorage.setItem("kasane-v1", JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, dex: {}, kofi: {}, runs: { d: { mode: "d", date: k, list: g.dailyList(k), res: [0, 1, 2, 3, 4].map(() => ({ n: [1, 0, 0, 0], p: 90 })) } } })); });
    await pn.reload();
    check("前の日に5色を終えて閉じても、翌日に開くとその日の記録がつく", await pn.evaluate(() => { const g = window.__kz, k = new Date(Date.parse(g.todayKey()) - 864e5).toISOString().slice(0, 10); return !!g.load().days[k] && !g.load().runs.d; }));
    check("前の日の結果の画面からは、今日の上級を始められない（今日の分を先に）", !(await pn.locator("#go-h").count()));
    check("保存に失敗したあと別のタブが新しく保存していたら、古いメモリで上書きせずそちらを読む", await pn.evaluate((K) => { const g = window.__kz, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 1, tagA: 1 })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 2, tagB: 1 }))); const r = g.load(); mem = null; return !!r.tagB && !r.tagA; }, "kasane-v1"));
    check("保存に失敗したあと別のタブが保存しても、両方の記録（日ごとの結果）を残す", await pn.evaluate((K) => { const g = window.__kz, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 5, days: { "2000-01-01": s0.days[Object.keys(s0.days)[0]] || 1 } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, days: { "2000-01-02": 1 } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && !!r.days["2000-01-02"]; }, "kasane-v1"));
    check("保存に失敗したタブの時刻が進んでいても、別のタブで先に進んだ途中経過を古いメモリで戻さない", await pn.evaluate((K) => { const g = window.__kz, s0 = g.load(), base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0 }; mem = JSON.stringify(Object.assign({}, s0, { t: 99, runs: Object.assign({}, s0.runs, { d: Object.assign({}, base) }) })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 1, runs: Object.assign({}, s0.runs, { d: Object.assign({}, base, { res: [{}, {}], i: 2 }) }) }))); const r = g.load(); mem = null; return r.runs.d.res.length === 2 && r.runs.d.i === 2; }, "kasane-v1"));
    check("保存に失敗したタブにだけある途中経過は、別のタブが保存しても消さない（その日を終えた記録があれば null を使う・終えた回は日ごとの結果に残す）", await pn.evaluate((K) => { const g = window.__kz, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (a, b, dd) => { mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: a })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: b }, dd ? { days: Object.assign({}, s0.days, dd) } : {}))); const r = g.load(); mem = null; return r; }; const r1 = put({ d: base }, {}), r2 = put({ d: base }, { d: null }, { "2000-01-01": 1 }), r3 = put({ d: base }, { d: null }), r4 = put({ d: done }, { d: null }); return !!r1.runs.d && r1.runs.d.date === "2000-01-01" && r2.runs.d === null && !!r3.runs.d && r3.runs.d.date === "2000-01-01" && r4.runs.d === null && !!r4.days["2000-01-01"]; }, "kasane-v1"));
    check("同じ進み具合なら、新しく保存したほうの途中経過を使う", await pn.evaluate((K) => { const g = window.__kz, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (ta, tb) => { mem = JSON.stringify(Object.assign({}, s0, { t: ta, runs: { d: Object.assign({}, base, { zz: "a" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: tb, runs: { d: Object.assign({}, base, { zz: "b" }) } }))); const r = g.load(); mem = null; return r.runs.d.zz; }; return put(9, 5) === "a" && put(5, 9) === "b"; }, "kasane-v1"));
    check("結果を見る前に別のタブが次の日を保存しても、終えた日の記録を残す", await pn.evaluate((K) => { const g = window.__kz, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: { d: done } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: { d: Object.assign({}, base, { date: "2000-01-02" }) } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && r.runs.d.date === "2000-01-02"; }, "kasane-v1"));
    check("同じ問題の練習をやり直したら、前の回（終えたもの）と取り違えず新しい回を使う", await pn.evaluate((K) => { const g = window.__kz, s0 = g.load(), base = { mode: "p", date: "2000-01-01", list: [1], tags: [1], res: [], i: 0, hints: [] }; mem = JSON.stringify(Object.assign({}, s0, { t: 9, runs: { p: Object.assign({}, base, { id: "new" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 5, runs: { p: Object.assign({}, base, { id: "old", res: [{}], i: 1 }) } }))); const r = g.load(); mem = null; return r.runs.p.id === "new"; }, "kasane-v1"));
    check("保存に失敗したあと別のタブが保存しても、帳の★は高いほうを残す", await pn.evaluate((K) => { const g = window.__kz, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 5, dex: { zz: 3 } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, dex: { zz: 1 } }))); const r = g.load(); mem = null; return r.dex.zz === 3; }, "kasane-v1"));
    check("保存に失敗したあと別のタブが別の日を「あとから」始めていても、保存の新しい側の日を続け、もう一方の日を apark に預けて消さない", await pn.evaluate((K) => { const g = window.__kz, s0 = g.load(), A = { mode: "a", date: "2000-01-05", list: [1, 2, 3], res: [{ p: 90, n: [1, 0, 0, 0] }], id: "A" }, B = { mode: "a", date: "2000-01-06", list: [1, 2, 3], res: [], id: "B" }; mem = JSON.stringify(Object.assign({}, s0, { t: 9, runs: Object.assign({}, s0.runs, { a: A }), apark: {} })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 5, runs: Object.assign({}, s0.runs, { a: B }), apark: {} }))); const r = g.load(); mem = null; localStorage.setItem(K, JSON.stringify(s0)); return r.runs.a.date === "2000-01-05" && r.runs.a.res.length === 1 && !!r.apark["2000-01-06"]; }, "kasane-v1"));
    check("保存に失敗したあと、あとからの途中経過は保存の新しい側を続け、預かりは進んだほうを残す", await pn.evaluate((K) => { const g = window.__kz, s0 = g.load(), A1 = { mode: "a", date: "2000-01-05", list: [1, 2, 3], res: [{ p: 90, n: [1, 0, 0, 0] }, { p: 80, n: [1, 0, 0, 0] }], id: "A" }, A0 = Object.assign({}, A1, { res: A1.res.slice(0, 1) }), B = { mode: "a", date: "2000-01-06", list: [1, 2, 3], res: [], id: "B" }; mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: Object.assign({}, s0.runs, { a: A1 }), apark: {} })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: Object.assign({}, s0.runs, { a: B }), apark: { "2000-01-05": A0 } }))); const r = g.load(); mem = null; localStorage.setItem(K, JSON.stringify(s0)); return r.runs.a.date === "2000-01-06" && r.apark["2000-01-05"].res.length === 2; }, "kasane-v1"));
    check("保存に失敗したあと、同じ日の預かりどうしも進んだほうを残す（新しい側の預かりが遅れていても戻さない）", await pn.evaluate((K) => { const g = window.__kz, s0 = g.load(), A2 = { mode: "a", date: "2000-01-05", list: [1, 2, 3], res: [{ p: 90, n: [1, 0, 0, 0] }, { p: 80, n: [1, 0, 0, 0] }], id: "A" }, A1 = Object.assign({}, A2, { res: A2.res.slice(0, 1) }); const put = (m, l) => { mem = JSON.stringify(m); localStorage.setItem(K, JSON.stringify(l)); const r = g.load(); mem = null; return r; }; const r1 = put(Object.assign({}, s0, { t: 5, apark: { "2000-01-05": A2 } }), Object.assign({}, s0, { t: 9, apark: { "2000-01-05": A1 } })), r2 = put(Object.assign({}, s0, { t: 9, apark: { "2000-01-05": A1 } }), Object.assign({}, s0, { t: 5, apark: { "2000-01-05": A2 } })); localStorage.setItem(K, JSON.stringify(s0)); return r1.apark["2000-01-05"].res.length === 2 && r2.apark["2000-01-05"].res.length === 2; }, "kasane-v1"));
    check("保存に失敗したあと、同じ進み具合なら見立てを使った印のある側を残す（runs と同じ日の預かりの両方）", await pn.evaluate((K) => { const g = window.__kz, s0 = g.load(), H = { mode: "a", date: "2000-01-05", list: [1, 2, 3], res: [{ p: 90, n: [1, 0, 0, 0] }], id: "A", hint: 1 }, N = Object.assign({}, H); delete N.hint; const put = (m, l) => { mem = JSON.stringify(m); localStorage.setItem(K, JSON.stringify(l)); const r = g.load(); mem = null; return r; }; const r1 = put(Object.assign({}, s0, { t: 5, apark: { "2000-01-05": H } }), Object.assign({}, s0, { t: 9, apark: { "2000-01-05": N } })), r2 = put(Object.assign({}, s0, { t: 5, runs: Object.assign({}, s0.runs, { a: H }) }), Object.assign({}, s0, { t: 9, runs: Object.assign({}, s0.runs, { a: N }) })); localStorage.setItem(K, JSON.stringify(s0)); return r1.apark["2000-01-05"].hint === 1 && r2.runs.a.hint === 1; }, "kasane-v1"));
    check("保存に失敗したあと、同じ日を別のタブで始め直していても（id がちがう）、あとからの途中経過は進んだほうを残す（2026-11-05 CodeRabbit）", await pn.evaluate((K) => { const g = window.__kz, s0 = g.load(), A = { mode: "a", date: "2000-01-05", list: [1, 2, 3], res: [{ p: 90, n: [1, 0, 0, 0] }], id: "A" }, B = { mode: "a", date: "2000-01-05", list: [1, 2, 3], res: [], id: "B" }; const run = (m, l) => { mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: Object.assign({}, s0.runs, { a: m }) })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: Object.assign({}, s0.runs, { a: l }) }))); const r = g.load(); mem = null; localStorage.setItem(K, JSON.stringify(s0)); return r.runs.a.res.length; }; return run(A, B) === 1 && run(B, A) === 1; }, "kasane-v1"));
    check("保存に失敗したあと、どちらの側が古い形（late・ach などが無い）でも、新しい記録の置き場を失わない", await pn.evaluate((K) => { const g = window.__kz, s0 = g.load(), old = { v: 1, tut: true, days: s0.days, hdays: {}, dex: {}, kofi: {}, runs: {} }, neu = Object.assign({}, old, { late: { "2000-01-03": { p: [90], n: [[1, 0, 0, 0]] } }, ach: { first: 1 }, apark: { "2000-01-04": { mode: "a", date: "2000-01-04", list: [1], res: [], id: "p" } } }); const put = (m, l) => { mem = JSON.stringify(m); localStorage.setItem(K, JSON.stringify(l)); const r = g.load(); mem = null; return r; }; const ok = (r) => !!r.late["2000-01-03"] && r.ach.first === 1 && !!(r.apark || {})["2000-01-04"]; const r1 = put(Object.assign({ t: 9 }, old), Object.assign({ t: 5 }, neu)), r2 = put(Object.assign({ t: 5 }, neu), Object.assign({ t: 9 }, old)); localStorage.setItem(K, JSON.stringify(s0)); return ok(r1) && ok(r2); }, "kasane-v1"));
    check("時計が戻っても、保存の時刻 t は前より大きくなる", await pn.evaluate((K) => { const s0 = JSON.parse(localStorage.getItem(K)); const far = Date.now() + 1e9; localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: far }))); save(() => {}); return JSON.parse(localStorage.getItem(K)).t > far; }, "kasane-v1"));
    await pn.close(); }
  { // 最後の1問を終えて「結果を見る」を押す前に閉じた日は、開き直すと結果へ進み記録がつく
    const pc = await newPage();
    await pc.evaluate(() => { const g = window.__kz, k = g.todayKey(); localStorage.setItem("kasane-v1", JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, dex: {}, cnt: 0, clean: 0, kofi: {}, runs: { d: { mode: "d", date: k, list: g.dailyList(k), res: [0, 1, 2, 3, 4].map(() => ({ n: [1, 0, 0, 0], p: 90 })) } } })); });
    await pc.reload();
    check("最後の1問のあと閉じても、開き直すと結果へ進み今日の記録がつく", await pc.evaluate(() => { const g = window.__kz; return !!g.load().days[g.todayKey()] && !g.load().runs.d; }));
    await pc.close(); }
  // 9. 見立て：1色に1回・方向だけを言う・上級には無い・使ったら記録に残る
  { const pv = await newPage(); await pv.click("#howto-ok");
    const adv = await pv.evaluate(() => { const { D, adviceOf } = window.__kz; const okRecipe = D.COLORS.every((c) => adviceOf(c.r, c) === "もう見本どおり"); const words = new Set(); let leak = 0; for (const c of D.COLORS) for (let k = 0; k < 4; k++) { const n = [0, 0, 0, 0]; n[k] = 1; const a = adviceOf(n, c); words.add(a); if (/\d|藍|紅花|刈安|紫根/.test(a)) leak++; } return { okRecipe, words: [...words], leak }; });
    check("見立て：お手本どおりなら「もう見本どおり」、言うのは濃さ・色みの向きだけ（液の名前・回数は言わない）", adv.okRecipe && adv.leak === 0 && adv.words.every((w) => /^(もう見本どおり|もっと濃く|濃すぎる|(赤|緑|黄|青)みが足りない)$/.test(w)), adv.words.join(","));
    await pv.click("#go-d");
    check("見立ては染める前は押せない", await pv.isDisabled("#mitate"));
    await pv.click('.vat[data-k="1"]'); await pv.waitForTimeout(260); await pv.click("#mitate");
    check("見立てを押すと一言が出て、その色ではもう押せない", (await pv.locator(".mitate").count()) === 1 && await pv.isDisabled("#mitate"));
    await pv.reload(); await pv.click("#go-d");
    await pv.click('.vat[data-k="1"]'); await pv.waitForTimeout(260);
    check("見立てを使った色は、開き直しても使ったまま（1色に1回）", await pv.isDisabled("#mitate") && (await pv.textContent("#mitate")) === "見立て済");
    await pv.click("#decide");
    check("決めたあと、目盛りと見立ての一言が出る", (await pv.locator(".verdict .meter").count()) === 1 && /見立て：/.test(await pv.textContent(".verdict .note")));
    await pv.click("#next");
    check("次の色では、また見立てを使える", !(await pv.locator(".mitate").count()) && (await pv.textContent("#mitate")) === "見立て");
    // 別のタブで同じ色の見立てを使っていたら、この画面ではもう使えない（2026-11-04 CodeRabbit）
    await pv.click('.vat[data-k="1"]'); await pv.waitForTimeout(260);
    await pv.evaluate(() => { const s = JSON.parse(localStorage.getItem("kasane-v1")); s.runs.d.hint = 1; localStorage.setItem("kasane-v1", JSON.stringify(s)); });
    await pv.click("#mitate");
    check("別のタブで同じ色の見立てを使っていたら、古い画面では二度目を出さない", (await pv.locator(".mitate").count()) === 0 && (await pv.textContent("#mitate")) === "見立て済");
    await pv.click("#reset");
    for (let i = 1; i < 5; i++) { await dyeRecipe(pv); await pv.waitForTimeout(260); if (i === 3) { await pv.evaluate(() => { const s = JSON.parse(localStorage.getItem("kasane-v1")); s.runs.d.hint = 3; localStorage.setItem("kasane-v1", JSON.stringify(s)); }); const n0 = await pv.evaluate(() => window.__kz.cur().n.slice()); await pv.click("#decide"); const r3 = await pv.evaluate(() => window.__kz.load().runs.d.res[3]); check("別のタブでこの色の見立てを使っていたら、古い画面で決めても染めた回数のまま印（h）を付けて残す（2026-11-05 CodeRabbit）", !!r3 && r3.h === 1 && JSON.stringify(r3.n) === JSON.stringify(n0) && n0.some((x) => x), JSON.stringify({ r3, n0 })); } else await pv.click("#decide"); if (i === 1) check("お手本どおり（100%）に染めると「ぴたり」が出る", (await pv.locator(".pitari").count()) === 1); await pv.click("#next"); }
    const rec = await pv.evaluate(() => { const g = window.__kz; return g.load().days[g.todayKey()]; });
    check("見立てを使った色は、日ごとの記録に印（h）が残る", JSON.stringify(rec.h) === "[1,1,0,1,0]", JSON.stringify(rec.h));
    await pv.click("#back"); await pv.click("#go-h");
    check("上級（記憶染め）には見立てが無い", (await pv.locator("#mitate").count()) === 0);
    await pv.click("#memo"); await pv.click('.vat[data-k="3"]'); await pv.click("#decide");
    check("上級の決めたあとにも「見立て：」は出さない（2026-11-04 CodeRabbit）", !(await pv.textContent(".verdict")).includes("見立て"));
    await pv.close(); }

  // 10. 実績：いまの記録から数える・10〜14こ・まだのものは進み具合・取れたら結果に小さく1回だけ
  { const pa = await newPage(); await pa.click("#howto-ok");
    const t = await pa.evaluate(() => { const g = window.__kz, N = g.D.COLORS.length; const rec = (p, h) => ({ p, n: p.map(() => [1, 0, 0, 0]), h });
      const s = { v: 1, days: { "2026-11-05": rec([100, 96, 95, 99, 100], [0, 0, 0, 0, 0]), "2026-11-06": rec([60, 70, 80, 90, 100], [1, 0, 0, 0, 0]), "2026-11-07": 1 }, hdays: { "2026-11-05": rec([90, 85, 80, 88, 86]) }, late: { "2026-11-04": rec([100, 100, 50, 50, 50]) }, dex: Object.fromEntries(g.D.COLORS.slice(0, 13).map((c) => [c.n, 3])), runs: {}, kofi: {}, ach: {} };
      const L = g.achList(s), by = Object.fromEntries(L.map((a) => [a.id, a])), t = g.tally(s);
      return { n: L.length, t, by, N, fams: new Set(g.D.COLORS.slice(0, 13).map((c) => c.f)).size, empty: g.achList({ v: 1, days: {}, hdays: {}, late: {}, dex: {}, runs: {} }).filter((a) => a.got).length }; });
    check("実績は10〜14こ（腕前・集める・続けるを混ぜる）", t.n >= 10 && t.n <= 14 && ["first", "days7", "hard5"].every((k) => t.by[k]) && ["full3", "clean", "hard", "pitari"].every((k) => t.by[k]) && ["dex4", "dexall", "fam"].every((k) => t.by[k]), `${t.n}こ`);
    check("実績の数え方：日数・ぴたり（あとからも数える）・★3の最多・見立てなし・上級の最高・色帳・色の仲間", t.t.days === 3 && t.t.pitari === 5 && t.t.best3 === 5 && t.t.clean === 1 && t.t.hbest === 86 && t.t.seen === 13 && t.t.fam === t.fams && t.t.hdays === 1, JSON.stringify(t.t));
    check("実績：取れたものは達成、まだのものは進み具合（3/7 のように）", t.by.full3.got && t.by.clean.got && t.by.hard.got && t.by.dex4.got && !t.by.days7.got && t.by.days7.cur === 3 && t.by.days7.goal === 7 && !t.by.dexall.got && t.by.dexall.goal === t.N && t.by.pitari10.cur === 5);
    check("記録が空なら、取れている実績は0", t.empty === 0);
    await pa.click("#go-ach");
    check("ホームから実績の画面が開き、全部の実績と進み具合が出る", (await pa.locator(".ach").count()) === t.n && (await pa.locator(".ach .pg").first().textContent()) === "0/1");
    await pa.click("#back"); await pa.click("#go-d");
    for (let i = 0; i < 5; i++) { await dyeRecipe(pa); await pa.waitForTimeout(260); await pa.click("#decide"); await pa.click("#next"); }
    check("新しく取れた実績は、結果の画面に小さく「🏅 実績：」と出る", /🏅 実績：/.test(await pa.textContent("#newach").catch(() => "")));
    await pa.click("#back"); await pa.click("#go-d");
    check("同じ実績は、結果を見直しても二度は知らせない", (await pa.locator("#newach").count()) === 0);
    await pa.close(); }

  // 11. 取りこぼした日（過去7日）：何百日分も、日付どおり・遊んでいない日だけ・7日以内
  { const pd = await newPage();
    const r = await pd.evaluate(() => { const g = window.__kz, bad = []; const add = (k, n) => new Date(Date.parse(k) + n * 864e5).toISOString().slice(0, 10); let total = 0;
      for (let i = 0; i < 400; i++) { const k = add(g.EPOCH, i), s = { days: {}, late: {} };
        for (let j = 1; j <= 9; j++) { const d = add(k, -j), x = (i * 7 + j * 13) % 5; if (x === 0) s.days[d] = { p: [90] }; else if (x === 1) s.late[d] = { p: [90] }; }
        const m = g.missedDays(s, k); total += m.length;
        for (const d of m) { if (!(d < k && d >= add(k, -7) && d >= g.EPOCH)) bad.push(`${k}:${d}範囲外`); if (s.days[d] || s.late[d]) bad.push(`${k}:${d}遊んだ日`); }
        for (let j = 1; j <= 7; j++) { const d = add(k, -j); if (d >= g.EPOCH && !s.days[d] && !s.late[d] && !m.includes(d)) bad.push(`${k}:${d}抜け`); }
        if (m.join() !== m.slice().sort().reverse().join()) bad.push(`${k}:順`);
        if (m.length && JSON.stringify(g.dailyList(m[0])) !== JSON.stringify(g.pick(g.seedOf(m[0])))) bad.push(`${k}:問題がちがう`); }
      return { bad: bad.slice(0, 5), n: bad.length, total, first: g.missedDays({ days: {}, late: {} }, g.EPOCH).length }; });
    check("400日分：取りこぼした日は、きのう〜7日前の遊んでいない日だけ・始まりの日より前は無い・その日の5色と同じ問題", r.n === 0 && r.total > 400 && r.first === 0, r.bad.join(" | "));
    await pd.close(); }
  { // 時計を10日進めて、あとから遊ぶ（今日の記録・連続の日・Ko-fi・シェアには数えない。色帳には載る。今日の途中経過を消さない）
    const pl = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pl.on("pageerror", (e) => errors.push(e.stack));
    await pl.addInitScript(() => { const RD = Date, off = Date.parse("2026-11-20T03:00:00Z") - RD.now(); /* 決まった日にする（今日から何日後だと、月をまたぐ日に失敗する。2026-11-04 天気図よみで CodeRabbit が指摘） */ window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }; });
    await pl.goto(url);
    const set = await pl.evaluate(() => { const g = window.__kz, k = g.todayKey(), add = (n) => new Date(Date.parse(k) + n * 864e5).toISOString().slice(0, 10), rec = { p: [90, 90, 90, 90, 90], n: [[1, 0, 0, 0], [1, 0, 0, 0], [1, 0, 0, 0], [1, 0, 0, 0], [1, 0, 0, 0]] };
      const s = { v: 1, tut: true, days: { [add(-1)]: rec }, hdays: {}, late: {}, dex: {}, kofi: {}, runs: { d: { mode: "d", date: k, list: g.dailyList(k), res: [{ n: [1, 0, 0, 0], p: 50 }], id: "today" } } };
      localStorage.setItem("kasane-v1", JSON.stringify(s)); return { k, miss: add(-3), y: add(-1) }; });
    await pl.reload();
    check("ホームの「染めた日」に、取りこぼした日の数が出る", /↺/.test(await pl.textContent("#go-cal")));
    await pl.click("#go-cal");
    check("カレンダー：今日の5色を遊んだ日に★の印、取りこぼした日は押せる（高さ44px以上）", (await pl.locator(`.cal .c.d2`).count()) >= 1 && (await pl.locator(`.cal button.c.miss[data-d="${set.miss}"]`).count()) === 1 && (await pl.locator(".cal button.c.miss").evaluateAll((els) => els.every((e) => e.getBoundingClientRect().height >= 44))));
    await pl.click(`.cal button.c.miss[data-d="${set.miss}"]`);
    const lr = await pl.evaluate((d) => { const g = window.__kz, r = g.load().runs.a; return { mode: g.mode(), list: r.list, want: g.dailyList(d), date: r.date }; }, set.miss);
    check("あとから遊ぶと、その日の「今日の5色」と同じ5色になる（日付の種）", lr.mode === "a" && lr.date === set.miss && JSON.stringify(lr.list) === JSON.stringify(lr.want));
    check("あとからの画面に日付が出る", (await pl.textContent("header")).includes(`${+set.miss.slice(5, 7)}/${+set.miss.slice(8, 10)}の5色`));
    await pl.click('.vat[data-k="0"]'); await pl.click("#decide"); await pl.click("#next");
    await pl.reload(); await pl.click("#go-cal");
    check("あとからも、途中で閉じたら続きから", (await pl.textContent(`.cal button.c.miss[data-d="${set.miss}"]`)).includes("続き"));
    await pl.click(`.cal button.c.miss[data-d="${set.miss}"]`);
    check("続きは2色目から", (await pl.textContent("header")).includes("2/5"));
    for (let i = 1; i < 5; i++) { await dyeRecipe(pl); await pl.waitForTimeout(260); await pl.click("#decide"); await pl.click("#next"); }
    const after = await pl.evaluate((x) => { const g = window.__kz, s = g.load(); return { late: !!s.late[x.miss], day: !!s.days[x.miss], days: Object.keys(s.days).length, streak: g.streak(s.days), runD: s.runs.d && s.runs.d.res.length, dex: Object.keys(s.dex).length, runA: s.runs.a }; }, set);
    check("あとから遊んだ日は late に入り、今日の記録（days）・連続の日には数えない", after.late && !after.day && after.days === 1 && after.streak === 1);
    check("あとから遊んでも、今日の5色の途中経過は消えない・色帳には載る", after.runD === 1 && after.dex >= 5 && !after.runA);
    check("あとからの結果に、シェア・Ko-fi・上級のボタンは出ない", (await pl.locator("#share, .kofi, #go-h").count()) === 0 && (await pl.locator("#go-cal").count()) === 1);
    await pl.click("#go-cal");
    check("カレンダー：あとから遊んだ日は別の印（点線）で、もう押せない", (await pl.locator(".cal .c.late").count()) === 1 && (await pl.locator(`.cal button[data-d="${set.miss}"]`).count()) === 0);
    await pl.evaluate(() => { startRun("a", "2000-01-01"); });
    check("7日より前の日は、あとからでも始めない", (await pl.evaluate(() => window.__kz.load().runs.a)) == null && (await pl.locator(".cal").count()) === 1);
    { // A日を途中→B日を始める→A日に戻ると続きから（あとからの途中経過は日付ごとに預ける。2026-11-04 星座つなぎで CodeRabbit が指摘）
      const ab = await pl.evaluate(() => { const g = window.__kz, k = g.todayKey(), add = (n) => new Date(Date.parse(k) + n * 864e5).toISOString().slice(0, 10); return { A: add(-4), B: add(-5) }; });
      await pl.click("#back"); await pl.click("#go-cal");
      await pl.click(`.cal button.c.miss[data-d="${ab.A}"]`); await pl.click('.vat[data-k="0"]'); await pl.click("#decide"); await pl.click("#next");
      await pl.click("#back"); await pl.click("#go-cal");
      await pl.click(`.cal button.c.miss[data-d="${ab.B}"]`);
      const midB = await pl.evaluate(() => { const r = window.__kz.load().runs.a; return { date: r.date, n: r.res.length }; });
      await pl.click("#back"); await pl.click("#go-cal");
      const lab = await pl.textContent(`.cal button.c.miss[data-d="${ab.A}"]`);
      await pl.click(`.cal button.c.miss[data-d="${ab.A}"]`);
      const backA = await pl.evaluate(() => { const r = window.__kz.load().runs.a; return { date: r.date, n: r.res.length }; });
      check("あとから：A日を途中→B日を始める→A日に戻ると続きから（2色目）", midB.date === ab.B && midB.n === 0 && lab.includes("続き") && backA.date === ab.A && backA.n === 1 && (await pl.textContent("header")).includes("2/5"), JSON.stringify({ midB, backA, lab }));
      await pl.click("#back"); await pl.click("#go-cal");
      // 途中の日を別のタブで終えていたら（もう取りこぼしでない日）、続きからでも始めない（2026-11-04 CodeRabbit）
      await pl.evaluate((A) => { const s = JSON.parse(localStorage.getItem("kasane-v1")); s.late[A] = { p: [90, 90, 90, 90, 90], n: [] }; localStorage.setItem("kasane-v1", JSON.stringify(s)); startRun("a", A); }, ab.A);
      check("あとから：その日をもう遊んだ（別のタブ）なら、同じ日の続きでも始めない", (await pl.locator(".cal").count()) === 1 && (await pl.locator("#vats").count()) === 0);
      await pl.evaluate((A) => { const s = JSON.parse(localStorage.getItem("kasane-v1")); delete s.late[A]; s.runs.a = null; s.apark = {}; localStorage.setItem("kasane-v1", JSON.stringify(s)); }, ab.A);
      await pl.click("#back"); await pl.click("#go-cal"); }
    if (!(await pl.locator("#prev").isDisabled())) { await pl.click("#prev"); check("カレンダーは前の月へ戻れる", (await pl.locator(".cal .c").count()) >= 28); }
    await pl.close(); }
  { // 連続の日は1以上のときだけ出す（休んだ日を責めない）
    const ps = await newPage(); await ps.click("#howto-ok");
    check("連続の日が0のときは、ホームに「連続」を出さない", !(await ps.textContent(".stats")).includes("連続"));
    await ps.close(); }
  for (const w of [320, 390]) { // 実績・カレンダーも幅320pxで崩れない
    const pw = await newPage(w, 700); await pw.click("#howto-ok");
    const chk = () => pw.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth, small: [...document.querySelectorAll("button, a")].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim() || e.id) }));
    const h = await chk(); await pw.click("#go-ach"); const a = await chk(); await pw.click("#back"); await pw.click("#go-cal"); const c = await chk();
    check(`幅${w}px：ホーム・実績・カレンダーが横にはみ出さず、押せる所は44px以上`, ![h, a, c].some((x) => x.over || x.small.length), [h, a, c].map((x) => x.small.join("/")).join(" | "));
    await pw.close(); }
  { // 同じ日はどのブラウザでも同じ問題：sort の比較の中で乱数を引かない（引く回数がブラウザで変わる）
    const src = ["index.html", ...["gen.js", "data.js"].filter((f) => existsSync(path.join(root, f)))].map((f) => readFileSync(path.join(root, f), "utf8")).join("\n");
    const bad = src.match(/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/g) || [];
    check("並べ替えの比較の中で乱数を引いていない（同じ日に人によって問題が変わらない）", bad.length === 0, bad.join(" | ")); }
} catch (e) { // 途中で止まっても、ここまでの結果とレポートは書き出す
  check("QA の操作が最後まで完了する", false, e.message.split("\n")[0]);
} finally {
  try { // キーボードで選んだボタンに枠が出る（all:unset のカレンダーのます目でも消えない。2026-11-04 CodeRabbit の指摘）。止まっても失敗として記録し、レポートまで進む
    const pf = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await pf.goto(url); await pf.evaluate(() => localStorage.clear()); await pf.reload();
    await pf.click("#howto-ok").catch(() => {});
    const bad = [];
    for (const open of [null, "#go-cal"]) {
      if (open) await pf.click(open);
      await pf.keyboard.press("Shift");
      bad.push(...await pf.evaluate(() => {
        const cal = document.querySelector(".cal");
        if (cal) { const b = document.createElement("button"); b.className = (cal.querySelector("button") || cal.lastElementChild).className + " miss"; b.textContent = "1"; cal.append(b); }
        return [...document.querySelectorAll("button:not([disabled]),a[href]")].filter((b) => b.checkVisibility()).filter((b) => { b.focus(); const cs = getComputedStyle(b); return !b.matches(":focus-visible") || cs.outlineStyle === "none" || parseFloat(cs.outlineWidth) < 2; }).map((b) => b.className || b.id || b.tagName);
      }));
    }
    check("キーボードで選んだボタン（カレンダーのあとから遊ぶ日も）に枠が出る", bad.length === 0, bad.join(","));
    await pf.close();
  } catch (e) { check("キーボードで選んだボタン（カレンダーのあとから遊ぶ日も）に枠が出る", false, e.message.split("\n")[0]); }
  await browser.close();
}
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));

const ng = results.filter((r) => !r.ok);
const md = `# 重ね染め QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
