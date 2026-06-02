# AWB Shopee Seller Center Automation

This unpacked Chrome extension uses the user's logged-in Chrome profile to automate Shopee Seller Center printing.

It does not contain Supabase secrets. The extension talks only to the local bridge:

```text
http://127.0.0.1:5137
```

The local bridge owns Supabase access and prints downloaded PDFs through SumatraPDF.

## Install

1. Start the local bridge with `npm run seller-center:extension-bridge`.
2. Open Chrome with the profile already logged in to Shopee Seller Center.
3. Open `chrome://extensions`.
4. Enable Developer mode.
5. Load unpacked extension from:

```text
C:\Users\Sorravit_L\Desktop\Online\extensions\shopee-seller-center-automation
```

6. Keep a Shopee Seller Center tab open.

The extension polls the bridge for queued Seller Center jobs and prints via the logged-in Chrome session.
