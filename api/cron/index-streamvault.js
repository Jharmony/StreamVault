import { runStreamVaultSupabaseIndexer } from '../../tools/index-streamvault-supabase.mjs';

export const config = {
  maxDuration: 60,
};

function applyHeaders(res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
}

function isAuthorized(req) {
  const secret = process.env.STREAMVAULT_INDEX_CRON_SECRET || process.env.CRON_SECRET || '';
  if (!secret) return true;
  return req.headers.authorization === `Bearer ${secret}`;
}

export default async function handler(req, res) {
  applyHeaders(res);
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const startedAt = Date.now();
  try {
    const result = await runStreamVaultSupabaseIndexer({
      loadEnv: false,
      limit: req.query?.limit || process.env.STREAMVAULT_INDEX_LIMIT || '100',
    });
    res.status(200).json({
      ...result,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error?.message || 'StreamVault index refresh failed.',
      durationMs: Date.now() - startedAt,
    });
  }
}
