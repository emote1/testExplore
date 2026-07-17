import { ChangeEvent, KeyboardEvent, MutableRefObject, RefObject } from 'react';
import { ArrowRight } from 'lucide-react';
import { COLORS } from './constants';

interface Props {
  value: string;
  onChange: (next: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  inputRef: RefObject<HTMLInputElement>;
  wrapperRef: MutableRefObject<HTMLDivElement | null>;
  /** When true, the current value failed address validation — tint the field coral. */
  invalid?: boolean;
}

/**
 * Search-bar scaffold. Renders the real <input> + submit button.
 * No visible pill border — the flock's formation fish provide that visually.
 */
export function ParticleSearchBar({
  value,
  onChange,
  onKeyDown,
  onSubmit,
  inputRef,
  wrapperRef,
  invalid = false,
}: Props) {
  const hasValue = !!value && value.trim().length > 0;

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'relative',
        height: 58,
        width: '100%',
        maxWidth: 540,
        margin: '0 auto',
      }}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Wallet address — 0x… or 5…"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: invalid ? COLORS.coral : COLORS.textPrimary,
          padding: '0 64px 0 28px',
          fontSize: 15,
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          borderRadius: 29,
          boxShadow: invalid
            ? `inset 0 0 0 1px ${COLORS.coral}, 0 0 18px rgba(255, 139, 110, 0.25)`
            : 'none',
          transition: 'box-shadow 0.25s ease, color 0.25s ease',
        }}
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={!hasValue}
        aria-label="Search"
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 42,
          height: 42,
          borderRadius: '50%',
          background: hasValue
            ? `linear-gradient(135deg, ${COLORS.coralDeep}, ${COLORS.coral})`
            : 'rgba(79, 184, 201, 0.12)',
          border: 'none',
          cursor: hasValue ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          boxShadow: hasValue
            ? '0 4px 18px rgba(255, 139, 110, 0.45), inset 0 0 0 1px rgba(255, 200, 184, 0.2)'
            : 'none',
        }}
      >
        <ArrowRight size={18} color={hasValue ? '#FFF6F2' : 'rgba(168, 223, 229, 0.4)'} />
      </button>
    </div>
  );
}
