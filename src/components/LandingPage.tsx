import { Shield, FileSearch, BarChart3, Zap, Globe, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const features = [
  {
    icon: Globe,
    title: "URL Scanning",
    description: "Paste any Philippine government website URL and get an instant GWT compliance audit.",
  },
  {
    icon: FileSearch,
    title: "File Upload",
    description: "Drag & drop local HTML files for offline evaluation against GWT standards.",
  },
  {
    icon: Shield,
    title: "Accessibility Checks",
    description: "Automated checks for ALT tags, font sizes, load time, descriptive URLs, and more.",
  },
  {
    icon: BarChart3,
    title: "Web Presence Scoring",
    description: "Evaluate all 4 stages of web presence — from Emerging to Connected.",
  },
  {
    icon: Zap,
    title: "Real-Time Progress",
    description: "Watch each audit stage complete in real-time with a live progress checklist.",
  },
  {
    icon: FileSpreadsheet,
    title: "Excel Reports",
    description: "Auto-generate audit summary reports matching the official DICT template.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            <span className="font-display text-xl font-bold text-foreground">GWT Auditor</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link to="/login?signup=true">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16">
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative container mx-auto px-4 py-24 md:py-32 lg:py-40">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-1.5 text-sm text-primary-foreground">
              <Shield className="h-4 w-4" />
              Philippine Government Web Standards
            </div>
            <h1 className="font-display text-4xl font-800 leading-tight tracking-tight text-primary-foreground md:text-5xl lg:text-6xl">
              Automated GWT
              <span className="block mt-1">Web Auditor</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-primary-foreground/75 md:text-xl">
              Evaluate government websites against DICT's Web Accessibility and 
              Presence guidelines. Get instant compliance reports with actionable insights.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link to="/login?signup=true">
                <Button variant="hero" size="lg" className="text-base px-8 py-6">
                  Start Auditing
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="hero-outline" size="lg" className="text-base px-8 py-6">
                  Sign In
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
        {/* Bottom wave */}
        <div className="relative h-16 md:h-24">
          <svg className="absolute bottom-0 w-full" viewBox="0 0 1440 60" fill="none" preserveAspectRatio="none">
            <path d="M0 60V20C240 50 480 0 720 20C960 40 1200 10 1440 30V60H0Z" fill="hsl(var(--background))" />
          </svg>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mx-auto mb-16 max-w-2xl text-center"
          >
            <h2 className="font-display text-3xl font-bold text-foreground md:text-4xl">
              Comprehensive Audit Engine
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Everything you need to assess Philippine government website compliance, 
              all in one streamlined platform.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="group rounded-xl border border-border bg-card p-6 shadow-card transition-all hover:shadow-elevated hover:-translate-y-1"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg font-bold text-card-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl rounded-2xl bg-gradient-hero p-10 text-center md:p-16 shadow-glow">
            <h2 className="font-display text-2xl font-bold text-primary-foreground md:text-3xl">
              Ready to audit your website?
            </h2>
            <p className="mt-4 text-primary-foreground/70">
              Create your free account and run your first GWT compliance audit in minutes.
            </p>
            <Link to="/login?signup=true">
              <Button variant="hero" size="lg" className="mt-8 text-base px-8 py-6">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>GWT Automated Web Auditor — Based on DICT Web Accessibility Assessment Guidelines</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
