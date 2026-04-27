import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

type VerificationState = 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email')?.trim().toLowerCase() || '';
  const token = searchParams.get('token')?.trim() || '';
  const [status, setStatus] = useState<VerificationState>(email && token ? 'verifying' : 'error');
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState(email);
  const [resendState, setResendState] = useState<'idle' | 'loading' | 'done'>('idle');

  const errorMessage = useMemo(() => {
    if (email && token) {
      return message || 'This verification link is invalid or has expired.';
    }
    return 'This verification link is incomplete. Request a new verification email and try again.';
  }, [email, message, token]);

  useEffect(() => {
    if (!email || !token) {
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, token }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || 'Email verification failed.');
        }

        setMessage(data.message || 'Email verified successfully.');
        setStatus('success');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Email verification failed.');
        setStatus('error');
      }
    };

    verifyEmail();
  }, [email, token]);

  const handleResend = async () => {
    if (!resendEmail) {
      setMessage('Email is required to resend the verification link.');
      setStatus('error');
      return;
    }

    setResendState('loading');
    try {
      const response = await fetch(`${API_BASE}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail.trim().toLowerCase() }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend verification email.');
      }

      setMessage(data.message || 'Verification email sent.');
      setResendState('done');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to resend verification email.');
      setResendState('idle');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-900 text-slate-50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600/20">
            {status === 'success' ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            ) : status === 'verifying' ? (
              <Mail className="h-6 w-6 text-blue-400" />
            ) : (
              <AlertCircle className="h-6 w-6 text-amber-400" />
            )}
          </div>
          <CardTitle>
            {status === 'success' ? 'Email Verified' : status === 'verifying' ? 'Verifying Email' : 'Verification Needed'}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {status === 'success'
              ? 'Your account is ready to sign in.'
              : 'We are validating your verification link.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'verifying' && (
            <p className="text-sm text-slate-300">Please wait while we confirm your email address.</p>
          )}

          {status === 'success' && (
            <Alert className="border-emerald-800 bg-emerald-950/40">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {status === 'error' && (
            <>
              <Alert variant="destructive" className="border-amber-800 bg-amber-950/40 text-slate-50">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
              <div className="space-y-3">
                <Input
                  type="email"
                  value={resendEmail}
                  onChange={(event) => setResendEmail(event.target.value)}
                  placeholder="you@example.gov.ph"
                  className="border-slate-700 bg-slate-800 text-slate-50"
                />
                <Button
                  type="button"
                  onClick={handleResend}
                  disabled={resendState === 'loading'}
                  className="w-full"
                >
                  {resendState === 'loading' ? 'Sending...' : 'Resend Verification Email'}
                </Button>
              </div>
            </>
          )}

          {resendState === 'done' && status !== 'success' && (
            <Alert className="border-blue-800 bg-blue-950/30">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <Link to="/login" className="block">
            <Button variant="outline" className="w-full border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800">
              Back to Sign In
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
