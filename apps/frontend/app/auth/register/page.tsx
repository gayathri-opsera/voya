"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../components/ui/Button.js";
import { Input } from "../../../components/ui/Input.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/Card.js";
import { useToast } from "../../../components/ui/Toast.js";
import { apiPost } from "../../../lib/api/client.js";
import { ApiError } from "../../../lib/api/errors.js";

export default function RegisterPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<{
    email?: string;
    password?: string;
    displayName?: string;
    form?: string;
  }>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      await apiPost("/auth/register", { email, password, displayName });
      addToast({
        title: "Check your email",
        description: "We sent you a verification link. Please check your inbox.",
        variant: "success",
      });
      router.push("/auth/login");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fieldErrors) {
          setErrors(err.fieldErrors as typeof errors);
        } else {
          setErrors({ form: err.message });
        }
      } else {
        setErrors({ form: "An unexpected error occurred. Please try again." });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md" variant="elevated">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <p className="mt-1 text-sm text-text-secondary">
            Join Voya to book travel with AI-powered recommendations.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            {errors.form && (
              <div role="alert" className="rounded-md bg-error-light p-3 text-sm text-error">
                {errors.form}
              </div>
            )}

            <Input
              label="Full name"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              error={errors.displayName}
            />

            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              required
            />

            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              hint="Must be at least 8 characters"
              required
            />

            <Button type="submit" loading={loading} className="w-full">
              Create account
            </Button>

            <p className="text-center text-sm text-text-secondary">
              Already have an account?{" "}
              <a href="/auth/login" className="text-brand-500 hover:underline font-medium">
                Sign in
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
