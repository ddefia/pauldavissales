-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "apolloContactId" TEXT,
ADD COLUMN     "linkedinUrl" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "annualRevenue" TEXT,
ADD COLUMN     "apolloAccountId" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "linkedinUrl" TEXT;
