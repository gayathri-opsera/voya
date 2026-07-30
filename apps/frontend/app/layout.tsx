import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Voya — AI Travel Booking",
  description: "Search and book flights, hotels, and car rentals",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
