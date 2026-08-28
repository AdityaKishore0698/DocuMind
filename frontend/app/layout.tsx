import type { Metadata } from "next";
import { Roboto_Flex, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/ui/Toast";

const robotoFlex = Roboto_Flex({
  variable: "--font-roboto-flex",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DocuMind",
  description: "Chat with your documents — a multi-tenant RAG workspace.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${robotoFlex.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-md-surface text-md-on-surface">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
