import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ProtectedRoute from './ProtectedRoute';
import { useAppContext } from '../context/AppContext';

vi.mock('../context/AppContext', () => ({ useAppContext: vi.fn() }));
const mockedContext = vi.mocked(useAppContext);

function renderRoutes() {
  render(<MemoryRouter initialEntries={['/private']}><Routes>
    <Route path="/login" element={<p>Login page</p>} />
    <Route element={<ProtectedRoute />}><Route path="/private" element={<p>Private page</p>} /></Route>
  </Routes></MemoryRouter>);
}

describe('ProtectedRoute', () => {
  it('redirects visitors without a token', () => {
    mockedContext.mockReturnValue({ token: null } as ReturnType<typeof useAppContext>);
    renderRoutes();
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('renders protected content for an authenticated visitor', () => {
    mockedContext.mockReturnValue({ token: 'valid' } as ReturnType<typeof useAppContext>);
    renderRoutes();
    expect(screen.getByText('Private page')).toBeInTheDocument();
  });
});
