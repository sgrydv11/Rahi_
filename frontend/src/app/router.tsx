import { createBrowserRouter } from 'react-router';
import { AppLayout } from './layouts/AppLayout';
import { HomePage } from '../features/home/HomePage';
import { LoginPage, RegisterPage } from '../features/auth/AuthPages';
import { RideSearchPage } from '../features/rides/RideSearchPage';
import { NotFoundPage } from '../components/NotFoundPage';
import { ProtectedRoute } from '../features/auth/AuthContext';
import { ProfilePage } from '../features/profile/ProfilePage';
import { RideDetailsPage } from '../features/rides/RideDetailsPage';
import { OfferRidePage, EditRidePage } from '../features/rides/ManageRidePages';
import { MyRidesPage } from '../features/rides/MyRidesPage';
import { BookingListPage, BookingDetailsPage } from '../features/bookings/BookingPages';
import { NotificationsPage } from '../features/bookings/NotificationsPage';
import { VehiclesPage } from '../features/vehicles/VehiclesPage';

export const router = createBrowserRouter([
  { element: <AppLayout />, children: [
    { path: '/', element: <HomePage /> },
    { path: '/login', element: <LoginPage /> },
    { path: '/register', element: <RegisterPage /> },
    { path: '/rides', element: <RideSearchPage /> },
    { path: '/rides/:id', element: <RideDetailsPage /> },
    { element: <ProtectedRoute />, children: [
      { path: '/profile', element: <ProfilePage /> },
      { path: '/vehicles', element: <VehiclesPage /> },
      { path: '/notifications', element: <NotificationsPage /> },
      { path: '/bookings/mine', element: <BookingListPage /> },
      { path: '/bookings/:id', element: <BookingDetailsPage /> },
      { path: '/rides/:id/bookings', element: <BookingListPage manifest /> },
      { path: '/rides/new', element: <OfferRidePage /> },
      { path: '/rides/mine', element: <MyRidesPage /> },
      { path: '/rides/:id/edit', element: <EditRidePage /> },
    ] },
    { path: '*', element: <NotFoundPage /> },
  ] },
]);
