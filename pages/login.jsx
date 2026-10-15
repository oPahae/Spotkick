import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Eye, EyeOff, Lock, User, LogIn } from "lucide-react";
import Screen from "../components/screen";
import Logo from "../components/logo";
import Field from "../components/field";
import Button from "../components/button";
import { useGuestOnly } from "../lib/authContext";

export default function Login() {
  const auth = useGuestOnly();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!username.trim()) next.username = "Enter your username.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) return;
    setLoading(true);
    try {
      await auth.login(username.trim(), password);
      router.replace("/home");
    } catch (err) {
      setFormError(err.message);
      setLoading(false);
    }
  };

  return (
    <Screen>
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
        <Logo className="mb-8 self-center" />
        <form onSubmit={submit} noValidate className="space-y-5 rounded-3xl bg-white/[0.06] p-7 ring-1 ring-inset ring-white/15 backdrop-blur-xl">
          <div>
            <h1 className="font-display text-4xl font-extrabold uppercase">Welcome back</h1>
            <p className="mt-1 text-chalk/55">Sign in to get back on the spot.</p>
          </div>
          {formError ? (
            <p role="alert" className="rounded-xl bg-siren-500/15 px-4 py-3 text-sm font-semibold text-siren-400 ring-1 ring-inset ring-siren-500/40">
              {formError}
            </p>
          ) : null}
          <Field id="username" label="Username" icon={User} value={username} onChange={(e) => setUsername(e.target.value)} error={errors.username} autoComplete="username" autoFocus />
          <Field
            id="password"
            label="Password"
            icon={Lock}
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            autoComplete="current-password"
            right={
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="flex h-9 w-9 items-center justify-center rounded-lg text-chalk/50 outline-none transition hover:text-chalk focus-visible:ring-2 focus-visible:ring-flare-400">
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            }
          />
          <Button type="submit" size="lg" loading={loading} icon={LogIn} className="w-full">
            {loading ? "Signing in" : "Sign in"}
          </Button>
          <p className="text-center text-sm text-chalk/55">
            New here?{" "}
            <Link href="/register" className="font-semibold text-flare-400 underline-offset-4 hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </Screen>
  );
}
