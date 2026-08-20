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

export type GatewayCustomerBilling = {
  phone: string;
  address: string;
  addressNumber: string;
  complement?: string | null;
  province: string;
  postalCode: string;
  cityIbge?: string | null;
};

export type GatewaySubscriptionCheckoutInput = {
  customerId?: string;
  customerData?: {
    name: string;
    email: string;
    cpfCnpj: string;
    billing: GatewayCustomerBilling;
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

export type GatewayCreditCardInput = {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
};

export type GatewayCreditCardHolderInput = {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  addressComplement?: string | null;
  phone?: string | null;
  mobilePhone: string;
};

export type GatewaySubscriptionWithCardInput = {
  customerId?: string;
  customer?: GatewayCustomerInput;
  customerBilling?: GatewayCustomerBilling;
  value: number;
  cycle: "MONTHLY";
  nextDueDate: string;
  description: string;
  externalReference: string;
  remoteIp: string;
  creditCard: GatewayCreditCardInput;
  creditCardHolderInfo: GatewayCreditCardHolderInput;
};

export type GatewaySubscriptionWithCardResult = {
  subscriptionId: string;
  customerId: string;
  creditCardToken?: string | null;
  creditCardBrand?: string | null;
  creditCardLast4?: string | null;
  status?: string | null;
};

export type GatewaySubscriptionUpgradeInput = {
  subscriptionId: string;
  customerId: string;
  value: number;
  description: string;
  updatePendingPayments: boolean;
  remoteIp: string;
  creditCard: GatewayCreditCardInput;
  creditCardHolderInfo: GatewayCreditCardHolderInput;
};

export type PaymentGateway = {
  createCustomer(input: GatewayCustomerInput): Promise<GatewayCustomer>;
  createSubscriptionCheckout(
    input: GatewaySubscriptionCheckoutInput,
  ): Promise<GatewaySubscriptionCheckout>;
  createSubscriptionWithCard(
    input: GatewaySubscriptionWithCardInput,
  ): Promise<GatewaySubscriptionWithCardResult>;
  upgradeSubscriptionWithCard(
    input: GatewaySubscriptionUpgradeInput,
  ): Promise<GatewaySubscriptionWithCardResult>;
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
