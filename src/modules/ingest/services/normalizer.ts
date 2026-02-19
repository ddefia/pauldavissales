import { parsePhoneNumberFromString } from "libphonenumber-js";

export interface NormalizedContact {
  prefix: string | null;
  firstName: string;
  lastName: string;
  suffix: string | null;
  fullName: string;
  title: string | null;
  department: string | null;
  email: string | null;
  emailSecondary: string | null;
  phone: string | null;
  phoneSecondary: string | null;
  phoneMobile: string | null;
  fax: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  county: string | null;
  organizationName: string | null;
  organizationType: string | null;
  organizationWebsite: string | null;
  organizationPhone: string | null;
  propertyName: string | null;
  propertyType: string | null;
  unitCount: number | null;
  yearBuilt: number | null;
  floors: number | null;
}

const PREFIXES = ["mr", "mrs", "ms", "dr", "prof", "rev", "hon"];
const SUFFIXES = ["jr", "sr", "ii", "iii", "iv", "esq", "phd", "md", "dds"];

const STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
  "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA",
  washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
  "district of columbia": "DC",
};

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/(?:^|\s|[-'])\S/g, (match) => match.toUpperCase());
}

export function normalizeName(raw: string): {
  prefix: string | null;
  firstName: string;
  lastName: string;
  suffix: string | null;
} {
  if (!raw || !raw.trim()) {
    return { prefix: null, firstName: "", lastName: "", suffix: null };
  }

  let cleaned = raw.trim().replace(/\s+/g, " ");

  // Extract prefix
  let prefix: string | null = null;
  for (const p of PREFIXES) {
    const regex = new RegExp(`^${p}\\.?\\s+`, "i");
    if (regex.test(cleaned)) {
      prefix = titleCase(p) + ".";
      cleaned = cleaned.replace(regex, "");
      break;
    }
  }

  // Extract suffix
  let suffix: string | null = null;
  for (const s of SUFFIXES) {
    const regex = new RegExp(`[,\\s]+${s}\\.?$`, "i");
    if (regex.test(cleaned)) {
      suffix = s.toUpperCase() === "JR" ? "Jr." : s.toUpperCase() === "SR" ? "Sr." : s.toUpperCase();
      cleaned = cleaned.replace(regex, "");
      break;
    }
  }

  let firstName: string;
  let lastName: string;

  // Handle "Last, First" format
  if (cleaned.includes(",")) {
    const parts = cleaned.split(",").map((p) => p.trim());
    lastName = parts[0];
    firstName = parts.slice(1).join(" ");
  } else {
    const parts = cleaned.split(" ").filter(Boolean);
    if (parts.length === 1) {
      firstName = parts[0];
      lastName = "";
    } else {
      firstName = parts[0];
      lastName = parts.slice(1).join(" ");
    }
  }

  return {
    prefix,
    firstName: titleCase(firstName),
    lastName: titleCase(lastName),
    suffix,
  };
}

export function normalizePhone(raw: string): string | null {
  if (!raw || !raw.trim()) return null;

  const cleaned = raw.replace(/[^\d+x]/gi, "");
  // Remove extension
  const withoutExt = cleaned.replace(/x\d+$/i, "");

  const parsed = parsePhoneNumberFromString(withoutExt, "US");
  if (parsed && parsed.isValid()) {
    return parsed.format("E.164");
  }

  // If not parseable but has 10 digits, assume US
  const digits = withoutExt.replace(/\D/g, "");
  if (digits.length === 10) {
    const retry = parsePhoneNumberFromString(`+1${digits}`, "US");
    return retry?.format("E.164") ?? null;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    const retry = parsePhoneNumberFromString(`+${digits}`, "US");
    return retry?.format("E.164") ?? null;
  }

  return null;
}

export function normalizeEmail(raw: string): string | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed) ? trimmed : null;
}

export function normalizeState(raw: string): string | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();

  // Already a 2-letter code
  if (/^[A-Z]{2}$/.test(trimmed.toUpperCase())) {
    return trimmed.toUpperCase();
  }

  // Full state name
  const mapped = STATE_ABBREVIATIONS[trimmed.toLowerCase()];
  return mapped ?? trimmed.toUpperCase().slice(0, 2);
}

export function normalizeZip(raw: string): string | null {
  if (!raw || !raw.trim()) return null;
  const digits = raw.replace(/[^\d-]/g, "");
  // 5-digit or 5+4 format
  const match = digits.match(/^(\d{5})(-\d{4})?/);
  return match ? match[1] : null;
}

export function normalizeRow(
  rawRow: Record<string, string>,
  mapping: Record<string, string>
): NormalizedContact {
  // Reverse the mapping: schemaField -> fileColumn
  const reverseMap: Record<string, string> = {};
  for (const [fileCol, schemaField] of Object.entries(mapping)) {
    if (schemaField) {
      reverseMap[schemaField] = fileCol;
    }
  }

  function get(schemaField: string): string {
    const fileCol = reverseMap[schemaField];
    return fileCol ? (rawRow[fileCol] ?? "").trim() : "";
  }

  // Handle name: check if we have separate first/last or a combined full name
  let nameResult;
  const rawFirst = get("firstName");
  const rawLast = get("lastName");

  if (rawFirst || rawLast) {
    const firstResult = rawFirst ? normalizeName(rawFirst) : { prefix: null, firstName: "", lastName: "", suffix: null };
    const lastResult = rawLast ? normalizeName(rawLast) : { prefix: null, firstName: "", lastName: "", suffix: null };

    nameResult = {
      prefix: firstResult.prefix || get("prefix") || null,
      firstName: firstResult.firstName || firstResult.lastName,
      lastName: lastResult.lastName || lastResult.firstName || rawLast,
      suffix: lastResult.suffix || get("suffix") || null,
    };

    // If firstName parsing put everything in firstName (single word), and we have a raw last name
    if (nameResult.firstName && rawLast) {
      nameResult.lastName = titleCase(rawLast);
    }
    if (rawFirst && !nameResult.lastName) {
      nameResult.firstName = titleCase(rawFirst);
    }
  } else {
    nameResult = { prefix: null, firstName: "", lastName: "", suffix: null };
  }

  const email = normalizeEmail(get("email"));

  // Fallback: if no name but we have an email, extract a name from email
  if (!nameResult.firstName && !nameResult.lastName && email) {
    const localPart = email.split("@")[0] ?? "";
    // Try to split on common separators: dots, underscores, hyphens
    const nameParts = localPart.split(/[._-]/).filter(Boolean);
    if (nameParts.length >= 2) {
      nameResult.firstName = titleCase(nameParts[0]);
      nameResult.lastName = titleCase(nameParts.slice(1).join(" "));
    } else if (nameParts.length === 1) {
      nameResult.firstName = titleCase(nameParts[0]);
      nameResult.lastName = "";
    }
  }
  const emailSecondary = normalizeEmail(get("emailSecondary"));
  const phone = normalizePhone(get("phone"));
  const phoneSecondary = normalizePhone(get("phoneSecondary"));
  const phoneMobile = normalizePhone(get("phoneMobile"));
  const fax = normalizePhone(get("fax"));

  const unitCountRaw = get("unitCount");
  const yearBuiltRaw = get("yearBuilt");
  const floorsRaw = get("floors");

  return {
    prefix: nameResult.prefix,
    firstName: nameResult.firstName,
    lastName: nameResult.lastName,
    suffix: nameResult.suffix,
    fullName: [nameResult.firstName, nameResult.lastName].filter(Boolean).join(" "),
    title: get("title") || null,
    department: get("department") || null,
    email,
    emailSecondary,
    phone,
    phoneSecondary,
    phoneMobile,
    fax,
    addressLine1: get("addressLine1") || null,
    addressLine2: get("addressLine2") || null,
    city: get("city") ? titleCase(get("city")) : null,
    state: normalizeState(get("state")),
    zipCode: normalizeZip(get("zipCode")),
    county: get("county") ? titleCase(get("county")) : null,
    organizationName: get("organizationName") || null,
    organizationType: get("organizationType") || null,
    organizationWebsite: get("organizationWebsite") || null,
    organizationPhone: normalizePhone(get("organizationPhone")),
    propertyName: get("propertyName") || null,
    propertyType: get("propertyType") || null,
    unitCount: unitCountRaw ? parseInt(unitCountRaw, 10) || null : null,
    yearBuilt: yearBuiltRaw ? parseInt(yearBuiltRaw, 10) || null : null,
    floors: floorsRaw ? parseInt(floorsRaw, 10) || null : null,
  };
}
