import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { getTenantContext, brandStyleBlock } from "@talentos/ui";
import { getTenantBySlug } from "@talentos/db";
import "./globals.css";

export const metadata: Metadata = {
  title: "TalentOS",
  description: "AI-powered talent discovery, learning and recruitment platform"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);

  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: brandStyleBlock(tenant) }} />
      </head>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
