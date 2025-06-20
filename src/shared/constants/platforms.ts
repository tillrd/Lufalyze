import { PlatformTarget } from '../types/platform';

// Platform loudness targets for different streaming and broadcast services
export const PLATFORM_TARGETS: PlatformTarget[] = [
  { name: 'Spotify', target: -14, range: [-14, -1], description: 'Music streaming' },
  { name: 'Apple Music', target: -16, range: [-16, -1], description: 'Music streaming' },
  { name: 'YouTube', target: -14, range: [-14, -1], description: 'Video platform' },
  { name: 'TikTok/Instagram', target: -14, range: [-14, -1], description: 'Social media' },
  { name: 'Broadcast TV', target: -23, range: [-23, -1], description: 'Television' },
  { name: 'Netflix', target: -27, range: [-27, -1], description: 'Streaming video' },
  { name: 'Amazon Music', target: -24, range: [-24, -1], description: 'Music streaming' },
]; 