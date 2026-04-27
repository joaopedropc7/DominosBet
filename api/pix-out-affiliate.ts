import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const ORAMA_URL         = 'https://api.oramapay.com/api/v1/transactions/pix-out';
const USER_AGENT        = 'DominosBet/1.0 (+suporte@dominosbet.com.br)';
const SUPABASE_URL      = 'https://jqrehnvxoxsykchtxguv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcmVobnZ4b3hzeWtjaHR4Z3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjgxMTcsImV4cCI6MjA5MDkwNDExN30.2I_6o3dmxqujRotZS8NtZwDLpkeGTXJyEFpKIq6hqO8';
const WEBHOOK_URL       = 'https://www.dominosbet.com.br/api/webhook-withdrawal';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    // ── 1. Autenticar admin ───────────────────────────────────
    const authHeader = req.headers.authorization ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const token = authHeader.replace('Bearer ', '');

    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
    if (authErr || !user) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    // ── 2. Ler body ───────────────────────────────────────────
    const { withdrawalId } = req.body as { withdrawalId: string };
    if (!withdrawalId) {
      return res.status(400).json({ error: 'withdrawalId é obrigatório.' });
    }

    // ── 3. Buscar dados do saque (pending ou processing para retry) ──
    const { data: rows, error: listErr } = await adminSupabase.rpc(
      'admin_list_affiliate_withdrawals',
      { p_status: null }, // busca todos para permitir retry
    );
    if (listErr) {
      return res.status(400).json({ error: listErr.message });
    }

    const wd = (rows as any[]).find((r: any) => r.id === withdrawalId);
    if (!wd) {
      return res.status(404).json({ error: 'Saque não encontrado.' });
    }
    if (!['pending', 'processing'].includes(wd.status)) {
      return res.status(400).json({ error: `Saque não pode ser enviado: status atual é "${wd.status}".` });
    }

    // ── 4. Buscar credenciais do gateway ─────────────────────
    const { data: gateway, error: gwErr } = await adminSupabase.rpc('get_payment_gateway');
    if (gwErr || !gateway?.api_key || !gateway?.public_key) {
      return res.status(400).json({ error: 'Gateway não configurado.' });
    }

    // ── 5. Chamar OramaPay pix-out ────────────────────────────
    const credentials    = Buffer.from(`${gateway.api_key}:${gateway.public_key}`).toString('base64');
    const amountCentavos = Number(wd.amount) * 100;

    // Se o perfil não tem CPF e a chave PIX é CPF, usa a própria chave como documento
    let destinationDoc = String(wd.destination_doc ?? '').replace(/\D/g, '');
    if (!destinationDoc && wd.pix_key_type === 'CPF') {
      destinationDoc = String(wd.pix_key).replace(/\D/g, '');
    }

    const payload: Record<string, any> = {
      amount:      amountCentavos,
      pixKey:      wd.pix_key,
      pixKeyType:  wd.pix_key_type,
      destinationName: wd.destination_name || wd.affiliate_name,
      externalRef: wd.external_ref,
      postbackUrl: WEBHOOK_URL,
    };

    // OramaPay só exige document para chaves CPF/CNPJ
    if (destinationDoc) {
      payload.destinationDocument = destinationDoc;
    }

    const oramaRes = await fetch(ORAMA_URL, {
      method: 'POST',
      headers: {
        'User-Agent':    USER_AGENT,
        'Content-Type':  'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify(payload),
    });

    const oramaData = await oramaRes.json();

    // ── 6. Gravar log da requisição ───────────────────────────
    await adminSupabase.rpc('insert_api_log', {
      p_type:          'pix-out-affiliate',
      p_withdrawal_id: withdrawalId,
      p_external_ref:  wd.external_ref,
      p_status_code:   oramaRes.status,
      p_request_body:  payload,
      p_response_body: oramaData,
      p_error:         oramaRes.ok ? null : (oramaData?.message ?? `HTTP ${oramaRes.status}`),
    });

    if (!oramaRes.ok) {
      return res.status(400).json({
        error: oramaData?.message ?? `OramaPay erro ${oramaRes.status}`,
      });
    }

    // ── 7. Atualiza status para "processing" ──────────────────
    const { error: updateErr } = await adminSupabase.rpc(
      'admin_set_affiliate_withdrawal_processing',
      {
        p_withdrawal_id:  withdrawalId,
        p_orama_id:       oramaData.id ?? '',
        p_orama_response: oramaData,
      },
    );
    if (updateErr) {
      console.error('[pix-out-affiliate] falha ao atualizar status:', updateErr.message);
    }

    return res.status(200).json({
      success:  true,
      oramaId:  oramaData.id,
      status:   oramaData.status,
      amount:   wd.amount,
    });

  } catch (err: any) {
    console.error('[pix-out-affiliate] erro:', err);
    return res.status(500).json({ error: err?.message ?? 'Erro interno.' });
  }
}
