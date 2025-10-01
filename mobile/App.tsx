import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus, Button, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

const STORAGE_KEY = 'walktrack:pending-entries';
const SAMPLE_INTERVAL_MS = 5000;
const SYNC_INTERVAL_MS = 15000;
const USER_ID = 'default';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000';

type PendingEntry = {
  userId: string;
  steps: number;
  takenAt: string;
};

type PermissionState = 'undetermined' | 'granted' | 'denied';

type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

export default function App() {
  const [permissionStatus, setPermissionStatus] = useState<PermissionState>('undetermined');
  const [todaySteps, setTodaySteps] = useState<number>(0);
  const [pendingEntries, setPendingEntries] = useState<PendingEntry[]>([]);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const lastSampleRef = useRef<Date>(new Date());
  const pendingRef = useRef<PendingEntry[]>([]);

  useEffect(() => {
    pendingRef.current = pendingEntries;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pendingEntries)).catch((error) => {
      console.warn('Failed to persist pending entries', error);
    });
  }, [pendingEntries]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value) {
          const parsed: PendingEntry[] = JSON.parse(value);
          pendingRef.current = parsed;
          setPendingEntries(parsed);
        }
      })
      .catch((error) => {
        console.warn('Failed to load cached entries', error);
      });
  }, []);

  useEffect(() => {
    Pedometer.requestPermissionsAsync()
      .then(({ status }) => {
        setPermissionStatus(status as PermissionState);
      })
      .catch((error) => {
        console.warn('Failed to request pedometer permission', error);
        setPermissionStatus('denied');
      });
  }, []);

  const updateTodaySteps = useCallback(async () => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    try {
      const { steps } = await Pedometer.getStepCountAsync(startOfDay, now);
      setTodaySteps(steps);
    } catch (error) {
      console.warn('Unable to read daily steps', error);
    }
  }, []);

  const flushQueue = useCallback(async () => {
    if (pendingRef.current.length === 0) {
      setSyncState('idle');
      return;
    }

    const network = await Network.getNetworkStateAsync();
    if (!network.isConnected) {
      setSyncState('offline');
      return;
    }

    setSyncState('syncing');

    const succeeded: number[] = [];

    for (let index = 0; index < pendingRef.current.length; index += 1) {
      const entry = pendingRef.current[index];
      try {
        const response = await fetch(`${API_BASE_URL}/api/steps`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(entry),
        });

        if (!response.ok) {
          const body = await response.text();
          console.warn('Failed to sync entry', response.status, body);
          setSyncState('error');
          return;
        }
        succeeded.push(index);
      } catch (error) {
        console.warn('Network error while syncing', error);
        setSyncState('error');
        return;
      }
    }

    if (succeeded.length > 0) {
      setPendingEntries((prev) => prev.filter((_, idx) => !succeeded.includes(idx)));
      setLastSync(new Date().toISOString());
      setSyncState('idle');
    }
  }, []);

  useEffect(() => {
    if (permissionStatus !== 'granted') {
      return;
    }

    let isMounted = true;
    lastSampleRef.current = new Date();
    updateTodaySteps();

    const sampleInterval = setInterval(async () => {
      if (!isMounted) {
        return;
      }
      const now = new Date();
      const windowStart = lastSampleRef.current ?? new Date(now.getTime() - SAMPLE_INTERVAL_MS);
      try {
        const { steps } = await Pedometer.getStepCountAsync(windowStart, now);
        lastSampleRef.current = now;
        if (steps > 0) {
          const entry: PendingEntry = {
            userId: USER_ID,
            steps,
            takenAt: now.toISOString(),
          };
          setPendingEntries((prev) => [...prev, entry]);
          setTodaySteps((prev) => prev + steps);
        }
      } catch (error) {
        console.warn('Failed to sample step count', error);
      }
    }, SAMPLE_INTERVAL_MS);

    const dailyInterval = setInterval(() => updateTodaySteps(), 60000);

    return () => {
      isMounted = false;
      clearInterval(sampleInterval);
      clearInterval(dailyInterval);
    };
  }, [permissionStatus, updateTodaySteps]);

  useEffect(() => {
    const interval = setInterval(() => {
      flushQueue();
    }, SYNC_INTERVAL_MS);

    const appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        flushQueue();
      }
    });

    flushQueue();

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [flushQueue]);

  const permissionMessage = useMemo(() => {
    if (permissionStatus === 'granted') {
      return 'Pedometer permission granted';
    }
    if (permissionStatus === 'denied') {
      return 'Permission denied - enable motion tracking in settings';
    }
    return 'Requesting pedometer permission...';
  }, [permissionStatus]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>WalkTrack</Text>
        <Text style={styles.subtitle}>Simple step tracker with cloud sync</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Permission status</Text>
          <Text style={styles.cardValue}>{permissionMessage}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Today&apos;s steps</Text>
          <Text style={styles.stepsValue}>{todaySteps}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Sync status</Text>
          <Text style={styles.cardValue}>{syncState.toUpperCase()}</Text>
          {lastSync && <Text style={styles.cardSecondary}>Last sync: {new Date(lastSync).toLocaleTimeString()}</Text>}
          <Text style={styles.cardSecondary}>Pending entries: {pendingEntries.length}</Text>
          <Button title="Sync now" onPress={() => flushQueue()} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Pending payloads</Text>
          {pendingEntries.length === 0 ? (
            <Text style={styles.cardSecondary}>No pending entries available</Text>
          ) : (
            pendingEntries.slice(-5).reverse().map((entry, index) => (
              <View key={`${entry.takenAt}-${index}`} style={styles.pendingRow}>
                <Text style={styles.pendingSteps}>{entry.steps} steps</Text>
                <Text style={styles.pendingTime}>{new Date(entry.takenAt).toLocaleTimeString()}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  container: {
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    color: '#555',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 16,
    color: '#111',
    marginBottom: 6,
  },
  cardSecondary: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  stepsValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#2f6fed',
  },
  pendingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomColor: '#eee',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pendingSteps: {
    fontSize: 14,
    fontWeight: '600',
  },
  pendingTime: {
    fontSize: 12,
    color: '#777',
  },
});
