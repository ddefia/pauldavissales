export interface SchemaField {
  key: string;
  label: string;
  required: boolean;
  category: "contact" | "organization" | "property" | "address";
}

export const SCHEMA_FIELDS: SchemaField[] = [
  // Contact
  { key: "firstName", label: "First Name", required: true, category: "contact" },
  { key: "lastName", label: "Last Name", required: true, category: "contact" },
  { key: "prefix", label: "Prefix", required: false, category: "contact" },
  { key: "suffix", label: "Suffix", required: false, category: "contact" },
  { key: "title", label: "Job Title", required: false, category: "contact" },
  { key: "department", label: "Department", required: false, category: "contact" },
  { key: "email", label: "Email", required: false, category: "contact" },
  { key: "emailSecondary", label: "Secondary Email", required: false, category: "contact" },
  { key: "phone", label: "Phone", required: false, category: "contact" },
  { key: "phoneSecondary", label: "Secondary Phone", required: false, category: "contact" },
  { key: "phoneMobile", label: "Mobile Phone", required: false, category: "contact" },
  { key: "fax", label: "Fax", required: false, category: "contact" },

  // Organization
  { key: "organizationName", label: "Organization Name", required: false, category: "organization" },
  { key: "organizationType", label: "Organization Type", required: false, category: "organization" },
  { key: "organizationWebsite", label: "Organization Website", required: false, category: "organization" },
  { key: "organizationPhone", label: "Organization Phone", required: false, category: "organization" },

  // Property
  { key: "propertyName", label: "Property/Building Name", required: false, category: "property" },
  { key: "propertyType", label: "Property Type", required: false, category: "property" },
  { key: "unitCount", label: "Unit Count", required: false, category: "property" },
  { key: "yearBuilt", label: "Year Built", required: false, category: "property" },
  { key: "floors", label: "Floors", required: false, category: "property" },

  // Address (shared)
  { key: "addressLine1", label: "Address Line 1", required: false, category: "address" },
  { key: "addressLine2", label: "Address Line 2", required: false, category: "address" },
  { key: "city", label: "City", required: false, category: "address" },
  { key: "state", label: "State", required: false, category: "address" },
  { key: "zipCode", label: "ZIP Code", required: false, category: "address" },
  { key: "county", label: "County", required: false, category: "address" },
];

export interface ColumnMapping {
  fileColumn: string;
  schemaField: string | null;
  confidence: number;
  sampleValues: string[];
}

// Aliases: schema field key → array of known column names (lowercase)
const FIELD_ALIASES: Record<string, string[]> = {
  firstName: [
    "first name", "fname", "first", "given name", "contact first", "contact first name",
    "first_name", "firstname",
  ],
  lastName: [
    "last name", "lname", "last", "surname", "family name", "contact last",
    "contact last name", "last_name", "lastname",
  ],
  prefix: ["prefix", "salutation", "mr/mrs", "title prefix"],
  suffix: ["suffix", "name suffix"],
  title: [
    "title", "job title", "position", "role", "designation", "job_title",
    "contact title", "job role",
  ],
  department: ["department", "dept", "division"],
  email: [
    "email", "e-mail", "email address", "contact email", "primary email",
    "email_address", "email1", "e mail", "work email",
  ],
  emailSecondary: [
    "secondary email", "email 2", "email2", "alternate email", "alt email",
    "personal email",
  ],
  phone: [
    "phone", "phone number", "telephone", "tel", "primary phone", "office phone",
    "work phone", "phone1", "phone_number", "main phone", "direct phone",
    "direct", "business phone",
  ],
  phoneSecondary: [
    "secondary phone", "phone 2", "phone2", "alternate phone", "other phone",
  ],
  phoneMobile: [
    "mobile", "cell", "cell phone", "mobile phone", "cellular", "mobile number",
    "cell number", "mobile_phone",
  ],
  fax: ["fax", "fax number", "fax_number", "facsimile"],
  organizationName: [
    "company", "company name", "organization", "org", "management company",
    "mgmt company", "firm", "management firm", "mgmt firm", "employer",
    "company_name", "organization name", "business name", "association name",
    "hoa name", "coa name", "condo association",
  ],
  organizationType: [
    "company type", "org type", "organization type", "entity type",
    "business type", "type",
  ],
  organizationWebsite: [
    "website", "web", "url", "company website", "web address", "homepage",
  ],
  organizationPhone: [
    "company phone", "org phone", "organization phone", "office number",
    "main number",
  ],
  propertyName: [
    "property", "property name", "building", "building name", "community",
    "association", "property_name", "complex", "development", "condo name",
    "community name",
  ],
  propertyType: [
    "property type", "building type", "property_type", "asset type",
  ],
  unitCount: [
    "units", "unit count", "number of units", "total units", "num units",
    "unit_count",
  ],
  yearBuilt: ["year built", "built", "year_built", "construction year"],
  floors: ["floors", "stories", "levels", "floor count"],
  addressLine1: [
    "address", "street", "street address", "address 1", "address line 1",
    "mailing address", "address1", "street_address", "physical address",
    "property address",
  ],
  addressLine2: [
    "address 2", "address line 2", "suite", "unit", "apt", "address2",
    "suite/unit",
  ],
  city: ["city", "town", "municipality"],
  state: ["state", "st", "province", "state/province"],
  zipCode: [
    "zip", "zip code", "zipcode", "postal code", "postal", "zip_code",
  ],
  county: ["county", "county name"],
};

export function autoDetectMapping(
  headers: string[],
  sampleRows: Record<string, string>[]
): ColumnMapping[] {
  const usedFields = new Set<string>();

  const mappings = headers.map((header) => {
    const normalized = header.toLowerCase().trim().replace(/[_-]/g, " ");
    let bestMatch: string | null = null;
    let bestConfidence = 0;

    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (usedFields.has(field)) continue;

      for (const alias of aliases) {
        if (normalized === alias) {
          if (1.0 > bestConfidence) {
            bestMatch = field;
            bestConfidence = 1.0;
          }
          break;
        }
        if (
          (normalized.includes(alias) || alias.includes(normalized)) &&
          normalized.length > 2
        ) {
          const confidence = 0.7;
          if (confidence > bestConfidence) {
            bestMatch = field;
            bestConfidence = confidence;
          }
        }
      }
      if (bestConfidence === 1.0) break;
    }

    if (bestMatch && bestConfidence >= 0.5) {
      usedFields.add(bestMatch);
    }

    const sampleValues = sampleRows
      .map((row) => row[header])
      .filter(Boolean)
      .slice(0, 3);

    return {
      fileColumn: header,
      schemaField: bestConfidence >= 0.5 ? bestMatch : null,
      confidence: bestConfidence,
      sampleValues,
    };
  });

  return mappings;
}
