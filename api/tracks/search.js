import { handleError, methodGuard, readQuery, searchTracks, sendJson } from '../_streamvault-index.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res)) return;
  try {
    const tracks = await searchTracks(readQuery(req, 'q'), readQuery(req, 'limit'));
    sendJson(res, 200, { tracks });
  } catch (error) {
    handleError(res, error);
  }
}
