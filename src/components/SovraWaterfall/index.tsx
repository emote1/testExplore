import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApolloClient } from '@apollo/client';
import { C, DEFAULT_ADDRESS } from './constants';
import { fmtAmount, fmtUsd } from './format';
import { usePoolSummary } from '@/hooks/use-pool-summary';
import { usePoolLive, type LiveTransferEvent } from '@/hooks/use-pool-live';
import { POOL_SUMMARY_QUERY, POOL_REEF_BALANCE_QUERY, POOL_TRANSFERS_QUERY } from '@/data/pool';
import { PoolContext } from './PoolContext';
import type { ChannelSummary, SovraTx } from './types';
import WalletPool from './WalletPool';
import ChannelBlock from './ChannelBlock';
import LiveBadge from './LiveBadge';
import FlowDivider from './FlowDivider';
import MooringSheet, { type MooringSheetAction } from './MooringSheet';
import { useWalletMooring } from '@/hooks/use-wallet-mooring';
import './sovra-waterfall.css';

interface WalletViewProps {
  /** Wallet address to display (hero). Defaults to a demo address in preview. */
  address?: string;
  /** Back to the landing/search view (replaces the prototype's window.location). */
  onBack?: () => void;
  /** Open another wallet in place (account switch / return to my waters). */
  onAddress?: (address: string) => void;
}

/** Root of the Waterfall (pool) view: entry lake -> dive -> flow channels. */
export default function WalletView({ address = DEFAULT_ADDRESS, onBack, onAddress }: WalletViewProps) {
  const [dived, setDived] = useState(false);
  const [diving, setDiving] = useState(false);
  const [diveDir, setDiveDir] = useState<'down' | 'up'>('down');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<SovraTx | null>(null);
  const [moorOpen, setMoorOpen] = useState(false);
  const mooring = useWalletMooring();

  // Opening the sheet re-shares the extension accounts for the picker. Silent:
  // only when the mooring came from the extension, i.e. permission is granted.
  const { mooredSource, accounts: mooredAccounts, extensionAvailable, moor: reMoor } = mooring;
  useEffect(() => {
    if (!moorOpen) return;
    if (mooredSource === 'extension' && mooredAccounts.length === 0 && extensionAvailable) {
      void reMoor();
    }
  }, [moorOpen, mooredSource, mooredAccounts.length, extensionAvailable, reMoor]);

  const summary = usePoolSummary(address);
  const { channels, account, accounts, prices, balanceReef, balanceUsd, lockedReef, netFlowUsd, loading, error } = summary;

  // live transfers: ripple the lake / flash the channel + refresh aggregates
  const client = useApolloClient();
  const [livePulse, setLivePulse] = useState<{ nonce: number; channel: string | null }>({ nonce: 0, channel: null });
  const onLive = useCallback((events: LiveTransferEvent[]) => {
    setLivePulse((p) => ({ nonce: p.nonce + 1, channel: events[events.length - 1]?.channel ?? null }));
    // tiny queries; refetchQueries only touches the ones currently on screen
    void client.refetchQueries({
      include: [POOL_SUMMARY_QUERY, POOL_REEF_BALANCE_QUERY, POOL_TRANSFERS_QUERY],
    }).catch(() => { /* next poll will catch up */ });
  }, [client]);
  usePoolLive(accounts, true, onLive);

  // choreographed dive: ripple + sink -> flood (swap view under cover) -> surface
  const doDive = () => {
    if (diving) return;
    setDiving(true); setDiveDir('down');
    setTimeout(() => setDived(true), 460);
    setTimeout(() => setDiving(false), 900);
  };
  const doSurface = () => {
    if (diving) return;
    setDiving(true); setDiveDir('up');
    setTimeout(() => { setDived(false); setExpanded(null); setDetail(null); }, 460);
    setTimeout(() => setDiving(false), 900);
  };

  // Tap a row -> its detail unfolds inline under it; tap again (or close) -> folds.
  const tapTx = useCallback((tx: SovraTx) => {
    setDetail((d) => (d?.hash === tx.hash ? null : tx));
  }, []);

  const inflowChannels: ChannelSummary[] = [channels.inflow, channels.stakeIn].filter((c) => c.count > 0);
  const outflowChannels: ChannelSummary[] = [channels.outflow, channels.swap].filter((c) => c.count > 0);
  const totalIn = inflowChannels.reduce((s, c) => s + c.usdTotal, 0);
  const totalOut = outflowChannels.reduce((s, c) => s + c.usdTotal, 0);

  const toggle = (id: string) => { setExpanded((e) => (e === id ? null : id)); setDetail(null); };

  const goBack = () => { if (onBack) onBack(); };
  const truncatedAddr = address.length <= 12 ? address : (
    <>{address.slice(0, 5)}<span style={{ color: C.textDim, margin: '0 2px' }}>…</span>{address.slice(-4)}</>
  );

  // mooring: is the wallet we are looking at the user's own moored wallet?
  const eqAddr = (a?: string | null, b?: string | null) =>
    !!a && !!b && a.toLowerCase() === b.toLowerCase();
  const isMine = eqAddr(mooring.mooredAddress, address) || eqAddr(mooring.mooredAddress, account);
  const openWallet = (next: string) => {
    setMoorOpen(false);
    if (onAddress && !eqAddr(next, address)) onAddress(next);
  };
  const moorActions: MooringSheetAction[] = [
    ...(!isMine && mooring.mooredAddress
      ? [{ icon: '⌂', label: 'return to my waters', color: C.teal, onClick: () => openWallet(mooring.mooredAddress as string) }]
      : []),
    ...(!mooring.mooredAddress && mooring.extensionAvailable
      ? [{ icon: '⚓', label: 'moor this wallet\'s browser', color: C.teal, onClick: () => {
          void mooring.moor().then((r) => { if (r.address) openWallet(r.address); });
        } }]
      : []),
    { icon: '⌕', label: 'another wallet', onClick: () => { setMoorOpen(false); goBack(); } },
    ...(mooring.mooredAddress
      ? [{ icon: '✕', label: 'drift away', color: C.coral, onClick: () => { void mooring.driftAway(); setMoorOpen(false); } }]
      : []),
  ];

  const hasFlows = inflowChannels.length > 0 || outflowChannels.length > 0;
  const ctxValue = useMemo(() => ({ account, accounts, prices }), [account, accounts, prices]);
  // the balance hero is tinted by net flow, matching the lake's water color
  const flowColor = netFlowUsd >= 0 ? C.teal : C.coral;

  // staggered "rise" delays for the dived view (header -> inflow -> outflow -> footer)
  const inDividerDelay = 120;
  const inBlockBase = 180;
  const outDividerDelay = inBlockBase + inflowChannels.length * 80 + 40;
  const outBlockBase = outDividerDelay + 60;
  const footerDelay = outBlockBase + outflowChannels.length * 80;

  return (
    <PoolContext.Provider value={ctxValue}>
      <div className="swf-view-enter" style={{
        position: 'relative', minHeight: '100vh', color: C.text,
        fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
        WebkitFontSmoothing: 'antialiased',
      }}>
        {/* fixed underwater gradient */}
        <div aria-hidden="true" style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: 'linear-gradient(180deg, #0A3A4A 0%, #062B38 22%, #04212C 50%, #02151D 80%, #010A10 100%)',
        }} />

        {/* phone column */}
        <div style={{ position: 'relative', maxWidth: 400, margin: '0 auto', minHeight: '100vh', overflowX: 'hidden' }}>
          <div style={{ position: 'relative', minHeight: '100vh', padding: '18px 16px calc(40px + env(safe-area-inset-bottom))' }}>
            {/* top bar — only in the dived working view. The address shrinks
                into a chip here: identity is context, the balance is the hero. */}
            {dived && (
              <div className="swf-rise" style={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 20 }}>
                {/* surfaces to the lake; leaving the wallet is the address chip's job */}
                <button onClick={doSurface} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 999, padding: '8px 13px', color: C.textMute, cursor: 'pointer', fontFamily: '"JetBrains Mono",monospace', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', flexShrink: 0 }}>← surface</button>
                <button onClick={() => setMoorOpen(true)} title="wallet options" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0,
                  background: 'transparent',
                  border: `1px solid ${isMine ? 'rgba(125,211,218,0.4)' : C.border}`, borderRadius: 999,
                  padding: '7px 11px', cursor: 'pointer',
                }}>
                  <span className="swf-seal-breath" style={{
                    fontFamily: '"Hiragino Sans","Yu Gothic","Noto Sans CJK JP",sans-serif', fontSize: 12, lineHeight: 1,
                    color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    backgroundImage: 'linear-gradient(150deg,#7DD3DA 0%,#A8DFE5 40%,#FF8B6E 100%)',
                  }}>水</span>
                  <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 10, color: C.textMute, whiteSpace: 'nowrap' }}>{truncatedAddr}</span>
                  {/* the pearl — these are your waters */}
                  {isMine && (
                    <span className="swf-seal-breath" style={{ fontSize: 8, lineHeight: 1, color: C.teal, textShadow: `0 0 8px ${C.teal}` }}>◉</span>
                  )}
                </button>
                <LiveBadge style={{ flexShrink: 0 }} />
              </div>
            )}

            {/* wallet hero — entry (lake) view only; in the dived view the
                address lives in the top-bar chip instead */}
            {!dived && (
              <div onClick={goBack} style={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 18, cursor: 'pointer' }}>
                <div className="swf-seal-breath" style={{
                  fontFamily: '"JetBrains Mono",monospace', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 7,
                  color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundImage: 'linear-gradient(150deg,#7DD3DA 0%,#A8DFE5 40%,#FF8B6E 100%)',
                }}>reef chain</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span className="swf-seal-breath" style={{
                    fontFamily: '"Hiragino Sans","Yu Gothic","Noto Sans CJK JP",sans-serif', fontSize: 32, lineHeight: 1,
                    color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    backgroundImage: 'linear-gradient(150deg,#7DD3DA 0%,#A8DFE5 40%,#FF8B6E 100%)',
                    borderRight: `1px solid ${C.border}`, paddingRight: 14,
                  }}>水</span>
                  <h1 style={{
                    fontFamily: '"JetBrains Mono",monospace', fontSize: 25, fontWeight: 400, margin: 0, letterSpacing: '0.01em',
                    color: C.text, lineHeight: 1,
                  }}>{truncatedAddr}</h1>
                </div>
                <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.textDim, marginTop: 8 }}>tap to change wallet</div>
              </div>
            )}

            {!dived ? (
              /* ENTRY: the lake, balance inside, centered — rises to the surface
                 on mount and when coming back up from the dived view */
              <div key="view-entry" className={(diving && diveDir === 'down') ? 'swf-dive-sink' : 'swf-view-rise'} style={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '66vh' }}>
                <WalletPool key="lake-big" netFlow={netFlowUsd} balance={balanceReef} balanceUsd={balanceUsd} lockedReef={lockedReef} loading={loading} pulse={livePulse.nonce} big showHint onDive={doDive} />
              </div>
            ) : (
              /* DIVED: sinks away below while surfacing back up */
              <div key="view-dived" className={(diving && diveDir === 'up') ? 'swf-dive-sink' : ''}>
                {/* balance hero (tap to surface) — the single dominant element:
                    number tinted by net flow, staked in staking gold */}
                <div onClick={doSurface} className="swf-rise" style={{
                  animationDelay: '40ms',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
                  marginBottom: 18, padding: '6px 0',
                }}>
                  <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 8, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.textMute, marginBottom: 5 }}>balance</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{
                      fontFamily: '"Bricolage Grotesque",sans-serif', fontSize: 34, fontWeight: 600, lineHeight: 1,
                      color: flowColor, textShadow: `0 0 24px ${flowColor}66`,
                    }}>{fmtAmount(balanceReef)}</span>
                    <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: C.textDim }}>REEF</span>
                  </div>
                  <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: C.tealLight, marginTop: 4 }}>{fmtUsd(balanceUsd)}</div>
                  {lockedReef > 0 && (
                    <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 10, color: C.staking, opacity: 0.85, marginTop: 4 }}>◈ {fmtAmount(lockedReef)} staked</div>
                  )}
                </div>

                {error ? (
                  <div className="swf-label-fade" style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontSize: 17, color: C.coralLight }}>the current is murky</div>
                    <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: C.textDim, marginTop: 6 }}>could not load this wallet — try again</div>
                  </div>
                ) : loading ? (
                  <div className="swf-label-fade" style={{ textAlign: 'center', padding: '40px 20px', fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: C.textMute, letterSpacing: '0.1em' }}>
                    reading the waters…
                  </div>
                ) : !hasFlows ? (
                  <div className="swf-label-fade" style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontSize: 17, color: C.textMute }}>the waters are still</div>
                    <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: C.textDim, marginTop: 6 }}>no flows on this wallet yet</div>
                  </div>
                ) : (
                  <>
                    {/* INFLOW — divider + blocks rise in one after another */}
                    {inflowChannels.length > 0 && (
                      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                        <div className="swf-rise" style={{ animationDelay: `${inDividerDelay}ms` }}>
                          <FlowDivider label="inflow" color={C.teal} />
                        </div>
                        {inflowChannels.map((ch, i) => (
                          <div key={ch.id} className="swf-rise" style={{ animationDelay: `${inBlockBase + i * 80}ms` }}>
                            <ChannelBlock ch={ch} expanded={expanded === ch.id} onToggle={() => toggle(ch.id)} onTapTx={tapTx}
                              selectedHash={detail?.hash ?? null}
                              share={totalIn > 0 ? ch.usdTotal / totalIn : 0}
                              pulse={livePulse.channel === ch.id ? livePulse.nonce : 0} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* OUTFLOW */}
                    {outflowChannels.length > 0 && (
                      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                        <div className="swf-rise" style={{ animationDelay: `${outDividerDelay}ms` }}>
                          <FlowDivider label="outflow" color={C.coral} />
                        </div>
                        {outflowChannels.map((ch, i) => (
                          <div key={ch.id} className="swf-rise" style={{ animationDelay: `${outBlockBase + i * 80}ms` }}>
                            <ChannelBlock ch={ch} expanded={expanded === ch.id} onToggle={() => toggle(ch.id)} onTapTx={tapTx}
                              selectedHash={detail?.hash ?? null}
                              share={totalOut > 0 ? ch.usdTotal / totalOut : 0}
                              pulse={livePulse.channel === ch.id ? livePulse.nonce : 0} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* summary footer (USD) */}
                    <div className="swf-rise" style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 10, marginTop: 24, animationDelay: `${footerDelay}ms` }}>
                      <div style={{ flex: 1, background: 'rgba(2,21,30,0.4)', border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px', textAlign: 'center' }}>
                        <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.textDim, marginBottom: 6 }}>total in</div>
                        <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontSize: 18, fontWeight: 600, color: C.teal }}>+{fmtUsd(totalIn)}</div>
                      </div>
                      <div style={{ flex: 1, background: 'rgba(2,21,30,0.4)', border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px', textAlign: 'center' }}>
                        <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.textDim, marginBottom: 6 }}>total out</div>
                        <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontSize: 18, fontWeight: 600, color: C.coral }}>−{fmtUsd(totalOut)}</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <MooringSheet
              open={moorOpen}
              onClose={() => setMoorOpen(false)}
              accounts={mooring.accounts}
              mooredAddress={mooring.mooredAddress}
              onPick={(a) => { mooring.pick(a); openWallet(a); }}
              showWalletConnect={mooring.isMobile && !mooring.mooredAddress}
              onWalletConnect={() => {
                void mooring.moorWalletConnect().then((a) => { if (a) openWallet(a); });
              }}
              isConnecting={mooring.isConnecting}
              error={mooring.error}
              actions={moorActions}
            />

            {diving && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 50, pointerEvents: 'none', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', top: '42%', left: '50%', width: '44px', height: '44px',
                  border: `3px solid ${C.tealLight}`, borderRadius: '50%', filter: 'blur(1.5px)',
                  animation: 'swfDiveRippleExpand 0.8s cubic-bezier(.2,.6,.3,1) both', boxShadow: `0 0 26px ${C.teal}`,
                }} />
                <div style={{
                  position: 'absolute', top: '42%', left: '50%', width: '44px', height: '44px',
                  border: `2px solid ${C.teal}`, borderRadius: '50%', filter: 'blur(2px)',
                  animation: 'swfDiveRippleExpand 0.9s cubic-bezier(.2,.6,.3,1) 0.1s both',
                }} />
                <div style={{
                  position: 'absolute', top: '42%', left: '50%', width: '44px', height: '44px',
                  border: `1.5px solid ${C.tealLight}`, borderRadius: '50%', filter: 'blur(2.5px)', opacity: 0.7,
                  animation: 'swfDiveRippleExpand 1.0s cubic-bezier(.2,.6,.3,1) 0.18s both',
                }} />
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'radial-gradient(circle at 50% 42%, rgba(20,80,95,0.85), rgba(2,21,30,0.96) 70%)',
                  animation: 'swfDiveFlood 0.9s ease-in-out both',
                }} />
                {/* air bubbles rushing past while sinking/surfacing */}
                {Array.from({ length: 9 }, (_, i) => {
                  const size = 5 + (i % 3) * 4;
                  return (
                    <div key={i} style={{
                      position: 'absolute', bottom: -24, left: `${8 + i * 10}%`,
                      width: size, height: size, borderRadius: '50%',
                      border: '1px solid rgba(168,223,229,0.5)',
                      background: 'radial-gradient(circle at 35% 30%, rgba(200,240,245,0.45), rgba(125,211,218,0.08))',
                      animation: `swfBubbleUp ${0.5 + (i % 4) * 0.09}s ease-in ${(i % 5) * 40}ms both`,
                    }} />
                  );
                })}
              </div>
            )}

          </div>
        </div>
      </div>
    </PoolContext.Provider>
  );
}
