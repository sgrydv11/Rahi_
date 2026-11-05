export interface GroupOffer {
  rideId: string; origin: string; destination: string; departureAt: string;
  availableSeats: number; farePerSeatPaise: number; currency: 'INR';
}
export interface Quote {
  farePaise: number; discountPercent: 0 | 5 | 10 | 15;
  discountPaise: number; totalPaise: number; currency: 'INR';
}
export interface SeatHold {
  id: string; rideId: string; seats: number; expiresAt: string; quote: Quote; bookingId?: string;
  status: 'HELD' | 'PAYMENT_PENDING' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED' | 'REFUND_PENDING';
}
export type Checkout = { provider: 'stripe'; checkoutUrl: string } |
  { provider: 'razorpay'; keyId: string; orderId: string };
export interface WalletBalance { currency: 'INR'; availablePaise: number; reservedPaise: number }
export interface WalletOperation {
  id: string; amountPaise: number; status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
}
export interface WalletEntry {
  id: string; amountPaise: number; createdAt: string;
  kind: 'TOP_UP' | 'RIDE_DEBIT' | 'RIDE_REFUND' | 'WITHDRAWAL' | 'WITHDRAWAL_RELEASE';
}
interface Page<T> { content: T[]; page: number; totalPages: number }
type Send = <T>(path: string, options?: { method: 'POST'; body?: unknown; key?: string }) => Promise<T>;
type Verification = { paymentId: string; signature: string };

const holdPath = (id: string) => `/group/holds/${encodeURIComponent(id)}`;
const topUpPath = (id: string) => `/wallet/top-ups/${encodeURIComponent(id)}`;

/** The routes are enabled as their backend phases ship. */
export function createGroupWalletClient(send: Send) {
  return {
    offers(page = 0, origin = '', destination = '') {
      const query = new URLSearchParams({ page: String(page), size: '20' });
      if (origin.trim()) query.set('origin', origin.trim());
      if (destination.trim()) query.set('destination', destination.trim());
      return send<Page<GroupOffer>>(`/group/offers?${query}`);
    },
    hold: (rideId: string, seats: number, key: string) =>
      send<SeatHold>('/group/holds', { method: 'POST', body: { rideId, seats }, key }),
    getHold: (id: string) => send<SeatHold>(holdPath(id)),
    checkout: (id: string, method: 'PROVIDER' | 'WALLET', key: string) =>
      send<{ hold: SeatHold; checkout?: Checkout }>(`${holdPath(id)}/checkout`, { method: 'POST', body: { method }, key }),
    sync: (id: string, body?: Verification) => send<SeatHold>(`${holdPath(id)}/sync`, { method: 'POST', body }),
    cancel: (id: string) => send<SeatHold>(`${holdPath(id)}/cancel`, { method: 'POST' }),
    wallet: () => send<WalletBalance>('/wallet'),
    transactions: (page = 0) => send<Page<WalletEntry>>(`/wallet/transactions?page=${page}&size=20`),
    topUp: (amountPaise: number, key: string) =>
      send<{ operation: WalletOperation; checkout: Checkout }>('/wallet/top-ups', { method: 'POST', body: { amountPaise }, key }),
    syncTopUp: (id: string, body?: Verification) =>
      send<WalletOperation>(`${topUpPath(id)}/sync`, { method: 'POST', body }),
    withdraw: (amountPaise: number, key: string) =>
      send<WalletOperation>('/wallet/withdrawals', { method: 'POST', body: { amountPaise }, key }),
    withdrawal: (id: string) => send<WalletOperation>(`/wallet/withdrawals/${encodeURIComponent(id)}`),
    nextDiscount: () => send<{ discountPercent: 5 | 10 | 15 }>('/ride-discounts/next'),
  };
}
