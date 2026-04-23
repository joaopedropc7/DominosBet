-- Habilita Realtime na tabela deposits para o app receber notificação de pagamento confirmado
ALTER PUBLICATION supabase_realtime ADD TABLE public.deposits;
