import net from "node:net";
import { env } from "@/lib/env";

export async function printZPL(zpl: string): Promise<void> {
  const host = env.printer.host();
  const port = env.printer.port();

  await new Promise<void>((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    function finalize(error?: Error) {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();

      if (error) {
        reject(error);
      } else {
        resolve();
      }
    }

    socket.setTimeout(5000);
    socket.once("error", (error) => {
      finalize(new Error(`Printer connection failed: ${error.message}`));
    });
    socket.once("timeout", () => {
      finalize(new Error("Printer connection timed out."));
    });
    socket.connect(port, host, () => {
      socket.write(zpl, (error) => {
        if (error) {
          finalize(new Error(`Printer write failed: ${error.message}`));
          return;
        }

        socket.end(() => finalize());
      });
    });
  });
}
