import { insert, list, StepReadingRow } from '../storage';

export interface StepReadingRecord {
  id: string;
  userId: string;
  steps: number;
  takenAt: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateStepReadingInput {
  userId: string;
  steps: number;
  takenAt: Date;
}

interface QueryOptions {
  userId: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

interface SummaryBucket {
  start: string;
  end: string;
  totalSteps: number;
  hour: number;
  day: number;
  month: number;
  year: number;
}

export function createStepReading(input: CreateStepReadingInput): StepReadingRecord {
  const record = insert({
    userId: input.userId,
    steps: input.steps,
    takenAt: input.takenAt.toISOString(),
  });

  return mapRow(record);
}

export function queryStepReadings(options: QueryOptions): StepReadingRecord[] {
  const rows = list()
    .filter((row) => row.userId === options.userId)
    .filter((row) => {
      const takenAt = new Date(row.takenAt).getTime();
      if (options.from && takenAt < options.from.getTime()) {
        return false;
      }
      if (options.to && takenAt > options.to.getTime()) {
        return false;
      }
      return true;
    })
    .sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime());

  const sliced = typeof options.limit === 'number' ? rows.slice(0, options.limit) : rows;
  return sliced.map(mapRow);
}

export function summariseStepReadings(options: QueryOptions): SummaryBucket[] {
  const relevant = queryStepReadings({ ...options, limit: undefined });
  const buckets = new Map<string, SummaryBucket>();

  relevant.forEach((record) => {
    const date = new Date(record.takenAt);
    const key = `${record.userId}:${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}-${date.getUTCHours()}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.totalSteps += record.steps;
      existing.end = record.takenAt;
    } else {
      buckets.set(key, {
        start: record.takenAt,
        end: record.takenAt,
        totalSteps: record.steps,
        hour: date.getUTCHours(),
        day: date.getUTCDate(),
        month: date.getUTCMonth() + 1,
        year: date.getUTCFullYear(),
      });
    }
  });

  return Array.from(buckets.values()).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

function mapRow(row: StepReadingRow): StepReadingRecord {
  return {
    id: row.id,
    userId: row.userId,
    steps: row.steps,
    takenAt: row.takenAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
