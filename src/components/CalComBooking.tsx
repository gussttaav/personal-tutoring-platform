"use client";

import { useEffect, useRef, useState } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";

interface CalComBookingProps {
  calLink: string;
  userName?: string;
  userEmail?: string;
  brandColor?: string;
  theme?: "light" | "dark";
  namespace?: string;
  onBookingSuccess?: () => void;
}

export default function CalComBooking({
  calLink,
  userName = "",
  userEmail = "",
  brandColor = "#18d26e",
  theme = "dark",
  namespace = "default",
  onBookingSuccess,
}: CalComBookingProps) {
  const [iframeHeight, setIframeHeight] = useState(580);
  const initialized = useRef(false);
  const successFired = useRef(false); // prevent double-firing

  useEffect(() => {
    initialized.current = false;
    successFired.current = false;
  }, [namespace]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async function () {
      const cal = await getCalApi({ namespace });

      cal("ui", {
        styles: { branding: { brandColor } },
        hideEventTypeDetails: false,
        layout: "month_view",
        theme,
      });

      cal("on", {
        action: "__dimensionChanged",
        callback: (e: any) => {
          const height = e?.detail?.data?.iframeHeight;
          if (height && height > 300) setIframeHeight(height + 16);
        },
      });

      cal("on", {
        action: "bookingSuccessful",
        callback: () => {
          if (successFired.current) return;
          successFired.current = true;
          onBookingSuccess?.();
        },
      });
    })();
  }, [namespace, brandColor, theme, onBookingSuccess]);

  return (
    <Cal
      namespace={namespace}
      calLink={calLink}
      style={{
        width: "100%",
        height: `${iframeHeight}px`,
        display: "block",
        transition: "height 0.3s ease",
      }}
      config={{
        name: userName,
        email: userEmail,
        theme,
        layout: "month_view",
      }}
    />
  );
}
