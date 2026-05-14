import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import secureSession from '@fastify/secure-session';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { createHash } from 'node:crypto';
import Fastify from 'fastify';
import { config } from './config.js';
import { runMigrations } from './db/migrate.js';
import adminRoutes from './routes/admin.js';
import publicRoutes from './routes/public.js';
import uploadRoutes from './routes/upload.js';

runMigrations();

const app = Fastify({
  logger: { level: 'info' },
  bodyLimit: config.maxUploadBytes + 1024 * 1024, // 给 multipart 留余量
});

await app.register(cors, {
  origin: config.corsOrigins,
  credentials: true,
});

await app.register(cookie);

// secure-session 需要 32 字节 key
const sessionKey = Buffer.from(config.sessionSecret, 'hex');
await app.register(secureSession, {
  key: sessionKey,
  cookieName: 'rh_session',
  cookie: {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: 60 * 60 * 24 * 7,
  },
});

await app.register(multipart, {
  limits: {
    fileSize: config.maxUploadBytes,
    files: 1,
  },
});

await app.register(swagger, {
  openapi: {
    info: {
      title: 'ReleaseHub API',
      description: '热成像固件分发平台 API',
      version: '0.1.0',
    },
    components: {
      securitySchemes: {
        bearer: { type: 'http', scheme: 'bearer' },
      },
    },
  },
});

await app.register(swaggerUi, { routePrefix: '/api/docs' });

app.get('/api/health', async () => ({ ok: true, ts: Date.now() }));

await app.register(publicRoutes);
await app.register(adminRoutes);
await app.register(uploadRoutes);

app.listen({ port: config.port, host: config.host }).then((addr) => {
  app.log.info(`ReleaseHub listening on ${addr}`);
});

// 防止哈希算法 tree-shaking（保持 import 引用）
void createHash;
