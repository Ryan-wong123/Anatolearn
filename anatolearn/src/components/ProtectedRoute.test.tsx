import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from '../context/AppContext';
import { describe, expect, it } from 'vitest';
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
            <Route path="/private" element={<p>Private page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppProvider>,
  );
}

describe('ProtectedRoute', () => {
  it('redirects a visitor without a token to login', () => {
    renderRoute();
    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Private page')).not.toBeInTheDocument();
  });

  it('renders protected content when a token exists', () => {
    renderRoute('deterministic-token');
    expect(screen.getByText('Private page')).toBeInTheDocument();
  });
});
