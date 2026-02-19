import { validate as deepValidate } from "deep-email-validator";

export interface EmailValidationResult {
  email: string;
  syntaxValid: boolean;
  mxValid: boolean;
  isDisposable: boolean;
  overallStatus: "valid" | "invalid" | "warn";
  message: string;
}

export async function validateEmail(
  email: string
): Promise<EmailValidationResult> {
  try {
    const result = await deepValidate({
      email,
      validateSMTP: false,
      validateMx: true,
      validateTypo: true,
      validateDisposable: true,
    });

    const syntaxValid = result.validators.regex?.valid ?? false;
    const mxValid = result.validators.mx?.valid ?? false;
    const isDisposable = !(result.validators.disposable?.valid ?? true);

    let overallStatus: "valid" | "invalid" | "warn";
    if (!syntaxValid) {
      overallStatus = "invalid";
    } else if (!mxValid || isDisposable) {
      overallStatus = "warn";
    } else {
      overallStatus = "valid";
    }

    return {
      email,
      syntaxValid,
      mxValid,
      isDisposable,
      overallStatus,
      message: result.reason ?? "OK",
    };
  } catch (err) {
    return {
      email,
      syntaxValid: false,
      mxValid: false,
      isDisposable: false,
      overallStatus: "invalid",
      message: err instanceof Error ? err.message : "Validation error",
    };
  }
}
