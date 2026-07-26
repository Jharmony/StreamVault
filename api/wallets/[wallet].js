import { getProfileByWallet, handleError, methodGuard, readParam, sendJson } from '../_streamvault-index.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res)) return;
  try {
    const profile = await getProfileByWallet(readParam(req, 'wallet'));
    sendJson(res, profile ? 200 : 404, { profile });
  } catch (error) {
    handleError(res, error);
  }
}
