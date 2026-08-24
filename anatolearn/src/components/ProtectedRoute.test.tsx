import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ProtectedRoute from './ProtectedRoute';
import { renderWithApp } from '../test/renderWithApp';

function RoutesUnderTest() {
  return <Routes><Route path="/login" element={<p>Login page</p>} /><Route element={<ProtectedRoute />}><Route path="/private" element={<p>Private page</p>} /></Route></Routes>;
}

describe('ProtectedRoute', () => {
  it('redirects a user without a token', () => {
    renderWithApp(<RoutesUnderTest />, ['/private']);
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('renders protected content with a stored token', () => {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 }));
    sessionStorage.setItem('anatolearn_token', `header.${payload}.signature`);
    renderWithApp(<RoutesUnderTest />, ['/private']);
    expect(screen.getByText('Private page')).toBeInTheDocument();
  });

  it('redirects invalid and expired stored tokens', () => {
    sessionStorage.setItem('anatolearn_token', 'invalid');
    const { unmount } = renderWithApp(<RoutesUnderTest />, ['/private']);
    expect(screen.getByText('Login page')).toBeInTheDocument();
    unmount();
    const payload = btoa(JSON.stringify({ exp: 1 }));
    sessionStorage.setItem('anatolearn_token', `header.${payload}.signature`);
    renderWithApp(<RoutesUnderTest />, ['/private']);
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });
});
