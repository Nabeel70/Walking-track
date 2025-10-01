import { setTimeout as delay } from 'node:timers/promises';

const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:4000';

async function main() {
  console.log(`Using API base URL: ${baseUrl}`);

  const health = await fetchJson('/health');
  console.log('Health check:', health);

  const payload = {
    userId: 'default',
    steps: Math.floor(Math.random() * 200 + 50),
    takenAt: new Date().toISOString(),
  };

  await postJson('/api/steps', payload);
  console.log('Posted sample reading:', payload);

  await delay(250);

  const readings = await fetchJson('/api/steps?userId=default&limit=5');
  console.log('Recent readings:', readings);
}

async function fetchJson(path, init) {
  const response = await fetch(baseUrl + path, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function postJson(path, body) {
  return fetchJson(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

main().catch((error) => {
  console.error('Smoke test failed');
  console.error(error);
  process.exitCode = 1;
});
