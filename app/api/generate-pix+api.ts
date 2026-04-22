import { ExpoRequest, ExpoResponse } from 'expo-router/server';
import { createClient } from '@supabase/supabase-js';

const ORAMA_URL  = 'https://api.oramapay.com/api/v1/transactions';
const USER_AGENT = 'DominosBet/1.0 (+suporte@dominosbet.com.br)';

const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: ExpoRequest): Promise<ExpoResponse> {
  try {
    // ── 1. Autenticar o usuário ───────────────────────────
    const authHeader = request.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return ExpoResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const userSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await userSupabase.auth.getUser();
    if (authErr || !user) {
      return ExpoResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    // ── 2. Ler body ───────────────────────────────────────
    const { amount } = await request.json() as { amount: number };
    if (!amount || amount <= 0) {
      return ExpoResponse.json({ error: 'Valor inválido.' }, { status: 400 });
    }

    const amountCentavos = Math.round(amount * 100);

    // ── 3. Criar registro de depósito ─────────────────────
    const { data: externalRef, error: intentErr } = await userSupabase.rpc(
      'create_deposit_intent',
      { p_amount_reais: amount, p_amount_centavos: amountCentavos },
    );
    if (intentErr) {
      return ExpoResponse.json({ error: intentErr.message }, { status: 400 });
    }

    // ── 4. Buscar credenciais e perfil com o token do usuário ─
    const [gatewayRes, profileRes] = await Promise.all([
      userSupabase.rpc('get_payment_gateway'),
      userSupabase.from('profiles').select('display_name, cpf, phone').eq('id', user.id).single(),
    ]);

    const gateway = gatewayRes.data as { api_key: string; public_key: string; is_live: boolean } | null;
    const profile = profileRes.data;

    if (!gateway?.api_key || !gateway?.public_key) {
      return ExpoResponse.json({ error: 'Gateway não configurado. Configure as chaves em Admin → Gateway.' }, { status: 400 });
    }

    // ── 5. Chamar OramaPay ────────────────────────────────
    const credentials = btoa(`${gateway.api_key}:${gateway.public_key}`);

    const requestBody = {
      amount:        amountCentavos,
      paymentMethod: 'pix',
      customer: {
        name:     profile?.display_name || user.email,
        email:    user.email,
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
    if (!oramaRes.ok) {
      return ExpoResponse.json({ error: oramaData?.message ?? `OramaPay erro ${oramaRes.status}` }, { status: 400 });
    }

    // ── 6. Salvar QR Code no banco ────────────────────────
    await userSupabase.rpc('update_deposit_pix', {
      p_external_ref:     externalRef,
      p_orama_id:         oramaData.id,
      p_pix_qrcode:       oramaData.pix?.qrcode      ?? '',
      p_pix_qrcode_image: oramaData.pix?.qrcodeImage ?? '',
      p_pix_expires_at:   oramaData.pix?.expiresAt   ?? null,
    });

    // ── 7. Retornar ao client ─────────────────────────────
    return ExpoResponse.json({
      depositId:     externalRef,
      transactionId: oramaData.id,
      status:        oramaData.status,
      amount:        oramaData.amount,
      pix: {
        qrcode:      oramaData.pix?.qrcode      ?? '',
        qrcodeImage: oramaData.pix?.qrcodeImage ?? '',
        expiresAt:   oramaData.pix?.expiresAt   ?? null,
      },
    });

  } catch (err: any) {
    return ExpoResponse.json({ error: err?.message ?? 'Erro interno.' }, { status: 500 });
  }
}
