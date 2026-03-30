type PrintLogRow = {
  awb_number: string | null;
  status: string;
};

export function buildLoadTestPrefix(date = new Date()) {
  return `LT-${date.toISOString().slice(0, 10)}`;
}

export function findDuplicateAwbNumbers(logs: PrintLogRow[]) {
  const counts = new Map<string, number>();

  for (const log of logs) {
    if (!log.awb_number || log.status !== "printed") {
      continue;
    }

    counts.set(log.awb_number, (counts.get(log.awb_number) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([awbNumber, count]) => ({
      awbNumber,
      count
    }));
}
