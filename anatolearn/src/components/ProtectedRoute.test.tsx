import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from '../context/AppContext';
import ProtectedRoute from './ProtectedRoute';
import { TOKEN_STORAGE_KEY } from '../api/api';
import { expect, it } from 'vitest';

function renderRoute(initialPath = '/private') {
  return render(
    <AppProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<h1>Login page</h1>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/private" element={<h1>Private page</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppProvider>,
  );
}

it('redirects an unauthenticated visitor to login', () => {
  renderRoute();
  expect(screen.getByRole('heading', { name: 'Login page' })).toBeInTheDocument();
});

it('renders protected content when a token is stored', () => {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, 'deterministic-test-token');
  renderRoute();
  expect(screen.getByRole('heading', { name: 'Private page' })).toBeInTheDocument();
});
