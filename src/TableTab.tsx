import { useState } from 'react';
import type { TabProps } from './App';
import { allSlots, dayTitle, slotKey, slotStatus, slotTime } from './logic';
import { Koma } from './parts';

export function TableTab({ data }: TabProps) {
  const { config, entries, assignment } = data;
  const valid = new Set(entries.map((e) => e.id));
  const nameOf = new Map(entries.map((e) => [e.id, e.name]));

  const [me, setMe] = useState('');
  const meEntry = entries.find((e) => e.name === me);

  const mine = meEntry
    ? allSlots(config).filter((ref) => slotStatus(config, assignment, ref, valid).some((r) => r.ids.includes(meEntry.id)))
    : [];

  return (
    <div className="panel">
      <label className="field">
        <span className="label">自分の名前</span>
        <select value={meEntry ? me : ''} onChange={(e) => setMe(e.target.value)}>
          <option value="">(選ぶと自分のシフトを強調表示します)</option>
          {entries.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
        </select>
      </label>

      {meEntry && (
        <div className="mine">
          <h2 className="h2">あなたのシフト</h2>
          {mine.length ? (
            <ul>
              {mine.map(({ day, slot, key }) => (
                <li key={key}>
                  {dayTitle(day)} {slot.name && <Koma>{slot.name}</Koma>} {slotTime(slot)}
                </li>
              ))}
            </ul>
          ) : <p className="muted">担当はありません。</p>}
        </div>
      )}

      {config.days.map((day) => (
        <div key={day.id} className="scroll">
          <table className="tbl">
            <caption>{dayTitle(day)}</caption>
            <thead>
              <tr><th>時間</th><th>担当メンバー</th></tr>
            </thead>
            <tbody>
              {day.slots.map((slot) => {
                const sts = slotStatus(config, assignment, { day, slot, key: slotKey(day.id, slot.id) }, valid);
                const hit = meEntry && sts.some((r) => r.ids.includes(meEntry.id));
                return (
                  <tr key={slot.id} className={hit ? 'hit' : undefined}>
                    <td className="nowrap">
                      {slot.name && <><Koma>{slot.name}</Koma><br /></>}
                      {slotTime(slot)}
                    </td>
                    <td>
                      {sts.map(({ role, ids, short }) => (
                        <div key={role.id} className="names">
                          {!slot.name && sts.length > 1 && <Koma>{role.name}</Koma>}
                          {ids.map((id) => (
                            <span key={id} className={meEntry?.id === id ? 'name me' : 'name'}>{nameOf.get(id)}</span>
                          ))}
                          {!ids.length && !short && <span className="muted">—</span>}
                          {short > 0 && <span className="short">あと{short}人</span>}
                        </div>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
