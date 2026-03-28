import Fastify from 'fastify';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { Server as SocketIOServer } from 'socket.io';
import { appRouter } from './trpc/router.js';
import { createContext } from './trpc/context.js';
import { redis } from './lib/redis.js';

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '0.0.0.0';
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
    maxParamLength: 5000,
  });

  await fastify.register(cors, {
    origin: CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await fastify.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
    },
  });

  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return fastify;
}

async function main() {
  const fastify = await buildServer();

  const io = new SocketIOServer(fastify.server, {
    cors: {
      origin: CORS_ORIGIN.split(','),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    const { worldId } = socket.handshake.query;
    if (typeof worldId === 'string') {
      socket.join(`world:${worldId}`);
    }

    socket.on('player:move', (data) => {
      if (typeof worldId === 'string') {
        socket.to(`world:${worldId}`).emit('player:update', {
          id: socket.id,
          ...data,
        });
      }
    });

    socket.on('player:action', (data) => {
      if (typeof worldId === 'string') {
        socket.to(`world:${worldId}`).emit('player:action', {
          id: socket.id,
          ...data,
        });
      }
    });

    socket.on('chat:message', (data) => {
      if (typeof worldId === 'string') {
        io.to(`world:${worldId}`).emit('chat:message', {
          senderId: socket.id,
          ...data,
          timestamp: Date.now(),
        });
      }
    });

    socket.on('disconnect', () => {
      if (typeof worldId === 'string') {
        socket.to(`world:${worldId}`).emit('player:leave', {
          id: socket.id,
        });
      }
    });
  });

  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`Server listening on ${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    fastify.log.info(`Received ${signal}, shutting down gracefully...`);
    io.close();
    await fastify.close();
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
