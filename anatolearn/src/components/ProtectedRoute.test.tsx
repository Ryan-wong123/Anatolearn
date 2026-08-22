import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from '../context/AppContext';
import { TOKEN_STORAGE_KEY } from '../api/api';
import ProtectedRoute from './ProtectedRoute';

function renderRoute(token?: string) {
  if (token) sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  return render(
    <AppProvider>
      <MemoryRouter initialEntries={['/private']}>
        <Routes>
          <Route path="/login" element={<p>Login page</p>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/private" element={<p>Protected content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppProvider>,
  );
}

describe('ProtectedRoute', () => {
  it('redirects a visitor without a token', () => {
    renderRoute();
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('renders protected content for an authenticated session', () => {
    renderRoute('fixture-token');
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});
