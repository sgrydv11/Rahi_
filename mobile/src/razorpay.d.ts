declare module 'react-native-razorpay' {
  interface CheckoutOptions {
    key: string;
    order_id: string;
    amount: string;
    currency: string;
    name: string;
    description: string;
  }
  interface CheckoutResult {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }
  const checkout: { open(options: CheckoutOptions): Promise<CheckoutResult> };
  export default checkout;
}
