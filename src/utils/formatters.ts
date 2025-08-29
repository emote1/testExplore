// src/utils/formatters.ts

export function formatTimestamp(timestamp: string, locale = 'en-US'): string {
  const date = new Date(timestamp);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  };

  if (isNaN(date.getTime())) {
    const numericTimestamp = parseInt(timestamp, 10);
    if (!isNaN(numericTimestamp)) {
      const numericDate = new Date(numericTimestamp);
      if (!isNaN(numericDate.getTime())) {
        return numericDate.toLocaleString(locale, options);
      }
    }
    return 'Invalid Date';
  }
  return date.toLocaleString(locale, options);
}

export function shortenHash(hash: string | undefined, startChars = 6, endChars = 4): string {
  if (!hash) return 'N/A';
  if (hash.length <= startChars + endChars + 3) return hash;
  return `${hash.substring(0, startChars)}...${hash.substring(hash.length - endChars)}`;
}

// Centralized configuration for number formatting
const NUMBER_FORMAT_CONFIG = {
  compact: {
    notation: 'compact',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
  default: {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
  smallValue: {
    maximumFractionDigits: 6,
  },
  fee: {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  },
} as const;

export function formatTokenAmount(
  amountStr: string,
  decimals: number,
  symbol: string,
  options?: Intl.NumberFormatOptions,
  allowCompact = true,
  locale = 'en-US'
): string {
  amountStr = amountStr ? amountStr.trim() : '';

  // Handle cases where the token is an NFT (decimals are 0)
  if (decimals === 0) {
    return symbol;
  }

  if (!amountStr || !/^\d+$/.test(amountStr)) {
    return `${(0).toLocaleString(locale, NUMBER_FORMAT_CONFIG.default)} ${symbol}`;
  }

  try {
    const amount = BigInt(amountStr);
    // IMPORTANT: use BigInt exponentiation to avoid RangeError from BigInt(10 ** decimals)
    const divisor = 10n ** BigInt(decimals);
    const integerPart = amount / divisor;
    const fractionalPart = (amount % divisor).toString().padStart(decimals, '0');
    const numericValue = parseFloat(`${integerPart}.${fractionalPart}`);

    let formattingOptions: Intl.NumberFormatOptions;

    if (options) {
      formattingOptions = options;
    } else if (allowCompact && numericValue >= 1_000) {
      formattingOptions = NUMBER_FORMAT_CONFIG.compact;
    } else if (numericValue > 0 && numericValue < 1) {
      formattingOptions = NUMBER_FORMAT_CONFIG.smallValue;
    } else {
      formattingOptions = NUMBER_FORMAT_CONFIG.default;
    }

    return `${numericValue.toLocaleString(locale, formattingOptions)} ${symbol}`;
  } catch (error) {
    console.error('Error formatting token amount:', { amountStr, decimals, symbol, error });
    return `${(0).toLocaleString(locale, NUMBER_FORMAT_CONFIG.default)} ${symbol}`;
  }
}

export function formatAmount(amount: string, decimals: number, symbol: string, locale = 'en-US'): string {
  return formatTokenAmount(amount, decimals, symbol, undefined, true, locale);
}

const REEF_DECIMALS = 18;

export function formatFee(feeAmount: string, feeTokenSymbol: string, locale = 'en-US'): string {
  return formatTokenAmount(
    feeAmount,
    REEF_DECIMALS,
    feeTokenSymbol,
    NUMBER_FORMAT_CONFIG.fee,
    false,
    locale
  );
}
