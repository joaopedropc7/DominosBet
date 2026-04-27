import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = 'https://jqrehnvxoxsykchtxguv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcmVobnZ4b3hzeWtjaHR4Z3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjgxMTcsImV4cCI6MjA5MDkwNDExN30.2I_6o3dmxqujRotZS8NtZwDLpkeGTXJyEFpKIq6hqO8';

// Status que a OramaPay envia quando o saque foi efetivado
const PAID_STATUSES = new Set(['PAID', 'COMPLETED', 'paid', 'completed']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    const body = req.body;

    // ── Loga TUDO que chega neste endpoint ───────────────────
    // (ajuda a depurar formato inesperado do webhook)
    await supabase.rpc('insert_api_log', {
      p_type:          'webhook-withdrawal',
      p_withdrawal_id: null,
      p_external_ref:  body?.data?.externalRef ?? null,
      p_status_code:   200,
      p_request_body:  body,
      p_response_body: null,
      p_error:         null,
    });

    // ── Formato OramaPay: { success: true, data: { id, status, ... } }
    const data       = body?.data ?? {};
    const oramaId    = data.id    ?? '';
    const status     = data.status ?? '';

    // Campos presentes em alguns webhooks (depende da versão da API)
    const externalRef = data.externalRef ?? data.external_ref ?? '';
    const e2eId       = data.pixEnd2EndId ?? data.pix?.end2EndId ?? data.endToEndId ?? '';
    const paidAt      = data.paidAt ?? data.paid_at ?? new Date().toISOString();

    // Ignora se não for status de pagamento concluído
    if (!PAID_STATUSES.has(status)) {
      console.log('[webhook-withdrawal] status ignorado:', status, '| oramaId:', oramaId);
      return res.status(200).json({ received: true });
    }

    // Determina o tipo de saque:
    // - Se tiver externalRef: usa prefixo wd-/awd- para distinguir
    // - Se não tiver: tenta ambos (player primeiro, depois affiliate)
    const ref = String(externalRef);
    let error: any = null;

    if (ref.startsWith('awd-')) {
      // Saque de afiliado por external_ref
      ({ error } = await supabase.rpc('confirm_affiliate_withdrawal', {
        p_external_ref: ref,
        p_orama_id:     oramaId,
        p_paid_at:      paidAt,
      }));
    } else if (ref.startsWith('wd-')) {
      // Saque de jogador por external_ref
      ({ error } = await supabase.rpc('confirm_player_withdrawal', {
        p_external_ref: ref,
        p_orama_id:     oramaId,
        p_e2e_id:       e2eId,
        p_paid_at:      paidAt,
      }));
    } else if (oramaId) {
      // Sem externalRef — busca por orama_id (tenta jogador, depois afiliado)
      const { error: errPlayer } = await supabase.rpc('confirm_player_withdrawal', {
        p_external_ref: null,
        p_orama_id:     oramaId,
        p_e2e_id:       e2eId,
        p_paid_at:      paidAt,
      });
      if (errPlayer) {
        const { error: errAffiliate } = await supabase.rpc('confirm_affiliate_withdrawal', {
          p_external_ref: null,
          p_orama_id:     oramaId,
          p_paid_at:      paidAt,
        });
        error = errAffiliate;
      }
    } else {
      console.log('[webhook-withdrawal] sem oramaId nem externalRef:', JSON.stringify(body));
      return res.status(200).json({ received: true });
    }

    // Loga resultado do processamento
    await supabase.rpc('insert_api_log', {
      p_type:          'webhook-withdrawal-processed',
      p_withdrawal_id: null,
      p_external_ref:  ref || oramaId,
      p_status_code:   error ? 500 : 200,
      p_request_body:  body,
      p_response_body: null,
      p_error:         error ? error.message : null,
    });

    if (error) {
      console.error('[webhook-withdrawal] RPC falhou:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ received: true });

  } catch (err: any) {
    console.error('[webhook-withdrawal] erro:', err);

    await supabase.rpc('insert_api_log', {
      p_type:          'webhook-withdrawal',
      p_withdrawal_id: null,
      p_external_ref:  null,
      p_status_code:   500,
      p_request_body:  req.body ?? null,
      p_response_body: null,
      p_error:         err?.message ?? 'Erro interno',
    }).catch(() => {});

    return res.status(500).json({ error: err?.message ?? 'Erro interno.' });
  }
}
