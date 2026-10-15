# gambling

パチンコ習慣記録アプリ（PWA）。ビルド不要の静的サイトです。

## 起動

```sh
python3 -m http.server 8080   # http://localhost:8080 を開く
```

HTTPSで公開するとスマートフォンの「ホーム画面に追加」でアプリとして使えます。記録は端末内（localStorage）に保存されます。

## 構成

- `index.html` / `styles.css` / `js/app.js` … 画面（ホーム・カレンダー・振り返り・設定）
- `js/store.js` … 記録の保存と集計
- `js/line-bridge.js` … 通知設定を外部の通知サービスへ渡すだけの窓口
- `line-notifier/` … LINE通知サービス（アプリ本体とは別に動作）
