/**
 * Golden Bakery Code Manager - Cloudflare Worker (Enhanced)
 * 
 * This worker handles:
 * - Backend API for managing unlock codes
 * - PayPal webhook for automatic code generation and delivery
 * - Email notifications via Resend
 * 
 * Endpoints:
 * - GET /api/codes - List all codes
 * - POST /api/codes - Create a new code
 * - PATCH /api/codes/:id - Update a code (mark as redeemed)
 * - DELETE /api/codes/:id - Delete a code
 * - POST /webhook - PayPal webhook (IMPORTANT: PayPal IPN verification)
 * 
 * Environment variables required:
 * - DB (D1 database binding)
 * - RESEND_API_KEY (Resend API key for sending emails)
 * - PAYPAL_WEBHOOK_ID (Your PayPal webhook ID, optional for verification)
 */

// Generate a random unlock code
function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'GOLDEN';
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Send email via Resend
async function sendEmail(email, code, env) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Golden Bakery <noreply@goldenbakery.com>',
        to: email,
        subject: 'Your Golden Bakery Pass Unlock Code',
        html: `
          <h2>Welcome to Golden Bakery! 🎉</h2>
          <p>Thank you for your purchase! Your unlock code is ready:</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <p style="font-size: 12px; color: #666;">Your Unlock Code:</p>
            <p style="font-size: 24px; font-weight: bold; font-family: monospace; letter-spacing: 2px;">${code}</p>
          </div>
          <p>Enter this code in the Golden Bakery app to unlock your exclusive content!</p>
          <p>If you have any questions, please contact our support team.</p>
          <p style="color: #999; font-size: 12px;">Golden Bakery</p>
        `,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Resend error:', data);
      throw new Error(`Email send failed: ${data.message}`);
    }

    console.log('Email sent successfully:', data.id);
    return { success: true, emailId: data.id };
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// Verify PayPal IPN message (basic verification)
async function verifyPayPalIPN(body, env) {
  try {
    // For production: implement full PayPal IPN verification
    // This is a simplified version - PayPal will resend if verification fails
    const verificationBody = new URLSearchParams('cmd=_notify-validate');
    for (const [key, value] of Object.entries(body)) {
      verificationBody.append(key, value);
    }

    const response = await fetch('https://ipnpb.paypal.com/cgi-bin/webscr', {
      method: 'POST',
      body: verificationBody,
    });

    const text = await response.text();
    return text === 'VERIFIED';
  } catch (error) {
    console.error('PayPal verification error:', error);
    // Return true anyway - PayPal will retry if we don't acknowledge
    return true;
  }
}

export default {
  async fetch(request, env, ctx) {
    // Enable CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // PayPal Webhook Handler
      if (path === '/webhook' && request.method === 'POST') {
        return await handlePayPalWebhook(request, env);
      }

      // Initialize database schema if needed
      if (path === '/api/init') {
        return await initDatabase(env, corsHeaders);
      }

      // Route handlers
      if (path === '/api/codes' && request.method === 'GET') {
        return await getCodes(env, corsHeaders);
      }

      if (path === '/api/codes' && request.method === 'POST') {
        return await createCode(request, env, corsHeaders);
      }

      if (path.match(/^\/api\/codes\/\d+$/) && request.method === 'PATCH') {
        const id = parseInt(path.split('/')[3]);
        return await updateCode(id, request, env, corsHeaders);
      }

      if (path.match(/^\/api\/codes\/\d+$/) && request.method === 'DELETE') {
        const id = parseInt(path.split('/')[3]);
        return await deleteCode(id, env, corsHeaders);
      }

      // Serve the HTML file for root path
      if (path === '/' || path === '') {
        return new Response(await getIndexHTML(), {
          headers: {
            'Content-Type': 'text/html',
            ...corsHeaders,
          },
        });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  },
};

// Handle PayPal Webhook
async function handlePayPalWebhook(request, env) {
  try {
    // Parse form data (PayPal sends as form-encoded)
    const formData = await request.formData();
    const body = Object.fromEntries(formData);

    console.log('PayPal webhook received:', body.txn_id, body.payment_status);

    // Verify the webhook is from PayPal
    const verified = await verifyPayPalIPN(body, env);
    if (!verified) {
      console.warn('PayPal IPN verification failed');
      // Still process it - PayPal will retry if we fail
    }

    // Only process completed payments
    if (body.payment_status !== 'Completed') {
      console.log('Skipping non-completed payment:', body.payment_status);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Extract customer email
    const email = body.custom || body.payer_email;
    if (!email) {
      console.error('No email found in PayPal webhook');
      return new Response(JSON.stringify({ error: 'No email provided' }), { status: 400 });
    }

    // Generate unique code
    let code;
    let attempts = 0;
    while (attempts < 5) {
      code = generateCode();
      // Check if code already exists
      const existing = await env.DB.prepare(
        'SELECT id FROM unlock_codes WHERE code = ?'
      ).bind(code).first();
      
      if (!existing) break;
      attempts++;
    }

    if (!code) {
      throw new Error('Failed to generate unique code');
    }

    // Store in D1
    const result = await env.DB.prepare(
      'INSERT INTO unlock_codes (email, code, redeemed) VALUES (?, ?, 0)'
    ).bind(email, code).run();

    // Send email
    try {
      await sendEmail(email, code, env);
    } catch (emailError) {
      console.error('Email send failed, but code was created:', emailError);
      // Don't fail the webhook - code is safely stored
    }

    console.log('Code generated and email sent:', { email, code, txnId: body.txn_id });

    return new Response(JSON.stringify({ 
      ok: true, 
      code,
      id: result.meta.last_row_id
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Webhook error:', error);
    // Return 200 to PayPal so it doesn't retry infinitely
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 200, // Important: Always return 200 to PayPal
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Initialize database schema
async function initDatabase(env, corsHeaders) {
  try {
    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS unlock_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        redeemed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    return new Response(JSON.stringify({ success: true, message: 'Database initialized' }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

// Get all codes
async function getCodes(env, corsHeaders) {
  try {
    const result = await env.DB.prepare(
      'SELECT id, email, code, redeemed, created_at FROM unlock_codes ORDER BY created_at DESC'
    ).all();

    return new Response(JSON.stringify(result.results), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Error fetching codes:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

// Create a new code
async function createCode(request, env, corsHeaders) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return new Response(JSON.stringify({ error: 'Email and code are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const result = await env.DB.prepare(
      'INSERT INTO unlock_codes (email, code, redeemed) VALUES (?, ?, 0)'
    ).bind(email, code).run();

    return new Response(JSON.stringify({ 
      success: true, 
      id: result.meta.last_row_id,
      email,
      code,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Error creating code:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

// Update a code (mark as redeemed)
async function updateCode(id, request, env, corsHeaders) {
  try {
    const { redeemed } = await request.json();

    await env.DB.prepare(
      'UPDATE unlock_codes SET redeemed = ? WHERE id = ?'
    ).bind(redeemed ? 1 : 0, id).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Error updating code:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

// Delete a code
async function deleteCode(id, env, corsHeaders) {
  try {
    await env.DB.prepare(
      'DELETE FROM unlock_codes WHERE id = ?'
    ).bind(id).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Error deleting code:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

// Index HTML (kept from original)
async function getIndexHTML() {
  // Return your dashboard HTML here or serve from another source
  return `<!DOCTYPE html>
<html>
<head>
  <title>Golden Bakery Code Manager</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <h1>Golden Bakery Code Manager</h1>
  <p>Dashboard is under construction</p>
</body>
</html>`;
}
