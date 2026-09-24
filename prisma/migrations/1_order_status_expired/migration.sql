-- AlterEnum: estado EXPIRED para pedidos (adição não destrutiva de valor de enum)
ALTER TYPE "OrderStatus" ADD VALUE 'EXPIRED';
