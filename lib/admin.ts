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
    default:
      return error ?? "Admin action failed.";
  }
}
