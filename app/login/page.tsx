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

  // 상단 로그인 상태
  const [inState, setInState] = useState<SignInState>({
    email: "",
    password: "",
    loading: false,
    msg: null,
  });

  // 하단 회원가입 상태
  const [upState, setUpState] = useState<SignUpState>({
    email: "",
    password: "",
    confirm: "",
    loading: false,
    msg: null,
  });

  // 회원가입 성공 시 상단 로그인 이메일 자동 채움
  useEffect(() => {
    if (upState.msg === "SIGNUP_SUCCESS" && upState.email) {
      setInState((s) => ({ ...s, email: upState.email }));
    }
  }, [upState.msg, upState.email]);

  // 유효성
  const validEmail = (v: string) => /\S+@\S+\.\S+/.test(v.trim());
  const canSignIn = validEmail(inState.email) && inState.password.length >= 1 && !inState.loading;
  const canSignUp =
    validEmail(upState.email) &&
    upState.password.length >= 8 &&
    upState.password === upState.confirm &&
    !upState.loading;

  // 로그인 제출
  const onSubmitSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSignIn) return;

    setInState((s) => ({ ...s, loading: true, msg: null }));
    try {
      const res = await signIn("credentials", {
        email: inState.email.trim().toLowerCase(),
        password: inState.password,
        redirect: true,          // 서버 리다이렉트로 헤더 즉시 갱신
        callbackUrl: nextUrl,    // 기본: /my (또는 ?next=…)
      });
      // redirect: true 이므로 여기까지 오면 보통 네비게이션이 이미 발생합니다.
      // next-auth가 실패 시에는 쿼리스트링에 error를 붙여 리다이렉트할 수 있으므로
      // 필요시 추가 처리(예: search.get('error'))를 별도로 가능.
    } catch (err) {
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
      {/* Title */}
      <h1 className="text-base font-semibold mb-4">OOFF · Our Own Film Festival</h1>

      {/* Login */}
      <section className="mb-8">
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

          {inState.msg && <p className="text-sm text-red-600">{inState.msg}</p>}

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

      {/* Divider */}
      <div className="relative my-8">
        <div className="h-[2px] bg-gray-200" />
        <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-gray-50 px-3 text-xs text-gray-500">
          or
        </span>
      </div>

      {/* Sign up */}
      <section>
        <h2 className="text-base font-medium mb-3">Sign up</h2>
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
            <label htmlFor="upPw2" className="text-sm text-gray-700">Confirm password</label>
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
