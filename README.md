# 三田祭 将棋研シフト

慶應義塾大学 将棋研究会の三田祭(対局企画)用のシフト登録・管理アプリ。
ログイン不要で、リンクを開くだけで使える。Vite + React + Supabase、公開は Vercel。

## ローカルで試す

```sh
npm install
npm run dev
```

`.env` がないときは「試用モード」になり、データはそのブラウザの localStorage にだけ保存される。

## 本番の準備

1. **Supabase** でプロジェクトを作る(無料プランで足りる)。
2. SQL Editor で `supabase/schema.sql` を実行する(テーブル3つと、誰でも読み書きできる RLS)。
3. Project Settings → API の `Project URL` と `anon public` キーを控える。
4. **Vercel** でこのリポジトリを読み込み、Environment Variables に次を入れてデプロイする。
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (ビルド設定は Vite の既定のままでよい)
5. 発行された URL を部員に共有する。`…/#table` でシフト表、`…/#admin` で管理画面を直接開ける。

初回アクセス時に、初期設定(2026年の日程・部員名簿23人)が `config` に書き込まれる。

## 注意

- 権限の区別はなく、リンクを知っている人は誰でもすべての操作ができる。リンクは部内だけで共有すること。
- 同時に編集した場合は、最後に保存した内容が残る。
