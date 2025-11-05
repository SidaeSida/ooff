// app/login/page.tsx
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
  const [lockRemain, setLockRemain] = useState<number | null>(null); // 남은 초
  const [failCount, setFailCount] = useState<number | null>(null);   // 누적 실패 횟수

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

  // 로그인 제출 함수들 위 어딘가에 추가
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
        redirect: false,            // 실패 시 페이지 전환 금지
        callbackUrl: nextUrl,
      });

      // 1) 성공: ok + url
      if (res?.ok && res.url) {
        window.location.assign(res.url);
        return;
      }

      // 2) 실패: 즉시 현재 잠금 상태 조회
      const locked = await checkLock(inState.email.trim().toLowerCase());
      if (locked) {
        // checkLock이 lockRemain/failCount와 메시지 상태를 이미 셋업함
        return;
      }

      // 3) 잠금이 아니면 일반 실패 메시지
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
        setUpState((s) => ({
          ...s,
          loading: false,
          msg: "This email already exists.",
        }));
      } else if (resp.status === 400) {
        setUpState((s) => ({ ...s, loading: false, msg: "Invalid input." }));
      } else {
        setUpState((s) => ({
          ...s,
          loading: false,
          msg: "Sign up failed. Please try again.",
        }));
      }
    } catch {
      setUpState((s) => ({ ...s, loading: false, msg: "Network error. Please retry." }));
    }
  };

  return (
    <main className="min-h-[70vh] py-6">
      {/* Title */}
      <h1 className="text-base font-semibold mb-4">OOFF · Our Own Film Festival</h1>

      {/* Login */}
      <section className="mb-6">
        <h2 className="text-base font-medium mb-3">Login</h2>
        <form onSubmit={onSubmitSignIn} className="space-y-3 max-w-sm">
          <div className="grid gap-1">
            <label htmlFor="inEmail" className="text-sm text-gray-700">
              Email
            </label>
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
            <label htmlFor="inPw" className="text-sm text-gray-700">
              Password
            </label>
            <input
              id="inPw"
              type="password"
              value={inState.password}
              onChange={(e) => setInState((s) => ({ ...s, password: e.target.value }))}
              required
              className="border rounded-lg px-3 py-2 text-sm"
              placeholder="Password"
              autoComplete="current-password"
            />
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
            <label htmlFor="upEmail" className="text-sm text-gray-700">
              Email
            </label>
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
            <label htmlFor="upPw" className="text-sm text-gray-700">
              Password (min 8)
            </label>
            <input
              id="upPw"
              type="password"
              value={upState.password}
              onChange={(e) => setUpState((s) => ({ ...s, password: e.target.value }))}
              required
              className="border rounded-lg px-3 py-2 text-sm"
              placeholder="Password"
              autoComplete="new-password"
            />
          </div>
          <div className="grid gap-1">
            <label htmlFor="upPw2" className="text-sm text-gray-700">
              Confirm password
            </label>
            <input
              id="upPw2"
              type="password"
              value={upState.confirm}
              onChange={(e) => setUpState((s) => ({ ...s, confirm: e.target.value }))}
              required
              className="border rounded-lg px-3 py-2 text-sm"
              placeholder="Confirm password"
              autoComplete="new-password"
            />
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
