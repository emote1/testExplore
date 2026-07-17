import { useMemo, useState } from 'react';
import { C, GROUP_PAGE, MONTHS, WEEKDAYS } from './constants';
import { fmtAge, fmtAmount, fmtUsd, hexA, truncate } from './format';
import { usePoolContext } from './PoolContext';
import TxDetailCard from './TxDetailCard';
import { usePoolCalendar } from '@/hooks/use-pool-calendar';
import { usePoolTransfers } from '@/hooks/use-pool-transfers';
import { dayRangeUtc, todayRange } from '@/data/pool';
import type {
  CalendarIndexData, ChannelSummary, Dir, SelectedDay, SovraTx, TimeGroupData,
} from './types';

function pageArrow(color: string, disabled: boolean): React.CSSProperties {
  return {
    fontFamily: '"JetBrains Mono",monospace', fontSize: 16, lineHeight: '1',
    color: disabled ? C.textDim : color,
    background: disabled ? 'transparent' : `${color}14`,
    border: `1px solid ${disabled ? C.border : color + '44'}`, borderRadius: 8,
    width: 30, height: 30, cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1, transition: 'all 0.15s',
  };
}

function navBtn(color: string, disabled = false): React.CSSProperties {
  return {
    fontFamily: '"JetBrains Mono",monospace', fontSize: 16,
    color: disabled ? C.textDim : color,
    background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8,
    width: 28, height: 28, cursor: disabled ? 'default' : 'pointer', lineHeight: '1',
    opacity: disabled ? 0.35 : 1, transition: 'opacity 0.15s',
  };
}

const loaderStyle: React.CSSProperties = {
  fontFamily: '"JetBrains Mono",monospace', fontSize: 10, color: C.textDim,
  textAlign: 'center', padding: '14px 0', letterSpacing: '0.08em',
};

/** One transaction row (counterparty, age, amount, whale badge). */
function TxRow({ tx, color, dir, onTapTx, selected }: {
  tx: SovraTx; color: string; dir: Dir; onTapTx: (tx: SovraTx) => void; selected: boolean;
}) {
  return (
    <button onClick={() => onTapTx(tx)} className="swf-row-in" aria-expanded={selected} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      background: selected ? 'rgba(4,33,44,0.8)' : 'rgba(2,21,30,0.55)',
      // no `border` shorthand here: left edge differs and both react to `selected`
      borderTop: `1px solid ${selected ? color + '77' : C.border}`,
      borderRight: `1px solid ${selected ? color + '77' : C.border}`,
      borderBottom: `1px solid ${selected ? color + '77' : C.border}`,
      borderLeft: `3px solid ${color}`, borderRadius: 10,
      boxShadow: selected ? `0 0 16px ${color}2e` : 'none',
      padding: '10px 13px', cursor: 'pointer', textAlign: 'left', width: '100%',
      transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: C.textMute }}>{truncate(tx.counterparty)}</div>
        <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 9, color: C.textDim, marginTop: 2 }}>{fmtAge(tx.ageMs)}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 600, color: tx.whale ? C.coralLight : C.text }}>
          {dir === 'in' ? '+' : '−'}{fmtAmount(tx.amount)} <span style={{ color: C.textDim, fontWeight: 400 }}>{tx.coin}</span>
          {tx.whale && <span style={{ marginLeft: 5 }}>🐋</span>}
        </div>
        {tx.valueUsd > 0 && (
          <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 9, color: C.textDim, marginTop: 1 }}>{fmtUsd(tx.valueUsd)}</div>
        )}
      </div>
    </button>
  );
}

/** Row + its detail card, which unfolds inline right under the tapped row. */
function TxItem({ tx, color, dir, selected, onTapTx }: {
  tx: SovraTx; color: string; dir: Dir; selected: boolean; onTapTx: (tx: SovraTx) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <TxRow tx={tx} color={color} dir={dir} onTapTx={onTapTx} selected={selected} />
      {selected && <TxDetailCard tx={tx} onClose={() => onTapTx(tx)} />}
    </div>
  );
}

/** A time group (e.g. Today) with arrow pagination (5 per page). */
function TimeGroup({ group, color, dir, onTapTx, defaultOpen, selectedHash }: {
  group: TimeGroupData; color: string; dir: Dir; onTapTx: (tx: SovraTx) => void; defaultOpen: boolean;
  selectedHash: string | null;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [page, setPage] = useState(0);
  const total = group.txs.reduce((s, t) => s + t.valueUsd, 0);
  const pageCount = Math.ceil(group.txs.length / GROUP_PAGE);
  const start = page * GROUP_PAGE;
  const visible = group.txs.slice(start, start + GROUP_PAGE);
  const paged = group.txs.length > GROUP_PAGE;
  const fade = Math.max(0.4, 1 - (group.depth || 0) * 0.09);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 4px 2px',
        opacity: open ? 1 : fade, transition: 'opacity 0.3s',
        width: '100%', textAlign: 'left',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            fontFamily: '"JetBrains Mono",monospace', fontSize: 9, color: C.textDim,
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block',
          }}>▶</span>
          <span style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontSize: 11.5, fontWeight: 500, color: C.textMute, letterSpacing: '0.02em' }}>{group.label}</span>
        </span>
        <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 9, color: C.textDim, letterSpacing: '0.04em' }}>
          {group.txs.length} · {dir === 'in' ? '+' : '−'}{fmtUsd(total)}
        </span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visible.map((tx) => (
            <TxItem key={tx.hash} tx={tx} color={color} dir={dir} onTapTx={onTapTx} selected={selectedHash === tx.hash} />
          ))}
          {paged && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '4px 0 2px' }}>
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} style={pageArrow(color, page === 0)}>‹</button>
              <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 10, color: C.textMute, minWidth: 44, textAlign: 'center' }}>
                {page + 1} / {pageCount}
              </span>
              <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1} style={pageArrow(color, page >= pageCount - 1)}>›</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Calendar: year/month picker + day grid with per-day activity intensity. */
function CalendarPicker({ cal, color, selectedDay, onSelectDay }: {
  cal: CalendarIndexData; color: string; selectedDay?: string | null;
  onSelectDay: (d: SelectedDay | null) => void;
}) {
  const now = new Date();
  // Open on the most recent month with activity — the current month is often empty.
  const lastActive = Number.isFinite(cal.maxTs) ? new Date(cal.maxTs) : now;
  const [year, setYear] = useState(lastActive.getFullYear());
  const [month, setMonth] = useState(lastActive.getMonth());
  const [yearOpen, setYearOpen] = useState(false);

  const first = new Date(year, month, 1);
  const startCol = (first.getDay() + 6) % 7; // 0 = Monday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const maxCount = Math.max(1, ...Object.values(cal.dayMap).map((d) => d.count));

  const cells: (number | null)[] = [];
  for (let i = 0; i < startCol; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  // Clamp navigation: never past the current month, never before the wallet's
  // first activity (no transactions can exist outside that window).
  const nowY = now.getFullYear();
  const nowM = now.getMonth();
  const atFuture = year > nowY || (year === nowY && month >= nowM);
  const minDate = Number.isFinite(cal.minTs) ? new Date(cal.minTs) : null;
  const atPast = minDate
    ? (year < minDate.getFullYear() || (year === minDate.getFullYear() && month <= minDate.getMonth()))
    : false;

  const prevMonth = () => { if (atPast) return; if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (atFuture) return; if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); };

  return (
    <div style={{
      background: 'rgba(2,21,30,0.4)', border: `1px solid ${C.border}`,
      borderRadius: 12, padding: '10px 12px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button onClick={prevMonth} disabled={atPast} style={navBtn(color, atPast)}>‹</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontSize: 13, fontWeight: 600, color: C.text }}>{MONTHS[month]}</span>
          <button onClick={() => setYearOpen((o) => !o)} style={{
            fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 600, color,
            background: `${color}14`, border: `1px solid ${color}44`, borderRadius: 8,
            padding: '2px 9px', cursor: 'pointer',
          }}>{year} ▾</button>
        </div>
        <button onClick={nextMonth} disabled={atFuture} style={navBtn(color, atFuture)}>›</button>
      </div>

      {yearOpen && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, justifyContent: 'center' }}>
          {cal.years.map((y) => (
            <button key={y} onClick={() => { setYear(y); if (y === nowY && month > nowM) setMonth(nowM); setYearOpen(false); }} style={{
              fontFamily: '"JetBrains Mono",monospace', fontSize: 11,
              color: y === year ? color : C.textMute,
              background: y === year ? `${color}22` : 'transparent',
              border: `1px solid ${y === year ? color + '66' : C.border}`, borderRadius: 8,
              padding: '4px 10px', cursor: 'pointer',
            }}>{y}</button>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ textAlign: 'center', fontFamily: '"JetBrains Mono",monospace', fontSize: 9.5, fontWeight: 500, color: C.textMute, letterSpacing: '0.02em' }}>{w}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={'e' + i} />;
          const key = year + '-' + month + '-' + day;
          const info = cal.dayMap[key];
          const active = !!info;
          const sel = selectedDay === key;
          const intensity = active ? 0.22 + (info.count / maxCount) * 0.55 : 0;
          return (
            <button key={key} disabled={!active}
              onClick={() => onSelectDay(sel ? null : { key, year, month, day, info })}
              title={active ? `${info.count} tx` : ''}
              style={{
                position: 'relative', aspectRatio: '1', borderRadius: 9,
                cursor: active ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: '"JetBrains Mono",monospace', fontSize: 12.5,
                color: active ? (sel ? '#02151D' : C.text) : 'rgba(168,223,229,0.28)',
                fontWeight: active ? 600 : 400,
                background: sel ? color : (active ? hexA(color, intensity) : 'transparent'),
                border: sel ? `1px solid ${color}` : (active ? `1px solid ${color}40` : '1px solid transparent'),
                boxShadow: sel ? `0 0 10px ${color}` : 'none',
                transition: 'all 0.15s',
              }}>
              {day}
              {active && !sel && (
                <span style={{
                  position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)',
                  width: 3, height: 3, borderRadius: '50%', background: color,
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ChannelBlockProps {
  ch: ChannelSummary;
  expanded: boolean;
  onToggle: () => void;
  onTapTx: (tx: SovraTx) => void;
  share?: number;
  /** Bump to flash the card — a live transfer just landed in this channel. */
  pulse?: number;
  /** Hash of the tx whose detail card is open (unfolds inline under its row). */
  selectedHash?: string | null;
}

/** A flow band: header (icon, total, share bar) + expandable calendar & list. */
export default function ChannelBlock({ ch, expanded, onToggle, onTapTx, share = 0, pulse = 0, selectedHash = null }: ChannelBlockProps) {
  const { accounts, prices } = usePoolContext();
  const [selDay, setSelDay] = useState<SelectedDay | null>(null);
  const [dayPage, setDayPage] = useState(0);
  const [calOpen, setCalOpen] = useState(false);
  const selectDay = (d: SelectedDay | null) => { setSelDay(d); setDayPage(0); };

  // stable ranges so the list queries don't refetch on every render
  const tRange = useMemo(() => todayRange(Date.now()), []);
  const dRange = useMemo(() => (selDay ? dayRangeUtc(selDay.key) : undefined), [selDay]);

  const cal = usePoolCalendar(accounts, ch.id, expanded);
  const today = usePoolTransfers({ accounts, channel: ch.id, prices, enabled: expanded && !selDay, range: tRange });
  const dayList = usePoolTransfers({ accounts, channel: ch.id, prices, enabled: expanded && !!selDay, range: dRange });

  const todayGroup: TimeGroupData = { label: 'Last 24h', fresh: true, depth: 0, txs: today.txs };

  return (
    <div style={{ position: 'relative', zIndex: 2 }}>
      {/* key replays the live-flash animation on every pulse (header is stateless) */}
      <button key={pulse || 'hdr'} onClick={onToggle} className={pulse ? 'swf-live-flash' : undefined} style={{
        width: '100%', display: 'block',
        background: `linear-gradient(90deg, ${ch.color}14, ${ch.color}28, ${ch.color}14)`,
        border: `1px solid ${ch.color}55`,
        borderRadius: 14, padding: '14px 18px', cursor: 'pointer',
        transition: 'all 0.25s ease',
        boxShadow: expanded ? `0 0 20px ${ch.color}40` : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: `${ch.color}22`, border: `1px solid ${ch.color}66`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: ch.color,
            }}>{ch.icon}</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontSize: 14, fontWeight: 500, color: C.text }}>{ch.label}</div>
              <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 9.5, color: C.textDim, letterSpacing: '0.06em', marginTop: 2 }}>
                {ch.count} {ch.desc} · lifetime
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 15, fontWeight: 600, color: ch.color }}>
              {ch.dir === 'in' ? '+' : '−'}{fmtAmount(ch.reefEqTotal)}
            </div>
            <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 9, color: C.textDim, marginTop: 2 }}>
              {fmtUsd(ch.usdTotal)}
            </div>
          </div>
        </div>
        {/* share-of-side bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11 }}>
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: `${ch.color}1f`, overflow: 'hidden' }}>
            <div style={{ width: `${Math.round(share * 100)}%`, height: '100%', background: ch.color, borderRadius: 2, transition: 'width 0.4s' }} />
          </div>
          <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 8.5, color: C.textDim, minWidth: 30, textAlign: 'right' }}>
            {Math.round(share * 100)}%
          </span>
        </div>
      </button>

      {expanded && (
        <div className="swf-channel-expand" style={{
          width: '100%', margin: '8px auto 0',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {/* calendar toggle */}
          <button onClick={() => setCalOpen((o) => !o)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: '"Bricolage Grotesque",sans-serif', fontSize: 12.5, fontWeight: 500, color: ch.color,
            background: `${ch.color}12`, border: `1px solid ${ch.color}3a`, borderRadius: 11,
            padding: '11px', cursor: 'pointer', letterSpacing: '0.01em',
          }}>
            <span style={{ fontSize: 14 }}>📅</span>
            {calOpen ? 'Hide calendar' : (selDay ? `${MONTHS[selDay.month].slice(0, 3)} ${selDay.day}, ${selDay.year}` : 'Pick a date')}
          </button>

          {selDay ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 2px 2px' }}>
                <span style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontSize: 12, fontWeight: 500, color: ch.color }}>
                  {MONTHS[selDay.month]} {selDay.day}, {selDay.year}
                </span>
                <button onClick={() => selectDay(null)} style={{
                  fontFamily: '"JetBrains Mono",monospace', fontSize: 9, color: C.textMute,
                  background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8,
                  padding: '3px 9px', cursor: 'pointer',
                }}>clear ✕</button>
              </div>
              {dayList.loading ? (
                <div style={loaderStyle}>loading…</div>
              ) : (
                <>
                  {dayList.txs.slice(dayPage * GROUP_PAGE, dayPage * GROUP_PAGE + GROUP_PAGE).map((tx) => (
                    <TxItem key={tx.hash} tx={tx} color={ch.color} dir={ch.dir} onTapTx={onTapTx} selected={selectedHash === tx.hash} />
                  ))}
                  {dayList.txs.length > GROUP_PAGE && (() => {
                    const pageCount = Math.ceil(dayList.txs.length / GROUP_PAGE);
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '4px 0 2px' }}>
                        <button onClick={() => setDayPage((p) => Math.max(0, p - 1))} disabled={dayPage === 0} style={pageArrow(ch.color, dayPage === 0)}>‹</button>
                        <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 10, color: C.textMute, minWidth: 44, textAlign: 'center' }}>
                          {dayPage + 1} / {pageCount}
                        </span>
                        <button onClick={() => setDayPage((p) => Math.min(pageCount - 1, p + 1))} disabled={dayPage >= pageCount - 1} style={pageArrow(ch.color, dayPage >= pageCount - 1)}>›</button>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          ) : (
            today.loading ? (
              <div style={loaderStyle}>loading…</div>
            ) : today.txs.length > 0 ? (
              <TimeGroup group={todayGroup} color={ch.color} dir={ch.dir} onTapTx={onTapTx} defaultOpen selectedHash={selectedHash} />
            ) : (
              <button onClick={() => setCalOpen(true)} style={{
                ...loaderStyle, color: C.textMute, width: '100%',
                background: 'transparent', border: 'none', cursor: 'pointer',
              }}>
                Nothing today — <span style={{ color: ch.color }}>browse by date ↓</span>
              </button>
            )
          )}

          {calOpen && (
            <CalendarPicker key={String(cal.maxTs)} cal={cal} color={ch.color}
              selectedDay={selDay?.key} onSelectDay={selectDay} />
          )}
        </div>
      )}
    </div>
  );
}
