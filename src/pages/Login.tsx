import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Mail, Lock, User } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

// Login page configuration
const LOGIN_CONFIG = {
  ICON_SIZE: 'h-4 w-4',
  LOGO_SIZE_DESKTOP: 'h-16 w-16',
  LOGO_SIZE_MOBILE: 'h-7 w-7',
  ICON_CLASS: 'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pl-10',
};

// Login page text content
const LOGIN_TEXT = {
  HERO_TITLE: 'GWT Auditor',
  HERO_SUBTITLE: 'Automated compliance checking for Philippine government websites based on DICT standards.',
  
  LOGIN_TITLE: 'Welcome back',
  LOGIN_SUBTITLE: 'Sign in to your audit dashboard.',
  
  SIGNUP_TITLE: 'Create your account',
  SIGNUP_SUBTITLE: 'Start auditing government websites today.',
  
  FORM_NAME_PLACEHOLDER: 'Full name',
  FORM_EMAIL_PLACEHOLDER: 'Email address',
  FORM_PASSWORD_PLACEHOLDER: 'Password',
  
  BUTTON_LOGIN: 'Sign In',
  BUTTON_SIGNUP: 'Create Account',
  BUTTON_LOADING: 'Processing...',
  
  TOGGLE_QUESTION_LOGIN: "Don't have an account?",
  TOGGLE_QUESTION_SIGNUP: 'Already have an account?',
  TOGGLE_ACTION_LOGIN: 'Sign up',
  TOGGLE_ACTION_SIGNUP: 'Sign in',
};

interface LoginFormFieldProps {
  icon: React.ReactNode;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

/**
 * Reusable login form input field with icon
 */
const LoginFormField: React.FC<LoginFormFieldProps> = ({
  icon,
  placeholder,
  type = 'text',
  value,
  onChange,
  required = false,
}) => (
  <div className="relative">
    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
      {icon}
    </div>
    <Input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="pl-10"
      required={required}
    />
  </div>
);

/**
 * Left panel with hero section
 */
const HeroPanel = () => (
  <div className="hidden lg:flex lg:w-1/2 bg-gradient-hero items-center justify-center relative overflow-hidden">
    <div
      className="absolute inset-0 opacity-10"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      }}
    />
    <div className="relative z-10 max-w-md px-8 text-center">
      <Shield className={`mx-auto ${LOGIN_CONFIG.LOGO_SIZE_DESKTOP} text-primary-foreground/90 mb-6`} />
      <h2 className="font-display text-3xl font-bold text-primary-foreground">{LOGIN_TEXT.HERO_TITLE}</h2>
      <p className="mt-4 text-primary-foreground/70 leading-relaxed">{LOGIN_TEXT.HERO_SUBTITLE}</p>
    </div>
  </div>
);

/**
 * Right panel with login form
 */
interface FormPanelProps {
  isSignup: boolean;
  setIsSignup: (value: boolean) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  fullName: string;
  setFullName: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const FormPanel: React.FC<FormPanelProps> = ({
  isSignup,
  setIsSignup,
  email,
  setEmail,
  password,
  setPassword,
  fullName,
  setFullName,
  onSubmit,
}) => (
  <div className="flex w-full lg:w-1/2 items-center justify-center p-8">
    <div className="w-full max-w-md">
      {/* Mobile header */}
      <Link to="/" className="flex items-center gap-2 mb-10 lg:hidden">
        <Shield className={`${LOGIN_CONFIG.LOGO_SIZE_MOBILE} text-primary`} />
        <span className="font-display text-xl font-bold text-foreground">{LOGIN_TEXT.HERO_TITLE}</span>
      </Link>

      {/* Form header */}
      <h1 className="font-display text-2xl font-bold text-foreground">
        {isSignup ? LOGIN_TEXT.SIGNUP_TITLE : LOGIN_TEXT.LOGIN_TITLE}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {isSignup ? LOGIN_TEXT.SIGNUP_SUBTITLE : LOGIN_TEXT.LOGIN_SUBTITLE}
      </p>

      {/* Form */}
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {isSignup && (
          <LoginFormField
            icon={<User className={LOGIN_CONFIG.ICON_SIZE} />}
            placeholder={LOGIN_TEXT.FORM_NAME_PLACEHOLDER}
            value={fullName}
            onChange={setFullName}
          />
        )}
        <LoginFormField
          icon={<Mail className={LOGIN_CONFIG.ICON_SIZE} />}
          placeholder={LOGIN_TEXT.FORM_EMAIL_PLACEHOLDER}
          type="email"
          value={email}
          onChange={setEmail}
          required
        />
        <LoginFormField
          icon={<Lock className={LOGIN_CONFIG.ICON_SIZE} />}
          placeholder={LOGIN_TEXT.FORM_PASSWORD_PLACEHOLDER}
          type="password"
          value={password}
          onChange={setPassword}
          required
        />

        <Button type="submit" className="w-full" size="lg">
          {isSignup ? LOGIN_TEXT.BUTTON_SIGNUP : LOGIN_TEXT.BUTTON_LOGIN}
        </Button>
      </form>

      {/* Toggle between login/signup */}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isSignup ? LOGIN_TEXT.TOGGLE_QUESTION_SIGNUP : LOGIN_TEXT.TOGGLE_QUESTION_LOGIN}{" "}
        <button
          onClick={() => setIsSignup(!isSignup)}
          className="font-medium text-primary hover:underline"
        >
          {isSignup ? LOGIN_TEXT.TOGGLE_ACTION_SIGNUP : LOGIN_TEXT.TOGGLE_ACTION_LOGIN}
        </button>
      </p>
    </div>
  </div>
);

/**
 * Login page component
 */
const Login = () => {
  const [searchParams] = useSearchParams();
  const [isSignup, setIsSignup] = useState(searchParams.get("signup") === "true");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Auth will be wired when Cloud is enabled
  };

  return (
    <div className="flex min-h-screen">
      <HeroPanel />
      <FormPanel
        isSignup={isSignup}
        setIsSignup={setIsSignup}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        fullName={fullName}
        setFullName={setFullName}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default Login;
