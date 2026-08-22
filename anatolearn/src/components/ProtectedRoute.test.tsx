import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from '../context/AppContext';
import ProtectedRoute from './ProtectedRoute';
import { TOKEN_STORAGE_KEY } from '../api/api';

function renderRoute(initialPath = '/dashboard') {
  return render(
    <AppProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<p>Sign in page</p>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<p>Private dashboard</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppProvider>,
  );
}

describe('ProtectedRoute', () => {
  it('redirects visitors without a token to login', () => {
    renderRoute();
    expect(screen.getByText('Sign in page')).toBeInTheDocument();
  });

  it('renders protected content when a token is present', () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'deterministic-token');
    renderRoute();
    expect(screen.getByText('Private dashboard')).toBeInTheDocument();
  });
});
