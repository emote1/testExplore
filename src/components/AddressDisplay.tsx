import React from 'react';
import { Check, Copy } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { shortenHash } from '../utils/formatters';
import { cn } from '@/utils/ui';

export interface AddressDisplayProps {
  address: string;
  className?: string;
  copyable?: boolean;
}

export function AddressDisplay({ address, className, copyable = false }: AddressDisplayProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }, [address]);

  return (
    <span className="inline-flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn('cursor-pointer font-mono text-sm', className)}>{shortenHash(address, 6, 6)}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{address}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {copyable ? (
        <button
          type="button"
          className="p-1 rounded-full text-emerald-700/80 hover:text-emerald-700 hover:bg-emerald-100/70 transition"
          title={copied ? 'Copied' : 'Copy address'}
          aria-label={copied ? 'Address copied' : 'Copy address'}
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      ) : null}
    </span>
  );
}
