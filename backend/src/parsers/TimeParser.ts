export function parseIso8601Duration(duration: string): number | undefined {
  if (!duration) return undefined;
  const match = duration.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return undefined;
  const days = parseInt(match[1] ?? '0');
  const hours = parseInt(match[2] ?? '0');
  const minutes = parseInt(match[3] ?? '0');
  const total = days * 1440 + hours * 60 + minutes;
  return total > 0 ? total : undefined;
}

export function parseHumanDuration(text: string): number | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  let total = 0;
  const hourMatch = lower.match(/(\d+)\s*(?:stunde|stunden|std\.?|h)/);
  const minMatch = lower.match(/(\d+)\s*(?:minute|minuten|min\.?|m)/);
  if (hourMatch) total += parseInt(hourMatch[1]) * 60;
  if (minMatch) total += parseInt(minMatch[1]);
  return total > 0 ? total : undefined;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} Min.`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} Std. ${m} Min.` : `${h} Std.`;
}
