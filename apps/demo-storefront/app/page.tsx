import { PurchaseFlow } from "./PurchaseFlow";
import { DEMO_PRODUCT } from "./product";

export default function HomePage() {
  return (
    <main>
      <p style={{ opacity: 0.7, fontSize: "0.85em" }}>FiberGate demo storefront</p>
      <h1>{DEMO_PRODUCT.name}</h1>
      <p>{DEMO_PRODUCT.description}</p>
      <p style={{ fontSize: "1.5em", fontWeight: 600 }}>{DEMO_PRODUCT.amountCkb} CKB</p>
      <PurchaseFlow />
    </main>
  );
}
