import { useEffect, useRef } from 'react';
import { dayTitle, slotKey, slotTime } from './logic';
import type { Day, Mark } from './types';

/** 駒の形のバッジ */
export function Koma({ children }: { children: React.ReactNode }) {
  return <span className="koma">{children}</span>;
}

export const MARK_TEXT: Record<Mark, string> = { ok: '○', maybe: '△' };

/** ○△グリッド(1日分) */
export function DayGrid({
  day, avail, base, editable, onCycle, onAll, onClear,
}: {
  day: Day;
  avail: Record<string, Mark>;
  base?: Record<string, Mark>; // 変更箇所を示すための元の登録
  editable: boolean;
  onCycle: (key: string) => void;
  onAll: () => void;
  onClear: () => void;
}) {
  return (
    <section className="day">
      <div className="day-head">
        <h3>{dayTitle(day)}</h3>
        {editable && (
          <span className="day-links">
            <button className="link" onClick={onAll}>すべて○</button>
            <button className="link" onClick={onClear}>クリア</button>
          </span>
        )}
      </div>
      <div className="board">
        {day.slots.map((s) => {
          const key = slotKey(day.id, s.id);
          const m = avail[key];
          const changed = base && (base[key] ?? '') !== (m ?? '');
          return (
            <button
              key={s.id}
              className={`cell ${m ?? 'none'}${changed ? ' changed' : ''}`}
              disabled={!editable}
              onClick={() => onCycle(key)}
              aria-label={`${slotTime(s)} ${m === 'ok' ? '参加できる' : m === 'maybe' ? '調整すれば可' : '不可'}`}
            >
              {changed && <span className="changed-tag">変更</span>}
              {s.name && <Koma>{s.name}</Koma>}
              <span className="cell-time">{slotTime(s)}</span>
              <span className="cell-mark">{m ? MARK_TEXT[m] : ''}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** クリップボードに書き込めなかったときの全文表示 */
export function CopyFallback({ text, onClose }: { text: string; onClose: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, [text]);
  return (
    <div className="notice">
      <p className="small">自動でコピーできませんでした。下の全文を選択してコピーしてください。</p>
      <textarea ref={ref} className="copybox" readOnly value={text} rows={10} />
      <button className="btn" onClick={onClose}>閉じる</button>
    </div>
  );
}
