import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = 'https://jqrehnvxoxsykchtxguv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcmVobnZ4b3hzeWtjaHR4Z3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjgxMTcsImV4cCI6MjA5MDkwNDExN30.2I_6o3dmxqujRotZS8NtZwDLpkeGTXJyEFpKIq6hqO8';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const body = req.body;

    // Apenas processa pagamentos confirmados
    if (body?.event !== 'transaction.paid') {
      return res.status(200).json({ received: true });
    }

    const data        = body?.data ?? {};
    const externalRef = data.externalRef;
    const oramaId     = data.id ?? body.id;
    const e2eId       = data.pix?.end2EndId ?? '';
    const paidAt      = data.paidAt ?? new Date().toISOString();

    if (!externalRef) {
      console.error('[webhook-oramapay] externalRef ausente', JSON.stringify(body));
      return res.status(400).json({ error: 'externalRef ausente.' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { error } = await supabase.rpc('confirm_deposit', {
      p_external_ref: externalRef,
      p_orama_id:     oramaId ?? '',
      p_e2e_id:       e2eId,
      p_paid_at:      paidAt,
    });

    if (error) {
      console.error('[webhook-oramapay] confirm_deposit falhou:', error.message);
      // Retorna 500 para OramaPay reenviar
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ received: true });

  } catch (err: any) {
    console.error('[webhook-oramapay] erro:', err);
    return res.status(500).json({ error: err?.message ?? 'Erro interno.' });
  }
}
