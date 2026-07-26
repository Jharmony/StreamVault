import { handleError, methodGuard, readQuery, searchProfiles, sendJson } from '../_streamvault-index.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res)) return;
  try {
    const profiles = await searchProfiles(readQuery(req, 'q'), readQuery(req, 'limit'));
    sendJson(res, 200, { profiles });
  } catch (error) {
    handleError(res, error);
  }
}
