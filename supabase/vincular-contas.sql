-- =====================================================================
-- Nosso Cantinho — PARTE 2: vincular as contas da Manu e do Lury ao casal
--
-- ANTES: crie as duas contas em Authentication > Users > Add user, com
-- estes e-mails internos (o login no site é só pelo NOME + senha):
--     manu@nossocantinho.app      e      lury@nossocantinho.app
-- Se mudou LOGIN_DOMINIO no .env/Vercel, troque o domínio abaixo também.
-- Pode rodar mais de uma vez sem problema (não duplica o casal nem os perfis).
-- =====================================================================
do $$
declare
  email_manu text := 'manu@nossocantinho.app';
  email_lury text := 'lury@nossocantinho.app';
  id_manu  uuid;
  id_lury  uuid;
  id_casal uuid;
begin
  select id into id_manu from auth.users where lower(email) = lower(email_manu);
  select id into id_lury from auth.users where lower(email) = lower(email_lury);

  if id_manu is null then
    raise exception 'Conta da Manu (%) não encontrada. Crie em Authentication > Users ou confira o e-mail.', email_manu;
  end if;
  if id_lury is null then
    raise exception 'Conta do Lury (%) não encontrada. Crie em Authentication > Users ou confira o e-mail.', email_lury;
  end if;

  -- Reaproveita o casal se uma das contas já estiver vinculada
  select casal_id into id_casal from public.perfis where user_id in (id_manu, id_lury) limit 1;
  if id_casal is null then
    insert into public.casais default values returning id into id_casal;
  end if;

  insert into public.perfis (user_id, casal_id, nome)
  values (id_manu, id_casal, 'manu'), (id_lury, id_casal, 'lury')
  on conflict (user_id) do nothing;

  raise notice 'Pronto! Manu e Lury vinculados ao casal %', id_casal;
end
$$;

-- Conferência: devem aparecer 2 linhas (manu e lury) com o mesmo casal_id
select p.nome, u.email, p.casal_id
from public.perfis p
join auth.users u on u.id = p.user_id
order by p.nome;
