"use server";

import { InvoiceAsset, type Invoice } from "@fibergate/sdk";

import { getGateway } from "@/lib/gateway";
import { DEMO_PRODUCT } from "./product";

/**
 * Creates a real invoice via `@fibergate/sdk`, i.e. a genuine HTTP call to
 * this deployment's `POST /api/v1/invoices` — the same call any third-party
 * merchant app integrating FiberGate would make.
 */
export async function createDemoInvoice(): Promise<Invoice> {
  const gateway = getGateway();
  return gateway.invoices.create({
    amount: DEMO_PRODUCT.amountCkb,
    asset: InvoiceAsset.CKB,
    description: DEMO_PRODUCT.name,
    metadata: { demo: true, product: DEMO_PRODUCT.name },
  });
}
