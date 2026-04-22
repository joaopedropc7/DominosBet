import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// OramaPay não exige verificação de assinatura por padrão,
// mas limitamos a resposta a POST apenas e usamos service role internamente.

serve(async (req) => {
  // ── 1. Aceitar apenas POST ──────────────────────────────
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // ── 2. Filtrar apenas pagamentos confirmados ────────────
  if (body?.event !== 'transaction.paid') {
    // Outros eventos (ex: transaction.refused) são ignorados silenciosamente
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const data = body?.data ?? {};
  const externalRef: string | undefined = data.externalRef;
  const oramaId:     string | undefined = data.id ?? body.id;
  const e2eId:       string | undefined = data.pix?.end2EndId ?? null;
  const paidAt:      string | undefined = data.paidAt ?? null;

  if (!externalRef) {
    console.error('webhook-oramapay: externalRef ausente', JSON.stringify(body));
    return new Response(JSON.stringify({ error: 'externalRef ausente' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── 3. Chamar confirm_deposit via service role ──────────
  try {
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error } = await serviceSupabase.rpc('confirm_deposit', {
      p_external_ref: externalRef,
      p_orama_id:     oramaId    ?? '',
      p_e2e_id:       e2eId      ?? '',
      p_paid_at:      paidAt     ?? new Date().toISOString(),
    });

    if (error) {
      console.error('webhook-oramapay: confirm_deposit falhou', error.message);
      // Retorna 500 para que a OramaPay reenvie o webhook
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err: any) {
    console.error('webhook-oramapay: erro inesperado', err?.message);
    return new Response(JSON.stringify({ error: err?.message ?? 'Erro interno.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── 4. Confirmar recebimento ────────────────────────────
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
