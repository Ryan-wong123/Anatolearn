import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import VideoPlayer from './VideoPlayer';
import { api } from '../api/api';

vi.mock('../api/api', () => ({ api: { getVideo: vi.fn() } }));

function renderPage() {
  render(<MemoryRouter initialEntries={['/videos/7']}><Routes><Route path="/videos/:videoId" element={<VideoPlayer />} /></Routes></MemoryRouter>);
}

test('shows loading and then the selected video', async () => {
  vi.mocked(api.getVideo).mockResolvedValue({ id: 7, title: 'Heart', description: null, video_path: '/videos/heart.mp4', thumbnail_path: null, created_at: '' });
  renderPage();
  expect(screen.getByText('Loading video...')).toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: 'Heart' })).toBeInTheDocument();
  expect(screen.getByText('No description provided.')).toBeInTheDocument();
});

test('shows an accessible API error state', async () => {
  vi.mocked(api.getVideo).mockRejectedValue(new Error('missing'));
  renderPage();
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load this video');
});
