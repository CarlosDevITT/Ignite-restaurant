-- Ignite Cardápio — checkout v2
-- Execute DEPOIS de cardapio-hardening-20260904.sql.
-- Adiciona Delivery, Retirada e Comer no local sem alterar a RPC v1 já usada.

begin;

create or replace function public.place_cardapio_order_v2(
  p_customer_name text,
  p_phone text,
  p_address text,
  p_payment_method text,
  p_order_type text,
  p_table_number integer,
  p_notes text,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_item jsonb;
  v_product record;
  v_quantity integer;
  v_subtotal numeric(12,2) := 0;
  v_delivery_fee numeric(10,2) := 0;
  v_configured_fee numeric(10,2);
  v_store_open boolean;
  v_total_quantity integer := 0;
  v_number bigint;
  v_clean_items jsonb := '[]'::jsonb;
  v_order public.orders%rowtype;
  v_phone_digits text;
  v_tipo text;
  v_address text;
begin
  if nullif(trim(p_customer_name), '') is null or nullif(trim(p_phone), '') is null then
    raise exception 'Nome e telefone são obrigatórios';
  end if;

  if length(trim(p_customer_name)) > 120 then
    raise exception 'Nome excede o tamanho permitido';
  end if;

  v_phone_digits := regexp_replace(p_phone, '[^0-9]', '', 'g');
  if length(v_phone_digits) < 10 or length(v_phone_digits) > 13 then
    raise exception 'Telefone inválido';
  end if;

  if p_payment_method not in ('pix', 'card', 'cash') then
    raise exception 'Forma de pagamento inválida';
  end if;

  if p_order_type not in ('delivery', 'pickup', 'local') then
    raise exception 'Tipo de pedido inválido';
  end if;

  if p_order_type = 'delivery' then
    if nullif(trim(coalesce(p_address, '')), '') is null then
      raise exception 'Endereço de entrega é obrigatório';
    end if;
    if length(trim(p_address)) > 300 then
      raise exception 'Endereço excede o tamanho permitido';
    end if;
    v_tipo := 'delivery';
    v_address := trim(p_address);
  elsif p_order_type = 'local' then
    if p_table_number is null or p_table_number < 1 or p_table_number > 999 then
      raise exception 'Número da mesa inválido';
    end if;
    v_tipo := 'local';
    v_address := null;
  else
    v_tipo := 'retirada';
    v_address := null;
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'O pedido está vazio';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'O pedido excede o limite de itens';
  end if;

  select delivery_fee, store_open into v_configured_fee, v_store_open
  from public.cardapio_settings where id = 1;
  if not coalesce(v_store_open, true) then
    raise exception 'A loja está fechada no momento';
  end if;
  if p_order_type = 'delivery' then
    v_delivery_fee := coalesce(v_configured_fee, 7);
  end if;

  if exists (
    select 1 from public.orders o
    where regexp_replace(coalesce(o.phone, ''), '[^0-9]', '', 'g') = v_phone_digits
      and o.created_at > now() - interval '20 seconds'
  ) then
    raise exception 'Aguarde alguns segundos antes de enviar outro pedido';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(v_item->>'product_id', '') !~ '^[0-9]+$' then
      raise exception 'Produto inválido';
    end if;

    v_quantity := coalesce((v_item->>'quantity')::integer, 1);
    if v_quantity < 1 or v_quantity > 20 then
      raise exception 'Quantidade inválida';
    end if;

    select
      p.id,
      p.name,
      case
        when coalesce(p.promo, false)
          and p.promo_price is not null
          and p.promo_price >= 0
          and p.promo_price < p.price
        then p.promo_price
        else p.price
      end as effective_price
    into v_product
    from public.products p
    where p.id = (v_item->>'product_id')::bigint
      and coalesce(p.ativo, true)
      and coalesce(p.available, true);

    if not found then
      raise exception 'Produto indisponível: %', v_item->>'product_id';
    end if;

    v_subtotal := v_subtotal + (v_product.effective_price * v_quantity);
    v_total_quantity := v_total_quantity + v_quantity;
    v_clean_items := v_clean_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'name', v_product.name,
      'quantity', v_quantity,
      'price', v_product.effective_price,
      'notes', left(coalesce(v_item->>'notes', ''), 300)
    ));
  end loop;

  v_number := nextval('public.cardapio_order_number_seq');
  if v_number > 2147483647 then
    raise exception 'A sequência do número do pedido excedeu o limite inteiro';
  end if;

  insert into public.orders (
    customer_name, phone, table_number, total, status, items_count, tipo,
    order_type, taxa_entrega, numero_pedido, metodo_pagamento,
    endereco_entrega, observacoes, items
  ) values (
    trim(p_customer_name), v_phone_digits,
    case when p_order_type = 'local' then p_table_number else null end,
    v_subtotal + v_delivery_fee, 'pending', v_total_quantity, v_tipo,
    p_order_type, v_delivery_fee, v_number::integer, p_payment_method,
    v_address, left(coalesce(p_notes, ''), 500), v_clean_items
  ) returning * into v_order;

  insert into public.order_items (
    order_id, product_id, product_name, quantity, unit_price, total_price, subtotal
  )
  select
    v_order.id,
    (item->>'product_id')::bigint,
    item->>'name',
    (item->>'quantity')::integer,
    (item->>'price')::numeric,
    (item->>'price')::numeric * (item->>'quantity')::integer,
    (item->>'price')::numeric * (item->>'quantity')::integer
  from jsonb_array_elements(v_clean_items) item;

  update public.orders
  set total = v_subtotal + v_delivery_fee,
      items_count = v_total_quantity,
      updated_at = now()
  where id = v_order.id
  returning * into v_order;

  return to_jsonb(v_order) || jsonb_build_object(
    'order_number', 'IG' || lpad(v_order.numero_pedido::text, 6, '0'),
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'service_type', p_order_type,
    'order_items', (
      select coalesce(jsonb_agg(to_jsonb(oi) order by oi.id), '[]'::jsonb)
      from public.order_items oi where oi.order_id = v_order.id
    )
  );
end;
$$;

revoke all on function public.place_cardapio_order_v2(text,text,text,text,text,integer,text,jsonb) from public;
grant execute on function public.place_cardapio_order_v2(text,text,text,text,text,integer,text,jsonb) to anon, authenticated;

commit;

-- Deve retornar uma linha com o nome da função.
select p.proname as checkout_rpc, pg_get_function_identity_arguments(p.oid) as argumentos
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'place_cardapio_order_v2';

