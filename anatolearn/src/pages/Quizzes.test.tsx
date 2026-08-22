import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider } from '../context/AppContext';
import Quizzes from './Quizzes';

const apiMocks = vi.hoisted(() => ({ getQuizzes: vi.fn(), getMyAttempts: vi.fn() }));
vi.mock('../api/api', () => ({ TOKEN_STORAGE_KEY: 'anatolearn_token', api: apiMocks }));

function renderPage() {
  return render(<AppProvider><Quizzes /></AppProvider>);
}

describe('Quizzes states', () => {
  beforeEach(() => {
    apiMocks.getMyAttempts.mockResolvedValue([]);
  });

  it('shows loading and then an empty state', async () => {
    apiMocks.getQuizzes.mockResolvedValue([]);
    renderPage();
    expect(screen.getByText('Loading quizzes...')).toBeInTheDocument();
    expect(await screen.findByText('No quizzes found.')).toBeInTheDocument();
  });

  it('shows a reliable API error state', async () => {
    apiMocks.getQuizzes.mockRejectedValue(new Error('offline'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load quizzes');
  });

  it('renders a completed attempt in history', async () => {
    apiMocks.getQuizzes.mockResolvedValue([]);
    apiMocks.getMyAttempts.mockResolvedValue([{ id: 7, quiz_id: 1, quiz_title: 'Anatomy fixture', score: 80, status: 'graded', attempted_at: '2026-01-01T00:00:00Z' }]);
    renderPage();
    expect(await screen.findByText('Anatomy fixture')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });
});
