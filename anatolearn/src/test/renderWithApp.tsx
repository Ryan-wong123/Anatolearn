import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider } from '../context/AppContext';

export function renderWithApp(ui: ReactElement, initialEntries = ['/']) {
  return render(<MemoryRouter initialEntries={initialEntries}><AppProvider>{ui}</AppProvider></MemoryRouter>);
}
