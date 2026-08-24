import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { api } from '../api/api';
import VideoPlayer from './VideoPlayer';

it('shows a useful API error', async () => {
  vi.spyOn(api, 'getVideo').mockRejectedValue(new Error('missing'));
  render(<MemoryRouter initialEntries={['/videos/404']}><Routes><Route path="/videos/:videoId" element={<VideoPlayer />} /></Routes></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load this video');
});

it('navigates from a video to its linked annotation', async () => {
  vi.spyOn(api, 'getVideo').mockResolvedValue({ id: 1, title: 'Heart', description: null, video_path: '/heart.mp4', thumbnail_path: null, created_at: '', annotation_id: 9, linked_model_id: 3 });
  render(<MemoryRouter initialEntries={['/videos/1']}><Routes><Route path="/videos/:videoId" element={<VideoPlayer />} /><Route path="/3dviewer/:modelId" element={<h1>Viewer destination</h1>} /></Routes></MemoryRouter>);
  await userEvent.click(await screen.findByRole('button', { name: 'View linked annotation' }));
  expect(screen.getByRole('heading', { name: 'Viewer destination' })).toBeInTheDocument();
});
