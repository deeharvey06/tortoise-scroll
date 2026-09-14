import mongoose from 'mongoose';

const accountMappingSchema = new mongoose.Schema(
  {
    providerAccountId: { type: String, required: true },
    providerAccountNumberMasked: { type: String, default: '' },
    providerAccountName: { type: String, default: '' },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
  },
  { _id: false }
);

const encryptedSecretSchema = new mongoose.Schema(
  {
    keyId: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    ciphertext: { type: String, required: true },
  },
  { _id: false }
);

const brokerConnectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        'connecting',
        'connected',
        'syncing',
        'attention_required',
        'authorization_expired',
        'rate_limited',
        'provider_unavailable',
        'disconnected',
      ],
      default: 'connecting',
      index: true,
    },
    accessTokenEncrypted: { type: encryptedSecretSchema, default: null },
    refreshTokenEncrypted: { type: encryptedSecretSchema, default: null },
    tokenExpiresAt: { type: Date, default: null },
    grantedScopes: [{ type: String }],
    providerMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    accountMappings: { type: [accountMappingSchema], default: [] },
    syncCheckpoint: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastSuccessfulSyncAt: { type: Date, default: null },
    lastAttemptedSyncAt: { type: Date, default: null },
    nextSyncAt: { type: Date, default: null, index: true },
    lastError: {
      code: { type: String, default: '' },
      category: { type: String, default: '' },
      message: { type: String, default: '' },
      at: { type: Date, default: null },
    },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

brokerConnectionSchema.index({ userId: 1, provider: 1, createdAt: -1 });
brokerConnectionSchema.index({ userId: 1, 'accountMappings.accountId': 1 });

export default mongoose.model('BrokerConnection', brokerConnectionSchema);
