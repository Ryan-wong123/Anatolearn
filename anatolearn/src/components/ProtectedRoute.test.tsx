import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../context/AppContext';
import { TOKEN_STORAGE_KEY } from '../api/api';
import ProtectedRoute from './ProtectedRoute';

function renderRoute(token?: string) {
  if (token) sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  return render(
    <MemoryRouter initialEntries={['/private']}>
      <AppProvider>
        <Routes>
          <Route path="/login" element={<p>Login page</p>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/private" element={<p>Private page</p>} />
          </Route>
        </Routes>
      </AppProvider>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('redirects a visitor without a token to login', () => {
    renderRoute();
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('renders protected content when a token exists', () => {
    renderRoute('deterministic-token');
    expect(screen.getByText('Private page')).toBeInTheDocument();
  });
});
