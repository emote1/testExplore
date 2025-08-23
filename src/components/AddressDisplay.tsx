import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { shortenHash } from '../utils/formatters';

export interface AddressDisplayProps {
  address: string;
}

export function AddressDisplay({ address }: AddressDisplayProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-pointer">{shortenHash(address, 6, 6)}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{address}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
