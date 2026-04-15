/**
 * Golden Bakery Code Manager - Cloudflare Worker
 * 
 * This worker handles the backend API for managing unlock codes.
 * It uses Cloudflare D1 (SQLite) database for storage.
 * 
 * Endpoints:
 * - GET /api/codes - List all codes
 * - POST /api/codes - Create a new code
 * - PATCH /api/codes/:id - Update a code (mark as redeemed)
 * - DELETE /api/codes/:id - Delete a code
 */

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

// Initialize database schema
async function initDatabase(env, corsHeaders) {
  try {
    // Create table with proper SQL syntax
    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS unlock_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        redeemed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    return new Response(JSON.stringify({ message: 'Database initialized' }), {
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
    ).bind(redeemed, id).run();

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

// Serve index.html
async function getIndexHTML() {
  // This is a placeholder - in production, you'd either:
  // 1. Serve static files from Cloudflare Pages
  // 2. Embed the HTML content here
  // 3. Fetch from external storage
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Golden Bakery Code Manager</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
    <div class="flex items-center justify-center min-h-screen bg-amber-50">
        <div class="text-center">
            <h1 class="text-4xl font-bold text-amber-700 mb-4">🎂 Golden Bakery Code Manager</h1>
            <p class="text-amber-600 mb-4">Worker is running! The HTML file should be served from Cloudflare Pages.</p>
            <p class="text-gray-600">If using this Worker alone, embed index.html content in the worker.js file.</p>
        </div>
    </div>
</body>
</html>`;
}
