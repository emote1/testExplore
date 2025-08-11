import { ExternalLink as ExternalLinkIcon } from 'lucide-react';
import React from 'react';
import { cn } from '../../utils/ui';

interface ExternalLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

export const ExternalLink: React.FC<ExternalLinkProps> = ({
  href,
  children,
  className,
  ...props
}) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1 text-sm text-blue-600 hover:underline',
        className
      )}
      {...props}
    >
      {children}
      <ExternalLinkIcon className="h-4 w-4" />
    </a>
  );
};
