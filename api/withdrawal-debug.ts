import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = 'https://jqrehnvxoxsykchtxguv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcmVobnZ4b3hzeWtjaHR4Z3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjgxMTcsImV4cCI6MjA5MDkwNDExN30.2I_6o3dmxqujRotZS8NtZwDLpkeGTXJyEFpKIq6hqO8';

/**
 * GET /api/withdrawal-debug?id=<uuid>&kind=player|affiliate
 *
 * Retorna o JSON bruto salvo da OramaPay quando o PIX-out foi enviado.
 * Útil para depurar falhas sem consultar o gateway novamente.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
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

    const { data: { user }, error: authErr } = await adminSupabase.auth.getUser();
    if (authErr || !user) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    // ── 2. Ler query params ───────────────────────────────────
    const id   = req.query.id   as string | undefined;
    const kind = req.query.kind as string | undefined; // 'player' | 'affiliate'

    if (!id) {
      return res.status(400).json({ error: 'Parâmetro "id" é obrigatório.' });
    }
    if (!kind || !['player', 'affiliate'].includes(kind)) {
      return res.status(400).json({ error: 'Parâmetro "kind" deve ser "player" ou "affiliate".' });
    }

    // ── 3. Buscar resposta salva ──────────────────────────────
    const { data: oramaResponse, error: rpcErr } = await adminSupabase.rpc(
      'admin_get_withdrawal_orama_response',
      { p_withdrawal_id: id, p_kind: kind },
    );

    if (rpcErr) {
      return res.status(400).json({ error: rpcErr.message });
    }

    if (oramaResponse === null || oramaResponse === undefined) {
      return res.status(404).json({
        error: 'Nenhuma resposta da OramaPay registrada para este saque.',
        hint:  'A resposta só é salva após o PIX-out ser enviado pelo painel admin.',
      });
    }

    return res.status(200).json({
      withdrawalId: id,
      kind,
      oramaResponse,
    });

  } catch (err: any) {
    console.error('[withdrawal-debug] erro:', err);
    return res.status(500).json({ error: err?.message ?? 'Erro interno.' });
  }
}
