-- 제주 장바구니 스키마: Supabase > SQL Editor 에 붙여넣고 Ctrl+Enter

create table if not exists public.products (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  price integer not null check (price >= 0),
  image_query text,
  created_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

alter table public.products enable row level security;
alter table public.cart_items enable row level security;

drop policy if exists "products are public" on public.products;
create policy "products are public" on public.products
  for select using (true);

drop policy if exists "own cart select" on public.cart_items;
create policy "own cart select" on public.cart_items
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own cart insert" on public.cart_items;
create policy "own cart insert" on public.cart_items
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "own cart update" on public.cart_items;
create policy "own cart update" on public.cart_items
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own cart delete" on public.cart_items;
create policy "own cart delete" on public.cart_items
  for delete to authenticated using (auth.uid() = user_id);

insert into public.products (name, description, price, image_query)
select * from (values
  ('한라봉 3kg',      '새콤달콤 제주 한라봉',        25000, 'dekopon orange'),
  ('감귤 5kg',        '노지 감귤 한 박스',            18000, 'jeju tangerine'),
  ('흑돼지 구이 세트', '제주 흑돼지 오겹살 600g',     42000, 'black pork bbq'),
  ('제주 녹차 선물세트','오설록 스타일 녹차 티백',     15000, 'green tea'),
  ('돌하르방 기념품',  '손바닥 크기 돌하르방',          9000, 'dol hareubang'),
  ('유채꿀 500g',      '봄 유채꽃에서 얻은 꿀',        16000, 'canola honey')
) as v(name, description, price, image_query)
where not exists (select 1 from public.products);
