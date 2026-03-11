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
  onAtRoot?: (atRoot: boolean) => void;
}

export default function CalComBooking({
  calLink,
  userName = "",
  userEmail = "",
  brandColor = "#18d26e",
  theme = "dark",
  namespace = "default",
  onBookingSuccess,
  onAtRoot,
}: CalComBookingProps) {
  const [iframeHeight, setIframeHeight] = useState(580);
  const initializedRef = useRef(false);
  const successFiredRef = useRef(false);
  const bookerEnteredRef = useRef(false);

  useEffect(() => {
    initializedRef.current = false;
    successFiredRef.current = false;
    bookerEnteredRef.current = false;
  }, [namespace]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let mounted = true;

    (async () => {
      const cal = await getCalApi({ namespace });
      if (!mounted) return;

      cal("ui", {
        styles: { branding: { brandColor } },
        hideEventTypeDetails: false,
        layout: "month_view",
        theme,
      });

      cal("on", {
        action: "__dimensionChanged",
        callback: (e: { detail?: { data?: { iframeHeight?: number } } }) => {
          if (!mounted) return;
          const height = e?.detail?.data?.iframeHeight;
          if (height && height > 100) setIframeHeight(height);
        },
      });

      cal("on", {
        action: "navigatedToBooker",
        callback: () => {
          if (!mounted || bookerEnteredRef.current) return;
          bookerEnteredRef.current = true;
          onAtRoot?.(false);
        },
      });

      cal("on", {
        action: "bookingSuccessful",
        callback: () => {
          if (successFiredRef.current || !mounted) return;
          successFiredRef.current = true;
          onBookingSuccess?.();
        },
      });
    })();

    return () => { mounted = false; };
  }, [namespace, brandColor, theme, onBookingSuccess, onAtRoot]);

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
