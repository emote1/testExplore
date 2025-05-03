// Types migrated from CRA project
export interface Transfer {
  id: string;
  amount: string;
  from: { id: string };
  to: { id: string };
  extrinsicHash?: string;
  timestamp?: number | string;
}

export interface TransactionItemProps {
  transfer: Transfer;
  address: string;
  copyToClipboard: (text: string) => void;
  openInExplorer: (address: string) => void;
}
