# line-notifier

アプリ本体から分離したLINE通知サービスです。アプリの「設定 > LINE通知」で通知サーバーURLを指定すると、ON/OFFと通知時刻だけがここに送られます（記録内容は送られません）。

## 起動

```sh
export LINE_CHANNEL_ACCESS_TOKEN=xxxx   # LINE Messaging API のチャネルアクセストークン
export LINE_USER_ID=Uxxxx               # 通知先ユーザーID
export TZ=Asia/Tokyo
node server.js                          # Node.js 18以上
```

- `POST /config` `{ "enabled": true, "time": "21:00" }` … 通知設定の更新（アプリが送信）
- `POST /test` … テスト通知の送信

アプリをHTTPSで公開する場合、通知サーバーもHTTPSで公開してください。
