// /api/stripe-webhook.js
import Stripe from "stripe";

// Stripe needs the raw body for signature verification
export const config = { api: { bodyParser: false } };

// read raw request body
async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// optional email via Resend (no extra package required on Vercel)
async function sendEmail({ to, subject, html }) {
  try {
    const key = process.env.RESEND_API_KEY; // set in Vercel if you want emails
    if (!key) return; // silently skip if not configured

    // Vercel runtimes have fetch. Use a simple POST.
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Hacheeto Store <orders@hacheeto.com>", // must be verified in Resend
        to: Array.isArray(to) ? to : [to],
        subject,
        html
      })
    });

    // don't throw if email fails; log only
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      console.warn("Resend email non-200:", resp.status, txt);
    }
  } catch (e) {
    console.warn("Resend email error:", e?.message || e);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const raw = await readRawBody(req);
    const sig = req.headers["stripe-signature"];

    const event = stripe.webhooks.constructEvent(
      raw,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // expand line items + customer details so email shows real names
      const full = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["line_items.data.price.product", "customer_details", "shipping_details"]
      });

      const items = full.line_items?.data ?? [];
      const lines = items.map((it) => {
        const name = it.price?.product?.name || it.description || "Item";
        const qty = it.quantity ?? 1;
        const amount = (it.amount_total ?? 0) / 100;
        return { name, qty, amount };
      });

      const buyer = full.customer_details?.email || "";
      const total = (full.amount_total || 0) / 100;
      const currency = (full.currency || "usd").toUpperCase();

      const rows = lines.map(
        (l) =>
          `<tr><td>${l.name}</td><td style="text-align:center">${l.qty}</td><td style="text-align:right">$${l.amount.toFixed(2)}</td></tr>`
      ).join("");

      const addr = full.shipping_details?.address;
      const shipTo = addr
        ? [
            addr.line1, addr.line2,
            [addr.city, addr.state].filter(Boolean).join(", "),
            addr.postal_code, addr.country
          ].filter(Boolean).join(" · ")
        : "N/A";

      const html = `
        <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif">
          <h2>🐾 New Hacheeto Order Paid</h2>
          <p><b>Session:</b> ${session.id}</p>
          <p><b>Buyer:</b> ${buyer || "N/A"}</p>
          <table style="width:100%;border-collapse:collapse" border="1" cellpadding="6">
            <thead><tr><th align="left">Item</th><th>Qty</th><th align="right">Amount</th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><td colspan="2" align="right"><b>Total</b></td><td align="right"><b>$${total.toFixed(2)} ${currency}</b></td></tr></tfoot>
          </table>
          <p style="margin-top:12px"><b>Ship to:</b> ${shipTo}</p>
        </div>
      `;

      // 1) Internal notification (FIXED: missing comma here previously)
      await sendEmail({
        to: ["info@hacheeto.com", "parisd@hacheeto.com"],
        subject: "✅ Hacheeto Store — Payment received",
        html
      });

      // 2) Optional buyer confirmation
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

    // Always ack Stripe quickly
    res.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
}
