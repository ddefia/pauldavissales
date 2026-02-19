import { validateEmail } from "./email-validator";
import { validatePhone } from "./phone-validator";
import prisma from "@/lib/prisma";

export interface ValidationRunResult {
  processed: number;
  valid: number;
  invalid: number;
  warnings: number;
}

export async function runValidation(
  contactIds: string[]
): Promise<ValidationRunResult> {
  let valid = 0;
  let invalid = 0;
  let warnings = 0;

  for (const contactId of contactIds) {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });
    if (!contact) continue;

    // Validate email
    if (contact.email) {
      const emailResult = await validateEmail(contact.email);

      const status =
        emailResult.overallStatus === "valid"
          ? "VALID"
          : emailResult.overallStatus === "warn"
          ? "WARN"
          : "INVALID";

      await prisma.validationResult.upsert({
        where: {
          contactId_type_field: {
            contactId,
            type: "EMAIL_MX",
            field: "email",
          },
        },
        create: {
          contactId,
          type: "EMAIL_MX",
          field: "email",
          originalValue: contact.email,
          status: status as any,
          message: emailResult.message,
          metadata: {
            syntaxValid: emailResult.syntaxValid,
            mxValid: emailResult.mxValid,
            isDisposable: emailResult.isDisposable,
          },
        },
        update: {
          status: status as any,
          message: emailResult.message,
          metadata: {
            syntaxValid: emailResult.syntaxValid,
            mxValid: emailResult.mxValid,
            isDisposable: emailResult.isDisposable,
          },
          checkedAt: new Date(),
        },
      });

      if (status === "VALID") valid++;
      else if (status === "WARN") warnings++;
      else invalid++;
    }

    // Validate each phone field
    const phoneFields = [
      { field: "phone" as const, value: contact.phone },
      { field: "phoneSecondary" as const, value: contact.phoneSecondary },
      { field: "phoneMobile" as const, value: contact.phoneMobile },
    ];

    for (const { field, value } of phoneFields) {
      if (!value) continue;

      const phoneResult = validatePhone(value);
      const status = phoneResult.status === "valid" ? "VALID" : "INVALID";

      await prisma.validationResult.upsert({
        where: {
          contactId_type_field: {
            contactId,
            type: "PHONE_FORMAT",
            field,
          },
        },
        create: {
          contactId,
          type: "PHONE_FORMAT",
          field,
          originalValue: value,
          status: status as any,
          message: phoneResult.message,
          metadata: {
            type: phoneResult.type,
            formattedNational: phoneResult.formattedNational,
            formattedE164: phoneResult.formattedE164,
          },
        },
        update: {
          status: status as any,
          message: phoneResult.message,
          metadata: {
            type: phoneResult.type,
            formattedNational: phoneResult.formattedNational,
            formattedE164: phoneResult.formattedE164,
          },
          checkedAt: new Date(),
        },
      });

      if (status === "VALID") valid++;
      else invalid++;
    }

    // Update contact status
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        lastValidatedAt: new Date(),
        status: "VALIDATED",
      },
    });
  }

  return {
    processed: contactIds.length,
    valid,
    invalid,
    warnings,
  };
}
