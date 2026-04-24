// netlify/functions/payment-webhook.js
// Ontvangt betalingsbevestiging van Mollie en updatet Supabase

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 200, body: 'OK' };
  }

  try {
    const params = new URLSearchParams(event.body);
    const paymentId = params.get('id');

    if (!paymentId) {
      return { statusCode: 200, body: 'No payment ID' };
    }

    const MOLLIE_KEY = process.env.MOLLIE_API_KEY || 'test_AnPEa5S3FxCGv6tpcj58bEsuJ92byC';
    const SB_URL = process.env.SUPABASE_URL || 'https://ouqqbrcstyhzoymrwvld.supabase.co';
    const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91cXFicmNzdHloem95bXJ3dmxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NTM0NTMsImV4cCI6MjA5MjUyOTQ1M30.81i_ykk1fGRBR4NuPNWN-TWp7aUbiOlkzRJjrfcocBM';

    // Haal betaling op bij Mollie
    const mollieRes = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${MOLLIE_KEY}` }
    });

    if (!mollieRes.ok) {
      console.error('Could not fetch payment from Mollie');
      return { statusCode: 200, body: 'OK' };
    }

    const payment = await mollieRes.json();
    const orderId = payment.metadata?.orderId;
    const mollieStatus = payment.status; // paid, pending, failed, canceled, expired

    if (!orderId) {
      return { statusCode: 200, body: 'No order ID in metadata' };
    }

    // Map Mollie status naar onze payment_status
    const paymentStatus = mollieStatus === 'paid' ? 'betaald' : mollieStatus;

    // Update order in Supabase
    const updateRes = await fetch(
      `${SB_URL}/rest/v1/orders?mollie_id=eq.${paymentId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ payment_status: paymentStatus })
      }
    );

    // Ook updaten op order ID als mollie_id nog niet gezet was
    if (orderId) {
      await fetch(
        `${SB_URL}/rest/v1/orders?id=eq.${orderId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': SB_KEY,
            'Authorization': `Bearer ${SB_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            payment_status: paymentStatus,
            mollie_id: paymentId
          })
        }
      );
    }

    console.log(`Payment ${paymentId} for order ${orderId}: ${mollieStatus}`);
    return { statusCode: 200, body: 'OK' };

  } catch (err) {
    console.error('Webhook error:', err);
    return { statusCode: 200, body: 'OK' }; // Altijd 200 terugsturen aan Mollie
  }
};
