const QUALITY_FIELDS = [
  { key: "firstName", weight: 15 },
  { key: "lastName", weight: 15 },
  { key: "email", weight: 20 },
  { key: "phone", weight: 15 },
  { key: "phoneMobile", weight: 5 },
  { key: "title", weight: 10 },
  { key: "organizationId", weight: 10 },
  { key: "addressLine1", weight: 5 },
  { key: "city", weight: 2 },
  { key: "state", weight: 1 },
  { key: "zipCode", weight: 2 },
] as const;

export function computeDataQualityScore(contact: Record<string, any>): number {
  let totalWeight = 0;
  let earnedWeight = 0;

  for (const field of QUALITY_FIELDS) {
    totalWeight += field.weight;
    const value = contact[field.key];
    if (value !== null && value !== undefined && value !== "") {
      earnedWeight += field.weight;
    }
  }

  return totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
}
