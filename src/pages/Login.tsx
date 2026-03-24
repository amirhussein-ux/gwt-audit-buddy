import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Mail, Lock, User } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

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
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-hero items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative z-10 max-w-md px-8 text-center">
          <Shield className="mx-auto h-16 w-16 text-primary-foreground/90 mb-6" />
          <h2 className="font-display text-3xl font-bold text-primary-foreground">GWT Auditor</h2>
          <p className="mt-4 text-primary-foreground/70 leading-relaxed">
            Automated compliance checking for Philippine government websites based on DICT standards.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-10 lg:hidden">
            <Shield className="h-7 w-7 text-primary" />
            <span className="font-display text-xl font-bold text-foreground">GWT Auditor</span>
          </Link>

          <h1 className="font-display text-2xl font-bold text-foreground">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isSignup ? "Start auditing government websites today." : "Sign in to your audit dashboard."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {isSignup && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
              />
            </div>

            <Button type="submit" className="w-full" size="lg">
              {isSignup ? "Create Account" : "Sign In"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => setIsSignup(!isSignup)}
              className="font-medium text-primary hover:underline"
            >
              {isSignup ? "Sign in" : "Sign up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
