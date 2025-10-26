// api/stripe-webhook.js
import Stripe from "stripe";

// Vercel must receive the raw body for signature verification
export const config = { api: { bodyParser: false } };

// tiny helper to read the raw request body
async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// optional: send email via Resend API (no extra package needed)
async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY; // add in Vercel → Env Vars
  if (!key) return; // silently skip if not configured
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Hacheeto Store <orders@hacheeto.com>", // use your verified domain in Resend
      to: Array.isArray(to) ? to : [to],
      subject,
      html
    })
  });
}

export default async function handler(req, res) {
  // Only POST from Stripe
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const raw = await readRawBody(req);
    const sig = req.headers["stripe-signature"];

    // Verify event using your webhook signing secret
    const event = stripe.webhooks.constructEvent(
      raw,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // We care about successful checkout
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // Get line items with product info
      const full = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["line_items.data.price.product", "customer_details"]
      });

      const items = full.line_items?.data ?? [];
      const lines = items.map((it) => {
        const name =
          it.price?.product?.name || it.description || "Item";
        const qty = it.quantity ?? 1;
        const amount = (it.amount_total ?? 0) / 100;
        return { name, qty, amount };
      });

      const buyer = full.customer_details?.email || "";
      const total = (full.amount_total || 0) / 100;
      const currency = (full.currency || "usd").toUpperCase();

      // Build a small HTML summary
      const rows = lines
        .map(
          (l) =>
            `<tr><td>${l.name}</td><td style="text-align:center">${l.qty}</td><td style="text-align:right">$${l.amount.toFixed(
              2
            )}</td></tr>`
        )
        .join("");

      const html = `
        <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif">
          <h2>🐾 New Hacheeto Order Paid</h2>
          <p><b>Session:</b> ${session.id}</p>
          <p><b>Buyer:</b> ${buyer || "N/A"}</p>
          <table style="width:100%;border-collapse:collapse" border="1" cellpadding="6">
            <thead><tr><th align="left">Item</th><th>Qty</th><th align="right">Amount</th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><td colspan="2" align="right"><b>Total</b></td><td align="right"><b>$${total.toFixed(
              2
            )} ${currency}</b></td></tr></tfoot>
          </table>
          <p style="margin-top:12px">Ship to (if collected on Checkout): ${
            full.shipping_details?.address
              ? `${full.shipping_details.address.line1 || ""} ${
                  full.shipping_details.address.city || ""
                }`
              : "N/A"
          }</p>
        </div>
      `;

      // 1) Send to you (internal notification)
      await sendEmail({
        to: "hacheeto@gmail.com",
        subject: "✅ Hacheeto Store — Payment received",
        html
      });

      // 2) Optional: confirmation to the buyer (uncomment if desired)
      if (buyer) {
        await sendEmail({
          to: buyer,
          subject: "Thanks for your Hacheeto order! 🐾",
          html:
            `<p>Hi! Thanks for your purchase. Your order is being processed.</p>` +
            html +
            `<p>Questions? Reply to this email or WhatsApp +1 910 372-8325.</p>`
        });
      }
    }

    // Respond to Stripe quickly
    res.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
}
