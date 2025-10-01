import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fetchStepReadings, StepReadingDTO } from './api';
import { StepChart, ChartPoint } from './components/StepChart';

type RangeKey = '1h' | '6h' | '1d' | '7d';

type RangeConfig = {
  label: string;
  durationMs: number;
  bucketMs: number;
};

const RANGE_CONFIG: Record<RangeKey, RangeConfig> = {
  '1h': {
    label: 'Last hour',
    durationMs: 60 * 60 * 1000,
    bucketMs: 5 * 60 * 1000,
  },
  '6h': {
    label: 'Last 6 hours',
    durationMs: 6 * 60 * 60 * 1000,
    bucketMs: 15 * 60 * 1000,
  },
  '1d': {
    label: 'Last day',
    durationMs: 24 * 60 * 60 * 1000,
    bucketMs: 60 * 60 * 1000,
  },
  '7d': {
    label: 'Last 7 days',
    durationMs: 7 * 24 * 60 * 60 * 1000,
    bucketMs: 24 * 60 * 60 * 1000,
  },
};

const USER_ID = 'default';

function bucketTimestamp(date: Date, bucketMs: number) {
  return Math.floor(date.getTime() / bucketMs) * bucketMs;
}

function aggregateReadings(readings: StepReadingDTO[], range: RangeConfig): ChartPoint[] {
  const buckets = new Map<number, number>();
  for (const reading of readings) {
    const takenAt = new Date(reading.takenAt);
    const bucket = bucketTimestamp(takenAt, range.bucketMs);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + reading.steps);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([timestamp, total]) => ({ x: new Date(timestamp), y: total }));
}

export default function App() {
  const [rangeKey, setRangeKey] = useState<RangeKey>('1d');
  const [readings, setReadings] = useState<StepReadingDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const range = RANGE_CONFIG[rangeKey];

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const to = new Date();
    const from = new Date(Date.now() - range.durationMs);
    try {
      const result = await fetchStepReadings({ userId: USER_ID, from, to });
      setReadings(result);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load data');
    } finally {
      setLoading(false);
    }
  }, [range.durationMs]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartPoints = useMemo(() => aggregateReadings(readings, range), [readings, range]);

  const totalSteps = useMemo(() => readings.reduce((sum, item) => sum + item.steps, 0), [readings]);
  const avgPerBucket = useMemo(() => {
    if (chartPoints.length === 0) {
      return 0;
    }
    return Math.round(totalSteps / chartPoints.length);
  }, [chartPoints.length, totalSteps]);

  return (
    <main>
      <header>
        <div>
          <h1>WalkTrack Dashboard</h1>
          <p>Visualise step readings uploaded from the mobile app</p>
        </div>
        <button onClick={() => fetchData()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <section className="card">
        <h2>Overview</h2>
        <div className="controls">
          <label>
            Range
            <select value={rangeKey} onChange={(event) => setRangeKey(event.target.value as RangeKey)}>
              {Object.entries(RANGE_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="status-row">
          <span className="badge">User: {USER_ID}</span>
          <span>Total steps: {totalSteps}</span>
          <span>Average per bucket: {avgPerBucket}</span>
          {lastUpdated && <span>Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}</span>}
        </div>
      </section>

      <section className="card">
        <h2>{RANGE_CONFIG[rangeKey].label}</h2>
        {error && <p style={{ color: '#dc2626' }}>{error}</p>}
        {!error && (
          <>
            {loading && <p>Loading data…</p>}
            {!loading && chartPoints.length === 0 && <p>No step readings for this period.</p>}
            {!loading && chartPoints.length > 0 && <StepChart points={chartPoints} suggestedMax={Math.max(...chartPoints.map((point) => point.y)) + 10} />}
          </>
        )}
      </section>
    </main>
  );
}
