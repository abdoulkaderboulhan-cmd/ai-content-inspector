// The server stores times in UTC without a "Z"; add it so the browser converts to local time.
export function formatDate(value) {
  if (!value) return "";
  const s = String(value);
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z");
  return d.toLocaleString();
}

export function percent(x) {
  return (Number(x) * 100).toFixed(1) + "%";
}
