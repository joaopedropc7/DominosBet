import { supabase } from './supabase';

export type OramaCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  document: { number: string; type: string };
};

export type OramaItem = {
  title: string;
  unitPrice: number;
  quantity: number;
  tangible: boolean;
};

export type OramaFee = {
  fixedAmount: number;
  spreadPercentage: number;
  estimatedFee: number;
  netAmount: number;
};

export type OramaPix = {
  qrCode: string;       // código copia-e-cola
  qrCodeImage: string;  // base64 ou URL do QR Code
  expiresAt: string;
};

/** Resposta simplificada devolvida pela Edge Function generate-pix */
export type GeneratePixResponse = {
  depositId:     string;
  transactionId: string;
  status:        string;
  amount:        number;          // em centavos
  pix: {
    qrcode:      string;          // código copia-e-cola
    qrcodeImage: string;          // base64 ou URL do QR Code
    expiresAt:   string | null;
  };
};

/** Status possíveis retornados pela OramaPay */
export type OramaStatus =
  | 'waiting_payment'   // aguardando pagamento PIX
  | 'paid'              // pago
  | 'refused'           // recusado
  | 'refunded'          // estornado
  | 'chargedback';      // chargeback

export type PixResponse = {
  id: string;
  externalRef: string;
  amount: number;           // em centavos
  refundedAmount: number;
  installments: number;
  companyId: string;
  paymentMethod: 'pix';
  status: OramaStatus;
  pix: OramaPix;            // dados do QR Code
  actionUrl: string | null;
  refusedReason: string | null;
  refusedCode: string | null;
  postbackUrl: string;
  metadata: Record<string, unknown> | null;
  customer: OramaCustomer;
  items: OramaItem[];
  fee: OramaFee;
  splits: unknown[];
  refunds: unknown[];
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
};

/**
 * Gera uma cobrança PIX via Edge Function segura.
 * As credenciais da OramaPay nunca chegam ao client.
 * O externalRef (UUID do depósito) é gerado internamente pela Edge Function.
 *
 * @param amount  Valor em reais (ex: 50.00)
 */
export async function generatePix(amount: number): Promise<GeneratePixResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Usuário não autenticado.');

  const res = await supabase.functions.invoke('generate-pix', {
    body: { amount },
  });

  if (res.error) throw new Error(res.error.message);
  if (res.data?.error) throw new Error(res.data.error);

  return res.data as GeneratePixResponse;
}
