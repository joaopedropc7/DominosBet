import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ORAMA_URL = 'https://api.oramapay.com/api/v1/transactions';
const USER_AGENT = 'DominosBet/1.0 (+suporte@dominosbet.com.br)';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // ── 1. Autenticar o caller ──────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) throw new Error('Não autenticado.');

    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const userSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authErr } = await userSupabase.auth.getUser();
    if (authErr || !user) throw new Error('Não autenticado.');

    // ── 2. Ler body ─────────────────────────────────────────
    const { amount } = await req.json() as { amount: number }; // em reais
    if (!amount || amount <= 0) throw new Error('Valor inválido.');

    const amountCentavos = Math.round(amount * 100);

    // ── 3. Criar registro de depósito (gera o externalRef) ──
    const { data: externalRef, error: intentErr } = await userSupabase.rpc(
      'create_deposit_intent',
      { p_amount_reais: amount, p_amount_centavos: amountCentavos },
    );
    if (intentErr) throw new Error(intentErr.message);

    // ── 4. Carregar perfil do usuário ───────────────────────
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('display_name, email, cpf, phone')
      .eq('id', user.id)
      .single();

    // ── 5. Carregar credenciais OramaPay ────────────────────
    const { data: settings, error: settingsErr } = await serviceSupabase
      .from('gateway_settings')
      .select('api_key, public_key, postback_url, is_live')
      .eq('provider', 'oramapay')
      .single();

    if (settingsErr || !settings?.api_key || !settings?.public_key) {
      throw new Error('Gateway não configurado. Configure as chaves em Admin → Gateway.');
    }

    // ── 6. Chamar OramaPay ──────────────────────────────────
    const credentials = btoa(`${settings.api_key}:${settings.public_key}`);

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
        postbackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-oramapay`,
      }),
    });

    const oramaData = await oramaRes.json();
    if (!oramaRes.ok) {
      throw new Error(oramaData?.message ?? `OramaPay error ${oramaRes.status}`);
    }

    // ── 7. Salvar dados do QR no registro de depósito ───────
    await userSupabase.rpc('update_deposit_pix', {
      p_external_ref:     externalRef,
      p_orama_id:         oramaData.id,
      p_pix_qrcode:       oramaData.pix?.qrcode ?? '',
      p_pix_qrcode_image: oramaData.pix?.qrcodeImage ?? '',
      p_pix_expires_at:   oramaData.pix?.expiresAt ?? null,
    });

    // ── 8. Retornar ao client ───────────────────────────────
    return new Response(JSON.stringify({
      depositId:      externalRef,
      transactionId:  oramaData.id,
      status:         oramaData.status,
      amount:         oramaData.amount,
      pix: {
        qrcode:      oramaData.pix?.qrcode,
        qrcodeImage: oramaData.pix?.qrcodeImage,
        expiresAt:   oramaData.pix?.expiresAt,
      },
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message ?? 'Erro interno.' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
