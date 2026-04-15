import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Plus, Copy, Trash2, RefreshCw, CheckCircle } from 'lucide-react';

interface UnlockCode {
  id: number;
  email: string;
  code: string;
  redeemed: number;
  created_at: string;
}

const App: React.FC = () => {
  const [codes, setCodes] = useState<UnlockCode[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Load codes on mount
  useEffect(() => {
    loadCodes();
  }, []);

  const loadCodes = async () => {
    try {
      const rows = await window.tasklet.sqlQuery(
        'SELECT id, email, code, redeemed, created_at FROM unlock_codes ORDER BY created_at DESC'
      );
      setCodes(rows ? (rows as unknown as UnlockCode[]) : []);
    } catch (err) {
      console.error('Failed to load codes:', err);
    }
  };

  const generateCode = async () => {
    if (!email.trim()) {
      alert('Please enter an email address');
      return;
    }

    setLoading(true);
    try {
      // Generate a random unlock code
      const code = generateRandomCode();
      
      const query = `
        INSERT INTO unlock_codes (email, code, redeemed)
        VALUES ('${email.replace(/'/g, "''")}', '${code}', 0)
      `;
      
      await window.tasklet.sqlExec(query);
      
      // Refresh the list
      await loadCodes();
      setEmail('');
      
    } catch (err) {
      console.error('Failed to generate code:', err);
      alert('Error generating code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateRandomCode = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'GOLDEN';
    for (let i = 0; i < 12; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const deleteCode = async (id: number) => {
    if (confirm('Are you sure you want to delete this code?')) {
      try {
        await window.tasklet.sqlExec(
          `DELETE FROM unlock_codes WHERE id = ${id}`
        );
        await loadCodes();
      } catch (err) {
        console.error('Failed to delete code:', err);
        alert('Error deleting code');
      }
    }
  };

  const markRedeemed = async (id: number) => {
    try {
      await window.tasklet.sqlExec(
        `UPDATE unlock_codes SET redeemed = 1 WHERE id = ${id}`
      );
      await loadCodes();
    } catch (err) {
      console.error('Failed to update code:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-yellow-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 pb-4 border-b-2 border-amber-200">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-700 via-orange-600 to-yellow-600 bg-clip-text text-transparent mb-2">
            🎂 Golden Bakery Code Manager
          </h1>
          <p className="text-amber-700/70 text-lg">
            Generate and manage unlock codes for the Golden Bakery Pass
          </p>
        </div>

        {/* Generate Code Card */}
        <div className="card bg-gradient-to-br from-amber-100 to-orange-100 shadow-lg border-2 border-amber-200 mb-8">
          <div className="card-body">
            <h2 className="card-title text-amber-900 mb-4">Generate New Code</h2>
            <div className="flex gap-3">
              <input
                type="email"
                placeholder="Customer email address"
                className="input input-bordered flex-1 bg-white border-amber-200 text-amber-950"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && generateCode()}
              />
              <button
                className={`btn bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 gap-2 ${loading ? 'loading' : ''}`}
                onClick={generateCode}
                disabled={loading}
              >
                <Plus size={18} />
                Generate
              </button>
            </div>
            <p className="text-sm text-amber-800/70 mt-2">
              Enter the customer's email, then click Generate. The code will be created and displayed below.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="stat bg-gradient-to-br from-yellow-200 to-amber-200 rounded-xl shadow-md border-2 border-yellow-300">
            <div className="stat-title text-amber-900 font-semibold">Total Codes</div>
            <div className="stat-value text-amber-700 text-3xl">{codes.length}</div>
          </div>
          <div className="stat bg-gradient-to-br from-orange-200 to-amber-200 rounded-xl shadow-md border-2 border-orange-300">
            <div className="stat-title text-amber-900 font-semibold">Unredeemed</div>
            <div className="stat-value text-orange-700 text-3xl">
              {codes.filter((c) => !c.redeemed).length}
            </div>
          </div>
          <div className="stat bg-gradient-to-br from-teal-200 to-cyan-200 rounded-xl shadow-md border-2 border-teal-300">
            <div className="stat-title text-teal-900 font-semibold">Redeemed</div>
            <div className="stat-value text-teal-700 text-3xl">
              {codes.filter((c) => c.redeemed).length}
            </div>
          </div>
        </div>

        {/* Codes Table */}
        <div className="card bg-gradient-to-br from-yellow-50 to-orange-50 shadow-lg border-2 border-amber-200">
          <div className="card-body">
            <h2 className="card-title text-amber-900 mb-4">All Codes</h2>
            {codes.length === 0 ? (
              <div className="text-center py-8 text-amber-700/60">
                No codes generated yet. Create one above to get started!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr className="border-b-2 border-amber-200 bg-gradient-to-r from-amber-100 to-orange-100">
                      <th className="text-amber-900 font-semibold">Email</th>
                      <th className="text-amber-900 font-semibold">Code</th>
                      <th className="text-amber-900 font-semibold">Created</th>
                      <th className="text-amber-900 font-semibold">Status</th>
                      <th className="text-amber-900 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map((codeItem, idx) => (
                      <tr key={codeItem.id} className={`border-b border-amber-100 hover:bg-amber-100/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-yellow-50'}`}>
                        <td className="text-amber-900/80">{codeItem.email}</td>
                        <td>
                          <code className="bg-gradient-to-r from-amber-200 to-orange-200 px-3 py-1 rounded font-mono text-sm font-semibold text-amber-900">
                            {codeItem.code}
                          </code>
                        </td>
                        <td className="text-amber-700/70 text-sm">
                          {new Date(codeItem.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          {codeItem.redeemed ? (
                            <div className="badge badge-lg bg-gradient-to-r from-teal-400 to-cyan-400 border-0 text-teal-900 gap-1">
                              <CheckCircle size={14} />
                              Redeemed
                            </div>
                          ) : (
                            <div className="badge badge-lg bg-gradient-to-r from-orange-300 to-amber-300 border-0 text-amber-900">Unused</div>
                          )}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              className={`btn btn-sm gap-1 ${
                                copied === codeItem.code 
                                  ? 'bg-teal-500 hover:bg-teal-600 text-white border-0' 
                                  : 'bg-amber-400 hover:bg-amber-500 text-white border-0'
                              }`}
                              onClick={() => copyToClipboard(codeItem.code)}
                              title="Copy code to clipboard"
                            >
                              <Copy size={14} />
                              {copied === codeItem.code ? 'Copied!' : 'Copy'}
                            </button>
                            {!codeItem.redeemed && (
                              <button
                                className="btn btn-sm bg-orange-400 hover:bg-orange-500 text-white border-0 gap-1"
                                onClick={() => markRedeemed(codeItem.id)}
                                title="Mark as redeemed"
                              >
                                <CheckCircle size={14} />
                              </button>
                            )}
                            <button
                              className="btn btn-sm bg-red-400 hover:bg-red-500 text-white border-0 gap-1"
                              onClick={() => deleteCode(codeItem.id)}
                              title="Delete code"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 p-6 bg-gradient-to-r from-teal-100 to-cyan-100 rounded-xl shadow-md border-2 border-teal-200">
          <div className="flex gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <p className="font-bold text-teal-900 text-lg">How to use:</p>
              <ol className="list-decimal list-inside text-sm mt-2 text-teal-800 space-y-1">
                <li>Enter customer email and click Generate</li>
                <li>Copy the generated code and send to the customer</li>
                <li>Customer pastes the code in the Golden Bakery Pass app to unlock</li>
                <li>Code will show as "Redeemed" once they use it</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
