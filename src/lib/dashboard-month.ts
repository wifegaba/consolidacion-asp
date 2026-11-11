const monthFormatter = new Intl.DateTimeFormat('es-ES', {
  month: 'long', year: 'numeric', timeZone: 'UTC',
});

export function isDashboardMonth(value?: string): value is string {
  return Boolean(value && /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value));
}

export function formatDashboardMonth(value: string) {
  const label = monthFormatter.format(new Date(value + '-01T00:00:00Z'));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
