import { Shield, FileSearch, BarChart3, Zap, Globe, FileSpreadsheet, Search, CheckCircle2, FileCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

import { motion } from "framer-motion";

import { Link } from "react-router-dom";

import { LucideIcon } from 'lucide-react';

const features = [

{

icon: Zap,

title: "Automation",

description: "Accelerate inspection workflows with intelligent automation, reducing manual effort and increasing throughput.",

},

{

icon: Globe,

title: "Web Integration",

description: "Seamlessly integrate with web platforms and access the dashboard from anywhere, anytime.",

},

{

icon: BarChart3,

title: "Analytics & Reports",

description: "Generate comprehensive reports with data-driven insights for informed decision making.",

},

{

icon: FileSearch,

title: "Documentation",

description: "Maintain centralized documentation with complete audit trails for compliance and transparency.",

},

{

icon: Shield,

title: "Standardization",

description: "Ensure uniform evaluation criteria across all inspections with automated standardized checks.",

},

{

icon: Search,

title: "Monitoring",

description: "Real-time monitoring and tracking of inspection processes with comprehensive visibility.",

},

];

const containerVariants = {

hidden: {},

visible: {

transition: {

staggerChildren: 0.12,

delayChildren: 0.2,

},

},

};

const cardVariants = {

hidden: {

opacity: 0,

y: 40,

scale: 0.95,

},

visible: {

opacity: 1,

y: 0,

scale: 1,

transition: {

duration: 0.5,

ease: [0.25, 0.8, 0.25, 1], // smoother than easeOut

},

},

};

interface FeatureCardProps {

icon: LucideIcon;

title: string;

description: string;

}

export function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {

return (

<div className="bg-[#1a0b2e] rounded-2xl p-8 border border-white/10 hover:border-purple-500/50 transition-all duration-300 group cursor-pointer">

<div className="bg-gradient-to-br from-purple-600/20 to-purple-500/20 w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:from-purple-600/30 group-hover:to-purple-500/30 transition-all">

<Icon className="w-7 h-7 text-purple-400" />

</div>

<h3 className="text-white text-xl mb-3">{title}</h3>

<p className="text-white/50 text-sm leading-relaxed">{description}</p>

</div>

);

}

const LandingPage = () => {

return (

<div className="min-h-screen bg-gradient-to-b from-[#0a0118] via-[#1a0b2e] to-[#0a0118]">

{/* Header with Glassmorphism */}

<header className="sticky top-0 z-50 backdrop-blur-[30px] bg-[#13031F]/20 border-b border-white/10">

<div className="container mx-auto px-6 py-4 flex items-center justify-between">

<div className="flex items-center gap-3">

<img src="/masidlogonobg.png" alt="MASID" className="w-7 h-7" />

<span className="text-white text-xl tracking-wide font-bold">MASID</span>

</div>

<Link to="/login">

<nav className="flex items-center gap-8">

<button className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all duration-300">

Login

</button>

</nav>

</Link>

</div>

<div className="h-px bg-gradient-to-r from-transparent via-[#160323] to-transparent"></div>

</header>

{/* Hero Section */}

<section className="relative min-h-[600px] flex items-center justify-center overflow-hidden">

<motion.div

className="absolute inset-0 bg-cover bg-center"

style={{ backgroundImage: `url(/masidherobg.jpg)` }}

animate={{ scale: [1, 1.05, 1] }}

transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}

>

<div className="absolute inset-0 bg-gradient-to-b from-[#110620]/60 via-[#110620]/40 to-[#110620]"></div>

</motion.div>

<div className="relative z-10 text-center px-6 py-20">

<img

src="/masidlogoOutline.png"

alt="MASID"

className="h-24 mx-auto mb-6 drop-shadow-[0_0_30px_rgba(168,85,247,0.5)]"

/>

<p className="text-xl text-white/70 mb-12 max-w-2xl mx-auto">

Monitoring and Automated Standards Inspection Dashboard

</p>

<div className="mt-12 flex flex-col items-center gap-4 sm:flex-row justify-center">

<Link to="/login?signup=true">

<motion.button

whileHover={{ scale: 1.05 }}

whileTap={{ scale: 0.95 }}

className="px-8 py-3 rounded-xl bg-white/10 backdrop-blur-md text-white font-semibold border border-white/30 hover:bg-white/20 transition-all"

>

Start Auditing

</motion.button>

</Link>

</div>

</div>

<div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#160323] to-transparent"></div>

</section>

{/* Features */}

<section className="py-24">

<div className="max-w-7xl mx-auto px-8">

{/* Title */}

<div className="text-center mb-16">

<h2 className="text-white text-4xl font-semibold mb-4">

Explore by Features

</h2>

</div>

{/* Cards */}

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">

{features.map((feature, i) => (

<FeatureCard

key={i}

icon={feature.icon}

title={feature.title}

description={feature.description}

/>

))}

</div>

</div>

</section>

{/* CTA Section */}

<section className="relative py-24 px-6 bg-gradient-to-b from-[#1a0a2e] to-[#13031F]">

<div className="container mx-auto max-w-4xl text-center">

<h2 className="text-white text-4xl mb-6">

Start Streamlining Your Inspections Today

</h2>

<p className="text-xl text-white/60 mb-10">

Transform your inspection workflow with intelligent automation and standardized processes.

Join organizations that are already experiencing increased efficiency.

</p>

<Link to="/login">

<motion.button

whileHover={{ scale: 1.05 }}

whileTap={{ scale: 0.95 }}

className="px-12 py-4 rounded-xl bg-gradient-to-r from-purple-600 via-purple-500 to-purple-600 hover:shadow-[0_0_50px_rgba(168,85,247,0.6)] transition-all duration-300 text-white text-lg"

>

Get Started

</motion.button>

</Link>

</div>

</section>

{/* Footer */}

<footer className="relative bg-[#0a0314] border-t border-purple-900/30">

<div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent"></div>

<div className="container mx-auto px-6 py-8">

<div className="flex items-center justify-between">

<div className="flex items-center gap-4">

<div className="w-9 h-9">

<img src="/pilipinsLogo.png" alt="Bagong Pilipinas"/>

</div>

<div className="w-7 h-7">

<img src="/dictLogo.png" alt="DICT"/>

</div>

<div className="w-7 h-7">

<img src="/nippsbLogo.png" alt="NIPPSB"/>

</div>

</div>

<p className="text-white/50 text-sm">

© 2026 DICT | NIPPSB. All rights reserved. v1.0.0

</p>

</div>

</div>

</footer>

</div>

);

};

export default LandingPage;