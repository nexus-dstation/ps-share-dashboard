# PS台数シェア推移 ダッシュボード

静的 HTML で閲覧する店舗別・年月別シェアダッシュボードです。

## ファイル

- `index.html`
- `style.css`
- `app.js`
- `generate_dashboard_data.py`
- `data/dashboard-data.csv`
- `data/dashboard-data.json`
- `data/dashboard-data.js`

## 使い方

1. `index.html` をブラウザで開く
2. `店舗選択` `レート` `表示項目` `表示期間` を切り替えて閲覧する

## 月次更新

1. 月別フォルダを追加する
2. その中に既存と同じ命名形式の CSV を入れる
3. `generate_dashboard_data.py` を実行する
4. 更新された `data/dashboard-data.csv` `data/dashboard-data.json` `data/dashboard-data.js` をコミットする

## GitHub 反映

```bash
git add .
git commit -m "Update dashboard data"
git push
```
