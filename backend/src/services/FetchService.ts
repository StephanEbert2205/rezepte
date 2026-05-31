import axios from 'axios';
import { config } from '../config';

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^fd[0-9a-f]{2}:/i,
  /^localhost$/i,
];

export function validatePublicUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Ungültige URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Nur HTTP und HTTPS URLs sind erlaubt');
  }

  const hostname = parsed.hostname;
  if (PRIVATE_IP_PATTERNS.some((p) => p.test(hostname))) {
    throw new Error('Private oder lokale URLs sind nicht erlaubt');
  }
}

export async function fetchHtml(url: string): Promise<string> {
  validatePublicUrl(url);

  const response = await axios.get<string>(url, {
    timeout: config.fetchTimeout,
    maxContentLength: config.maxResponseSize,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
    },
    responseType: 'text',
    maxRedirects: 5,
  });

  return response.data;
}
