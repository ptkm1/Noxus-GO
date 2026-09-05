export type ReceivableStatus =
  | "PENDING"
  | "PROCESSING"
  | "PAID"
  | "PARTIALLY_PAID"
  | "OVERDUE"
  | "CANCELLED"
  | "ERROR";

export const BOLETO_STATUS_LABEL: Record<ReceivableStatus, string> = {
  PENDING: "Em aberto",
  PROCESSING: "Processando",
  PAID: "Pago",
  PARTIALLY_PAID: "Pago parcial",
  OVERDUE: "Vencido",
  CANCELLED: "Cancelado",
  ERROR: "Erro",
};

export type EligibleOrder = {
  id: string;
  orderNumber: number | null;
  status: string;
  totalAmount: number;
  createdAt: string;
  customer: { id: string; name: string; document: string | null } | null;
  paymentCondition: {
    id: string;
    code: string;
    name: string;
    days: number;
    installmentDays: number[];
  } | null;
  openInstallments: number;
  totalInstallments: number;
  alreadyEmitted: number;
  canEmit: boolean;
  issues: string[];
};

export type BankConnectionBrief = {
  id: string;
  provider: string;
  status: string;
  metadata?: { label?: string | null };
};

export type BoletoRow = {
  id: string;
  customerId: string;
  customerName: string | null;
  orderId: string | null;
  orderNumber: number | null;
  provider: string | null;
  amount: number;
  paidAmount: number;
  remaining: number;
  dueDate: string;
  status: ReceivableStatus;
  digitableLine: string | null;
  nossoNumero: string | null;
  installmentIndex: number | null;
  installmentTotal: number | null;
  editableFields?: string[];
};

export type BoletoDetail = BoletoRow & {
  instructions: string | null;
  interestPercent: number | null;
  finePercent: number | null;
  discountAmount: number | null;
  discountUntil: string | null;
  cancelReason: string | null;
  events: Array<{
    id: string;
    action: string;
    message: string;
    createdAt: string;
    actorUser: { id: string; name: string } | null;
  }>;
  editableFields: string[];
};

export type BoletosSummary = {
  open: number;
  overdue: number;
  paidMonth: number;
  processing: number;
  errors: number;
  dueSoon: number;
  totalOpenAmount: number;
};

export const EVENT_ACTION_LABEL: Record<string, string> = {
  EMIT: "Emissão",
  UPDATE: "Edição",
  CANCEL: "Cancelamento",
  SYNC: "Sincronização",
  PDF_VIEW: "Visualização PDF",
  PDF_DOWNLOAD: "Download PDF",
  REISSUE: "Reemissão",
  STATUS: "Status",
};
