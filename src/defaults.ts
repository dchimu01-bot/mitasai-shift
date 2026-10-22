import type { Assignment, Config, Slot } from './types';

const regular = (): Slot[] => [
  { id: 's1', start: '09:30', end: '13:00' },
  { id: 's2', start: '13:00', end: '15:30' },
  { id: 's3', start: '15:30', end: '18:00' },
];

export const DEFAULT_CONFIG: Config = {
  title: '三田祭 将棋研シフト',
  members: [
    '小野', '鈴木', '森', '山口', '砂原', '荒木', '平林', '境', '松本', '根岸', '佐藤', '橘',
    '長谷部', '松尾', '河口', '牧', '中村', '伊藤', '大間', '髙木', '堀内', '髙橋', '稲田',
  ],
  roles: [{ id: 'r-taikyoku', name: '担当', need: 4 }],
  days: [
    { id: 'd1119', date: '2026-11-19', label: '前日準備', slots: [{ id: 'prep', start: '', end: '', name: '前日準備', need: 6 }] },
    { id: 'd1120', date: '2026-11-20', label: '', slots: regular() },
    { id: 'd1121', date: '2026-11-21', label: '', slots: regular() },
    { id: 'd1122', date: '2026-11-22', label: '', slots: regular() },
    {
      id: 'd1123', date: '2026-11-23', label: '最終日',
      slots: [...regular(), { id: 'cleanup', start: '18:00', end: '19:00', name: '後片付け', need: 6 }],
    },
  ],
  updatedAt: '',
};

export const EMPTY_ASSIGNMENT: Assignment = { published: false, map: {}, updatedAt: '' };
