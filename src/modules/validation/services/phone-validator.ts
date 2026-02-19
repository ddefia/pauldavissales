import { parsePhoneNumberFromString } from "libphonenumber-js";

export interface PhoneValidationResult {
  phone: string;
  isValid: boolean;
  type: "mobile" | "fixed_line" | "voip" | "toll_free" | "unknown";
  formattedNational: string | null;
  formattedE164: string | null;
  status: "valid" | "invalid" | "warn";
  message: string;
}

export function validatePhone(phone: string): PhoneValidationResult {
  const parsed = parsePhoneNumberFromString(phone, "US");

  if (!parsed || !parsed.isValid()) {
    return {
      phone,
      isValid: false,
      type: "unknown",
      formattedNational: null,
      formattedE164: null,
      status: "invalid",
      message: "Invalid phone number format",
    };
  }

  const numberType = parsed.getType();
  const typeMap: Record<string, PhoneValidationResult["type"]> = {
    MOBILE: "mobile",
    FIXED_LINE: "fixed_line",
    FIXED_LINE_OR_MOBILE: "mobile",
    VOIP: "voip",
    TOLL_FREE: "toll_free",
    PREMIUM_RATE: "unknown",
    SHARED_COST: "unknown",
    PERSONAL_NUMBER: "mobile",
    UAN: "unknown",
  };

  const detectedType = typeMap[numberType ?? ""] ?? "unknown";

  return {
    phone,
    isValid: true,
    type: detectedType,
    formattedNational: parsed.formatNational(),
    formattedE164: parsed.format("E.164"),
    status: "valid",
    message: `Valid ${detectedType === "unknown" ? "phone" : detectedType.replace("_", " ")} number`,
  };
}
