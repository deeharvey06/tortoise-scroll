import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Single-document settings store (there is only ever one). DB settings
 * take priority over .env defaults set at startup, so the person can
 * change providers from the UI without restarting the server. The API key
 * is never returned to the client in full — see aiController's masking.
 */
const aiSettingsSchema = new Schema(
  {
    provider: { type: String, enum: ['disabled', 'openai', 'ollama'], default: 'disabled' },
    openaiApiKey: { type: String, default: '' },
    openaiModel: { type: String, default: 'gpt-4o-mini' },
    ollamaBaseUrl: { type: String, default: 'http://localhost:11434' },
    ollamaModel: { type: String, default: 'llama3.1' },
    temperature: { type: Number, default: 0.3, min: 0, max: 1 },
  },
  { timestamps: true }
);

export default mongoose.model('AISettings', aiSettingsSchema);
