/**
 * Timezone helpers built on Intl — no external date library needed.
 */

export function localHourInTimezone(timezone, date = new Date()) {
  try {
    const hour = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(date);
    return Number(hour) % 24;
  } catch {
    return date.getUTCHours();
  }
}

/** Returns YYYY-MM-DD for the given instant in the store's timezone. */
export function localDateKey(timezone, date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** A UTC-midnight Date used as the `@db.Date` key for a local day. */
export function dateOnly(dateKey) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function shiftDateKey(dateKey, days) {
  return addDays(dateOnly(dateKey), days).toISOString().slice(0, 10);
}

/** Start/end instants (UTC) covering a local calendar day in `timezone`. */
export function localDayRange(timezone, dateKey) {
  // Determine the timezone offset at noon on that day to avoid DST edges.
  const probe = new Date(`${dateKey}T12:00:00Z`);
  const offsetMinutes = timezoneOffsetMinutes(timezone, probe);
  const start = new Date(new Date(`${dateKey}T00:00:00Z`).getTime() - offsetMinutes * 60000);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  return { start, end };
}

export function timezoneOffsetMinutes(timezone, date = new Date()) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
    const asUTC = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
      Number(parts.second)
    );
    return (asUTC - date.getTime()) / 60000;
  } catch {
    return 0;
  }
}

export function lastNDateKeys(timezone, n, endDateKey = localDateKey(timezone)) {
  const keys = [];
  for (let i = n - 1; i >= 0; i -= 1) keys.push(shiftDateKey(endDateKey, -i));
  return keys;
}
