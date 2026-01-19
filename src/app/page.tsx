"use client";
import Link from "next/link";
import Image from "next/image";
import { useUser } from "@/context/UserContext";
import { FileText, Brain, BookOpen, Sparkles, Zap, Target, Database, Network, TrendingUp, ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const { user, setUser } = useUser();

  useEffect(() => {
    if (!user) {
      fetch("/api/auth/me", {
        credentials: "include",
      })
        .then((res) => {
          if (res.ok) {
            return res.json();
          }
          return null;
        })
        .then((data) => {
          if (data?.user) {
            setUser(data.user);
          }
        })
        .catch(() => {
          // Silently fail if not logged in
        });
    }
  }, [user, setUser]);

  const tools = [
    {
      icon: Brain,
      title: "AI Business Brain",
      description: "Advanced AI-powered business intelligence and insights that help you make data-driven decisions.",
      benefits: [
        "Get instant answers to business questions",
        "Access your organization's knowledge base",
        "Generate insights from conversations",
      ],
      href: "/dashboard/ai-business-brain",
      disabled: false,
    },
    {
      icon: FileText,
      title: "Job Description Builder AI",
      description: "Create comprehensive, optimized job descriptions with AI-powered analysis and recommendations.",
      benefits: [
        "Generate detailed job descriptions instantly",
        "Get AI recommendations for requirements",
        "Ensure compliance and best practices",
      ],
      href: "/dashboard",
      disabled: false,
    },
    {
      icon: BookOpen,
      title: "Process Builder",
      description: "Automatically generate standard operating procedures for your business processes and workflows.",
      benefits: [
        "Document processes automatically",
        "Create consistent procedures",
        "Improve team efficiency",
      ],
      href: null,
      disabled: true,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <nav className="border-b border-border/20 sticky top-0 z-50 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <Image
                src="/icon.png"
                alt="L9V AI Tools"
                width={40}
                height={40}
                className="rounded-lg"
                priority
              />
              <span className="text-xl font-semibold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Level 9 Virtual
              </span>
            </Link>
            <div className="flex items-center gap-3">
              {user ? (
                <Button asChild size="default" className="font-medium">
                  <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
              ) : (
                <Button asChild size="default" className="font-medium">
                  <Link href="/signin">Get Started</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36">
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl leading-tight">
            The Foundation for your{" "}
            <span className="relative inline-block">
              <span className="text-primary">
                Business Intelligence
              </span>
              <span className="absolute -bottom-2 left-0 right-0 h-3 bg-gradient-to-r from-[color:var(--accent-strong)]/30 via-[color:var(--accent-strong)]/20 to-[color:var(--accent-strong)]/30 -z-10 rounded-full blur-sm"></span>
            </span>
          </h1>
          <p className="mt-8 text-lg sm:text-xl lg:text-2xl leading-relaxed text-muted-foreground max-w-3xl mx-auto font-light">
            Powerful AI tools that help you build, scale, and optimize your business. Powered by a self-learning business brain that continuously evolves with your data.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            {user ? (
              <Button asChild size="lg" className="text-base font-medium px-8">
                <Link href="/dashboard">
                  Explore Tools <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="text-base font-medium px-8">
                  <Link href="/signin">Get Started</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="text-base font-medium px-8">
                  <Link href="/signin">Sign In</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32 border-t border-border/40">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16 lg:mb-20">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-foreground via-foreground/90 to-foreground bg-clip-text text-transparent">
                How Your Business Brain Works
              </span>
            </h2>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Every interaction, every document, every conversation feeds into an intelligent knowledge base that learns and adapts to your business.
            </p>
          </div>

          <div className="grid gap-6 sm:gap-8 md:grid-cols-3">
            <Card className="border border-border/30 shadow-lg hover:shadow-xl transition-all duration-300 group bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 dark:from-blue-400 dark:via-blue-500 dark:to-indigo-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-blue-500/20">
                  <Database className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-xl mb-3 font-bold">Data Collection</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Your business data flows in from multiple sources: job descriptions, SOPs, conversations, and manual inputs. Every piece of information is captured and structured.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-border/30 shadow-lg hover:shadow-xl transition-all duration-300 group bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 via-purple-600 to-pink-600 dark:from-purple-400 dark:via-purple-500 dark:to-pink-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-purple-500/20">
                  <Network className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-xl mb-3 font-bold">AI Integration</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Advanced AI analyzes patterns, extracts insights, and identifies opportunities. The system learns from your business context, industry, and unique workflows.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-border/30 shadow-lg hover:shadow-xl transition-all duration-300 group bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 dark:from-emerald-400 dark:via-green-400 dark:to-teal-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-green-500/20">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-xl mb-3 font-bold">Continuous Learning</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  The business brain gets smarter over time. It recognizes patterns, predicts needs, and provides increasingly accurate recommendations as it learns from your data.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Business Brain Explanation */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32 border-t border-border/40 bg-muted/40 dark:bg-muted/20">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16 lg:mb-20">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-foreground via-foreground/90 to-foreground bg-clip-text text-transparent">
                Your Business Brain in Action
              </span>
            </h2>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              See how integrated data creates intelligent insights across all your tools.
            </p>
          </div>

          <div className="space-y-10 sm:space-y-12">
            <div className="flex gap-6 items-start group p-6 rounded-2xl bg-card/30 backdrop-blur-sm border border-border/20 hover:border-primary/30 hover:bg-card/40 transition-all duration-300">
              <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-blue-600 dark:from-primary dark:via-primary/80 dark:to-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-primary/20">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-xl sm:text-2xl font-bold mb-3 tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">Unified Knowledge Base</h3>
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                  All your business information—from job descriptions to customer conversations—is stored in a unified knowledge base. This becomes the foundation that powers every tool.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start group p-6 rounded-2xl bg-card/30 backdrop-blur-sm border border-border/20 hover:border-[color:var(--accent-strong)]/30 hover:bg-card/40 transition-all duration-300">
              <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-[color:var(--accent-strong)] via-yellow-500 to-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-[color:var(--accent-strong)]/30">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-xl sm:text-2xl font-bold mb-3 tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">Real-Time Learning</h3>
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                  When you create a job description, the system learns about your hiring needs. When you chat with the AI, it captures pain points and opportunities. Every interaction enriches the knowledge base.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start group p-6 rounded-2xl bg-card/30 backdrop-blur-sm border border-border/20 hover:border-primary/30 hover:bg-card/40 transition-all duration-300">
              <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-blue-600 dark:from-primary dark:via-primary/80 dark:to-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-primary/20">
                <Target className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-xl sm:text-2xl font-bold mb-3 tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">Context-Aware Intelligence</h3>
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                  The AI doesn't just process data—it understands your business context. It knows your industry, your tools, your bottlenecks, and your goals. This context makes every recommendation more relevant and actionable.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start group p-6 rounded-2xl bg-card/30 backdrop-blur-sm border border-border/20 hover:border-[color:var(--accent-strong)]/30 hover:bg-card/40 transition-all duration-300">
              <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-[color:var(--accent-strong)] via-yellow-500 to-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-[color:var(--accent-strong)]/30">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-xl sm:text-2xl font-bold mb-3 tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">Cross-Tool Intelligence</h3>
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                  Insights from one tool enhance another. A conversation about a process can inform SOP generation. Job description patterns can reveal organizational needs. The business brain connects the dots across all your tools.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32 border-t border-border/40">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16 lg:mb-20">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-foreground via-foreground/90 to-foreground bg-clip-text text-transparent">
                Powerful Tools Powered by Your Business Brain
              </span>
            </h2>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Each tool leverages your unified knowledge base to deliver intelligent, context-aware results. The more you use them, the smarter they become.
            </p>
          </div>

          <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool, index) => {
              const Icon = tool.icon;
              const gradientClasses = [
                "bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 dark:from-blue-400 dark:via-blue-500 dark:to-indigo-500 shadow-blue-500/20",
                "bg-gradient-to-br from-purple-500 via-purple-600 to-pink-600 dark:from-purple-400 dark:via-purple-500 dark:to-pink-500 shadow-purple-500/20",
                "bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 dark:from-emerald-400 dark:via-green-400 dark:to-teal-500 shadow-green-500/20",
              ];
              const cardContent = (
                <Card className="group h-full flex flex-col border border-border/30 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-primary/30 bg-card/50 backdrop-blur-sm">
                  <CardHeader className="pb-4">
                    <div className={`w-16 h-16 rounded-2xl ${gradientClasses[index]} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">{tool.title}</CardTitle>
                      {tool.disabled && (
                        <Badge variant="secondary" className="text-xs font-medium">
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-base leading-relaxed">
                      {tool.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col pt-0">
                    <div className="space-y-3 mb-6">
                      {tool.benefits.map((benefit, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <Zap className="w-4 h-4 text-[color:var(--accent-strong)] mt-0.5 flex-shrink-0" />
                          <span className="text-sm sm:text-base text-muted-foreground leading-relaxed">{benefit}</span>
                        </div>
                      ))}
                    </div>
                    {!tool.disabled && tool.href && (
                      <div className="mt-auto pt-4 border-t border-border/50">
                        <span className="text-sm font-medium text-primary group-hover:underline inline-flex items-center gap-1">
                          Get Started <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );

              if (tool.disabled || !tool.href) {
                return <div key={index}>{cardContent}</div>;
              }

              return (
                <Link key={index} href={tool.href} className="block h-full">
                  {cardContent}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32 border-t border-border/40">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16 lg:mb-20">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-foreground via-foreground/90 to-foreground bg-clip-text text-transparent">
                How This Transforms Your Business
              </span>
            </h2>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              The integrated business brain approach delivers tangible benefits that compound over time.
            </p>
          </div>

          <div className="grid gap-6 sm:gap-8 md:grid-cols-2">
            <Card className="border border-border/30 shadow-lg hover:shadow-xl transition-all duration-300 group bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-blue-600 dark:from-primary dark:via-primary/80 dark:to-blue-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-primary/20">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-xl sm:text-2xl mb-3 tracking-tight font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">Intelligent Automation</CardTitle>
                <CardDescription className="text-base sm:text-lg leading-relaxed">
                  Stop repeating information. Once captured, your business data is intelligently reused across all tools. Create a job description once, and the system remembers your requirements, tools, and preferences.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-border/30 shadow-lg hover:shadow-xl transition-all duration-300 group bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[color:var(--accent-strong)] via-yellow-500 to-amber-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-[color:var(--accent-strong)]/30">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-xl sm:text-2xl mb-3 tracking-tight font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">Faster Decision Making</CardTitle>
                <CardDescription className="text-base sm:text-lg leading-relaxed">
                  Get instant answers to business questions. The AI Business Brain has your entire knowledge base at its fingertips, providing context-aware responses in seconds instead of hours of research.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-border/30 shadow-lg hover:shadow-xl transition-all duration-300 group bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-blue-600 dark:from-primary dark:via-primary/80 dark:to-blue-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-primary/20">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-xl sm:text-2xl mb-3 tracking-tight font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">Continuous Improvement</CardTitle>
                <CardDescription className="text-base sm:text-lg leading-relaxed">
                  Your business brain gets smarter every day. It learns from patterns, identifies bottlenecks, and suggests optimizations. The longer you use it, the more valuable it becomes.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-border/30 shadow-lg hover:shadow-xl transition-all duration-300 group bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[color:var(--accent-strong)] via-yellow-500 to-amber-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-[color:var(--accent-strong)]/30">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-xl sm:text-2xl mb-3 tracking-tight font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">Unified Intelligence</CardTitle>
                <CardDescription className="text-base sm:text-lg leading-relaxed">
                  Break down silos. Information from conversations informs job descriptions. SOP insights enhance business brain responses. Everything works together as one intelligent system.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32 border-t border-border/40 bg-muted/40 dark:bg-muted/20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-foreground via-foreground/90 to-foreground bg-clip-text text-transparent">
              Ready to Build Your Business Brain?
            </span>
          </h2>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Start feeding your business brain today. Every interaction makes it smarter, and every tool becomes more powerful.
          </p>
          <div className="mt-12 flex items-center justify-center">
            {user ? (
              <Button asChild size="lg" className="text-base font-medium px-8">
                <Link href="/dashboard">
                  Go to Dashboard <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="text-base font-medium px-8">
                <Link href="/signin">
                  Get Started <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
