import 'dotenv/config';
import app from './app';
import { config } from './config';
import { prisma } from './database';

// Ungefangene Fehler loggen und sauber beenden (Keepalive-Supervisor startet neu)
process.on('uncaughtException', (err) => {
  console.error(`[${new Date().toISOString()}] uncaughtException:`, err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(`[${new Date().toISOString()}] unhandledRejection:`, reason);
  process.exit(1);
});

async function main() {
  await prisma.$connect();
  console.log('Datenbankverbindung hergestellt');

  const server = app.listen(config.port, () => {
    console.log(`Server läuft auf http://localhost:${config.port}`);
    console.log(`Umgebung: ${config.nodeEnv}`);
  });

  const shutdown = async () => {
    console.log('Server wird beendet...');
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Fehler beim Starten:', err);
  process.exit(1);
});
