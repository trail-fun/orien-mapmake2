# orien-mapmake2（サービス3: 競技地図作成）

サービス2（下見支援アプリ）でエクスポートした ZIP データを読み込み、競技地図上に CP を配置・編集できる Web アプリ。

- GitHub: https://github.com/trail-fun/orien-mapmake2
- デプロイ先: https://trail-fun.github.io/orien-mapmake2/

---

## 実装済み機能

### S2 データ読込・地図表示

- サービス2 からエクスポートした ZIP ファイル（`survey.geojson` + `photos/`）を読み込み
- 国土地理院タイルをベース地図として表示（MapLibre GL JS）
- CP候補（グレー）・確定CP（赤）・調査メモ（ポイント/ライン/エリア）・印刷範囲を表示
- CP コース順を結ぶ点線を表示

### CP 地図上操作

| 操作 | 挙動 |
|------|------|
| 確定CPをシングルクリック | 選択（黄色リング表示） |
| 確定CPをドラッグ | 位置をリアルタイム移動 |
| 確定CPをダブルクリック | CP編集モーダルを開く |
| CP候補をクリック | 確定CPへ昇格ダイアログ |
| 空きエリアをクリック | 選択解除 |

### CP 編集モーダル

- 種別（スタート / CP / フィニッシュ / S兼F）
- CP番号（cp種別のみ）・得点・説明
- 座標表示・保存・削除

### CP パネル（折りたたみ式）

- CP 一覧表示・クリック選択
- 順番変更（↑↓、cp 種別のみ）
- 追加（地図中心に配置）・編集・削除

---

## 技術スタック

| ライブラリ | 用途 |
|-----------|------|
| React 19 + TypeScript + Vite | フレームワーク |
| MapLibre GL JS | 地図表示・インタラクション |
| Zustand | グローバル状態管理 |
| JSZip | S2 ZIP ファイルの解析 |
| 国土地理院タイル | ベース地図 |

---

## ファイル構成

```
src/
  types/index.ts            型定義（S1メタデータ・CP候補・確定CP・調査メモ）
  store/projectStore.ts     Zustand ストア（project・selectedCpId・CRUD）
  lib/
    parseS2Zip.ts           S2 ZIP ファイルのパース
    utils.ts                ID生成・ソート・ラベル・候補→CP昇格
  components/
    MapView/MapView.tsx     地図表示・インタラクション（クリック/ドラッグ/選択）
    CPEditModal.tsx         CP 編集モーダル
    CPPanel.tsx             CP 一覧パネル（折りたたみ）
  App.tsx                   ルートコンポーネント・モーダル制御
```

---

## 開発

```bash
npm install
npm run dev
```

## デプロイ

`main` ブランチへプッシュすると GitHub Actions が自動的に GitHub Pages へデプロイします。

```
https://trail-fun.github.io/orien-mapmake2/
```

---

## 開発ステップ

```
✅ Step1: S2データ読込＋地図表示
  └── ZIPパース・MapLibre地図・CP候補/確定CP/調査メモ/印刷範囲表示

✅ Step2: CP編集機能
  └── 地図上選択/ドラッグ・編集モーダル・候補昇格・CPパネル（順番変更）

□ Step3: データ保存・エクスポート
  └── IndexedDB保存 or JSON/ZIPダウンロード

□ Step4: PDF出力（競技地図）
  └── 印刷範囲に合わせた競技地図の PDF 出力
```
