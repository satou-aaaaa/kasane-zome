# AGENTS.md

重ね染め：藍・紅花・刈安・紫根の染め液に布をくぐらせ、見本の日本の伝統色に近づける1日5色のゲーム。`index.html` と `data.js`（伝統色と染め液）を GitHub Pages で公開する。

## 準備（最初に一度）

```bash
bash scripts/setup.sh   # Node.js（版は .nvmrc）を確かめ、検査の依存とブラウザを入れる。何度実行してもよい
```

## push する前の確認

```bash
node qa/run.mjs   # お手本がいちばん近いか（全部計算し直し）・5色の組み方（3000日×2）・通しで遊ぶ・続きから・上級・色帳・Ko-fi・スマホ幅・PWA（CI の QA と同じ）
```

## このリポジトリの決まり

- 染めは「布の色 × 染め液の透す色」を線形 RGB で掛ける（順番は関係なく回数で決まる）。式は `tools/color.cjs` と `index.html` に同じものを置く。色の近さは CIEDE2000。
- `data.js` は `node tools/make-data.cjs` で作る（手で直さない）。色を足すときは `tools/colors-raw.json` に [名前, 読み, 色] を足して作り直す。お手本で色の差3.6以内に染められない色は自動で外れる。色の値は nipponcolors.com などで広く使われている値。
- 染め液の色（`VATS` の `t`）を変えると全部のお手本と過去の日の点数の意味が変わる。変えた PR に一言書く。
- 今日の5色・上級は日本時間の日付から作る乱数（`seedOf`・`rng`）で決まり、だれでも同じ。`Math.random()` は練習の色選びだけ（QA が数を見る）。`COLORS` を足し引きすると過去の日の5色も変わる。
- 5色は色の仲間を重ねない・2液以上の色を2つ以上。上級（記憶染め）は今日の5色と重ねず、3液以上を2つ以上。見本は「覚えた」を押すまで見られ、押したら隠れる。時間制限は付けない。
- 今日の5色・上級は1日1回で、途中で閉じても続きから（やり直しで結果を変えられない）。記録は保存の前に読み直す（別のタブで消さない）。練習は記録を増やさない（色帳には載る）。途中経過はモードごとに分けて保存し（`runs.d`・`runs.h`）、練習で今日・上級の途中を消さない。答えを入れる前に、保存した進み具合が画面と同じか確かめる（古いタブで二重に入れない。2026-11-04 CodeRabbit の指摘）。
- 一致度はお手本と同じ近さで100%、色の差が1増えるごとに3%下がる。★3は95%以上・★2は85%以上・★1は70%以上。
- 文字は少なめ・一画面一色。お笑いの言葉は入れない（本物っぽさ優先。QA が見る）。ほかの作品の名前・キャラ・見た目は使わない。
- 共有は遊ぶ人が押したときに開くリンク（X・LINE・Web Share・コピー）だけ。シェアの文に色の名前（答え）を出さない。
- 感想は「感想を送る」から GitHub の Issue フォーム（`.github/ISSUE_TEMPLATE/feedback.yml`、ラベル「感想」）を開くだけ。項目は shared-workflows の `template/.github/ISSUE_TEMPLATE/feedback.yml` と同じにし、名前・メールは聞かない。週1で shared-workflows `routines/game-feedback.md` が読んで直す。
- 応援は Ko-fi（https://ko-fi.com/satouaaaaa）へのただのリンクだけ。今日の5色・上級を初めて終えて平均80%以上のときだけ、結果の画面の下に1行（共有フォルダ kofi/app-guide.md）。遊ぶのは無料のまま、有料版は置かない。
- 外へ通信しない。外から読むのは Google Fonts の文字だけ（CSP の `connect-src 'self'` を広げない）。記録は遊ぶ人のブラウザ（localStorage）だけ。
- `hidden` 属性を使う要素に `display` を付けるときは `[hidden]{display:none}` も書く（2026-11-04 上級の見本の覆いがずっと出ていたのを QA で見つけた）。
- 押せる所は高さ44px以上（QA が見る）。機能を足す・直すたびに `qa/run.mjs` に検査を足す。乱数で組む部分は何千回も作って確かめる（shared-workflows `incidents/2026-10-31-roppo-empty-village.md`）。
- PWA（`manifest.webmanifest`・`sw.js`・`icon-*.png`）：画面のファイルを足したら `sw.js` の `SHELL` にも足し、中身を大きく変えたら `CACHE` の版を上げる。アイコンは `node tools/make-icons.cjs`、SNS 用の絵 `og.png` は `node tools/make-og.cjs`（答えを入れない）。
- 公開リポジトリなので、個人情報・鍵を入れない。

## 公開

- GitHub Pages は `main` のルート（`/`）を公開する。PR の QA と Secret scan が ✅ になると `automerge.yml` が自動でマージする。止めたいときは下書きにするか、ラベル「自動マージしない」を付ける。
- `sw.js`・`manifest.webmanifest` を変える PR は自動ではマージされない（`hold_paths`）。CodeRabbit のレビューを待ち、手でマージする直前に今の head へのレビューを読み直す（shared-workflows `incidents/2026-11-01-roppo-merged-before-review.md`）。CodeRabbit は PR に `@coderabbitai review` とコメントして頼む。

## 共通のきまり

- PR の作り方・マージの仕方は satou-aaaaa/shared-workflows の `routines/pr.md`、全体のきまりは `routines/common.md` に従う。
- CI の部品は shared-workflows の共通部品を呼ぶ。リポジトリ側の .github/workflows には呼び出しと設定値だけを書く。
- Claude 以外の AI・人が作業するときは、shared-workflows の `routines/tool-map.md` と `routines/without-claude.md` を読む。
