import mongoose from 'mongoose';
const brokerAuthorizationStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: { type: String, required: true, lowercase: true },
    connectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BrokerConnection',
      default: null,
    },
    stateHash: { type: String, required: true, unique: true },
    sessionHash: { type: String, required: true },
    redirectUri: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
export default mongoose.model(
  'BrokerAuthorizationState',
  brokerAuthorizationStateSchema
);
