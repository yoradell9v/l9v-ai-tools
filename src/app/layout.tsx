import type { Metadata } from "next";
import { Geist, Geist_Mono, Poppins } from "next/font/google";
import "@/styles/globals.css";
import { UserProvider } from "@/context/UserContext";
import { ClientProviders } from "@/components/forms/ClientProviders";
import NavigationLoader from "@/components/ui/NavigationLoader";

const poppins = Poppins({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Job Description Builder AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <body className={`${poppins.className} antialiased`}>
        <UserProvider>
          <ClientProviders>
            <NavigationLoader />
            {children}
          </ClientProviders>
        </UserProvider>
      </body>
    </html>
  );
}