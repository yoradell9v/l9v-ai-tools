"use client";
import Link from "next/link";
import { useUser } from "@/context/UserContext";
import { FileText, Brain } from "lucide-react";
import { useEffect, useMemo } from "react";

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
        icon: <Brain className="w-8 h-8 text-white" />,
        title: "AI Business Brain",
        subtitle: "Coming soon - Advanced AI-powered business intelligence and insights.",
        href: null as string | null,
        disabled: true,
      },
      {
        icon: <FileText className="w-8 h-8 text-white" />,
        title: "Job Description Builder AI",
        subtitle: "Create comprehensive job descriptions with AI-powered analysis and recommendations.",
        href: "/dashboard",
        disabled: false,
      },
      {
        icon: <FileText className="w-8 h-8 text-white" />,
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
            <h1 className="text-3xl font-semibold leading-10 tracking-tight text-[#18416B] dark:text-[#FAC133] sm:text-5xl transition-colors duration-150">
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
              const CardContent = (
                <div
                  className={`group relative rounded-2xl backdrop-blur p-6 shadow-lg transition-all duration-150 border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] ${card.disabled
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:shadow-xl hover:-translate-y-0.5 cursor-pointer"
                    }`}
                >
                  <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                    <div
                      className={`w-14 h-14 mb-4 rounded-lg flex items-center justify-center shadow-md transition-colors duration-150 bg-[#FAC133] dark:bg-[#FAC133]/90 ${card.disabled ? "opacity-70" : ""
                        }`}
                    >
                      {card.icon}
                    </div>
                    <h3 className="text-base font-semibold mb-2 transition-colors duration-150 text-[#18416B] dark:text-[#FAC133]">
                      {card.title}
                    </h3>
                    <p className="text-sm leading-relaxed transition-colors duration-150 mb-3 text-[#1a1a1a] dark:text-[#e0e0e0]">
                      {card.subtitle}
                    </p>
                    {card.disabled ? (
                      <span className="text-xs font-medium px-3 py-1 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">
                        COMING SOON
                      </span>
                    ) : card.href ? (
                      <span className="text-xs font-medium text-[#18416B] dark:text-[#FAC133] hover:text-[#245884] dark:hover:text-[#FAC133]/80">
                        Get Started →
                      </span>
                    ) : null}
                  </div>
                </div>
              );

              if (card.disabled || !card.href) {
                return <div key={index}>{CardContent}</div>;
              }

              return (
                <Link key={index} href={card.href}>
                  {CardContent}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Buttons - Only show if user is not signed in */}
        {!user && (
          <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
            <Link
              href="/signin"
              className="w-full sm:w-auto font-semibold py-2.5 px-6 rounded-xl focus:outline-none focus:ring-2 transition-all duration-150 shadow-md bg-[#FAC133] text-[#18416B] dark:bg-[#FAC133] dark:text-[#1a1a1a] hover:brightness-110"
            >
              Sign In
            </Link>

          </div>
        )}
      </main>
    </div>
  );
}
