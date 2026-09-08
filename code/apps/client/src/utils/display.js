const GAME_LABELS = {
  lol: '英雄联盟',
  'league-of-legends': '英雄联盟',
  wangzhe: '王者荣耀',
  honor: '王者荣耀',
  delta: '三角洲行动',
  valorant: '无畏契约',
  pubg: '绝地求生',
};

const SERVICE_LABELS = {
  companion: '陪玩服务',
  boosting: '进阶服务',
  training: '教学指导',
  team: '组队协作',
};

export function gameText(value) {
  const key = String(value || '').trim();
  return GAME_LABELS[key.toLowerCase()] || key || '综合服务';
}

export function serviceTypeText(value) {
  const key = String(value || '').trim();
  return SERVICE_LABELS[key.toLowerCase()] || key || '品质服务';
}

export function formatDateTime(value) {
  if (value === null || value === undefined || value === '') return '—';
  const parsed = /^\d{10,13}$/.test(String(value)) ? Number(value) : value;
  const date = new Date(parsed);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function maskPhone(value) {
  return String(value || '').replace(/^(1\d{2})\d{4}(\d{4})$/, '$1****$2');
}
