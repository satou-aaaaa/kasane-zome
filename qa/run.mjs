// 重ね染めの検査。データ（お手本が本当にいちばん近いか）・5色の組み方（何千回）・通しで遊ぶ・記録・続きから・上級・色帳・スマホ幅・PWA を確かめる。
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
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$/.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない", ext.length === 0, ext.join(","));
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("Math.random は練習の色選びだけ（今日の5色・上級は日付の乱数）", (html.match(/Math\.random/g) || []).length === 1);
{ const silly = /お笑い|ギャグ|ボケ|ツッコミ|なんでやねん|（うそ）/;
  check("画面にお笑いの言葉を入れない（本物っぽく）", !silly.test(html)); }
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/kasane-zome/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームは名前・メールを聞かない（楽しさ・よかった所・直してほしい所だけ）", /id: fun/.test(fy) && /id: good/.test(fy) && /id: fix/.test(fy) && !/id: (name|email|mail)/.test(fy) && /labels: \["感想"\]/.test(fy)); }
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
  const need = ["./index.html", "./data.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
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

  // 8. スマホ幅：横にはみ出さない・押せる所は44px以上
  for (const w of [320, 390]) {
    const p3 = await newPage(w, 700); await p3.click("#howto-ok");
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
  { // 最後の1問を終えて「結果を見る」を押す前に閉じた日は、開き直すと結果へ進み記録がつく
    const pc = await newPage();
    await pc.evaluate(() => { const g = window.__kz, k = g.todayKey(); localStorage.setItem("kasane-v1", JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, dex: {}, cnt: 0, clean: 0, kofi: {}, runs: { d: { mode: "d", date: k, list: g.dailyList(k), res: [0, 1, 2, 3, 4].map(() => ({ n: [1, 0, 0, 0], p: 90 })) } } })); });
    await pc.reload();
    check("最後の1問のあと閉じても、開き直すと結果へ進み今日の記録がつく", await pc.evaluate(() => { const g = window.__kz; return !!g.load().days[g.todayKey()] && !g.load().runs.d; }));
    await pc.close(); }
  { // 同じ日はどのブラウザでも同じ問題：sort の比較の中で乱数を引かない（引く回数がブラウザで変わる）
    const src = ["index.html", ...["gen.js", "data.js"].filter((f) => existsSync(path.join(root, f)))].map((f) => readFileSync(path.join(root, f), "utf8")).join("\n");
    const bad = src.match(/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/g) || [];
    check("並べ替えの比較の中で乱数を引いていない（同じ日に人によって問題が変わらない）", bad.length === 0, bad.join(" | ")); }
} catch (e) { // 途中で止まっても、ここまでの結果とレポートは書き出す
  check("QA の操作が最後まで完了する", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
}
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));

const ng = results.filter((r) => !r.ok);
const md = `# 重ね染め QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
