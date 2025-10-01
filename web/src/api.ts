export interface StepReadingDTO {
  id: string;
  userId: string;
  steps: number;
  takenAt: string;
  createdAt: string;
}

type FetchParams = {
  userId: string;
  from?: Date;
  to?: Date;
  limit?: number;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export async function fetchStepReadings(params: FetchParams): Promise<StepReadingDTO[]> {
  const search = new URLSearchParams();
  search.set('userId', params.userId);
  if (params.from) {
    search.set('from', params.from.toISOString());
  }
  if (params.to) {
    search.set('to', params.to.toISOString());
  }
  if (params.limit) {
    search.set('limit', String(params.limit));
  }

  const response = await fetch(`${API_BASE_URL}/api/steps?${search.toString()}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to load steps (${response.status}): ${body}`);
  }

  const payload = await response.json();
  return payload.data as StepReadingDTO[];
}
