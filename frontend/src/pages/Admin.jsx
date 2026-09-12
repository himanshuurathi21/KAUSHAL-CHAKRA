import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import api from '../api/client';

const SIZE_COLORS = {
  2: '#1f5b85',
  3: '#7c2a23',
  4: '#d98716',
  5: '#2e7d4f',
};

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [gaps, setGaps] = useState([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/admin/stats'), api.get('/admin/skill-gaps').catch(() => ({ data: { gaps: [] } }))])
      .then(([{ data }, gapRes]) => {
        setStats(data);
        setGaps(gapRes.data.gaps || []);
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load stats'))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-muted">Loading stats…</div>;
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="kc-alert-error inline-block">{error}</p>
      </div>
    );
  }

  const { totalUsers, totalConfirmedCycles, waitingUsers, cycleSizeBreakdown, comparison } = stats || {};
  const safeComparison = comparison || {};
  const safeBreakdown = cycleSizeBreakdown || {};

  const sizeData = [2, 3, 4, 5].map((size) => ({
    name: `${size}-way`,
    count: safeBreakdown[size] ?? 0,
    color: SIZE_COLORS[size],
  }));

  const compareData = [
    { name: 'Cyclic engine', users: safeComparison.matchedByCyclicEngine ?? 0, fill: '#7c2a23' },
    { name: 'Direct swap only', users: safeComparison.matchedByDirectSwapOnly ?? 0, fill: '#d98716' },
  ];

  const Card = ({ label, value, sub }) => (
    <div className="kc-card p-5">
      <p className="text-muted text-xs uppercase tracking-wider">{label}</p>
      <p className="kc-display text-3xl font-bold text-ink mt-1">{value}</p>
      {sub && <p className="text-muted text-xs mt-1">{sub}</p>}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="kc-display text-3xl font-bold text-ink">Admin analytics</h1>
        <p className="text-muted text-sm mt-1">
          How the cyclic matching engine is performing.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card label="Total users" value={totalUsers} />
        <Card label="Confirmed exchanges" value={totalConfirmedCycles} />
        <Card label="Waiting for a match" value={waitingUsers ?? '—'} sub="users with skills but no active cycle" />
        <Card
          label="Matched only via cycles"
          value={`${safeComparison.pctWouldNotMatchWithoutCycles ?? '—'}%`}
          sub={`${safeComparison.matchedOnlyViaCycles ?? '—'} of ${safeComparison.matchedByCyclicEngine ?? '—'} users would not match with direct 1-to-1 swaps only`}
        />
      </div>

      {/* Cycle-size breakdown */}
      <div className="kc-card p-5 space-y-4">
        <h2 className="kc-display text-lg text-ink font-bold">Confirmed exchanges by cycle size</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={sizeData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2b211815" />
            <XAxis dataKey="name" stroke="#77664e" fontSize={12} tickLine={false} />
            <YAxis stroke="#77664e" fontSize={12} tickLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: '#2b211808' }}
              contentStyle={{ background: '#fffdf7', border: '1px solid #e0d0b2', borderRadius: 12 }}
              labelStyle={{ color: '#2b2118' }}
            />
            <Bar dataKey="count" name="exchanges" radius={[6, 6, 0, 0]}>
              {sizeData.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cyclic vs direct-swap-only comparison */}
      <div className="kc-card p-5 space-y-4">
        <h2 className="kc-display text-lg text-ink font-bold">Users matched: cyclic vs direct-swap-only</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={compareData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2b211815" />
            <XAxis dataKey="name" stroke="#77664e" fontSize={12} tickLine={false} />
            <YAxis stroke="#77664e" fontSize={12} tickLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: '#2b211808' }}
              contentStyle={{ background: '#fffdf7', border: '1px solid #e0d0b2', borderRadius: 12 }}
              labelStyle={{ color: '#2b2118' }}
            />
            <Bar dataKey="users" name="matched users" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-muted text-xs">
          The cyclic engine unlocks skill exchanges that would never happen through simple 1-to-1
          matching — currently {safeComparison.pctWouldNotMatchWithoutCycles ?? '—'}% of matched users.
        </p>
      </div>

      {/* Skills in high demand, low supply */}
      <div className="kc-card p-5 space-y-4">
        <h2 className="kc-display text-lg text-ink font-bold">Skills in high demand, low supply</h2>
        {gaps.length === 0 ? (
          <p className="text-muted text-sm">No skill gap data.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-xs uppercase tracking-wider border-b border-line">
                  <th className="text-left py-2">Skill</th>
                  <th className="text-right py-2">Want</th>
                  <th className="text-right py-2">Offer</th>
                  <th className="text-right py-2">Gap</th>
                </tr>
              </thead>
              <tbody>
                {gaps.slice(0, 10).map((g) => (
                  <tr key={g.skillId} className="border-b border-line/60">
                    <td className="py-2 font-medium text-ink">{g.skillName}</td>
                    <td className="py-2 text-right text-muted">{g.demand}</td>
                    <td className="py-2 text-right text-muted">{g.supply}</td>
                    <td className={`py-2 text-right font-bold ${g.gap > 0 ? 'text-clay' : 'text-leaf'}`}>{g.gap > 0 ? `+${g.gap}` : g.gap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-muted text-xs mt-2">e.g. "{gaps[0]?.demand} want {gaps[0]?.skillName}, only {gaps[0]?.supply} offer it" — top gap.</p>
          </div>
        )}
      </div>
    </div>
  );
}
