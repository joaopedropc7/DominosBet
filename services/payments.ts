import { supabase } from './supabase';

const ORAMA_URL  = 'https://api.oramapay.com/api/v1/transactions';
const USER_AGENT = 'DominosBet/1.0 (+suporte@dominosbet.com.br)';

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
 * As credenciais são buscadas das configurações do admin (gateway_settings).
 */
export async function generatePix(amount: number): Promise<GeneratePixResponse> {
  // ── 1. Sessão do usuário ──────────────────────────────
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Usuário não autenticado.');

  const amountCentavos = Math.round(amount * 100);

  // ── 2. Criar registro de depósito no banco ────────────
  const { data: externalRef, error: intentErr } = await supabase.rpc(
    'create_deposit_intent',
    { p_amount_reais: amount, p_amount_centavos: amountCentavos },
  );
  if (intentErr) throw new Error(intentErr.message);

  // ── 3. Buscar credenciais e perfil em paralelo ────────
  const [gatewayRes, profileRes] = await Promise.all([
    supabase.rpc('get_payment_gateway'),
    supabase.from('profiles').select('display_name, cpf, phone').eq('id', session.user.id).single(),
  ]);

  if (gatewayRes.error) throw new Error(gatewayRes.error.message);

  const gateway = gatewayRes.data as { api_key: string; public_key: string; is_live: boolean };
  const profile = profileRes.data;

  if (!gateway?.api_key || !gateway?.public_key) {
    throw new Error('Gateway não configurado. Configure as chaves em Admin → Gateway.');
  }

  // ── 4. Chamar OramaPay diretamente ────────────────────
  const credentials = btoa(`${gateway.api_key}:${gateway.public_key}`);

  const requestBody = {
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
  };

  console.log('[OramaPay] POST', ORAMA_URL);
  console.log('[OramaPay] body:', JSON.stringify(requestBody, null, 2));

  const oramaRes = await fetch(ORAMA_URL, {
    method: 'POST',
    headers: {
      'User-Agent':    USER_AGENT,
      'Content-Type':  'application/json',
      'Authorization': `Basic ${credentials}`,
    },
    body: JSON.stringify(requestBody),
  });

  const oramaData = await oramaRes.json();
  console.log('[OramaPay] status:', oramaRes.status);
  console.log('[OramaPay] response:', JSON.stringify(oramaData, null, 2));

  if (!oramaRes.ok) {
    throw new Error(oramaData?.message ?? `OramaPay erro ${oramaRes.status}`);
  }

  // ── 5. Salvar QR Code no banco ────────────────────────
  await supabase.rpc('update_deposit_pix', {
    p_external_ref:     externalRef,
    p_orama_id:         oramaData.id,
    p_pix_qrcode:       oramaData.pix?.qrcode      ?? '',
    p_pix_qrcode_image: oramaData.pix?.qrcodeImage ?? '',
    p_pix_expires_at:   oramaData.pix?.expiresAt   ?? null,
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
