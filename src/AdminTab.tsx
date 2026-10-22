import { useEffect, useState } from 'react';
import type { TabProps } from './App';
import {
  allSlots, autoAssign, candidateOrder, countAssigned, fmtDate, isWork, now,
  parseMembers, slotIds, slotKey, slotRoles, slotStatus, slotTime, stdNeed, uid,
} from './logic';
import { downloadShiftXlsx } from './exportXlsx';
import { Koma, MARK_TEXT } from './parts';
import { deleteEntry, saveAssignment, saveConfig, saveEntries } from './store';
import type { Assignment, Config, Day, Slot } from './types';

const SECTIONS = [
  { id: 'assign', label: '割当' },
  { id: 'members', label: 'メンバー' },
  { id: 'settings', label: '日程・時間枠・人数' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

const FAIL = '保存できませんでした。もう一度お試しください';

export function AdminTab(props: TabProps) {
  const { data, patch, toast, reload } = props;
  const { config, entries, assignment } = data;
  const [section, setSection] = useState<SectionId>('assign');
  const [confirmClear, setConfirmClear] = useState(false);

  const valid = new Set(entries.map((e) => e.id));

  // 概要の数値
  let needTotal = 0, filledTotal = 0, shortSlots = 0;
  for (const ref of allSlots(config)) {
    let short = false;
    for (const { role, ids } of slotStatus(config, assignment, ref, valid)) {
      needTotal += role.need;
      filledTotal += Math.min(ids.length, role.need);
      if (ids.length < role.need) short = true;
    }
    if (short) shortSlots++;
  }

  const saveAsg = async (next: Omit<Assignment, 'updatedAt'>) => {
    const a = { ...next, updatedAt: now() };
    patch({ assignment: a });
    try { await saveAssignment(a); return true; } catch { toast(FAIL); reload(); return false; }
  };

  const runAuto = async () => {
    const { map, added } = autoAssign(config, entries, assignment);
    if (await saveAsg({ ...assignment, map })) toast(`${added}件を割り当てました`);
  };

  const togglePublish = async () => {
    const published = !assignment.published;
    if (await saveAsg({ ...assignment, published })) toast(published ? 'シフト表を公開しました' : '公開を取り消しました');
  };

  const clearAll = async () => {
    setConfirmClear(false);
    if (await saveAsg({ ...assignment, map: {} })) toast('割当をすべて消しました');
  };

  const download = async () => {
    try {
      await downloadShiftXlsx(config, assignment, entries);
    } catch {
      toast('ダウンロードできませんでした');
    }
  };

  const saveCfg = async (c: Config) => {
    patch({ config: c });
    try { await saveConfig(c); return true; } catch { toast(FAIL); reload(); return false; }
  };

  return (
    <div className="panel">
      <section className="card">
        <div className="row between">
          <h2 className="h2 flush">概要</h2>
          <span className={assignment.published ? 'pill ok' : 'pill'}>{assignment.published ? '公開中' : '未公開'}</span>
        </div>
        <div className="stats">
          <div><b>{entries.length}</b><span>登録メンバー</span></div>
          <div><b>{filledTotal} / {needTotal}</b><span>必要人数の充足</span></div>
          <div><b className={shortSlots ? 'short-text' : ''}>{shortSlots}</b><span>人が足りないコマ</span></div>
        </div>
        <div className="btns">
          <button className="btn primary" onClick={runAuto}>空きを自動で埋める</button>
          <button className="btn" onClick={togglePublish}>{assignment.published ? '公開を取り消す' : 'シフト表を公開'}</button>
          <button className="btn" onClick={download}>シフト表をダウンロード(Excel)</button>
          <button className="btn danger" onClick={() => setConfirmClear(true)}>割当をすべてクリア</button>
        </div>
        {confirmClear && (
          <div className="confirm">
            すべての割当を消しますか?
            <button className="btn danger" onClick={clearAll}>消す</button>
            <button className="btn" onClick={() => setConfirmClear(false)}>やめる</button>
          </div>
        )}
        <p className="small muted">自動割当は ○ の人を優先し、担当コマ数が少ない人から順に入れます。すでに入っている割当は変えません。</p>
      </section>

      <nav className="subtabs">
        {SECTIONS.map((s) => (
          <button key={s.id} className={section === s.id ? 'subtab on' : 'subtab'} onClick={() => setSection(s.id)}>{s.label}</button>
        ))}
      </nav>

      {section === 'assign' && <AssignSection {...props} saveAsg={saveAsg} saveCfg={saveCfg} />}
      {section === 'members' && <MembersSection {...props} saveAsg={saveAsg} />}
      {section === 'settings' && <SettingsSection {...props} />}
    </div>
  );
}

type SaveAsg = (a: Omit<Assignment, 'updatedAt'>) => Promise<boolean>;

// ---------------- 割当 ----------------
function AssignSection({ data, saveAsg, saveCfg }: TabProps & { saveAsg: SaveAsg; saveCfg: (c: Config) => Promise<boolean> }) {
  const { config, entries, assignment } = data;
  const [dayId, setDayId] = useState(config.days[0]?.id ?? '');
  const day = config.days.find((d) => d.id === dayId) ?? config.days[0];
  if (!day) return <p className="muted">日程がありません。「日程・時間枠・人数」で追加してください。</p>;

  const valid = new Set(entries.map((e) => e.id));
  const nameOf = new Map(entries.map((e) => [e.id, e.name]));
  const counts = countAssigned(config, assignment, entries);
  const std = stdNeed(config);

  const setList = (key: string, roleId: string, ids: string[]) =>
    saveAsg({ ...assignment, map: { ...assignment.map, [key]: { ...assignment.map[key], [roleId]: ids } } });

  const setNeed = (slot: Slot, need: number | undefined) => {
    const days = config.days.map((d) =>
      d.id !== day.id ? d : {
        ...d,
        slots: d.slots.map((s) => {
          if (s.id !== slot.id) return s;
          const { need: _old, ...rest } = s;
          return need == null ? rest : { ...rest, need };
        }),
      });
    saveCfg({ ...config, days, updatedAt: now() });
  };

  return (
    <section>
      <div className="daybtns">
        {config.days.map((d) => (
          <button key={d.id} className={d.id === day.id ? 'chip on' : 'chip'} onClick={() => setDayId(d.id)}>{fmtDate(d.date)}</button>
        ))}
      </div>
      {day.label && <p className="small muted">{day.label}</p>}

      {day.slots.map((slot) => {
        const key = slotKey(day.id, slot.id);
        const sts = slotStatus(config, assignment, { day, slot, key }, valid);
        const assigned = sts.reduce((n, r) => n + r.ids.length, 0);
        const need = sts.reduce((n, r) => n + r.role.need, 0);
        const inSlot = new Set(slotIds(assignment, key, valid));
        const cands = entries.filter((e) => e.avail[key] && !inSlot.has(e.id)).sort(candidateOrder(key, counts));
        const canAdjust = isWork(slot) || config.roles.length === 1;
        const curNeed = slotRoles(config, slot)[0]?.need ?? 0;
        const target = sts.find((r) => r.short > 0) ?? sts[0];

        return (
          <div key={slot.id} className="card slotcard">
            <div className="row between">
              <div className="slot-title">
                {slot.name && <Koma>{slot.name}</Koma>} <b>{slotTime(slot)}</b>
              </div>
              <span className={assigned >= need ? 'pill ok' : 'pill short'}>{assigned} / {need}</span>
            </div>

            {canAdjust && (
              <div className="row need">
                <span className="small muted">必要人数</span>
                <button className="btn mini" aria-label="減らす" disabled={curNeed <= 0} onClick={() => setNeed(slot, curNeed - 1)}>−</button>
                <b>{curNeed}人</b>
                <button className="btn mini" aria-label="増やす" onClick={() => setNeed(slot, curNeed + 1)}>＋</button>
                {!isWork(slot) && slot.need != null && slot.need !== std && (
                  <button className="link small" onClick={() => setNeed(slot, undefined)}>標準({std}人)に戻す</button>
                )}
              </div>
            )}

            {sts.map(({ role, ids }) => (
              <div key={role.id} className="names">
                {!slot.name && sts.length > 1 && <Koma>{role.name}</Koma>}
                {ids.map((id) => (
                  <button key={id} className="chip assigned" title="クリックで外す" onClick={() => setList(key, role.id, ids.filter((x) => x !== id))}>
                    {nameOf.get(id)} ×
                  </button>
                ))}
                {!ids.length && <span className="muted small">まだ誰もいません</span>}
              </div>
            ))}

            <div className="cands">
              <span className="small muted">候補</span>
              {cands.map((e) => (
                <button
                  key={e.id}
                  className={`chip cand ${e.avail[key]}`}
                  onClick={() => target && setList(key, target.role.id, [...target.ids, e.id])}
                >
                  {MARK_TEXT[e.avail[key]]} {e.name} <small>{counts[e.id]}</small>
                </button>
              ))}
              {!cands.length && <span className="muted small">候補はいません</span>}
            </div>
          </div>
        );
      })}
    </section>
  );
}

// ---------------- メンバー ----------------
function MembersSection({ data, patch, toast, reload, saveAsg }: TabProps & { saveAsg: SaveAsg }) {
  const { config, entries, assignment } = data;
  const [confirmId, setConfirmId] = useState('');
  const counts = countAssigned(config, assignment, entries);
  const registered = new Set(entries.map((e) => e.name));
  const unregistered = config.members.filter((n) => !registered.has(n));

  const remove = async (id: string) => {
    setConfirmId('');
    const name = entries.find((e) => e.id === id)?.name;
    try {
      await deleteEntry(id);
    } catch {
      toast('削除できませんでした');
      return reload();
    }
    patch((d) => ({ entries: d.entries.filter((e) => e.id !== id) }));
    const map: Assignment['map'] = {};
    for (const [k, roles] of Object.entries(assignment.map)) {
      map[k] = Object.fromEntries(Object.entries(roles).map(([r, ids]) => [r, ids.filter((x) => x !== id)]));
    }
    await saveAsg({ ...assignment, map });
    toast(`${name}さんを削除しました`);
  };

  return (
    <section className="card">
      <p className="small">
        <b>未登録({unregistered.length}人):</b>
        {unregistered.length ? unregistered.join('、') : 'なし'}
      </p>
      <div className="scroll">
        <table className="tbl">
          <thead>
            <tr><th>名前</th><th className="num">○</th><th className="num">△</th><th className="num">担当</th><th>操作</th></tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const v = Object.values(e.avail);
              return (
                <tr key={e.id}>
                  <td className="nowrap">{e.name}</td>
                  <td className="num ok-text">{v.filter((m) => m === 'ok').length}</td>
                  <td className="num maybe-text">{v.filter((m) => m === 'maybe').length}</td>
                  <td className="num">{counts[e.id]}</td>
                  <td className="nowrap">
                    {confirmId === e.id ? (
                      <span className="confirm inline">
                        削除しますか?
                        <button className="btn mini danger" onClick={() => remove(e.id)}>削除</button>
                        <button className="btn mini" onClick={() => setConfirmId('')}>やめる</button>
                      </span>
                    ) : (
                      <button className="link danger-text" onClick={() => setConfirmId(e.id)}>削除</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!entries.length && <tr><td colSpan={5} className="muted">まだ誰も登録していません</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------- 日程・時間枠・人数 ----------------
type Draft = { title: string; need: string; membersText: string; days: Day[] };
const toDraft = (c: Config): Draft => ({
  title: c.title, need: String(stdNeed(c)), membersText: c.members.join('\n'), days: structuredClone(c.days),
});
const comparable = (d: Draft) => JSON.stringify([d.title, d.need, parseMembers(d.membersText), d.days]);

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = y ? new Date(y, m - 1, d + n) : new Date();
  const p = (v: number) => String(v).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}
function addHour(t: string) {
  const [h, m] = t.split(':').map(Number);
  return `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
const copySlots = (slots: Slot[]) => slots.map((s) => ({ ...s, id: uid() }));

function SettingsSection({ data, patch, toast, reload }: TabProps) {
  const { config, entries, assignment } = data;
  const [base, setBase] = useState(config);
  const [draft, setDraft] = useState(() => toDraft(config));
  const [busy, setBusy] = useState(false);
  const dirty = comparable(draft) !== comparable(toDraft(base));

  // 保存していない変更がなければ、最新の設定に追従する
  useEffect(() => {
    if (!dirty) { setBase(config); setDraft(toDraft(config)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const setDay = (id: string, fn: (d: Day) => Day) =>
    setDraft((dr) => ({ ...dr, days: dr.days.map((d) => (d.id === id ? fn(d) : d)) }));
  const setSlot = (dayId: string, slotId: string, p: Partial<Slot>) =>
    setDay(dayId, (d) => ({
      ...d,
      slots: d.slots.map((s) => {
        if (s.id !== slotId) return s;
        const next = { ...s, ...p };
        if (next.need == null) delete next.need;
        return next;
      }),
    }));

  const addSlot = (day: Day) => {
    const prev = day.slots[day.slots.length - 1];
    const start = prev?.end || '09:00';
    setDay(day.id, (d) => ({ ...d, slots: [...d.slots, { id: uid(), start, end: addHour(start) }] }));
  };
  const addDay = () => {
    const last = draft.days[draft.days.length - 1];
    const day: Day = {
      id: uid(),
      date: addDays(last?.date ?? '', last ? 1 : 0),
      label: '',
      slots: last ? copySlots(last.slots) : [],
    };
    setDraft((dr) => ({ ...dr, days: [...dr.days, day] }));
  };

  const save = async () => {
    const n = parseInt(draft.need, 10);
    const need = Number.isFinite(n) && n >= 0 ? n : stdNeed(config);
    const days = draft.days
      .filter((d) => d.date)
      .map((d) => ({
        ...d,
        label: d.label.trim(),
        slots: d.slots
          .map((s) => {
            const name = s.name?.trim();
            const { name: _n, ...rest } = s;
            return (name ? { ...rest, name } : rest) as Slot;
          })
          .filter((s) => (s.start && s.end) || s.name)
          .sort((a, b) => a.start.localeCompare(b.start)),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const next: Config = {
      title: draft.title.trim() || config.title,
      members: parseMembers(draft.membersText),
      roles: config.roles.map((r, i) => (i === 0 ? { ...r, need } : r)),
      days,
      updatedAt: now(),
    };

    // 消えた枠の登録と割当を捨てる
    const keys = new Set(allSlots(next).map((r) => r.key));
    const pruned = entries
      .filter((e) => Object.keys(e.avail).some((k) => !keys.has(k)))
      .map((e) => ({ ...e, avail: Object.fromEntries(Object.entries(e.avail).filter(([k]) => keys.has(k))) }));
    const map = Object.fromEntries(Object.entries(assignment.map).filter(([k]) => keys.has(k)));
    const asgChanged = Object.keys(map).length !== Object.keys(assignment.map).length;

    setBusy(true);
    try {
      await saveConfig(next);
      await saveEntries(pruned);
      const a = asgChanged ? { ...assignment, map, updatedAt: now() } : assignment;
      if (asgChanged) await saveAssignment(a);
      patch((d) => ({
        config: next,
        assignment: a,
        entries: d.entries.map((e) => pruned.find((p) => p.id === e.id) ?? e),
      }));
      setBase(next);
      setDraft(toDraft(next));
      toast('設定を保存しました');
    } catch {
      toast(FAIL);
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card settings">
      <label className="field">
        <span className="label">ページの見出し</span>
        <input type="text" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      </label>

      <label className="field">
        <span className="label">部員名簿(1行に1人)</span>
        <textarea rows={8} value={draft.membersText} onChange={(e) => setDraft({ ...draft, membersText: e.target.value })} />
        <span className="small muted">{parseMembers(draft.membersText).length}人。改行・「、」・「,」のどれで区切っても読み取ります。</span>
      </label>

      <label className="field">
        <span className="label">標準の必要人数</span>
        <input type="number" min={0} inputMode="numeric" className="narrow" value={draft.need} onChange={(e) => setDraft({ ...draft, need: e.target.value })} />
        <span className="small muted">各枠の人数欄を空欄にすると、この標準人数になります。割当画面の −/＋ でも枠ごとに変えられます。</span>
      </label>

      <h3 className="h3">日程</h3>
      {draft.days.map((day, i) => (
        <div key={day.id} className="day-edit">
          <div className="row wrap">
            <label className="field inline">
              <span className="label">日付</span>
              <input type="date" value={day.date} onChange={(e) => setDay(day.id, (d) => ({ ...d, date: e.target.value }))} />
            </label>
            <label className="field inline grow">
              <span className="label">メモ(任意)</span>
              <input type="text" placeholder="例:前日準備、最終日" value={day.label} onChange={(e) => setDay(day.id, (d) => ({ ...d, label: e.target.value }))} />
            </label>
          </div>

          <div className="slot-rows">
            {day.slots.map((s) => (
              <div key={s.id} className="slot-row">
                <input type="time" aria-label="開始" value={s.start} onChange={(e) => setSlot(day.id, s.id, { start: e.target.value })} />
                <span>–</span>
                <input type="time" aria-label="終了" value={s.end} onChange={(e) => setSlot(day.id, s.id, { end: e.target.value })} />
                <input type="text" className="work" placeholder="専用作業名(任意)" value={s.name ?? ''} onChange={(e) => setSlot(day.id, s.id, { name: e.target.value })} />
                <input
                  type="number" min={0} inputMode="numeric" className="tiny" placeholder={String(draft.need)} aria-label="必要人数"
                  value={s.need ?? ''}
                  onChange={(e) => setSlot(day.id, s.id, { need: e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10) || 0) })}
                />
                <span className="small muted">人</span>
                <button className="btn mini" aria-label="枠を削除" onClick={() => setDay(day.id, (d) => ({ ...d, slots: d.slots.filter((x) => x.id !== s.id) }))}>×</button>
              </div>
            ))}
          </div>

          <div className="row wrap gap">
            <button className="link" onClick={() => addSlot(day)}>枠を追加</button>
            {i > 0 && (
              <button className="link" onClick={() => setDay(day.id, (d) => ({ ...d, slots: copySlots(draft.days[i - 1].slots) }))}>前日の枠をコピー</button>
            )}
            <button className="link danger-text" onClick={() => setDraft((dr) => ({ ...dr, days: dr.days.filter((d) => d.id !== day.id) }))}>この日を削除</button>
          </div>
        </div>
      ))}
      <button className="btn" onClick={addDay}>日程を追加</button>

      <p className="small muted">
        専用作業名を入れた枠は、時間を空欄にすると『時間指定なし』になります。専用作業名を入れた枠(前日準備・後片付けなど)は、通常の担当ではなくその作業だけを割り当てます。枠を削除すると、その枠の割当と登録も消えます。
      </p>

      <div className="actions sticky">
        {dirty && <p className="small status-line">保存していない変更があります</p>}
        <button className="btn primary" disabled={!dirty || busy} onClick={save}>設定を保存</button>
        <button className="btn" disabled={!dirty || busy} onClick={() => setDraft(toDraft(base))}>変更を破棄</button>
      </div>
    </section>
  );
}
