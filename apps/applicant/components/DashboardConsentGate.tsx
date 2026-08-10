"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduateConsentModal } from "./GraduateConsentModal";

interface DashboardConsentGateProps {
  show: boolean;
}

export function DashboardConsentGate({ show }: DashboardConsentGateProps) {
  const [isOpen, setIsOpen] = useState(show);
  const router = useRouter();

  if (!isOpen) return null;

  return (
    <GraduateConsentModal
      showProfileFormOnPublish={false}
      onPublish={() => router.push("/dashboard/graduate-profile")}
      onDecline={() => setIsOpen(false)}
    />
  );
}
