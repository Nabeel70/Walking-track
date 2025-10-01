import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, TimeScale);

export type ChartPoint = {
  x: string | number | Date;
  y: number;
};

type Props = {
  points: ChartPoint[];
  suggestedMax?: number;
};

export function StepChart({ points, suggestedMax }: Props) {
  const chartData = useMemo(() => {
    return {
      datasets: [
        {
          label: 'Steps',
          data: points,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.35)',
          tension: 0.3,
          fill: true,
        },
      ],
    };
  }, [points]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    parsing: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => `Steps: ${context.parsed.y}`,
        },
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          tooltipFormat: 'MMM d, HH:mm',
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
        },
      },
      y: {
        beginAtZero: true,
        suggestedMax: suggestedMax ?? undefined,
      },
    },
  }), [suggestedMax]);

  return (
    <div style={{ height: 360 }}>
      <Line options={options} data={chartData} />
    </div>
  );
}
