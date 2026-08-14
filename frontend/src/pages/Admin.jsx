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
  2: '#38bdf8',
  3: '#818cf8',
  4: '#c084fc',
  5: '#f472b6',
};

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .get('/admin/stats')
      .then(({ data }) => setStats(data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load stats'))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-indigo-200">Loading stats…</div>;
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-rose-300">{error}</p>
      </div>
    );
  }

  const { totalUsers, totalConfirmedCycles, waitingUsers, cycleSizeBreakdown, comparison } = stats;

  const sizeData = [2, 3, 4, 5].map((size) => ({
    name: `${size}-way`,
    count: cycleSizeBreakdown[size] ?? 0,
    color: SIZE_COLORS[size],
  }));

  const compareData = [
    { name: 'Cyclic engine', users: comparison.matchedByCyclicEngine, fill: '#818cf8' },
    { name: 'Direct swap only', users: comparison.matchedByDirectSwapOnly, fill: '#38bdf8' },
  ];

  const Card = ({ label, value, sub }) => (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <p className="text-indigo-300 text-xs uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold text-white mt-1">{value}</p>
      {sub && <p className="text-indigo-300/70 text-xs mt-1">{sub}</p>}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin analytics</h1>
        <p className="text-indigo-200 text-sm mt-1">
          How the cyclic matching engine is performing.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card label="Total users" value={totalUsers} />
        <Card label="Confirmed exchanges" value={totalConfirmedCycles} />
        <Card label="Waiting for a match" value={waitingUsers ?? '—'} sub="users with skills but no active cycle" />
        <Card
          label="Matched only via cycles"
          value={`${comparison.pctWouldNotMatchWithoutCycles}%`}
          sub={`${comparison.matchedOnlyViaCycles} of ${comparison.matchedByCyclicEngine} users would not match with direct 1-to-1 swaps only`}
        />
      </div>

      {/* Cycle-size breakdown */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
        <h2 className="text-white font-semibold">Confirmed exchanges by cycle size</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={sizeData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
            <XAxis dataKey="name" stroke="#a5b4fc" fontSize={12} tickLine={false} />
            <YAxis stroke="#a5b4fc" fontSize={12} tickLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: '#ffffff10' }}
              contentStyle={{ background: '#1e1b4b', border: '1px solid #ffffff20', borderRadius: 12 }}
              labelStyle={{ color: '#e0e7ff' }}
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
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
        <h2 className="text-white font-semibold">Users matched: cyclic vs direct-swap-only</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={compareData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
            <XAxis dataKey="name" stroke="#a5b4fc" fontSize={12} tickLine={false} />
            <YAxis stroke="#a5b4fc" fontSize={12} tickLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: '#ffffff10' }}
              contentStyle={{ background: '#1e1b4b', border: '1px solid #ffffff20', borderRadius: 12 }}
              labelStyle={{ color: '#e0e7ff' }}
            />
            <Bar dataKey="users" name="matched users" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-indigo-300/70 text-xs">
          The cyclic engine unlocks skill exchanges that would never happen through simple 1-to-1
          matching — currently {comparison.pctWouldNotMatchWithoutCycles}% of matched users.
        </p>
      </div>
    </div>
  );
}
