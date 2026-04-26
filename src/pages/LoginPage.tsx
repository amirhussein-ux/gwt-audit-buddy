import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Lock, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const LOGIN_CONFIG = {
  ICON_SIZE: 'h-4 w-4',
  DICT_DOMAIN: '@dict.gov.ph',
};

type View = 'login' | 'forgot' | 'forgot-sent';

interface LoginFormFieldProps {
  icon: React.ReactNode;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

const LoginFormField: React.FC<LoginFormFieldProps> = ({
  icon, placeholder, type = 'text', value, onChange, required = false,
}) => (
  <div className="relative">
    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
      {icon}
    </div>
    <Input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="pl-10 bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl focus:border-purple-500/60 focus:ring-purple-500/20 transition-all"
      required={required}
    />
  </div>
);

const HeroPanel = () => (
  <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden">
    <motion.div
      className="absolute inset-0 bg-cover bg-center"
      style={{ backgroundImage: 'url(/masidLoginbg.jpg)' }}
      animate={{ scale: [1, 1.04, 1] }}
      transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
    />
    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(7,2,15,0.88)_0%,rgba(17,6,32,0.7)_42%,rgba(10,1,24,0.9)_100%)]" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(192,132,252,0.16),transparent_48%)]" />
    <div className="relative z-10 max-w-md px-12 text-center">
      <img
        src="/masidlogoOutline.png"
        alt="MASID"
        className="h-18 mx-auto mb-6 drop-shadow-[0_0_30px_rgba(168,85,247,0.5)]"
      />
      <p className="text-white/60 leading-relaxed">
        Monitoring and Automated Standards Inspection Dashboard
      </p>
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
    </div>
  </div>
);

const cardVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
};

const Login = () => {
  const [view, setView] = useState<View>('login');

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password fields
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const { login, requestPasswordReset } = useAuth();
  const navigate = useNavigate();

  const DEMO_EMAIL = (import.meta as any).env.VITE_DEMO_EMAIL || '';
  const DEMO_PASSWORD = (import.meta as any).env.VITE_DEMO_PASSWORD || '';

  // --- Login ---
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.toLowerCase().endsWith(LOGIN_CONFIG.DICT_DOMAIN)) {
      setError(`Only DICT email addresses (${LOGIN_CONFIG.DICT_DOMAIN}) are allowed.`);
      return;
    }
    setIsLoading(true);
    try {
      const authenticatedUser = await login(email, password);
      const landingPage = authenticatedUser.settings?.dashboard?.landingPage || 'dashboard';
      navigate(`/${landingPage}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Forgot password ---
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (!forgotEmail.toLowerCase().endsWith(LOGIN_CONFIG.DICT_DOMAIN)) {
      setForgotError(`Please enter a valid DICT webmail address (${LOGIN_CONFIG.DICT_DOMAIN}).`);
      return;
    }
    setForgotLoading(true);
    try {
      await requestPasswordReset(forgotEmail.trim());
      setView('forgot-sent');
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Failed to send reset email. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const goBack = () => {
    setView('login');
    setForgotEmail('');
    setForgotError('');
    setError('');
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-[#0a0118] via-[#1a0b2e] to-[#0a0118]">
      <HeroPanel />

      {/* Right panel */}
      <div className="relative flex w-full lg:w-1/2 items-center justify-center overflow-hidden bg-gradient-to-b from-[#0a0118] via-[#1a0b2e] to-[#0a0118] p-8">
        <div className="relative z-10 w-full max-w-md space-y-6">

          {/* Mobile header */}
          <div className="lg:hidden text-center mb-8">
            <img
              src="/masidlogoOutline.png"
              alt="MASID"
              className="h-16 mx-auto mb-4 drop-shadow-[0_0_20px_rgba(168,85,247,0.5)]"
            />
            <h1 className="text-2xl font-bold text-white">MASID</h1>
            <p className="text-white/50 text-sm mt-1">Monitoring and Automated Standards Inspection Dashboard</p>
          </div>

          {/* Animated card switcher */}
          <AnimatePresence mode="wait">

            {/* ── LOGIN VIEW ── */}
            {view === 'login' && (
              <motion.div
                key="login"
                variants={cardVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="bg-[#1a0b2e] border border-white/10 rounded-2xl p-8 shadow-[0_0_40px_rgba(168,85,247,0.08)]"
              >
                <div className="mb-6">
                  <h2 className="text-white text-2xl font-semibold">Welcome back</h2>
                  <p className="text-white/50 text-sm mt-1">Sign in to your audit dashboard.</p>
                </div>

                {error && (
                  <Alert className="mb-4 bg-red-950/50 border-red-500/30 rounded-xl">
                    <AlertCircle className="h-4 w-4 text-red-400" />
                    <AlertDescription className="text-red-300">{error}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <LoginFormField
                    icon={<Mail className={LOGIN_CONFIG.ICON_SIZE} />}
                    placeholder={`DICT Webmail (name${LOGIN_CONFIG.DICT_DOMAIN})`}
                    type="email"
                    value={email}
                    onChange={setEmail}
                    required
                  />
                  <div className="space-y-1">
                    <LoginFormField
                      icon={<Lock className={LOGIN_CONFIG.ICON_SIZE} />}
                      placeholder="Password"
                      type="password"
                      value={password}
                      onChange={setPassword}
                      required
                    />
                    {/* Forgot password link */}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => { setView('forgot'); setError(''); }}
                        className="text-xs text-purple-400 hover:text-purple-300 hover:underline transition-colors pt-1"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={isLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-semibold hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </motion.button>
                </form>
              </motion.div>
            )}

            {/* ── FORGOT PASSWORD — ENTER EMAIL ── */}
            {view === 'forgot' && (
              <motion.div
                key="forgot"
                variants={cardVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="bg-[#1a0b2e] border border-white/10 rounded-2xl p-8 shadow-[0_0_40px_rgba(168,85,247,0.08)]"
              >
                {/* Back button */}
                <button
                  onClick={goBack}
                  className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm mb-6 transition-colors group"
                >
                  <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                  Back to sign in
                </button>

                <div className="mb-6">
                  <h2 className="text-white text-2xl font-semibold">Reset password</h2>
                  <p className="text-white/50 text-sm mt-1">
                    Enter your DICT webmail and we'll send you a reset link.
                  </p>
                </div>

                {forgotError && (
                  <Alert className="mb-4 bg-red-950/50 border-red-500/30 rounded-xl">
                    <AlertCircle className="h-4 w-4 text-red-400" />
                    <AlertDescription className="text-red-300">{forgotError}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <LoginFormField
                    icon={<Mail className={LOGIN_CONFIG.ICON_SIZE} />}
                    placeholder={`DICT Webmail (name${LOGIN_CONFIG.DICT_DOMAIN})`}
                    type="email"
                    value={forgotEmail}
                    onChange={setForgotEmail}
                    required
                  />

                  <motion.button
                    type="submit"
                    disabled={forgotLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-semibold hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                  </motion.button>
                </form>
              </motion.div>
            )}

            {/* ── FORGOT PASSWORD — CONFIRMATION ── */}
            {view === 'forgot-sent' && (
              <motion.div
                key="forgot-sent"
                variants={cardVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="bg-[#1a0b2e] border border-white/10 rounded-2xl p-8 shadow-[0_0_40px_rgba(168,85,247,0.08)] text-center"
              >
                <div className="flex items-center justify-center mb-5">
                  <div className="bg-purple-600/20 rounded-full p-4">
                    <CheckCircle2 className="h-10 w-10 text-purple-400" />
                  </div>
                </div>
                <h2 className="text-white text-2xl font-semibold mb-2">Check your email</h2>
                <p className="text-white/50 text-sm leading-relaxed mb-2">
                  A password reset link has been sent to
                </p>
                <p className="text-purple-400 text-sm font-medium mb-6 break-all">{forgotEmail}</p>
                <p className="text-white/30 text-xs mb-8">
                  Didn't receive it? Check your spam folder or make sure the address is a valid DICT webmail.
                </p>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={goBack}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-semibold hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all duration-300"
                >
                  Back to Sign In
                </motion.button>
              </motion.div>
            )}

          </AnimatePresence>

          {/* Demo credentials (dev only) */}
          {DEMO_EMAIL && DEMO_PASSWORD && view === 'login' && (
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <p className="text-sm font-medium text-white/70 mb-1">Demo Credentials</p>
              <p className="text-xs text-white/40">
                <strong>Email:</strong> {DEMO_EMAIL}<br />
                <strong>Password:</strong> {'•'.repeat(DEMO_PASSWORD.length)}
              </p>
              <p className="text-xs text-yellow-400/70 mt-2">⚠️ Development mode only.</p>
            </div>
          )}

          <p className="text-center text-xs text-white/30">
            Powered by Department of Information and Communications Technology
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
