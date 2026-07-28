"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/auth";

export interface LoginState {
  error?: string;
}

export async function authenticate(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/dashboard",
    });
    return {};
  } catch (error) {
    // `signIn` signals a successful redirect by throwing NEXT_REDIRECT — that
    // must bubble up to Next.js untouched.
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }

    if (error instanceof AuthError) {
      return error.type === "CredentialsSignin"
        ? { error: "Incorrect email or password." }
        : { error: "Could not sign you in. Please try again." };
    }

    console.error("[login] Unexpected error:", error);
    return {
      error:
        "Sign-in is unavailable right now. Check the database connection and try again.",
    };
  }
}
