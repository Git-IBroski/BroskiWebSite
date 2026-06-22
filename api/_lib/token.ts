import { createHash } from 'node:crypto';

/**
 * Token hashing utility for the Records_API.
 *
 * The raw Secret_Player_Token is never stored. Instead we store the SHA-256 hex
 * digest of the token in `dtt_players.token_hash` (UNIQUE), and look players up
 * by hashing the incoming token on every request. A single SHA-256 over a
 * high-entropy (>=128-bit) random token gives O(1) indexed lookup while keeping
 * tokens protected at rest.
 *
 * Design ref: "Token storage decision" (Requirements 5.3, 5.8, 10.1).
 *
 * @param rawToken the plaintext Secret_Player_Token supplied by the client
 * @returns the lowercase SHA-256 hex digest of the token
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}
