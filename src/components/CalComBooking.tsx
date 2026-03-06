"use client";

import { useEffect, useRef, useState } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";

interface CalComBookingProps {
  calLink: string;
  userName?: string;
  userEmail?: string;
  brandColor?: string;
  theme?: "light" | "dark";
  onBookingSuccess?: () => void;
}

export default function CalComBooking({
  calLink,
  userName = "",
  userEmail = "",
  brandColor = "#18d26e",
  theme = "dark",
  onBookingSuccess,
}: CalComBookingProps) {
  const [iframeHeight, setIframeHeight] = useState(600);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async function () {
      const cal = await getCalApi();

      cal("ui", {
        styles: {
          branding: { brandColor },
        },
        hideEventTypeDetails: false,
        layout: "month_view",
        theme,
      });

      // Dynamically resize container to match cal.com content
      cal("on", {
        action: "__dimensionChanged",
        callback: (e: any) => {
          const height = e?.detail?.data?.iframeHeight;
          if (height && height > 300) {
            setIframeHeight(height + 16); // small padding buffer
          }
        },
      });

      // Optional: fire callback when booking is confirmed
      cal("on", {
        action: "bookingSuccessful",
        callback: () => {
          onBookingSuccess?.();
        },
      });
    })();
  }, [brandColor, theme, onBookingSuccess]);

  return (
    <Cal
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
      }}
    />
  );
}
