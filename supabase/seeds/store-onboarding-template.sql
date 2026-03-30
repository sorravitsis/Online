-- Store onboarding template
-- Replace placeholder values before running in Supabase SQL Editor.

insert into stores (
  name,
  platform,
  shop_id,
  access_token,
  refresh_token,
  token_expiry,
  batch_limit,
  is_active
)
values
  (
    'Shopee Store 01',
    'shopee',
    'replace-shop-id',
    'replace-access-token',
    'replace-refresh-token',
    now() + interval '7 days',
    20,
    true
  );
