# Bloch Golf

量子回路がゴルフのショットになる、量子コンピューティング教育ゲーム。

ブロッホ球の上でゴルフボールを転がし、量子ゲートを使ってターゲットの量子状態にボールを導こう。少ないゲート数でホールインできればバーディー!

## How to Play

1. ターゲットの量子状態（旗の位置）を確認する
2. 回路エディタに量子ゲート（H, X, Y, Z, S, T, RX, RY, RZ）を追加する
3. ゲートを追加するたびにボールがブロッホ球上を転がる
4. ターゲットに到達すればホールクリア
5. ゲート数が少ないほどスコアが良い（Par 以下ならバーディー、イーグル）

## Target States

| ホール | 状態          | ブロッホ球上の位置 | Par |
| ------ | ------------- | ------------------ | --- |
| \|1⟩   | Excited State | 南極（-Z）         | 1   |
| \|+⟩   | Plus State    | +X 軸              | 1   |
| \|−⟩   | Minus State   | -X 軸              | 2   |
| \|i+⟩  | i-Plus State  | +Y 軸              | 2   |
| \|i−⟩  | i-Minus State | -Y 軸              | 2   |

## Tech Stack

- **React 18** + **TypeScript** — UI フレームワーク
- **Three.js** / **React Three Fiber** / **Drei** — 3D ブロッホ球の描画
- **@qamposer/react** — 量子回路エディタ
- **Vite** — ビルドツール

## Getting Started

```bash
# 依存関係のインストール
pnpm install

# 開発サーバーの起動
pnpm dev

# プロダクションビルド
pnpm build

# ビルド結果のプレビュー
pnpm preview
```

## Architecture

```
src/
├── App.tsx                    # メインアプリ（回路変更の検出・アニメーション制御）
├── types/
│   └── game.ts                # ゲーム状態・ブロッホ座標・ターゲット定義
├── utils/
│   ├── quantum.ts             # 量子状態の計算（ゲート行列の適用）
│   └── gateRotation.ts        # ゲート→SO(3)回転変換（アニメーション用）
├── components/
│   ├── BlochSphere/
│   │   ├── BlochScene.tsx     # 3D シーン全体
│   │   ├── GolfBall.tsx       # ゴルフボール（ローリングアニメーション付き）
│   │   ├── GrassSphere.tsx    # 芝テクスチャのブロッホ球
│   │   ├── HoleCup.tsx        # ホールカップ（旗付き）
│   │   ├── AxisLabels.tsx     # 軸ラベル（|0⟩, |1⟩, |+⟩, ...）
│   │   └── BallTrail.tsx      # ボールの軌跡エフェクト
│   ├── Effects/
│   │   └── Celebration.tsx    # ホールイン時のパーティクルエフェクト
│   └── GamePanel/
│       └── GamePanel.tsx      # スコアボード・操作パネル
└── hooks/
    └── useBallAnimation.ts    # ボールアニメーションのカスタムフック
```

## How It Works

1. プレイヤーが回路エディタでゲートを追加・編集・削除する
2. 回路の変更を検出し、変更タイプ（追加/編集/削除）に応じて処理を分岐
3. 各ゲートの行列を量子状態 |0⟩ に順番に適用し、最終的なブロッホ球座標を計算
4. ゲート追加時はゲートの回転軸・角度に沿ったアニメーションを再生（最短経路ではなく物理的に正しい軌道）
5. ターゲット状態との角度距離が閾値以内ならホールクリア
