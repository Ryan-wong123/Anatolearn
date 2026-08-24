import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Quizzes from './Quizzes';
import { api } from '../api/api';

vi.mock('../context/AppContext', () => ({ useAppContext: () => ({ role: 'student' }) }));
vi.mock('../api/api', () => ({ api: { getQuizzes: vi.fn(), getMyAttempts: vi.fn() } }));

describe('Quizzes list states', () => {
  beforeEach(() => {
    vi.mocked(api.getMyAttempts).mockResolvedValue([]);
  });

  it('renders loading followed by the empty state', async () => {
    let resolve!: (value: never[]) => void;
    vi.mocked(api.getQuizzes).mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<Quizzes />);
    expect(screen.getByText('Loading quizzes…')).toBeInTheDocument();
    resolve([]);
    expect(await screen.findByText('No quizzes found.')).toBeInTheDocument();
  });

  it('renders API errors for users', async () => {
    vi.mocked(api.getQuizzes).mockRejectedValue(new Error('offline'));
    render(<Quizzes />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load quizzes');
  });

  it('renders published quiz details without answer keys', async () => {
    vi.mocked(api.getQuizzes).mockResolvedValue([{ id: 1, title: 'Cardiac anatomy', description: 'Heart structures', type: 'MCQ', category: 'Cardiology', is_published: true, created_at: '2026-01-01' }]);
    render(<Quizzes />);
    expect(await screen.findByText('Cardiac anatomy')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Quiz' })).toBeInTheDocument();
  });
});
