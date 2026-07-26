import { getProfileByHandle, handleError, methodGuard, readParam, sendJson } from '../../_streamvault-index.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res)) return;
  try {
    const profile = await getProfileByHandle(readParam(req, 'handle'));
    sendJson(res, profile ? 200 : 404, { profile });
  } catch (error) {
    handleError(res, error);
  }
}
