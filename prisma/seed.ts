import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create territories
  const palmBeach = await prisma.territory.upsert({
    where: { name: "Palm Beach County" },
    update: {},
    create: {
      name: "Palm Beach County",
      description: "Palm Beach County including West Palm Beach, Boca Raton, Delray Beach, Boynton Beach, Jupiter, Palm Beach Gardens",
      counties: ["Palm Beach"],
      zipCodes: [
        "33401", "33402", "33403", "33404", "33405", "33406", "33407", "33408", "33409", "33410",
        "33411", "33412", "33413", "33414", "33415", "33416", "33417", "33418", "33419", "33420",
        "33421", "33422", "33424", "33425", "33426", "33427", "33428", "33429", "33430", "33431",
        "33432", "33433", "33434", "33435", "33436", "33437", "33438", "33440", "33444", "33445",
        "33446", "33449", "33458", "33459", "33460", "33461", "33462", "33463", "33464", "33465",
        "33466", "33467", "33468", "33469", "33470", "33472", "33473", "33474", "33476", "33477",
        "33478", "33480", "33481", "33482", "33483", "33484", "33486", "33487", "33488", "33493",
        "33496", "33497", "33498",
      ],
    },
  });

  const martin = await prisma.territory.upsert({
    where: { name: "Martin County" },
    update: {},
    create: {
      name: "Martin County",
      description: "Martin County including Stuart, Jensen Beach, Palm City, Hobe Sound",
      counties: ["Martin"],
      zipCodes: [
        "34990", "34994", "34995", "34996", "34997", "33455", "34957",
      ],
    },
  });

  const stLucie = await prisma.territory.upsert({
    where: { name: "St. Lucie County" },
    update: {},
    create: {
      name: "St. Lucie County",
      description: "St. Lucie County including Port St. Lucie, Fort Pierce",
      counties: ["St. Lucie"],
      zipCodes: [
        "34945", "34946", "34947", "34949", "34950", "34951", "34952", "34953",
        "34954", "34981", "34982", "34983", "34984", "34985", "34986", "34987", "34988",
      ],
    },
  });

  const indianRiver = await prisma.territory.upsert({
    where: { name: "Indian River County" },
    update: {},
    create: {
      name: "Indian River County",
      description: "Indian River County including Vero Beach, Sebastian",
      counties: ["Indian River"],
      zipCodes: [
        "32958", "32960", "32961", "32962", "32963", "32966", "32967", "32968",
        "32976",
      ],
    },
  });

  console.log("Created territories:", palmBeach.name, martin.name, stLucie.name, indianRiver.name);

  // Create admin user
  const passwordHash = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@pauldavis-pbctc.com" },
    update: {},
    create: {
      email: "admin@pauldavis-pbctc.com",
      name: "Admin",
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  // Assign admin to all territories
  for (const territory of [palmBeach, martin, stLucie, indianRiver]) {
    await prisma.userTerritory.upsert({
      where: {
        userId_territoryId: {
          userId: admin.id,
          territoryId: territory.id,
        },
      },
      update: {},
      create: {
        userId: admin.id,
        territoryId: territory.id,
      },
    });
  }

  console.log("Created admin user:", admin.email);
  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
