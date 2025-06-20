import { Metrics } from './metrics';

// Worker communication message types
export interface WorkerMessage {
  type: 'progress' | 'result' | 'error';
  data: Metrics | number | string;
} 