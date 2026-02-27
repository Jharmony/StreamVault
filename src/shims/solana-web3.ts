// Minimal stub for @solana/web3.js so that bundling works without pulling in rpc-websockets.
// StreamVault does not currently use Solana-specific functionality at runtime.
//
// Some downstream packages import symbols like `PublicKey` during build-time; we provide
// a tiny compatible surface so Rollup can bundle successfully.

export class PublicKey {
  constructor(_value?: any) {}
  toString() {
    return '';
  }
  toBase58() {
    return '';
  }
  toBuffer() {
    return new Uint8Array();
  }
  equals(_other: any) {
    return false;
  }
  static isOnCurve(_pubkey: any) {
    return false;
  }
}

export const LAMPORTS_PER_SOL = 1_000_000_000;

