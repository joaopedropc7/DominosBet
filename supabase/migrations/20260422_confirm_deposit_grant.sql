-- Permite que o webhook (sem sessão de usuário) chame confirm_deposit via anon key.
-- Segurança: externalRef é um UUID aleatório que só a OramaPay conhece.
GRANT EXECUTE ON FUNCTION public.confirm_deposit(text, text, text, timestamptz) TO anon;
