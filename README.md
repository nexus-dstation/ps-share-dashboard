# PS台数シェア推移ダッシュボード

静的 HTML で閲覧する店舗別・年月別シェアダッシュボードです。

## ファイル構成

- `index.html`
- `style.css`
- `app.js`
- `generate_dashboard_data.py`
- `update_dashboard_data.bat`
- `data/dashboard-data.csv`
- `data/dashboard-data.json`
- `data/dashboard-data.js`

## 閲覧方法

1. `index.html` をブラウザで開く
2. 初期パスワード `7777` を入力する
3. 店舗選択 / レート / 表示項目 / 表示期間を切り替えて確認する

## 月次更新の考え方

GitHub Pages で全員に同じ内容を見せるには、ブラウザアップロードだけではなく、`data/dashboard-data.json` と `data/dashboard-data.js` を更新して GitHub に push する必要があります。

ブラウザの隠しアップロードはその端末確認用です。
全員反映は、下の「本番反映手順」で行います。

## 本番反映手順

### 1. 月フォルダを追加する

プロジェクト直下に新しい月フォルダを追加します。

例:

- `2026年3月`

フォルダ内には次の CSV を入れます。

- `チェーン店レポート_種別_店舗全体実績_*.csv`
- `チェーン店レポート_種別_4円超パチンコ_*.csv`
- `チェーン店レポート_種別_1円パチンコ_*.csv`
- `チェーン店レポート_種別_1円未満P_*.csv`
- `チェーン店レポート_種別_20円超パチスロ_*.csv`
- `チェーン店レポート_種別_5円スロット_*.csv`
- `チェーン店レポート_種別_5円未満S_*.csv`

### 2. 表示用データを再生成する

方法はどちらでも大丈夫です。

#### 方法A: バッチを実行

`update_dashboard_data.bat` をダブルクリック

#### 方法B: コマンド実行

```powershell
& "C:\Users\knanbu\AppData\Local\Programs\Python\Python313\python.exe" .\generate_dashboard_data.py
```

これで次の3ファイルが更新されます。

- `data/dashboard-data.csv`
- `data/dashboard-data.json`
- `data/dashboard-data.js`

### 3. GitHub へ反映する

```powershell
git add .
git commit -m "Add 2026-03 dashboard data"
git push
```

push 後、GitHub Pages が更新されると、見る人全員が新しい月を閲覧できます。

## 毎月の最短手順

1. 新しい月フォルダを追加
2. `update_dashboard_data.bat` を実行
3. `git commit -m "Add YYYY-MM dashboard data"`
4. `git push`

## 補足

- 店舗並びは最新月の `4円超パチンコ` CSV 順を使用します
- 0台が全期間続くレートは画面上で非表示になります
- ブラウザの隠しアップロード保存は端末ローカル保存です
- 全員に反映する正式更新は、必ず `data/dashboard-data.json/js` の更新と `git push` を行ってください
