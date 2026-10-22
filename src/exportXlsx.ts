import type { Cell, Row } from 'write-excel-file/browser';
import { dayTitle, slotKey, slotStatus, slotTime } from './logic';
import type { Assignment, Config, Entry } from './types';

const border = { borderStyle: 'thin', borderColor: '#9AA5B1' } as const;
const head = { ...border, fontWeight: 'bold', backgroundColor: '#DFE7F3', align: 'center' } as const;

/** シフト表を Excel ファイルとしてダウンロードする */
export async function downloadShiftXlsx(c: Config, a: Assignment, entries: Entry[]) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const valid = new Set(entries.map((e) => e.id));
  const nameOf = new Map(entries.map((e) => [e.id, e.name]));

  const rows: Row[] = [
    [{ value: c.title, fontWeight: 'bold', fontSize: 14, columnSpan: 4 }, null, null, null],
    [],
    [{ value: '日付', ...head }, { value: '時間', ...head }, { value: '担当メンバー', ...head }, { value: '人数', ...head }],
  ];

  for (const day of c.days) {
    const dayRows: Cell[][] = [];
    for (const slot of day.slots) {
      const sts = slotStatus(c, a, { day, slot, key: slotKey(day.id, slot.id) }, valid);
      for (const { role, ids, short } of sts) {
        let time = slot.name ? (slot.start || slot.end ? `${slot.name} ${slotTime(slot)}` : slot.name) : slotTime(slot);
        if (!slot.name && sts.length > 1) time += ` ${role.name}`;
        const names = ids.map((id) => nameOf.get(id)).join('、') || '未定';
        dayRows.push([
          null,
          { value: time, ...border, alignVertical: 'center' },
          { value: short ? `${names}(あと${short}人)` : names, ...border, wrap: true, alignVertical: 'center', ...(short ? { textColor: '#B83A3A' } : {}) },
          { value: `${ids.length} / ${role.need}`, ...border, align: 'center', alignVertical: 'center' },
        ]);
      }
    }
    if (!dayRows.length) continue;
    dayRows[0][0] = { value: dayTitle(day), ...border, fontWeight: 'bold', alignVertical: 'center', rowSpan: dayRows.length };
    rows.push(...dayRows);
  }

  await writeXlsxFile(rows, {
    sheet: 'シフト表',
    columns: [{ width: 18 }, { width: 22 }, { width: 50 }, { width: 9 }],
  }).toFile(`${c.title}.xlsx`);
}
