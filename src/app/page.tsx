"use client";
import Link from "next/link";
import { useUser } from "@/context/UserContext";
import { FileText, Brain } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
  }, [user]);

  const cards = useMemo(
    () => [
      {
        icon: <Brain className="w-5 h-5 text-white" />,
        title: "AI Business Brain",
        subtitle: "Advanced AI-powered business intelligence and insights.",
        href: "/dashboard/ai-business-brain",
        disabled: false,
      },
      {
        icon: <FileText className="w-5 h-5 text-white" />,
        title: "Job Description Builder AI",
        subtitle: "Create comprehensive job descriptions with AI-powered analysis and recommendations.",
        href: "/dashboard",
        disabled: false,
      },
      {
        icon: <FileText className="w-5 h-5 text-white" />,
        title: "SOP Generator",
        subtitle: "Coming soon - Automatically generate standard operating procedures for your business.",
        href: null as string | null,
        disabled: true,
      },
    ],
    []
  );

  return (
    <div className="flex min-h-screen items-center justify-center font-sans transition-colors duration-150 bg-white dark:bg-[#121212]">
      <main className="flex min-h-screen w-full max-w-5xl flex-col items-center justify-between py-24 px-8 sm:items-start transition-colors duration-150 bg-white dark:bg-[#121212]">
        {/* Header */}
        <div className="w-full">
          <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left mb-12">
            <h1 className="text-3xl font-semibold leading-10 tracking-tight sm:text-5xl transition-colors duration-150">
              {user ? `Welcome back, ${user.firstname}!` : "Level 9 Virtual AI Tools"}
            </h1>
            <p className="max-w-md text-lg leading-8 transition-colors duration-150 text-[#1a1a1a] dark:text-[#e0e0e0]">
              {user
                ? "Choose a tool to get started with your business needs."
                : "Powerful AI tools to help you build and scale your business."}
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {cards.map((card, index) => {
              const cardContent = (
                <Card
                  className={`group transition-all duration-150 h-full flex flex-col ${card.disabled
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:shadow-xl hover:-translate-y-0.5 cursor-pointer"
                    }`}
                >
                  <CardHeader className="flex flex-col items-center sm:items-start text-center sm:text-left">
                    <div
                      className={`w-10 h-10 mb-4 rounded-lg flex items-center justify-center shadow-md transition-colors duration-150 bg-[#FAC133] dark:bg-[#FAC133]/90 ${card.disabled ? "opacity-70" : ""
                        }`}
                    >
                      {card.icon}
                    </div>
                    <CardTitle className="text-base font-semibold mb-2 transition-colors duration-150">
                      {card.title}
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed transition-colors duration-150 mb-3">
                      {card.subtitle}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center sm:items-start text-center sm:text-left mt-auto">
                    {card.disabled ? (
                      <span className="text-xs font-medium px-3 py-1 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">
                        COMING SOON
                      </span>
                    ) : card.href ? (
                      <span className="text-xs font-medium">
                        Get Started →
                      </span>
                    ) : null}
                  </CardContent>
                </Card>
              );

              if (card.disabled || !card.href) {
                return <div key={index} className="h-full">{cardContent}</div>;
              }

              return (
                <Link key={index} href={card.href} className="block h-full">
                  {cardContent}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Buttons - Only show if user is not signed in */}
        {!user && (
          <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/signin">Sign In</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
