export type GatewayCustomerInput = {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone?: string | null;
  externalReference: string;
};

export type GatewayCustomer = {
  id: string;
};

export type GatewayCheckoutItem = {
  name: string;
  description?: string;
  quantity: number;
  value: number;
};

export type GatewaySubscriptionCheckoutInput = {
  customerId?: string;
  customerData?: {
    name: string;
    email: string;
    cpfCnpj: string;
    phone?: string | null;
  };
  items: GatewayCheckoutItem[];
  cycle: "MONTHLY";
  nextDueDate: string;
  minutesToExpire: number;
  externalReference: string;
  successUrl: string;
  cancelUrl: string;
  expiredUrl: string;
};

export type GatewaySubscriptionCheckout = {
  id: string;
  link: string;
  expiresAt: Date | null;
};

export type PaymentGateway = {
  createCustomer(input: GatewayCustomerInput): Promise<GatewayCustomer>;
  createSubscriptionCheckout(
    input: GatewaySubscriptionCheckoutInput,
  ): Promise<GatewaySubscriptionCheckout>;
  cancelSubscription(subscriptionId: string): Promise<void>;
};

export class PaymentGatewayError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PaymentGatewayError";
  }
}
