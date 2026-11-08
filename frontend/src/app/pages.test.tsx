import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppLayout } from './layouts/AppLayout';
import { HomePage } from '../features/home/HomePage';
import { LoginPage, RegisterPage } from '../features/auth/AuthPages';
import { RideSearchPage } from '../features/rides/RideSearchPage';
import { AuthProvider } from '../features/auth/AuthContext';

describe('foundation pages', () => {
  it.each([
    ['/', <HomePage />, 'Same direction.'],
    ['/login', <LoginPage />, 'Welcome back.'],
    ['/register', <RegisterPage />, 'Join the journey.'],
    ['/rides', <RideSearchPage />, 'Where are you headed?'],
  ])('renders %s inside the shared layout', (path, element, title) => {
    const html = renderToString(<AuthProvider><MemoryRouter initialEntries={[path]}><Routes>
      <Route element={<AppLayout />}><Route path={path} element={element} /></Route>
    </Routes></MemoryRouter></AuthProvider>);
    expect(html).toContain(title);
    expect(html).toContain('Main navigation');
    expect(html).toContain('App navigation');
    expect(html).toContain('>Home</span>');
    expect(html).toContain('My Bookings');
    expect(html).toContain('>Offers</span>');
    expect(html).toContain('>Account</span>');
    expect(html).toContain('Skip to content');
    if (path === '/login' || path === '/register') expect(html).toContain('Continue with Google');
    if (path === '/register') {
      expect(html).toContain('Offer a seat (Driver)');
      expect(html).toContain('Find a seat (Passenger)');
      expect(html).toContain('Both — offer and find seats');
      expect(html).toContain('Mobile number');
      expect(html).not.toContain('Full name');
      expect(html).not.toContain('type="password"');
    }
    if (path === '/rides') { expect(html).toContain('Today'); expect(html).toContain('Tomorrow'); expect(html).toContain('Women-only'); expect(html).not.toContain('time zone'); }
  });
});
