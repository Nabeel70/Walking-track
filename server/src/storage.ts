import fs from 'fs';
import path from 'path';

type StepReadingRow = {
  id: string;
  userId: string;
  steps: number;
  takenAt: string;
  createdAt: string;
  updatedAt: string;
};

type State = {
  records: StepReadingRow[];
  nextId: number;
  loaded: boolean;
  filePath: string;
};

const defaultPath = path.resolve(__dirname, '../data/step-readings.json');
const configuredPath = process.env.DATA_FILE ? path.resolve(process.cwd(), process.env.DATA_FILE) : defaultPath;
const dataDir = path.dirname(configuredPath);

const state: State = {
  records: [],
  nextId: 1,
  loaded: false,
  filePath: configuredPath,
};

function ensureLoaded() {
  if (state.loaded) {
    return;
  }

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(state.filePath)) {
    try {
      const raw = fs.readFileSync(state.filePath, 'utf8');
      const parsed = JSON.parse(raw) as StepReadingRow[];
      state.records = parsed.map((item) => ({
        ...item,
        id: String(item.id),
        userId: item.userId,
        steps: Number(item.steps),
        takenAt: item.takenAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));
      const maxId = state.records.reduce((max, item) => {
        const numericId = Number(item.id);
        return Number.isNaN(numericId) ? max : Math.max(max, numericId);
      }, 0);
      state.nextId = maxId + 1;
    } catch (error) {
      console.warn('Failed to read step data store, starting fresh', error);
      state.records = [];
      state.nextId = 1;
    }
  }

  state.loaded = true;
}

function persist() {
  const payload = JSON.stringify(state.records, null, 2);
  fs.writeFileSync(state.filePath, payload, 'utf8');
}

export function insert(record: Omit<StepReadingRow, 'id' | 'createdAt' | 'updatedAt'>): StepReadingRow {
  ensureLoaded();
  const now = new Date().toISOString();
  const newRecord: StepReadingRow = {
    id: String(state.nextId++),
    userId: record.userId,
    steps: record.steps,
    takenAt: record.takenAt,
    createdAt: now,
    updatedAt: now,
  };
  state.records.push(newRecord);
  persist();
  return newRecord;
}

export function list(): StepReadingRow[] {
  ensureLoaded();
  return [...state.records];
}

export function replaceAll(records: StepReadingRow[]) {
  state.records = records;
  state.nextId = records.reduce((max, item) => {
    const numericId = Number(item.id);
    return Number.isNaN(numericId) ? max : Math.max(max, numericId);
  }, 0) + 1;
  persist();
}

export type { StepReadingRow };
