-- Cria o banco "shadow" usado pelo `prisma migrate dev`.
SELECT 'CREATE DATABASE ecommerce_shadow OWNER ecommerce'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ecommerce_shadow')\gexec
