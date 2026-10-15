import { useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Eye, EyeOff, ImagePlus, Lock, User, UserRound, X, UserPlus } from "lucide-react";
import Screen from "../components/screen";
import Logo from "../components/logo";
import Field from "../components/field";
import Button from "../components/button";
import Avatar from "../components/avatar";
import { useGuestOnly } from "../lib/authContext";
import { resizeImage } from "../lib/api";

export default function Register() {
  const auth = useGuestOnly();
  const router = useRouter();
  const fileRef = useRef(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sex, setSex] = useState("male");
  const [image, setImage] = useState(null);
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const pickImage = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      setImage(await resizeImage(file));
      setErrors((x) => ({ ...x, image: undefined }));
    } catch (err) {
      setErrors((x) => ({ ...x, image: err.message }));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!/^[A-Za-z0-9_]{3,16}$/.test(username.trim())) next.username = "Use 3 to 16 letters, numbers or underscores.";
    if (password.length < 6) next.password = "Use at least 6 characters.";
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) return;
    setLoading(true);
    try {
      await auth.register({ username: username.trim(), password, sex, image });
      router.replace("/home");
    } catch (err) {
      if (err.fields) setErrors(err.fields);
      setFormError(err.fields ? "" : err.message);
      setLoading(false);
    }
  };

  const sexOption = (value, label, Icon) => (
    <label
      className={`flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-semibold ring-1 ring-inset transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-flare-400 ${sex === value ? "bg-flare-500 text-ink-950 ring-flare-500" : "bg-ink-950/60 text-chalk/70 ring-white/15 hover:bg-white/10"}`}
    >
      <input type="radio" name="sex" value={value} checked={sex === value} onChange={() => setSex(value)} className="sr-only" />
      <Icon className="h-5 w-5" aria-hidden="true" />
      {label}
    </label>
  );

  return (
    <Screen>
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
        <Logo className="mb-8 self-center" />
        <form onSubmit={submit} noValidate className="space-y-5 rounded-3xl bg-white/[0.06] p-7 ring-1 ring-inset ring-white/15 backdrop-blur-xl">
          <div>
            <h1 className="font-display text-4xl font-extrabold uppercase">Join the shootout</h1>
            <p className="mt-1 text-chalk/55">Three fields and you are on the pitch.</p>
          </div>
          {formError ? (
            <p role="alert" className="rounded-xl bg-siren-500/15 px-4 py-3 text-sm font-semibold text-siren-400 ring-1 ring-inset ring-siren-500/40">
              {formError}
            </p>
          ) : null}
          <div className="flex items-center gap-4">
            <Avatar username={username || "player"} sex={sex} image={image} size={72} ring />
            <div className="flex-1">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={pickImage} className="sr-only" id="photo" aria-label="Profile photo" />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon={ImagePlus} onClick={() => fileRef.current && fileRef.current.click()}>
                  {image ? "Change photo" : "Add photo"}
                </Button>
                {image ? (
                  <Button size="sm" variant="ghost" icon={X} onClick={() => setImage(null)}>
                    Remove
                  </Button>
                ) : null}
              </div>
              <p className={`mt-1.5 text-xs ${errors.image ? "text-siren-400" : "text-chalk/45"}`} role={errors.image ? "alert" : undefined}>
                {errors.image || "Optional. Square crops look best."}
              </p>
            </div>
          </div>
          <Field id="username" label="Username" icon={User} value={username} onChange={(e) => setUsername(e.target.value)} error={errors.username} autoComplete="username" maxLength={16} autoFocus />
          <Field
            id="password"
            label="Password"
            icon={Lock}
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            autoComplete="new-password"
            right={
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="flex h-9 w-9 items-center justify-center rounded-lg text-chalk/50 outline-none transition hover:text-chalk focus-visible:ring-2 focus-visible:ring-flare-400">
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            }
          />
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-chalk/80">Sex</legend>
            <div className="flex gap-3">
              {sexOption("male", "Male", User)}
              {sexOption("female", "Female", UserRound)}
            </div>
            {errors.sex ? <p role="alert" className="mt-1.5 text-sm text-siren-400">{errors.sex}</p> : null}
          </fieldset>
          <Button type="submit" size="lg" loading={loading} icon={UserPlus} className="w-full">
            {loading ? "Creating account" : "Create account"}
          </Button>
          <p className="text-center text-sm text-chalk/55">
            Already registered?{" "}
            <Link href="/login" className="font-semibold text-flare-400 underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </Screen>
  );
}
