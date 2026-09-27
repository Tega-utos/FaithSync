import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FaithSync — Spiritual Habit Tracking & Accountability',
    short_name: 'FaithSync',
    description: 'Sync your spiritual walk. Track prayer, scripture study, and grow with faithful buddies.',
    start_url: '/home',
    display: 'standalone',
    background_color: '#0E0E0E',
    theme_color: '#234537',
    orientation: 'portrait',
    icons: [
      {
        src: '/assets/logo.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/assets/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
