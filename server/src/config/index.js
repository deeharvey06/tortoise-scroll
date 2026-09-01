const config = {
  port: Number(process.env.PORT || 5050),
  mongoUri:
    process.env.MONGO_URI || 'mongodb://localhost:27017/trading-journal',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'tortoise-scroll-local-dev-secret',
  nodeEnv: process.env.NODE_ENV || 'development',
};

export function getConfig() {
  return { ...config };
}

export default config;
