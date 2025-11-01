import Stripe from "stripe";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).send("Method not allowed");

    // Ensure JSON body even if it's a string
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    if (!body) body = {};
    const cart = Array.isArray(body) ? body : Array.isArray(body.items) ? body.items : [];

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) throw new Error("Missing STRIPE_SECRET_KEY env var");

    const stripe = new Stripe(stripeSecret);

    const PRICE_ID_LOOKUP = {
      polo:    "price_1SMLAkDHOKkzOa2p6r42FbEY",
      tee:     "price_1SML6PDHOKkzOa2piiFPU3rz",
      chancla: "price_1SML1fDHOKkzOa2pBm2wCVL1",
      badge:   "price_1SML0gDHOKkzOa2pdXaUN0bO",
      cap:     "price_1SMKvxDHOKkzOa2ppXOVZnY2",
      handbag: "price_1SMKssDHOKkzOa2pfNsnt0Gn",
      purse:   "price_1SMKn9DHOKkzOa2pABVNvLaB",
      // add mugs if Buy Now used on mugs:
      // mug_white: "price_live_XXXX",
      // mug_black: "price_live_YYYY"
    };

    const line_items = cart
      .filter(i => PRICE_ID_LOOKUP[i.id])
      .map(i => ({ price: PRICE_ID_LOOKUP[i.id], quantity: Math.max(1, parseInt(i.qty || 1, 10)) }));

    if (!line_items.length) return res.status(400).send("No valid items in cart (check product IDs vs PRICE_ID_LOOKUP)");

    const origin = req.headers.origin || "https://hacheeto.com";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      billing_address_collection: "required",
      shipping_address_collection: { allowed_countries: ["US","PE","EC","MX","CA"] },
      allow_promotion_codes: true,
      success_url: `${origin}/success-store.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/products.html`,
      metadata: { store: "hacheeto" }
    });

    res.setHeader("Content-Type", "application/json");
    res.status(200).end(JSON.stringify({ id: session.id }));
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message || "Server error");
  }
}
