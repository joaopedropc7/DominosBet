import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const ORAMA_URL      = 'https://api.oramapay.com/api/v1/transactions/pix-out';
const USER_AGENT     = 'DominosBet/1.0 (+suporte@dominosbet.com.br)';
const SUPABASE_URL   = 'https://jqrehnvxoxsykchtxguv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcmVobnZ4b3hzeWtjaHR4Z3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjgxMTcsImV4cCI6MjA5MDkwNDExN30.2I_6o3dmxqujRotZS8NtZwDLpkeGTXJyEFpKIq6hqO8';
const WEBHOOK_URL    = 'https://www.dominosbet.com.br/api/webhook-withdrawal';

const PIX_KEY_TYPE_MAP: Record<string, string> = {
  'telefone':  'PHONE',
  'celular':   'PHONE',
  'phone':     'PHONE',
  'cpf':       'CPF',
  'cnpj':      'CNPJ',
  'email':     'EMAIL',
  'e-mail':    'EMAIL',
  'aleatoria': 'RANDOM',
  'aleatória': 'RANDOM',
  'evp':       'RANDOM',
  'random':    'RANDOM',
};

function normalizePixKeyType(raw: string): string {
  return PIX_KEY_TYPE_MAP[String(raw).toLowerCase().trim()] ?? String(raw).toUpperCase().trim();
}

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

    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // ── 2. Ler body ───────────────────────────────────────────
    const { withdrawalId } = req.body as { withdrawalId: string };
    if (!withdrawalId) {
      return res.status(400).json({ error: 'withdrawalId é obrigatório.' });
    }

    // ── 3. Buscar dados do saque ──────────────────────────────
    // (o RPC admin_list_player_withdrawals já verifica is_admin internamente)
    const { data: rows, error: listErr } = await adminSupabase.rpc(
      'admin_list_player_withdrawals',
      { p_status: null }, // busca todos para permitir retry de 'processing'
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
    const credentials = Buffer.from(`${gateway.api_key}:${gateway.public_key}`).toString('base64');

    // net_amount em coins = reais; converter para centavos
    const amountCentavos = wd.net_amount * 100;

    const payload = {
      amount:              amountCentavos,
      pixKey:              wd.pix_key,
      pixKeyType:          normalizePixKeyType(wd.pix_key_type),
      destinationName:     wd.destination_name,
      destinationDocument: wd.destination_doc.replace(/\D/g, ''),
      externalRef:         wd.external_ref,
      postbackUrl:         WEBHOOK_URL,
    };

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
      p_type:          'pix-out',
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
      'admin_set_withdrawal_processing',
      {
        p_withdrawal_id:  withdrawalId,
        p_orama_id:       oramaData.id ?? '',
        p_orama_response: oramaData,
      },
    );
    if (updateErr) {
      console.error('[pix-out] falha ao atualizar status:', updateErr.message);
    }

    return res.status(200).json({
      success:   true,
      oramaId:   oramaData.id,
      status:    oramaData.status,
      netAmount: wd.net_amount,
    });

  } catch (err: any) {
    console.error('[pix-out] erro:', err);
    return res.status(500).json({ error: err?.message ?? 'Erro interno.' });
  }
}
