/**
 * ResetPasswordPage.tsx
 *
 * Handles the final step of the password reset flow.
 * Mounted at: /reset-password?email=<email>&token=<token>
 *
 * The reset link in the email should point to:
 *   https://your-frontend.com/reset-password?email=user@dict.gov.ph&token=abc123...
 *
 * The backend (POST /auth/reset-password) expects: { email, token, password }
 * Token is the raw unhashed token returned by generatePasswordResetToken()
 * and stored hashed in the database — the backend verifies via bcrypt compare.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Lock, CheckCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';

// ── Password strength helper ──────────────────────────────────────────────────
function getPasswordStrength(pw: string): {
  score: number;       // 0–4
  label: string;
  color: string;
  bgColor: string;
} {
  if (!pw) return { score: 0, label: '', color: '', bgColor: '' };

  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw))   score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  // Cap at 4
  score = Math.min(score, 4);

  const levels = [
    { label: 'Too short',  color: 'text-red-500',    bgColor: 'bg-red-500'    },
    { label: 'Weak',       color: 'text-red-400',    bgColor: 'bg-red-400'    },
    { label: 'Fair',       color: 'text-amber-400',  bgColor: 'bg-amber-400'  },
    { label: 'Good',       color: 'text-blue-400',   bgColor: 'bg-blue-400'   },
    { label: 'Strong',     color: 'text-emerald-400',bgColor: 'bg-emerald-400'},
  ];

  return { score, ...levels[score] };
}

// ── Validation ────────────────────────────────────────────────────────────────
function validatePassword(pw: string): string | null {
  if (pw.length < 8)                           return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw))                       return 'Include at least one uppercase letter.';
  if (!/[a-z]/.test(pw))                       return 'Include at least one lowercase letter.';
  if (!/\d/.test(pw))                          return 'Include at least one number.';
  if (!/[^A-Za-z0-9]/.test(pw))               return 'Include at least one special character (!@#$...).';
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ResetPasswordPage() {
  const [searchParams]  = useSearchParams();
  const navigate        = useNavigate();
  const { resetPassword } = useAuth();

  // Pull email + token from URL query params
  const emailParam = searchParams.get('email') || '';
  const tokenParam = searchParams.get('token') || '';

  const [password, setPassword]       = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError]             = useState('');
  const [status, setStatus]           = useState<'idle' | 'loading' | 'success'>('idle');

  // If no token/email in URL, the link is broken
  const isBrokenLink = !emailParam || !tokenParam;

  const strength    = getPasswordStrength(password);
  const pwError     = password ? validatePassword(password) : null;
  const matchError  = confirmPw && password !== confirmPw ? 'Passwords do not match.' : null;
  const canSubmit   = !pwError && !matchError && password.length > 0 && confirmPw.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validatePassword(password);
    if (validationError) { setError(validationError); return; }
    if (password !== confirmPw) { setError('Passwords do not match.'); return; }

    setStatus('loading');
    try {
      await resetPassword(emailParam, tokenParam, password);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed. The link may have expired.');
      setStatus('idle');
    }
  };

  // ── Broken link state ──────────────────────────────────────────────────────
  if (isBrokenLink) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
                <AlertCircle className="text-white" size={24} />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">Invalid Reset Link</h1>
          </div>
          <Card className="border-slate-700 bg-slate-800">
            <CardContent className="pt-6 space-y-4 text-center">
              <p className="text-slate-300 text-sm leading-relaxed">
                This password reset link is incomplete or has already been used.
                Reset links are single-use and expire after 15 minutes.
              </p>
              <p className="text-slate-400 text-xs">
                Request a new link from the login page.
              </p>
              <Link to="/login">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 mt-2">
                  Back to Login
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center">
                <ShieldCheck className="text-white" size={24} />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">Password Reset!</h1>
          </div>
          <Card className="border-slate-700 bg-slate-800">
            <CardContent className="pt-6 space-y-4">
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <CheckCircle className="h-10 w-10 text-emerald-400" />
                <p className="text-slate-300 text-sm leading-relaxed">
                  Your password has been reset successfully. You can now sign in with your new password.
                </p>
              </div>
              <Button
                onClick={() => navigate('/login', { replace: true })}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Reset form ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <Lock className="text-white" size={24} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white">MASID</h1>
          <p className="text-slate-400">Monitoring and Automated Standards Inspection Dashboard</p>
        </div>

        <Card className="border-slate-700 bg-slate-800">
          <CardHeader className="space-y-1">
            <CardTitle className="text-white">Set new password</CardTitle>
            <CardDescription>
              Resetting password for{' '}
              <span className="text-blue-400 font-medium">{emailParam}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error alert */}
              {error && (
                <Alert variant="destructive" className="bg-red-950 border-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* New password */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">New password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                  <Input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={status === 'loading'}
                    className="pl-10 pr-10 bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                    required
                    autoFocus
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                {/* Strength meter */}
                {password && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            strength.score >= level ? strength.bgColor : 'bg-slate-600'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${strength.color}`}>{strength.label}</span>
                      {pwError && (
                        <span className="text-xs text-red-400">{pwError}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Confirm password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                  <Input
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    disabled={status === 'loading'}
                    className={`pl-10 pr-10 bg-slate-700 border-slate-600 text-white placeholder-slate-400 ${
                      matchError ? 'border-red-500' : confirmPw && !matchError ? 'border-emerald-500' : ''
                    }`}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {matchError && (
                  <p className="text-xs text-red-400">{matchError}</p>
                )}
                {confirmPw && !matchError && (
                  <p className="text-xs text-emerald-400">✓ Passwords match</p>
                )}
              </div>

              {/* Requirements list */}
              <ul className="text-xs text-slate-400 space-y-1 pt-1">
                {[
                  { check: password.length >= 8,          text: 'At least 8 characters' },
                  { check: /[A-Z]/.test(password) && /[a-z]/.test(password), text: 'Uppercase and lowercase letters' },
                  { check: /\d/.test(password),            text: 'At least one number' },
                  { check: /[^A-Za-z0-9]/.test(password), text: 'At least one special character' },
                ].map(({ check, text }) => (
                  <li key={text} className={`flex items-center gap-1.5 ${check ? 'text-emerald-400' : ''}`}>
                    <span>{check ? '✓' : '○'}</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>

              {/* Submit */}
              <Button
                type="submit"
                disabled={status === 'loading' || !canSubmit}
                className="w-full bg-blue-600 hover:bg-blue-700 mt-2"
              >
                {status === 'loading' ? 'Resetting...' : 'Reset Password'}
              </Button>

              {/* Cancel */}
              <Link to="/login" className="block">
                <button
                  type="button"
                  className="w-full text-sm text-slate-400 hover:text-slate-300 transition-colors pt-1"
                >
                  Cancel — Back to Sign In
                </button>
              </Link>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-slate-400">
          Powered by Department of Information and Communications Technology
        </p>
      </div>
    </div>
  );
}
