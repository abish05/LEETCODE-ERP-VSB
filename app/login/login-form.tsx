"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { authenticate, type LoginState } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    authenticate,
    {},
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="Enter the e-mail"
          required
          autoFocus
          disabled={pending}
          aria-invalid={Boolean(state.error)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            required
            disabled={pending}
            aria-invalid={Boolean(state.error)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-0 top-0 grid h-9 w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </p>
      ) : null}

      <Button
        type="submit"
        variant="navy"
        size="lg"
        className="w-full"
        disabled={pending}
      >
        {pending ? (
          <>
            <Loader2 className="animate-spin" />
            Signing in…
          </>
        ) : (
          <>
            <LogIn />
            Sign in
          </>
        )}
      </Button>
    </form>
  );
}
