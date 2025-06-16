// src/utils/formatters.ts

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  return date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function shortenHash(hash: string | undefined, startChars = 6, endChars = 4): string {
  if (!hash) return 'N/A';
  if (hash.length <= startChars + endChars + 3) return hash; // +3 for '...'
  return `${hash.substring(0, startChars)}...${hash.substring(hash.length - endChars)}`;
}
