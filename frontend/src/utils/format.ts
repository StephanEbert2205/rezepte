export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} Min.`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} Std. ${m} Min.` : `${h} Std.`;
}

export function scaleAmount(
  amountPerServing: number | null,
  targetServings: number,
  unit?: string | null,
): string {
  if (amountPerServing === null || amountPerServing === undefined) return '';
  const total = amountPerServing * targetServings;

  const unitsThatRoundUp = ['Stück', 'Zehe', 'Zehen', 'Bund', 'Dose', 'Dosen', 'Becher', 'Paket', 'Scheibe', 'Scheiben', 'Zweig', 'Zweige', 'Blatt'];
  if (unit && unitsThatRoundUp.includes(unit)) {
    return Math.ceil(total).toString();
  }

  const fracs: [number, string][] = [
    [0.25, '¼'], [0.333, '⅓'], [0.5, '½'], [0.667, '⅔'], [0.75, '¾'],
  ];

  if (total < 1 && total > 0) {
    for (const [val, sym] of fracs) {
      if (Math.abs(total - val) < 0.04) return sym;
    }
    return parseFloat(total.toFixed(1)).toString();
  }

  const whole = Math.floor(total);
  const frac = total - whole;
  if (frac > 0.05 && whole > 0) {
    for (const [val, sym] of fracs) {
      if (Math.abs(frac - val) < 0.04) return `${whole}${sym}`;
    }
  }

  if (total < 10) return parseFloat(total.toFixed(1)).toString();
  return Math.round(total).toString();
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
