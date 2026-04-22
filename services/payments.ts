import { supabase } from './supabase';

export type GeneratePixResponse = {
  depositId:     string;
  transactionId: string;
  status:        string;
  amount:        number;
  pix: {
    qrcode:      string;
    qrcodeImage: string;
    expiresAt:   string | null;
  };
};

/**
 * Gera uma cobrança PIX via API Route do próprio app (/api/generate-pix).
 * A API Route roda server-side (Vercel) e chama a OramaPay sem problemas de CORS.
 */
export async function generatePix(amount: number): Promise<GeneratePixResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Usuário não autenticado.');

  const res = await fetch('/api/generate-pix', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ amount }),
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data?.error ?? 'Erro ao gerar PIX.');

  return data as GeneratePixResponse;
}
