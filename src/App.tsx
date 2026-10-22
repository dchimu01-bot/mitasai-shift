import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminTab } from './AdminTab';
import { RegisterTab } from './RegisterTab';
import { TableTab } from './TableTab';
import { isLocal, loadAll } from './store';
import type { Data } from './types';

export type TabProps = {
  data: Data;
  patch: (p: Partial<Data> | ((d: Data) => Partial<Data>)) => void;
  toast: (msg: string) => void;
  reload: () => Promise<void>;
};

const TABS = [
  { id: 'register', label: 'シフト登録' },
  { id: 'table', label: 'シフト表' },
  { id: 'admin', label: '管理' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const tabFromHash = (): TabId => {
  const h = location.hash.slice(1);
  return TABS.some((t) => t.id === h) ? (h as TabId) : 'register';
};

export default function App() {
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<TabId>(tabFromHash);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef<number>(undefined);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(''), 2600);
  }, []);

  const reload = useCallback(async () => {
    try {
      setData(await loadAll());
      setLoadError('');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const patch = useCallback<TabProps['patch']>((p) => {
    setData((d) => (d ? { ...d, ...(typeof p === 'function' ? p(d) : p) } : d));
  }, []);

  // 開いたとき・タブを切り替えたとき・画面に戻ってきたときに読み直す
  useEffect(() => { reload(); }, [tab, reload]);
  // シフト表を開いたままでも、管理画面での変更が届くように定期的に読み直す
  useEffect(() => {
    if (tab !== 'table') return;
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') reload(); }, 20000);
    return () => clearInterval(t);
  }, [tab, reload]);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') reload(); };
    const onHash = () => setTab(tabFromHash());
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('hashchange', onHash);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('hashchange', onHash);
    };
  }, [reload]);

  useEffect(() => {
    if (data) document.title = data.config.title;
  }, [data]);

  const choose = (id: TabId) => {
    history.replaceState(null, '', id === 'register' ? location.pathname : `#${id}`);
    setTab(id);
  };

  const props = data && { data, patch, toast, reload };

  return (
    <div className="app">
      <header className="masthead">
        <h1>{data?.config.title ?? '三田祭 将棋研シフト'}</h1>
        <p className="sub">慶應義塾大学 将棋研究会 ・ 三田祭 対局企画</p>
        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'tab on' : 'tab'} onClick={() => choose(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {loadError && (
          <div className="notice error">
            読み込みに失敗しました({loadError})。
            <button className="link" onClick={reload}>もう一度読み込む</button>
          </div>
        )}
        {!props && !loadError && <p className="muted center">読み込み中…</p>}
        {props && tab === 'register' && <RegisterTab {...props} />}
        {props && tab === 'table' && <TableTab {...props} />}
        {props && tab === 'admin' && <AdminTab {...props} />}
      </main>

      {isLocal && <footer className="muted small center">試用モード:データはこのブラウザの中だけに保存され、ほかの人とは共有されません(Supabase 未設定)</footer>}

      <div className={toastMsg ? 'toast show' : 'toast'} role="status" aria-live="polite">{toastMsg}</div>
    </div>
  );
}
