import mongoose from 'mongoose';

const brokerExecutionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    importJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ImportJob',
      default: null,
      index: true,
    },
    brokerConnectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BrokerConnection',
      default: null,
      index: true,
    },
    broker: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    executionId: { type: String, default: '' },
    orderId: { type: String, default: '' },
    executionKey: { type: String, required: true },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    instrumentKey: { type: String, required: true, index: true },
    assetType: {
      type: String,
      enum: ['equity', 'option', 'future', 'forex', 'crypto', 'other'],
      default: 'equity',
    },
    side: { type: String, enum: ['buy', 'sell'], required: true },
    quantity: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true },
    timestamp: { type: Date, required: true, index: true },
    commission: { type: Number, default: 0 },
    fees: { type: Number, default: 0 },
    multiplier: { type: Number, default: 1 },
    multiplierSource: {
      type: String,
      enum: [
        'broker',
        'contract-spec',
        'user-spec',
        'asset-default',
        'mapping',
      ],
      default: 'asset-default',
    },
    expiration: { type: Date, default: null },
    strike: { type: Number, default: null },
    optionType: { type: String, enum: ['call', 'put', null], default: null },
    positionEffect: {
      type: String,
      enum: ['open', 'close', 'unknown'],
      default: 'unknown',
    },
    status: {
      type: String,
      enum: ['filled', 'cancelled', 'rejected', 'unknown'],
      default: 'filled',
    },
    rawBrokerMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    sources: {
      type: [
        {
          _id: false,
          sourceType: { type: String, enum: ['csv', 'api'], required: true },
          importJobId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ImportJob',
            default: null,
          },
          brokerConnectionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BrokerConnection',
            default: null,
          },
        },
      ],
      default: [],
    },
    rawRowNumber: { type: Number, default: null },
    tradeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trade',
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

brokerExecutionSchema.index(
  { userId: 1, accountId: 1, broker: 1, executionKey: 1 },
  { unique: true }
);
brokerExecutionSchema.index({
  userId: 1,
  accountId: 1,
  broker: 1,
  instrumentKey: 1,
  timestamp: 1,
});

export default mongoose.model('BrokerExecution', brokerExecutionSchema);
