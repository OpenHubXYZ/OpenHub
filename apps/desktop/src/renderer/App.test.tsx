/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('desktop app shell', () => {
  it('shows the product name and Phase 1 empty state', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'TheOpenHub Skills Studio' })).toBeInTheDocument();
    expect(screen.getByText('No skills indexed yet')).toBeInTheDocument();
    expect(screen.getByText('SQLite source of truth')).toBeInTheDocument();
  });
});
