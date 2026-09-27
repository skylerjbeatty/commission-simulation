import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guion's Sales Compensation Simulator",
  description: "Internal decision-making sandbox for Guion's Showcase Furniture & Appliances sales compensation.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-stone-100 text-stone-900">{children}</body>
    </html>
  );
}
