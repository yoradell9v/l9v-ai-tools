import type { Metadata } from "next";
import { Geist, Geist_Mono, Poppins, Figtree } from "next/font/google";
import "@/styles/globals.css";
import { UserProvider } from "@/context/UserContext";
import { ClientProviders } from "@/components/forms/ClientProviders";
import NavigationLoader from "@/components/ui/NavigationLoader";

const poppins = Poppins({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
});

const figtree = Figtree({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-figtree",
});

export const metadata: Metadata = {
  title: "L9V AI Business Tools",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <body className={`${figtree.className} antialiased`}>
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