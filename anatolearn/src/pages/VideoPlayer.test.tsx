import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import VideoPlayer from './VideoPlayer';
import { api } from '../api/api';

vi.mock('../api/api', () => ({ api: { getVideo: vi.fn() } }));

describe('VideoPlayer', () => {
  it('shows loading then the fetched video', async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(api.getVideo).mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<MemoryRouter initialEntries={['/videos/7']}><Routes><Route path="/videos/:videoId" element={<VideoPlayer />} /></Routes></MemoryRouter>);
    expect(screen.getByText('Loading video...')).toBeInTheDocument();
    resolve({ id: 7, title: 'Heart lecture', description: null, video_path: '/videos/heart.mp4', thumbnail_path: null, created_at: '' });
    expect(await screen.findByRole('heading', { name: 'Heart lecture' })).toBeInTheDocument();
    expect(screen.getByText('No description provided.')).toBeInTheDocument();
  });

  it('shows an understandable error when the API fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(api.getVideo).mockRejectedValue(new Error('offline'));
    render(<MemoryRouter initialEntries={['/videos/404']}><Routes><Route path="/videos/:videoId" element={<VideoPlayer />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load this video');
  });
});
