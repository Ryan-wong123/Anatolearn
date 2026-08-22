import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import VideoPlayer from './VideoPlayer';
import { api } from '../api/api';

vi.mock('../api/api', () => ({ api: { getVideo: vi.fn() } }));

function renderPlayer() {
  render(<MemoryRouter initialEntries={['/videos/7']}><Routes><Route path="/videos/:videoId" element={<VideoPlayer />} /></Routes></MemoryRouter>);
}

describe('VideoPlayer', () => {
  it('shows loading then the retrieved video', async () => {
    vi.mocked(api.getVideo).mockResolvedValue({ id: 7, title: 'Heart cycle', description: null, video_path: '/videos/heart.mp4', thumbnail_path: null, created_at: '2026-01-01' });
    renderPlayer();
    expect(screen.getByText('Loading video...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Heart cycle' })).toBeInTheDocument();
    expect(screen.getByText('No description provided.')).toBeInTheDocument();
  });

  it('shows an understandable API error', async () => {
    vi.mocked(api.getVideo).mockRejectedValue(new Error('Video not found'));
    renderPlayer();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load video: Video not found');
  });
});
