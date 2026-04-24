// netlify/functions/create-payment.js
// Maakt een Mollie betaling aan en geeft de checkout URL terug

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { amount, description, orderId, tableNum, redirectUrl } = JSON.parse(event.body);

    // Mollie API key — sla op als Netlify environment variable: MOLLIE_API_KEY
    // Voor test: test_AnPEa5S3FxCGv6tpcj58bEsuJ92byC
    const MOLLIE_KEY = process.env.MOLLIE_API_KEY || 'test_AnPEa5S3FxCGv6tpcj58bEsuJ92byC';

    const webhookUrl = `${process.env.URL || 'https://taporder.netlify.app'}/.netlify/functions/payment-webhook`;

    const response = await fetch('https://api.mollie.com/v2/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MOLLIE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: {
          currency: 'EUR',
          value: Number(amount).toFixed(2)
        },
        description: description || `Bestelling Tafel ${tableNum}`,
        redirectUrl: redirectUrl,
        webhookUrl: webhookUrl,
        metadata: {
          orderId: String(orderId),
          tableNum: String(tableNum)
        },
        method: ['bancontact', 'creditcard', 'ideal']
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Mollie error:', err);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Mollie fout: ' + err })
      };
    }

    const payment = await response.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId: payment.id,
        checkoutUrl: payment._links.checkout.href,
        status: payment.status
      })
    };

  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
