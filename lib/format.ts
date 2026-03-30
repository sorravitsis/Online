import type { OrderStatus } from "@/lib/types";

export function formatOrderStatus(status: OrderStatus) {
  switch (status) {
    case "pending":
      return "Pending";
    case "printing":
      return "Printing";
    case "printed":
      return "Printed";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}
