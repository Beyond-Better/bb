import {StripeConstructorOptions, Stripe} from './stripe-js/index.d.ts';

export const loadStripe: (
  publishableKey: string,
  options?: StripeConstructorOptions | undefined
) => Promise<Stripe | null>;
