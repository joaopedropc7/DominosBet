import { supabase } from './supabase';

const ORAMA_URL   = 'https://api.oramapay.com/api/v1/transactions';
const USER_AGENT  = 'DominosBet/1.0 (+suporte@dominosbet.com.br)';
const ORAMA_API_KEY    = process.env.EXPO_PUBLIC_ORAMA_API_KEY    ?? '';
const ORAMA_PUBLIC_KEY = process.env.EXPO_PUBLIC_ORAMA_PUBLIC_KEY ?? '';

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
 * Gera uma cobrança PIX diretamente via OramaPay.
 * Credenciais lidas das variáveis de ambiente (EXPO_PUBLIC_ORAMA_*).
 *
 * @param amount  Valor em reais (ex: 50.00)
 */
export async function generatePix(amount: number): Promise<GeneratePixResponse> {
  // ── 1. Sessão do usuário ──────────────────────────────
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Usuário não autenticado.');

  if (!ORAMA_API_KEY || !ORAMA_PUBLIC_KEY) {
    throw new Error('Chaves OramaPay não configuradas. Verifique o arquivo .env.');
  }

  const amountCentavos = Math.round(amount * 100);

  // ── 2. Criar registro de depósito no banco ────────────
  const { data: externalRef, error: intentErr } = await supabase.rpc(
    'create_deposit_intent',
    { p_amount_reais: amount, p_amount_centavos: amountCentavos },
  );
  if (intentErr) throw new Error(intentErr.message);

  // ── 3. Carregar perfil do usuário ─────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email, cpf, phone')
    .eq('id', session.user.id)
    .single();

  // ── 4. Chamar OramaPay ────────────────────────────────
  const credentials = btoa(`${ORAMA_API_KEY}:${ORAMA_PUBLIC_KEY}`);

  const oramaRes = await fetch(ORAMA_URL, {
    method: 'POST',
    headers: {
      'User-Agent':    USER_AGENT,
      'Content-Type':  'application/json',
      'Authorization': `Basic ${credentials}`,
    },
    body: JSON.stringify({
      amount:        amountCentavos,
      paymentMethod: 'pix',
      customer: {
        name:     profile?.display_name || session.user.email,
        email:    session.user.email,
        phone:    (profile?.phone || '').replace(/\D/g, ''),
        document: {
          number: (profile?.cpf || '').replace(/\D/g, ''),
          type:   'cpf',
        },
      },
      items: [{
        title:     'Depósito',
        unitPrice: amountCentavos,
        quantity:  1,
        tangible:  false,
      }],
      externalRef,
    }),
  });

  const oramaData = await oramaRes.json();
  if (!oramaRes.ok) {
    throw new Error(oramaData?.message ?? `OramaPay erro ${oramaRes.status}`);
  }

  // ── 5. Salvar QR Code no banco ────────────────────────
  await supabase.rpc('update_deposit_pix', {
    p_external_ref:     externalRef,
    p_orama_id:         oramaData.id,
    p_pix_qrcode:       oramaData.pix?.qrcode   ?? '',
    p_pix_qrcode_image: oramaData.pix?.qrcodeImage ?? '',
    p_pix_expires_at:   oramaData.pix?.expiresAt  ?? null,
  });

  // ── 6. Retornar ao componente ─────────────────────────
  return {
    depositId:     externalRef,
    transactionId: oramaData.id,
    status:        oramaData.status,
    amount:        oramaData.amount,
    pix: {
      qrcode:      oramaData.pix?.qrcode      ?? '',
      qrcodeImage: oramaData.pix?.qrcodeImage ?? '',
      expiresAt:   oramaData.pix?.expiresAt   ?? null,
    },
  };
}
