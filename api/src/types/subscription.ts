// Subscription and plan types for BB API
export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  limits?: {
    conversations?: number;
    tokensPerMonth?: number;
  };
}

export interface Subscription {
  planId: string;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  paymentMethod?: {
    brand: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
  };
}

export interface BillingPreview {
  prorationDate: string;
  nextPayment: number;
  immediatePayment: number;
  nextBillingDate: string;
}