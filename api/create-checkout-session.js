 
// /api/create-checkout-session.js
import Stripe from "stripe";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const cart = req.body || [];

    // 🔗 Replace "price_xxx" with your real Stripe Price IDs
 const PRICE_ID_LOOKUP = {
  polo:    "price_1SMLAkDHOKkzOa2p6r42FbEY", // Hacheeto Polo ($39)
  tee:     "price_1SML6PDHOKkzOa2piiFPU3rz", // Hacheeto “Club” Tee Shirt ($29)
  chancla: "price_1SML1fDHOKkzOa2pBm2wCVL1", // Hacheeto Flip-Flops ($22)
  badge:   "price_1SML0gDHOKkzOa2pdXaUN0bO", // Hacheeto Badge ($8)
  cap:     "price_1SMKvxDHOKkzOa2ppXOVZnY2", // Hacheeto Baseball Cap ($24)
  handbag: "price_1SMKssDHOKkzOa2pfNsnt0Gn", // Hacheeto Handbag ($59)
  purse:   "price_1SMKn9DHOKkzOa2pABVNvLaB", // Hacheeto Purse ($39)
};


    const line_items = cart
      .filter(i => PRICE_ID_LOOKUP[i.id])
      .map(i => ({
        price: PRICE_ID_LOOKUP[i.id],
        quantity: Math.max(1, parseInt(i.qty || 1, 10)),
      }));

    if (!line_items.length) {
      return res.status(400).send("No valid items in cart");
    }

    const origin = req.headers.origin || "https://hacheeto.com";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      billing_address_collection: "required",
      shipping_address_collection: {
        allowed_countries: ["US", "PE", "EC", "MX", "CA"], // adjust as needed
      },
      allow_promotion_codes: true,
      success_url: `${origin}/success-store.html?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url: `${origin}/cancel.html`,
      metadata: { store: "hacheeto" },
    });

    return res.status(200).json({ id: session.id });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || "Server error");
  }
}
