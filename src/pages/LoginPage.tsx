import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, CheckCircle, Lock, Mail, User } from 'lucide-react';

const LOGIN_CONFIG = {
  MESSAGES: {
    RESET_SENT:
      'If an account exists for this email, you will receive a password reset link shortly. Check your inbox and spam folder.',
  },
  UI: {
    TITLE: 'MASID',
    SUBTITLE: 'Monitoring and Automated Standards Inspection Dashboard',
    CARD_TITLE: 'Government Agency Login',
    CARD_DESCRIPTION: 'Enter your shared account credentials',
    ORGANIZATION: 'Department of Information and Communications Technology',
  },
  PLACEHOLDER: {
    EMAIL: 'name@dict.gov.ph',
  },
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [view, setView] = useState<'login' | 'forgot'>('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<'idle' | 'loading' | 'sent'>('idle');
  const [forgotError, setForgotError] = useState('');

  const navigate = useNavigate();
  const { login, isAuthenticated, requestPasswordReset, user } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      const landingPage = user?.settings?.dashboard?.landingPage || 'dashboard';
      navigate(`/${landingPage}`, { replace: true });
    }
  }, [isAuthenticated, navigate, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setForgotError('');
    setForgotStatus('loading');

    try {
      await requestPasswordReset(forgotEmail.trim());
      setForgotStatus('sent');
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Request failed. Please try again.');
      setForgotStatus('idle');
    }
  };

  if (view === 'forgot') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="space-y-8 w-full max-w-md">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <Lock className="text-white" size={24} />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white">{LOGIN_CONFIG.UI.TITLE}</h1>
            <p className="text-slate-400">{LOGIN_CONFIG.UI.SUBTITLE}</p>
          </div>

          <Card className="border-slate-700 bg-slate-800">
            <CardHeader className="space-y-1">
              <CardTitle className="text-white">Reset your password</CardTitle>
              <CardDescription>
                Enter your email address and we&apos;ll send you a link to reset your password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {forgotStatus === 'sent' ? (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <CheckCircle className="h-12 w-12 text-green-400" />
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {LOGIN_CONFIG.MESSAGES.RESET_SENT}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setView('login')}
                    className="w-full border-slate-600 text-slate-200 hover:bg-slate-700"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  {forgotError && (
                    <Alert variant="destructive" className="bg-red-950 border-red-800">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{forgotError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Email address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                      <Input
                        type="email"
                        placeholder={LOGIN_CONFIG.PLACEHOLDER.EMAIL}
                        value={forgotEmail}
                        onChange={(event) => setForgotEmail(event.target.value)}
                        disabled={forgotStatus === 'loading'}
                        className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={forgotStatus === 'loading' || !forgotEmail.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {forgotStatus === 'loading' ? 'Sending...' : 'Send Reset Link'}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setView('login')}
                    className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors pt-1"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Sign In
                  </button>
                </form>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-sm text-slate-400">
            Powered by {LOGIN_CONFIG.UI.ORGANIZATION}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="space-y-8 w-full max-w-md">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <Lock className="text-white" size={24} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white">{LOGIN_CONFIG.UI.TITLE}</h1>
          <p className="text-slate-400">{LOGIN_CONFIG.UI.SUBTITLE}</p>
        </div>

        <Card className="border-slate-700 bg-slate-800">
          <CardHeader className="space-y-1">
            <CardTitle className="text-white">{LOGIN_CONFIG.UI.CARD_TITLE}</CardTitle>
            <CardDescription>{LOGIN_CONFIG.UI.CARD_DESCRIPTION}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-950 border-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Email</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                  <Input
                    type="email"
                    placeholder={LOGIN_CONFIG.PLACEHOLDER.EMAIL}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={isLoading}
                    className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                  <Input
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isLoading}
                    className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading || !email || !password}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setView('forgot');
                    setError('');
                    setForgotEmail('');
                    setForgotStatus('idle');
                    setForgotError('');
                  }}
                  className="text-sm text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                >
                  Forgot your password?
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-slate-400">
          Powered by {LOGIN_CONFIG.UI.ORGANIZATION}
        </p>
      </div>
    </div>
  );
}
