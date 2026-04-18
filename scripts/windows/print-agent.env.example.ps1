# Copy this file to `print-agent.env.ps1` and fill in the real values.
# `print-agent.env.ps1` is gitignored — it holds the service-role key and is
# dot-sourced by print-agent-start.ps1 at task launch.

$env:NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<service-role-jwt>"
$env:LOCAL_PRINT_AGENT_NAME="warehouse-deli-01"
$env:LOCAL_PRINTER_NAME="Deli 750W (Copy 2)"
$env:PRINT_AGENT_INTERVAL_MS="3000"
$env:SUMATRA_PDF_PATH="C:\Users\<user>\AppData\Local\SumatraPDF\SumatraPDF.exe"

# Override Sumatra with paper=fit to handle label printer paper size mismatch.
# Without "fit", SumatraPDF silently fails (exit code 1) on thermal label printers.
$env:PDF_PRINT_COMMAND='& "C:\Users\<user>\AppData\Local\SumatraPDF\SumatraPDF.exe" -print-to "{printer}" -print-settings "fit" -silent -exit-on-print "{file}"'
