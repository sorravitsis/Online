export function isValidBatchLimit(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 50;
}

export function mapAdminError(error?: string) {
  switch (error) {
    case "invalid_request":
      return "The submitted admin form payload could not be read.";
    case "store_id_required":
      return "The selected store is missing its identifier.";
    case "store_not_found":
      return "The selected store could not be found anymore. Refresh and try again.";
    case "no_store_updates_provided":
      return "No store changes were submitted.";
    case "invalid_batch_limit":
      return "Batch limit must be an integer between 1 and 50.";
    case "passwords_required":
      return "Current and new password are both required.";
    case "password_config_missing":
      return "The password hash is missing from app_config.";
    case "invalid_password":
      return "The current password is incorrect.";
    case "password_confirmation_mismatch":
      return "New password confirmation does not match.";
    case "missing_lazada_callback_params":
      return "Lazada did not return the expected authorization code and state.";
    case "invalid_lazada_state":
      return "The Lazada authorization state was rejected. Start the connection again.";
    case "lazada_token_exchange_failed":
      return "Lazada did not issue an access token for this authorization code.";
    case "lazada_seller_lookup_failed":
      return "Connected to Lazada, but the seller profile lookup did not complete.";
    case "lazada_store_connection_failed":
      return "The Lazada store connection could not be completed.";
    default:
      return error ?? "Admin action failed.";
  }
}
