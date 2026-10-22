import { useEffect, useMemo, useState } from 'react';
import type { TabProps } from './App';
import { fmtStamp, now, slotKey, uid } from './logic';
import { DayGrid } from './parts';
import { findEntryByName, saveEntries } from './store';
import type { Entry, Mark } from './types';

const OTHER = '__other__';
const NEXT: Record<string, Mark | undefined> = { none: 'ok', ok: 'maybe', maybe: undefined };

export function RegisterTab({ data, patch, toast }: TabProps) {
  const { config, entries } = data;

  // 名簿 + 名簿にないが登録済みの名前
  const options = useMemo(() => {
    const names = [...config.members];
    for (const e of entries) if (!names.includes(e.name)) names.push(e.name);
    return names;
  }, [config.members, entries]);

  const [sel, setSel] = useState('');
  const [typed, setTyped] = useState('');
  const [draft, setDraft] = useState<Record<string, Mark>>({});
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const name = sel === OTHER ? typed.trim() : sel;
  const entry = sel && sel !== OTHER ? entries.find((e) => e.name === sel) ?? null : null;
  const locked = !!entry && !editing;

  // 名前を選び直したとき・登録内容が更新されたときに読み込み直す
  const loadKey = `${sel}|${entry?.id ?? ''}|${entry?.updatedAt ?? ''}`;
  useEffect(() => {
    setDraft(entry ? { ...entry.avail } : {});
    setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey]);

  // 入力した名前がすでに登録済みなら、その人の登録内容を表示する
  const resolveTyped = () => {
    const n = typed.trim();
    if (n && options.includes(n)) {
      setSel(n);
      setTyped('');
    }
  };

  const allKeys = config.days.flatMap((d) => d.slots.map((s) => slotKey(d.id, s.id)));
  const changes = entry
    ? allKeys.filter((k) => (entry.avail[k] ?? '') !== (draft[k] ?? '')).length
    : 0;

  const cycle = (key: string) => {
    if (locked) return;
    setDraft((d) => {
      const next = { ...d };
      const m = NEXT[d[key] ?? 'none'];
      if (m) next[key] = m; else delete next[key];
      return next;
    });
  };
  const setDay = (dayId: string, mark: Mark | undefined) => {
    const day = config.days.find((d) => d.id === dayId)!;
    setDraft((d) => {
      const next = { ...d };
      for (const s of day.slots) {
        const k = slotKey(day.id, s.id);
        if (mark) next[k] = mark; else delete next[k];
      }
      return next;
    });
  };

  const putEntry = (e: Entry) =>
    patch((d) => ({ entries: d.entries.some((x) => x.id === e.id) ? d.entries.map((x) => (x.id === e.id ? e : x)) : [...d.entries, e] }));

  const register = async () => {
    if (!name) return toast('名前を選んでください');
    if (name.length > 40) return toast('名前は40文字以内にしてください');
    setBusy(true);
    try {
      const existing = await findEntryByName(name);
      if (existing) {
        putEntry(existing);
        setSel(name);
        setTyped('');
        toast('この名前はすでに登録されています。登録内容を表示しました');
        return;
      }
      const e: Entry = { id: uid(), name, avail: draft, updatedAt: now() };
      await saveEntries([e]);
      putEntry(e);
      setSel(name);
      setTyped('');
      toast('登録しました');
    } catch {
      toast('保存できませんでした。通信状況を確認してもう一度押してください');
    } finally {
      setBusy(false);
    }
  };

  const finishEdit = async () => {
    if (!entry || !changes) return;
    setBusy(true);
    try {
      const e: Entry = { ...entry, avail: draft, updatedAt: now() };
      await saveEntries([e]);
      putEntry(e);
      toast('変更を反映しました');
    } catch {
      toast('保存できませんでした。通信状況を確認してもう一度押してください');
    } finally {
      setBusy(false);
    }
  };

  const cancelEdit = () => {
    setDraft(entry ? { ...entry.avail } : {});
    setEditing(false);
  };

  return (
    <div className="panel">
      <label className="field">
        <span className="label">自分の名前を選んでください</span>
        <select value={sel} disabled={!!entry} onChange={(e) => setSel(e.target.value)}>
          <option value="">(選んでください)</option>
          {options.map((n) => (
            <option key={n} value={n}>
              {entries.some((e) => e.name === n) ? `${n}(登録済み)` : n}
            </option>
          ))}
          <option value={OTHER}>名簿にない(名前を入力する)</option>
        </select>
      </label>
      {entry && !editing && (
        <button className="link small" onClick={() => setSel('')}>別の名前を選ぶ</button>
      )}

      {sel === OTHER && (
        <label className="field">
          <span className="label">名前を入力(シフト表にこの名前で表示されます)</span>
          <input type="text" maxLength={40} value={typed} onChange={(e) => setTyped(e.target.value)} onBlur={resolveTyped} />
        </label>
      )}

      {name && (
        <>
          {entry && (
            <p className="status">
              <span className="pill ok">登録済み</span> ・ {fmtStamp(entry.updatedAt)} 更新
            </p>
          )}
          {locked && (
            <p className="notice">
              登録済みです。内容を直すときは、下の『登録内容を変更する』を押してから修正し、『変更を完了する』で反映してください。
            </p>
          )}

          <h2 className="h2">参加できる時間</h2>
          <p className="legend">
            <span><b className="mk ok">○</b> 参加できる</span>
            <span><b className="mk maybe">△</b> 調整すれば可</span>
            <span>空欄 = 不可</span>
          </p>

          {config.days.map((day) => (
            <DayGrid
              key={day.id}
              day={day}
              avail={draft}
              base={editing && entry ? entry.avail : undefined}
              editable={!locked}
              onCycle={cycle}
              onAll={() => setDay(day.id, 'ok')}
              onClear={() => setDay(day.id, undefined)}
            />
          ))}

          <div className="actions sticky">
            {!entry && (
              <button className="btn primary" disabled={busy} onClick={register}>登録する</button>
            )}
            {locked && (
              <button className="btn primary" onClick={() => setEditing(true)}>登録内容を変更する</button>
            )}
            {entry && editing && (
              <>
                <p className="small status-line">
                  {changes
                    ? `${changes}か所を変更中(『変更を完了する』を押すまで反映されません)`
                    : 'マスをタップして修正してください'}
                </p>
                <button className="btn primary" disabled={busy || !changes} onClick={finishEdit}>変更を完了する</button>
                <button className="btn" disabled={busy} onClick={cancelEdit}>キャンセル</button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
