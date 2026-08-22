import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { AppProvider } from '../context/AppContext';
import { TOKEN_STORAGE_KEY } from '../api/api';

function renderRoute() {
  return render(
    <AppProvider><MemoryRouter initialEntries={['/dashboard']}><Routes>
      <Route path="/login" element={<p>Login page</p>} />
      <Route element={<ProtectedRoute />}><Route path="/dashboard" element={<p>Private page</p>} /></Route>
    </Routes></MemoryRouter></AppProvider>,
  );
}

test('redirects a visitor without a token', () => {
  renderRoute();
  expect(screen.getByText('Login page')).toBeInTheDocument();
});

test('renders protected content with a stored token', () => {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, 'header.eyJyb2xlIjoic3R1ZGVudCIsInByb2dyYW1faWQiOjF9.signature');
  renderRoute();
  expect(screen.getByText('Private page')).toBeInTheDocument();
});
