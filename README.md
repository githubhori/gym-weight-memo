# ジムウエイトメモ（PWA）

ジムの各マシンのウエイトを記録し、トレーニング中に大きな文字で確認する個人用アプリ。
ビルド不要・外部通信なし・完全オフライン動作。データは端末のブラウザ内にだけ保存されます。

## ローカルで確認する

Node.js が必要です。`index.html` があるこのフォルダに移動してから実行します（別のフォルダで実行するとアプリは表示されません）。

```
cd <このフォルダのパス>
npx serve
```

表示された URL（通常 `http://localhost:3000`）を Chrome で開く（DevTools のデバイスモードで幅427pxも確認）。

確認が終わったら、`npx serve` を実行したターミナルで `Ctrl + C` を押すとサーバーが止まります（ターミナルを閉じても止まります）。
停止後に `http://localhost:3000` を開いても、Service Worker が残っていれば、アプリはキャッシュから表示されます。完全に消したいときは、DevTools の Application タブ → Storage → 「Clear site data」を実行してください。

## 公開（GitHub Pages）

1. GitHub で Public リポジトリ `gym-weight-memo` を作る（「Add a README」などは**チェックしない**＝空のまま作る）。
2. push する。`index.html` があるこのフォルダに移動してから、次のコマンドを実行する（`<ユーザー名>` は自分の GitHub ユーザー名に置き換える）。

   ```
   cd <このフォルダのパス>
   git branch -M main
   git remote add origin https://github.com/<ユーザー名>/gym-weight-memo.git
   git push -u origin main
   ```

   初回はブラウザが開き、GitHub のログイン認証を求められることがあります。
3. GitHub の Settings → Pages で、Source を「Deploy from a branch」、Branch を `main`、フォルダを `/ (root)` にして Save する。1〜数分で公開される。
4. 公開URL `https://<ユーザー名>.github.io/gym-weight-memo/` を Pixel の Chrome で開き、「ホーム画面に追加」する。

## 更新したとき（重要）

ファイルを変更したら、**`js/version.js` の `APP_VERSION` を上げる**（例: `gym-weight-v1` → `gym-weight-v2`）。
これがキャッシュ名とバックアップ画面のバージョン表示を兼ねています。上げ忘れると、端末が古い版を使い続けます。

新しい版は、アプリを完全に閉じて次に開いたときに反映されます（編集中の入力が消えないよう、自動リロードはしません）。

ファイルを追加・削除したときは、`sw.js` の `FILES` 一覧も直してください。

## 色・文字サイズの調整

`css/style.css` の先頭の `:root` にある CSS 変数だけで変えられます。
（詳細画面のマシン名・ウエイトの自動縮小の基準値は `js/app.js` 冒頭の `FIT` にあります）

## バックアップ

「バックアップ」画面から JSON を書き出し・読み込みできます。読み込みは全置換です。
