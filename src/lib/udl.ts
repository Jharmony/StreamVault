export type UdlAiUse = 'allow-train' | 'allow-generate' | 'deny';

export type UdlInterval = 'one-time' | 'per-stream' | 'per-download' | 'per-month';
export type UdlCommercialUse =
  | 'Allowed'
  | 'Allowed-With-Credit'
  | 'Allowed-With-RevenueShare'
  | 'Allowed-With-Fee-One-Time'
  | 'Allowed-With-Fee-Monthly';
export type UdlDerivation =
  | 'Allowed'
  | 'Allowed-With-Credit'
  | 'Allowed-With-Indication'
  | 'Allowed-With-License-Passthrough'
  | 'Allowed-With-RevenueShare'
  | 'Allowed-With-Fee-One-Time'
  | 'Allowed-With-Fee-Monthly';
export type UdlDataModelTraining = 'Allowed' | 'Allowed-With-Fee-One-Time' | 'Allowed-With-Fee-Monthly';
export type UdlUnknownUsageRights = 'Excluded';
export type UdlPaymentMode = 'Random-Distribution' | 'Global-Distribution';

export const UDL_LICENSE_TX_ID = 'dE0rmDfl9_OWjkDznNEXHaSO_JohJkRolvMzaCroUdw';
export const LEGACY_STREAMVAULT_UDL_LICENSE_ID = 'udl://music/1.0';
export const UDL_LICENSE_URL = `https://turbo-gateway.com/${UDL_LICENSE_TX_ID}`;

/**
 * Minimal UDL configuration stored in atomic asset metadata and mirrored in tags.
 * This intentionally stays string-based so it round-trips cleanly through Arweave tags.
 */
export interface UdlConfig {
  /** Arweave tx id for the UDL license document. */
  licenseId: string;
  /** Arweave tx id (ar://...) or https URL for full license text */
  uri?: string;
  /** Allowed usages such as stream, download, commercial-sync, remix */
  usage: string[];
  /** Whether and how AI systems may use this track */
  aiUse: UdlAiUse;
  /** Numeric fee as a string (e.g. '0', '1', '5') */
  fee: string;
  /** Currency code, e.g. 'U', 'MATIC', 'USDC.base', 'AR' */
  currency: string;
  /** Primary address that receives license fees. Detailed splits are mirrored in Royalties-Splits. */
  paymentAddress?: string;
  /** How payment should be distributed when a PST or split-aware contract is attached. */
  paymentMode?: UdlPaymentMode;
  /** How often the fee applies (per-stream, per-download, etc.) */
  interval: UdlInterval;
  /** UDL commercial-use parameter. Omit to disallow by default. */
  commercialUse?: UdlCommercialUse;
  /** UDL derivation parameter. Omit to disallow commercial derivations by default. */
  derivation?: UdlDerivation;
  /** UDL data-model-training parameter. Omit to disallow by default. */
  dataModelTraining?: UdlDataModelTraining;
  /** UDL unknown usage rights parameter. Omit to include unknown rights where available. */
  unknownUsageRights?: UdlUnknownUsageRights;
  /** UDL expiry in years. Omit for unlimited term. */
  expiryYears?: string;
  /** Whether attribution is required when using the work */
  attribution?: 'required' | 'optional';
  /** Optional human-readable jurisdiction or notes */
  jurisdiction?: string;
}

export type RoyaltyChain = 'arweave' | 'ethereum' | 'base' | 'polygon' | 'solana';

export interface RoyaltySplit {
  /** Recipient address on the target chain */
  address: string;
  /** Share of the payout in basis points (10_000 = 100%) */
  shareBps: number;
  /** Chain on which royalties are expected to be settled */
  chain: RoyaltyChain;
  /** Token symbol or identifier, e.g. 'U', 'MATIC', 'USDC.base', 'AR' */
  token: string;
}

function normalizedLicenseId(licenseId?: string): string {
  const value = String(licenseId || '').trim();
  if (!value || value === LEGACY_STREAMVAULT_UDL_LICENSE_ID) return UDL_LICENSE_TX_ID;
  return value;
}

function feeMode(interval: UdlInterval): 'One-Time' | 'Monthly' {
  return interval === 'per-month' ? 'Monthly' : 'One-Time';
}

function standardFeeValue(udl: UdlConfig): string {
  const fee = String(udl.fee || '0').trim() || '0';
  return `${feeMode(udl.interval)}-${fee}`;
}

function dataModelTrainingValue(udl: UdlConfig): string | null {
  if (udl.dataModelTraining) return udl.dataModelTraining;
  if (udl.aiUse === 'deny') return null;
  return 'Allowed';
}

function commercialUseValue(udl: UdlConfig): string | null {
  if (udl.commercialUse) return udl.commercialUse;
  return udl.usage.includes('commercial-sync') ? 'Allowed' : null;
}

function derivationValue(udl: UdlConfig): string | null {
  if (udl.derivation) return udl.derivation;
  return udl.usage.includes('remix') ? 'Allowed-With-Credit' : null;
}

/** Arweave transaction tags mirroring UDL fields (used on data txs and atomic assets). */
export function udlConfigToTags(udl: UdlConfig): { name: string; value: string }[] {
  const accessFee = standardFeeValue(udl);
  const commercialUse = commercialUseValue(udl);
  const derivations = derivationValue(udl);
  const dataModelTraining = dataModelTrainingValue(udl);
  return [
    { name: 'License', value: normalizedLicenseId(udl.licenseId) },
    { name: 'License-URI', value: udl.uri || UDL_LICENSE_URL },
    { name: 'Access', value: 'Public' },
    { name: 'Access-Fee', value: accessFee },
    { name: 'License-Fee', value: accessFee },
    { name: 'Currency', value: udl.currency },
    ...(udl.paymentAddress ? [{ name: 'Payment-Address', value: udl.paymentAddress }] : []),
    ...(udl.paymentAddress ? [{ name: 'Payment-Mode', value: udl.paymentMode || 'Global-Distribution' }] : []),
    ...(commercialUse ? [{ name: 'Commercial-Use', value: commercialUse }] : []),
    ...(derivations
      ? [
          { name: 'Derivation', value: derivations },
          { name: 'Derivations', value: derivations },
        ]
      : []),
    ...(dataModelTraining ? [{ name: 'Data-Model-Training', value: dataModelTraining }] : []),
    ...(udl.unknownUsageRights ? [{ name: 'Unknown-Usage-Rights', value: udl.unknownUsageRights }] : []),
    ...(udl.expiryYears ? [{ name: 'Expiry', value: udl.expiryYears }] : []),
    { name: 'License-Use', value: udl.usage.join(',') },
    { name: 'License-AI-Use', value: udl.aiUse },
    { name: 'License-Fee-Unit', value: udl.interval },
    { name: 'License-Currency', value: udl.currency },
    ...(udl.paymentAddress ? [{ name: 'License-Fee-Recipient', value: udl.paymentAddress }] : []),
    ...(udl.attribution ? [{ name: 'License-Attribution', value: udl.attribution }] : []),
    ...(udl.jurisdiction ? [{ name: 'License-Jurisdiction', value: udl.jurisdiction }] : []),
  ];
}
