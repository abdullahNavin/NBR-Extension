-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('trial', 'active', 'expired', 'revoked');
CREATE TYPE "PaymentMethod" AS ENUM ('bkash', 'nagad');
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'verified', 'rejected');

-- AlterTable: License.status String -> LicenseStatus (cast preserves data)
ALTER TABLE "License" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "License" ALTER COLUMN "status" TYPE "LicenseStatus" USING "status"::"LicenseStatus";
ALTER TABLE "License" ALTER COLUMN "status" SET DEFAULT 'trial';

-- AlterTable: Payment.method String -> PaymentMethod
ALTER TABLE "Payment" ALTER COLUMN "method" TYPE "PaymentMethod" USING "method"::"PaymentMethod";

-- AlterTable: Payment.status String -> PaymentStatus (cast preserves data)
ALTER TABLE "Payment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "status" TYPE "PaymentStatus" USING "status"::"PaymentStatus";
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'pending';
