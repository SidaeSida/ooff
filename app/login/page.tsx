"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

type SignUpState = {
  email: string;
  password: string;
  confirm: string;
  loading: boolean;
  msg: string | null;
};

type SignInState = {
  email: string;
  password: string;
  loading: boolean;
  msg: string | null;
};

export default function LoginPage() {
  const search = useSearchParams();
  const nextUrl = search.get("next") || "/my";

  // 로그인 상태
  const [inState, setInState] = useState<SignInState>({
    email: "",
    password: "",
    loading: false,
    msg: null,
  });

  // 회원가입 상태
  const [upState, setUpState] = useState<SignUpState>({
    email: "",
    password: "",
    confirm: "",
    loading: false,
    msg: null,
  });

  // Sign up 토글
  const [openSignUp, setOpenSignUp] = useState(false);

  // 잠금 표시용 상태
  const [lockRemain, setLockRemain] = useState<number | null>(null);
  const [failCount, setFailCount] = useState<number | null>(null);

  // CapsLock / ShowPassword
  const [capsIn, setCapsIn] = useState(false);
  const [capsUp, setCapsUp] = useState(false);
  const [showInPw, setShowInPw] = useState(false);
  const [showUpPw, setShowUpPw] = useState(false);
  const [showUpPw2, setShowUpPw2] = useState(false);

  // 회원가입 성공 시 상단 로그인 이메일 자동 채움
  useEffect(() => {
    if (upState.msg === "SIGNUP_SUCCESS" && upState.email) {
      setInState((s) => ({ ...s, email: upState.email }));
      setOpenSignUp(false);
    }
  }, [upState.msg, upState.email]);

  // 잠금 카운트다운
  useEffect(() => {
    if (lockRemain == null) return;
    if (lockRemain <= 0) {
      setLockRemain(null);
      setFailCount(null);
      return;
    }
    const t = setInterval(() => setLockRemain((s) => (s == null ? null : s - 1)), 1000);
    return () => clearInterval(t);
  }, [lockRemain]);

  // 유효성
  const validEmail = (v: string) => /\S+@\S+\.\S+/.test(v.trim());
  const canSignIn =
    validEmail(inState.email) && inState.password.length >= 1 && !inState.loading;
  const canSignUp =
    validEmail(upState.email) &&
    upState.password.length >= 8 &&
    upState.password === upState.confirm &&
    !upState.loading;

  // 잠금 상태 조회
  const checkLock = async (email: string) => {
    try {
      const resp = await fetch(`/api/lock?email=${encodeURIComponent(email)}`, { cache: "no-store" });
      if (!resp.ok) return false;
      const data = await resp.json();
      if (data.locked) {
        setLockRemain(Number(data.remain) || 180);
        setFailCount(Number(data.count) || 5);
        setInState((s) => ({ ...s, msg: null }));
        return true;
      } else {
        setLockRemain(null);
        setFailCount(null);
        return false;
      }
    } catch {
      return false;
    }
  };

  // 로그인 제출 — 성공/실패/잠금 분기
  const onSubmitSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSignIn) return;

    setInState((s) => ({ ...s, loading: true, msg: null }));
    try {
      const res = await signIn("credentials", {
        email: inState.email.trim().toLowerCase(),
        password: inState.password.trim(),
        redirect: false,
        callbackUrl: nextUrl,
      });

      if (res?.ok && res.url) {
        window.location.assign(res.url);
        return;
      }

      const locked = await checkLock(inState.email.trim().toLowerCase());
      if (locked) return;

      setLockRemain(null);
      setFailCount(null);
      setInState((s) => ({ ...s, msg: "Email or password is incorrect." }));
    } catch {
      setInState((s) => ({ ...s, msg: "Sign in failed. Please try again." }));
    } finally {
      setInState((s) => ({ ...s, loading: false }));
    }
  };

  // 회원가입 제출
  const onSubmitSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSignUp) return;

    setUpState((s) => ({ ...s, loading: true, msg: null }));
    try {
      const resp = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: upState.email.trim().toLowerCase(),
          password: upState.password,
        }),
      });

      if (resp.status === 201) {
        setUpState((s) => ({ ...s, loading: false, msg: "SIGNUP_SUCCESS" }));
      } else if (resp.status === 409) {
        setUpState((s) => ({ ...s, loading: false, msg: "This email already exists." }));
      } else if (resp.status === 400) {
        setUpState((s) => ({ ...s, loading: false, msg: "Invalid input." }));
      } else {
        setUpState((s) => ({ ...s, loading: false, msg: "Sign up failed. Please try again." }));
      }
    } catch {
      setUpState((s) => ({ ...s, loading: false, msg: "Network error. Please retry." }));
    }
  };

  return (
    <main className="min-h-[70vh] py-6">
      {/* 중복 타이틀 제거: 바로 Login부터 */}
      <section className="mb-6">
        <h2 className="text-base font-medium mb-3">Login</h2>
        <form onSubmit={onSubmitSignIn} className="space-y-3 max-w-sm">
          <div className="grid gap-1">
            <label htmlFor="inEmail" className="text-sm text-gray-700">Email</label>
            <input
              id="inEmail"
              type="email"
              value={inState.email}
              onChange={(e) => setInState((s) => ({ ...s, email: e.target.value }))}
              required
              className="border rounded-lg px-3 py-2 text-sm"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div className="grid gap-1">
            <label htmlFor="inPw" className="text-sm text-gray-700">Password</label>
            <div className="relative">
              <input
                id="inPw"
                type={showInPw ? "text" : "password"}
                value={inState.password}
                onChange={(e) => setInState((s) => ({ ...s, password: e.target.value }))}
                onKeyDown={(e) => setCapsIn(e.getModifierState && e.getModifierState("CapsLock"))}
                onKeyUp={(e) => setCapsIn(e.getModifierState && e.getModifierState("CapsLock"))}
                required
                className="border rounded-lg px-3 py-2 text-sm w-full pr-16"
                placeholder="Password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowInPw((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs underline"
                aria-label={showInPw ? "Hide password" : "Show password"}
              >
                {showInPw ? "Hide" : "Show"}
              </button>
            </div>
            {capsIn && <p className="text-xs text-amber-700">Caps Lock is on.</p>}
          </div>

          {/* 오류/잠금 메시지 */}
          {lockRemain != null ? (
            <p className="text-sm text-red-600">
              Too many failed attempts. Please try again in{" "}
              {String(Math.floor(lockRemain / 60)).padStart(2, "0")}:
              {String(lockRemain % 60).padStart(2, "0")}
              {typeof failCount === "number" ? ` (${failCount}/5)` : null}
            </p>
          ) : inState.msg ? (
            <p className="text-sm text-red-600">{inState.msg}</p>
          ) : null}

          <button
            type="submit"
            disabled={!canSignIn}
            className={`px-3 py-2 text-sm rounded-lg border ${
              canSignIn ? "hover:bg-gray-50 cursor-pointer" : "opacity-50 cursor-not-allowed"
            }`}
          >
            Sign in
          </button>
        </form>
      </section>

      {/* Sign up 토글 */}
      <div className="my-6 flex items-center justify-center">
        <button
          type="button"
          onClick={() => setOpenSignUp((v) => !v)}
          className="text-sm underline hover:no-underline"
          aria-expanded={openSignUp}
          aria-controls="signup-panel"
        >
          {openSignUp ? "Hide sign up" : "Sign up"}
        </button>
      </div>

      {/* Sign up 패널 */}
      <section
        id="signup-panel"
        className={`transition-all duration-200 overflow-hidden ${
          openSignUp ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <h2 className="sr-only">Sign up</h2>
        <form onSubmit={onSubmitSignUp} className="space-y-3 max-w-sm">
          <div className="grid gap-1">
            <label htmlFor="upEmail" className="text-sm text-gray-700">Email</label>
            <input
              id="upEmail"
              type="email"
              value={upState.email}
              onChange={(e) => setUpState((s) => ({ ...s, email: e.target.value }))}
              required
              className="border rounded-lg px-3 py-2 text-sm"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div className="grid gap-1">
            <label htmlFor="upPw" className="text-sm text-gray-700">Password (min 8)</label>
            <div className="relative">
              <input
                id="upPw"
                type={showUpPw ? "text" : "password"}
                value={upState.password}
                onChange={(e) => setUpState((s) => ({ ...s, password: e.target.value }))}
                onKeyDown={(e) => setCapsUp(e.getModifierState && e.getModifierState("CapsLock"))}
                onKeyUp={(e) => setCapsUp(e.getModifierState && e.getModifierState("CapsLock"))}
                required
                className="border rounded-lg px-3 py-2 text-sm w-full pr-16"
                placeholder="Password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowUpPw((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs underline"
                aria-label={showUpPw ? "Hide password" : "Show password"}
              >
                {showUpPw ? "Hide" : "Show"}
              </button>
            </div>
            {capsUp && <p className="text-xs text-amber-700">Caps Lock is on.</p>}
          </div>
          <div className="grid gap-1">
            <label htmlFor="upPw2" className="text-sm text-gray-700">Confirm password</label>
            <div className="relative">
              <input
                id="upPw2"
                type={showUpPw2 ? "text" : "password"}
                value={upState.confirm}
                onChange={(e) => setUpState((s) => ({ ...s, confirm: e.target.value }))}
                required
                className="border rounded-lg px-3 py-2 text-sm w-full pr-16"
                placeholder="Confirm password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowUpPw2((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs underline"
                aria-label={showUpPw2 ? "Hide password" : "Show password"}
              >
                {showUpPw2 ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* 검증 메시지 */}
          {upState.password && upState.password.length < 8 && (
            <p className="text-xs text-red-600">Password must be at least 8 characters.</p>
          )}
          {upState.confirm && upState.password !== upState.confirm && (
            <p className="text-xs text-red-600">Passwords do not match.</p>
          )}
          {upState.msg && upState.msg !== "SIGNUP_SUCCESS" && (
            <p className="text-sm text-red-600">{upState.msg}</p>
          )}
          {upState.msg === "SIGNUP_SUCCESS" && (
            <p className="text-sm text-green-700">Sign up successful. Please sign in above.</p>
          )}

          <button
            type="submit"
            disabled={!canSignUp}
            className={`px-3 py-2 text-sm rounded-lg border ${
              canSignUp ? "hover:bg-gray-50 cursor-pointer" : "opacity-50 cursor-not-allowed"
            }`}
          >
            Create account
          </button>
        </form>
      </section>
    </main>
  );
}
