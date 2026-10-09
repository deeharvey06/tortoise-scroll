export function fmtMoney(value) {
  if (value === null || value === undefined) return null;

  const sign = value < 0 ? '−' : '';

  return `${sign}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDuration(seconds) {
  if (seconds === null || seconds === undefined) return null;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function fmtAxisMoney(value) {
  if (!Number.isFinite(Number(value))) return value;

  const number = Number(value);
  const absolute = Math.abs(number);

  const compact =
    absolute >= 1000000
      ? `${(absolute / 1000000).toFixed(1)}m`
      : absolute >= 1000
        ? `${(absolute / 1000).toFixed(1)}k`
        : absolute.toFixed(0);
  return `${number < 0 ? '−' : ''}$${compact}`;
}
