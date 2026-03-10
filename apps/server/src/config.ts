import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
  },
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
};
