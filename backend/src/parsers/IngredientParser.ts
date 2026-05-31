import { ParsedIngredient } from './types';

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '¼': 0.25, '¾': 0.75,
  '⅓': 1 / 3, '⅔': 2 / 3,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
  '⅙': 1 / 6, '⅚': 5 / 6,
};

const UNIT_ALIASES: Record<string, string> = {
  'el': 'EL', 'esslöffel': 'EL', 'esslöffeln': 'EL', 'esslöffel.': 'EL',
  'tl': 'TL', 'teelöffel': 'TL', 'teelöffeln': 'TL', 'teelöffel.': 'TL',
  'g': 'g', 'gr': 'g', 'gramm': 'g',
  'kg': 'kg', 'kilogramm': 'kg',
  'ml': 'ml', 'milliliter': 'ml', 'milliliters': 'ml',
  'l': 'l', 'liter': 'l', 'lt': 'l',
  'dl': 'dl', 'deziliter': 'dl',
  'cl': 'cl', 'zentiliter': 'cl',
  'prise': 'Prise', 'prisen': 'Prise', 'priesen': 'Prise',
  'msp': 'Msp.', 'msp.': 'Msp.',
  'bund': 'Bund', 'bünde': 'Bund',
  'zehe': 'Zehe', 'zehen': 'Zehen',
  'stück': 'Stück', 'stk': 'Stück', 'stk.': 'Stück',
  'dose': 'Dose', 'dosen': 'Dosen',
  'glas': 'Glas', 'gläser': 'Glas',
  'becher': 'Becher',
  'paket': 'Paket', 'pakete': 'Paket', 'pkt': 'Paket', 'pkt.': 'Paket',
  'päckchen': 'Päckchen',
  'tasse': 'Tasse', 'tassen': 'Tasse',
  'handvoll': 'Handvoll',
  'scheibe': 'Scheibe', 'scheiben': 'Scheiben',
  'zweig': 'Zweig', 'zweige': 'Zweige',
  'blatt': 'Blatt', 'blätter': 'Blätter',
  'tropfen': 'Tropfen',
};

const OPTIONAL_PHRASES = ['optional', 'nach belieben', 'nach geschmack', 'nach wunsch'];
const FREE_TEXT_PATTERNS = [
  /^(etwas|wenig|reichlich|nach geschmack|nach belieben|nach wunsch|zum abschmecken)/i,
  /^(salz und pfeffer|salz|pfeffer)\s*(und|&)?\s*(pfeffer|salz)?(\s+nach.*)?$/i,
];

function normalizeFractions(text: string): string {
  let result = text;
  for (const [char, _] of Object.entries(UNICODE_FRACTIONS)) {
    result = result.replace(new RegExp(char, 'g'), ` ${char} `);
  }
  return result.trim();
}

function parseFraction(text: string): number | null {
  const trimmed = text.trim();

  if (UNICODE_FRACTIONS[trimmed] !== undefined) {
    return UNICODE_FRACTIONS[trimmed];
  }

  // Slash fraction: "1/2", "3/4"
  const slashMatch = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (slashMatch) {
    return parseInt(slashMatch[1]) / parseInt(slashMatch[2]);
  }

  // Mixed number: "1½", "2 ½", "1 1/2"
  const mixedMatch = trimmed.match(/^(\d+)\s*([½¼¾⅓⅔⅛⅜⅝⅞⅙⅚]|(\d+)\/(\d+))?$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    if (mixedMatch[2]) {
      const frac = UNICODE_FRACTIONS[mixedMatch[2]] ?? parseInt(mixedMatch[3]) / parseInt(mixedMatch[4]);
      return whole + (frac ?? 0);
    }
    return whole;
  }

  // Plain decimal
  const decimal = parseFloat(trimmed.replace(',', '.'));
  if (!isNaN(decimal)) return decimal;

  return null;
}

function parseAmount(token: string): { amount: number; raw: string } | null {
  const cleaned = token.trim();

  // Range: "2-3" → average
  const rangeMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)$/);
  if (rangeMatch) {
    const lo = parseFloat(rangeMatch[1].replace(',', '.'));
    const hi = parseFloat(rangeMatch[2].replace(',', '.'));
    return { amount: (lo + hi) / 2, raw: cleaned };
  }

  // Mixed fraction: "1 1/2", "2 ½"
  const mixedMatch = cleaned.match(/^(\d+)\s+([½¼¾⅓⅔⅛⅜⅝⅞⅙⅚]|\d+\/\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const frac = parseFraction(mixedMatch[2]);
    if (frac !== null) return { amount: whole + frac, raw: cleaned };
  }

  // Unicode fraction alone or prefixed
  for (const [char, val] of Object.entries(UNICODE_FRACTIONS)) {
    if (cleaned === char) return { amount: val, raw: cleaned };
    if (cleaned.endsWith(char)) {
      const prefix = cleaned.slice(0, -char.length).trim();
      const whole = parseFloat(prefix.replace(',', '.'));
      if (!isNaN(whole)) return { amount: whole + val, raw: cleaned };
    }
  }

  // Slash fraction
  const slashMatch = cleaned.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (slashMatch) {
    return { amount: parseInt(slashMatch[1]) / parseInt(slashMatch[2]), raw: cleaned };
  }

  // Plain number — only match if the entire token is numeric (no stray text like "5 Basilikumblätter")
  const num = parseFloat(cleaned.replace(',', '.'));
  if (!isNaN(num) && /^\d[\d.,]*$/.test(cleaned)) return { amount: num, raw: cleaned };

  return null;
}

function normalizeUnit(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return UNIT_ALIASES[lower] ?? raw.trim();
}

export function parseIngredient(raw: string): ParsedIngredient {
  const trimmed = raw.trim();

  // Check for free-text patterns (no amount parsing needed)
  for (const pattern of FREE_TEXT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { raw: trimmed, name: trimmed, optional: false };
    }
  }

  // Check for optional
  const lowerTrimmed = trimmed.toLowerCase();
  const optional = OPTIONAL_PHRASES.some((p) => lowerTrimmed.includes(p));

  // Tokenize: split on whitespace, preserving unicode fractions
  const tokens = trimmed.split(/\s+/);

  let amountResult: ReturnType<typeof parseAmount> | null = null;
  let amountRaw = '';
  let tokenIndex = 0;

  // Try to parse amount from first 1-3 tokens
  for (let len = Math.min(3, tokens.length); len >= 1; len--) {
    const candidate = tokens.slice(0, len).join(' ');
    amountResult = parseAmount(candidate);
    if (amountResult) {
      amountRaw = amountResult.raw;
      tokenIndex = len;
      break;
    }
  }

  if (!amountResult || tokenIndex >= tokens.length) {
    return { raw: trimmed, name: trimmed, optional, amountOriginal: amountRaw || undefined };
  }

  // Try to parse unit from next token
  let unit: string | undefined;
  let unitTokenIndex = tokenIndex;

  const nextToken = tokens[tokenIndex];
  if (nextToken) {
    const normalizedUnit = normalizeUnit(nextToken);
    const isKnownUnit = UNIT_ALIASES[nextToken.toLowerCase().trim()] !== undefined;
    if (isKnownUnit) {
      unit = normalizedUnit;
      unitTokenIndex = tokenIndex + 1;
    }
  }

  const nameTokens = tokens.slice(unitTokenIndex);
  const name = nameTokens.join(' ').trim() || trimmed;

  let finalName = name;
  let notes: string | undefined;

  // Extract notes from parentheses: "Weizenmehl (Type 550)" → name="Weizenmehl", notes="Type 550"
  const parenMatch = finalName.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    finalName = parenMatch[1].trim();
    notes = parenMatch[2].trim() || undefined;
  }

  // Extract notes after comma: "Butter, weich" → name="Butter", notes="weich"
  const commaIdx = finalName.indexOf(',');
  if (commaIdx > 0) {
    const commaNote = finalName.slice(commaIdx + 1).trim();
    if (commaNote) notes = notes ? commaNote + ', ' + notes : commaNote;
    finalName = finalName.slice(0, commaIdx).trim();
  }

  return {
    raw: trimmed,
    name: finalName,
    amountOriginal: amountRaw,
    unitOriginal: unit,
    amountNumeric: amountResult.amount,
    optional,
    notes,
  };
}

export function formatAmount(amount: number, unit?: string): string {
  const unitsThatRoundToWhole = ['Stück', 'Zehe', 'Zehen', 'Bund', 'Dose', 'Dosen', 'Becher', 'Paket', 'Scheibe', 'Scheiben', 'Zweig', 'Zweige', 'Blatt'];

  if (unit && unitsThatRoundToWhole.includes(unit)) {
    return Math.ceil(amount).toString();
  }

  // Round to sensible precision
  if (amount < 0.1) return (Math.ceil(amount * 10) / 10).toFixed(1);
  if (amount < 1) {
    const fracs: [number, string][] = [[0.25, '¼'], [0.33, '⅓'], [0.5, '½'], [0.67, '⅔'], [0.75, '¾']];
    for (const [val, sym] of fracs) {
      if (Math.abs(amount - val) < 0.05) return sym;
    }
  }
  if (amount < 10) return parseFloat(amount.toFixed(1)).toString();
  return Math.round(amount).toString();
}
