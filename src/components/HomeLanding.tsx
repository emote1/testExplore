import React from 'react';
import { Search, Wallet, Activity, LineChart, TrendingUp, Clock } from 'lucide-react';
import { TpsSparkline } from './TpsSparkline';
import { useWsStatus } from '../hooks/use-ws-status';
import { useTpsLive } from '../hooks/use-tps-live';

interface HomeLandingProps {
  onSearch: (value: string) => void;
}

// legacy sparkline helpers removed (now handled by TpsSparkline)

export function HomeLanding({ onSearch }: HomeLandingProps) {
  const [value, setValue] = React.useState('');
  const { perMin, tpsTrend } = useTpsLive(60);
  const perMinText = Number.isFinite(perMin) && perMin >= 0 ? perMin.toFixed(0) : '0';
  const ws = useWsStatus();
  const wsDot = ws.tone === 'live' ? 'bg-green-500' : ws.tone === 'warning' ? 'bg-yellow-500' : ws.tone === 'error' ? 'bg-red-500' : 'bg-gray-400';
  // sparkline moved to TpsSparkline: all helpers/animation removed

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    onSearch(v);
  }

  return (
    <div className="w-full">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50 via-blue-50 to-white" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-12 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">Explore. Analyze. Trade.</h1>
          <p className="mt-3 text-gray-600">A decentralized data engine powered by freedom and intelligence.</p>
          <p className="text-indigo-600 font-medium">SOVRA — where data becomes sovereignty.</p>

          <form onSubmit={handleSubmit} className="mt-8 mx-auto max-w-3xl">
            <div className="flex items-stretch gap-3 bg-white rounded-full shadow-xl border border-gray-200 p-1.5">
              <div className="flex-1 flex items-center gap-2 px-3">
                <Search className="h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Enter wallet address or transaction hash..."
                  className="w-full bg-transparent outline-none text-gray-900 placeholder:text-gray-400"
                />
              </div>
              <button type="submit" className="px-5 py-2.5 rounded-full text-white font-semibold bg-gradient-to-r from-indigo-500 to-blue-600 shadow-md hover:from-indigo-600 hover:to-blue-700">
                Search
              </button>
            </div>
            <div className="text-xs text-gray-400 mt-2">Example: 5Eo9q... • 0x1a2b3c4d5e6f...</div>
          </form>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Network Statistics</h2>
          <div className="inline-flex items-center gap-2 text-sm text-gray-600">
            <span className={`w-2 h-2 rounded-full ${wsDot} ${ws.tone === 'live' ? 'animate-pulse' : ''}`} />
            <span>Live</span>
            {ws.tone !== 'live' ? <span className="text-gray-500">• {ws.text}</span> : null}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Volume" value="$2.4B" delta="+12.5%" icon={<LineChart className="h-4 w-4 text-emerald-600" />} color="emerald" />
          <StatCard title="Active Wallets" value="1.2M" delta="+8.3%" icon={<Wallet className="h-4 w-4 text-blue-600" />} color="blue" />
          <StatCard
            title="Transactions/min"
            value={`${perMinText} tx/min`}
            valueNode={
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-semibold text-gray-900">{perMinText}</span>
                <span className="text-sm text-gray-600">tx/</span>
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">min</span>
              </div>
            }
            sparkNode={<TpsSparkline series={tpsTrend} trendWin={60} trendRes={8} trendZoom={2} height={20} width={40} xpad={4} emaAlpha={0.18} fixedXFrac={0.8} yPadPx={4} pathAnimMs={800} />}
            delta="Live"
            icon={<Activity className="h-4 w-4 text-violet-600" />}
            color="violet"
          />
          <StatCard title="Network Growth" value="94.2%" delta="+2.1%" icon={<TrendingUp className="h-4 w-4 text-orange-600" />} color="orange" />
        </div>
      </section>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  sub?: string;
  valueNode?: React.ReactNode;
  sparkNode?: React.ReactNode;
  sparkClassName?: string;
  delta: string;
  icon: React.ReactNode;
  color: 'emerald' | 'blue' | 'violet' | 'orange';
}

function StatCard({ title, value, sub, valueNode, sparkNode, sparkClassName, delta, icon, color }: StatCardProps) {
  const paths: Record<StatCardProps['color'], string> = {
    emerald: 'M2 10 C6 7,10 12,14 9, 18 8,22 11,26 10, 30 12,34 11,38 12',
    blue: 'M2 12 C6 11,10 13,14 12, 18 10,22 12,26 11, 30 12,34 12,38 12',
    violet: 'M2 11 C6 9,10 12,14 10, 18 12,22 10,26 13, 30 12,34 13,38 12',
    orange: 'M2 12 C6 13,10 12,14 13, 18 12,22 13,26 12, 30 11,34 12,38 11',
  };
  const stroke = {
    emerald: '#10b981',
    blue: '#2563eb',
    violet: '#7c3aed',
    orange: '#f59e0b',
  }[color];
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow transition-shadow">
      <div className="flex items-center justify-between text-gray-600 text-sm">
        <span className="inline-flex items-center gap-2">{title}</span>
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-50 border border-gray-200">
          {icon}
        </span>
      </div>
      <div className={`mt-2 ${sparkClassName ?? 'h-20'}`}>
        {sparkNode ? (
          sparkNode
        ) : (
          <svg viewBox="0 0 40 20" className="w-full h-full" preserveAspectRatio="none">
            <path d={paths[color]} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between">
        <div>
          {valueNode ? (
            <div>{valueNode}</div>
          ) : (
            <div className="text-2xl font-semibold text-gray-900">{value}</div>
          )}
          {sub ? <div className="text-xs text-gray-500">{sub}</div> : null}
        </div>
        <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">{delta}</div>
      </div>
    </div>
  );
}

 
