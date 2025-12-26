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
      color: "bg-blue-500",
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
      color: "bg-purple-500",
    },
    {
      icon: BookOpen,
      title: "SOP Generator",
      description: "Automatically generate standard operating procedures for your business processes and workflows.",
      benefits: [
        "Document processes automatically",
        "Create consistent procedures",
        "Improve team efficiency",
      ],
      href: null,
      disabled: true,
      color: "bg-green-500",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <nav className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/icon.png"
                alt="L9V AI Tools"
                width={40}
                height={40}
                className="rounded-lg"
                priority
              />
              <span className="text-xl font-semibold">Level 9 Virtual</span>
            </Link>
            <div className="flex items-center gap-4">
              {user ? (
                <Button asChild>
                  <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/signin">Get Started</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            The Foundation for your <span className="text-primary">Business Intelligence</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl max-w-2xl mx-auto">
            Powerful AI tools that help you build, scale, and optimize your business. Powered by a self-learning business brain that continuously evolves with your data.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            {user ? (
              <Button asChild size="lg" className="text-base">
                <Link href="/dashboard">Explore Tools <ArrowRight className="ml-2 w-4 h-4" /></Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="text-base">
                  <Link href="/signin">Get Started</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="text-base">
                  <Link href="/signin">Sign In</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-16 sm:py-24 border-t">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How Your Business Brain Works
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Every interaction, every document, every conversation feeds into an intelligent knowledge base that learns and adapts to your business.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <Card className="border-2">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                  <Database className="w-6 h-6 text-blue-500" />
                </div>
                <CardTitle>Data Collection</CardTitle>
                <CardDescription className="text-base mt-2">
                  Your business data flows in from multiple sources: job descriptions, SOPs, conversations, and manual inputs. Every piece of information is captured and structured.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
                  <Network className="w-6 h-6 text-purple-500" />
                </div>
                <CardTitle>AI Integration</CardTitle>
                <CardDescription className="text-base mt-2">
                  Advanced AI analyzes patterns, extracts insights, and identifies opportunities. The system learns from your business context, industry, and unique workflows.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-green-500" />
                </div>
                <CardTitle>Continuous Learning</CardTitle>
                <CardDescription className="text-base mt-2">
                  The business brain gets smarter over time. It recognizes patterns, predicts needs, and provides increasingly accurate recommendations as it learns from your data.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Business Brain Explanation */}
      <section className="container mx-auto px-4 py-16 sm:py-24 border-t bg-muted/30">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Your Business Brain in Action
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              See how integrated data creates intelligent insights across all your tools.
            </p>
          </div>

          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Brain className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Unified Knowledge Base</h3>
                <p className="text-muted-foreground">
                  All your business information—from job descriptions to customer conversations—is stored in a unified knowledge base. This becomes the foundation that powers every tool.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Real-Time Learning</h3>
                <p className="text-muted-foreground">
                  When you create a job description, the system learns about your hiring needs. When you chat with the AI, it captures pain points and opportunities. Every interaction enriches the knowledge base.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Context-Aware Intelligence</h3>
                <p className="text-muted-foreground">
                  The AI doesn't just process data—it understands your business context. It knows your industry, your tools, your bottlenecks, and your goals. This context makes every recommendation more relevant and actionable.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Cross-Tool Intelligence</h3>
                <p className="text-muted-foreground">
                  Insights from one tool enhance another. A conversation about a process can inform SOP generation. Job description patterns can reveal organizational needs. The business brain connects the dots across all your tools.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section className="container mx-auto px-4 py-16 sm:py-24 border-t">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Powerful Tools Powered by Your Business Brain
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Each tool leverages your unified knowledge base to deliver intelligent, context-aware results. The more you use them, the smarter they become.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool, index) => {
              const Icon = tool.icon;
              const cardContent = (
                <Card className="group h-full flex flex-col transition-all hover:shadow-lg">
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-lg ${tool.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl">{tool.title}</CardTitle>
                      {tool.disabled && (
                        <Badge variant="secondary" className="text-xs">
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-base mt-2">
                      {tool.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <div className="space-y-3 mb-6">
                      {tool.benefits.map((benefit, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <Zap className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-muted-foreground">{benefit}</span>
                        </div>
                      ))}
                    </div>
                    {!tool.disabled && tool.href && (
                      <div className="mt-auto">
                        <span className="text-sm font-medium text-primary">Get Started →</span>
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
      <section className="container mx-auto px-4 py-16 sm:py-24 border-t">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How This Transforms Your Business
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              The integrated business brain approach delivers tangible benefits that compound over time.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Intelligent Automation</CardTitle>
                <CardDescription className="text-base mt-2">
                  Stop repeating information. Once captured, your business data is intelligently reused across all tools. Create a job description once, and the system remembers your requirements, tools, and preferences.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Faster Decision Making</CardTitle>
                <CardDescription className="text-base mt-2">
                  Get instant answers to business questions. The AI Business Brain has your entire knowledge base at its fingertips, providing context-aware responses in seconds instead of hours of research.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Continuous Improvement</CardTitle>
                <CardDescription className="text-base mt-2">
                  Your business brain gets smarter every day. It learns from patterns, identifies bottlenecks, and suggests optimizations. The longer you use it, the more valuable it becomes.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Unified Intelligence</CardTitle>
                <CardDescription className="text-base mt-2">
                  Break down silos. Information from conversations informs job descriptions. SOP insights enhance business brain responses. Everything works together as one intelligent system.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 sm:py-24 border-t bg-muted/30">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to Build Your Business Brain?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start feeding your business brain today. Every interaction makes it smarter, and every tool becomes more powerful.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            {user ? (
              <Button asChild size="lg" className="text-base">
                <Link href="/dashboard">Go to Dashboard <ArrowRight className="ml-2 w-4 h-4" /></Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="text-base">
                <Link href="/signin">Get Started <ArrowRight className="ml-2 w-4 h-4" /></Link>
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
