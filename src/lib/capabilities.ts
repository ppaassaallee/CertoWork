import { useState, useEffect } from "react";

export interface CapabilityInfo {
  configured: boolean;
  description: string;
  available?: boolean;
  model?: string | null;
  connectionStatus?: string;
}

export interface PlatformCapabilities {
  openai: CapabilityInfo;
  gemini: CapabilityInfo;
  activeAIProvider: CapabilityInfo;
  firebase: CapabilityInfo;
  hubspot: CapabilityInfo;
  googleDrive: CapabilityInfo;
  oneDrive?: CapabilityInfo;
}

export function usePlatformCapabilities() {
  const [capabilities, setCapabilities] = useState<PlatformCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchCapabilities() {
      try {
        const response = await fetch("/api/capabilities");
        if (!response.ok) {
          throw new Error("Failed to fetch platform capabilities");
        }
        const data = await response.json();
        if (active) {
          setCapabilities(data);
          setLoading(false);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || "An error occurred");
          setLoading(false);
        }
      }
    }

    fetchCapabilities();
    return () => {
      active = false;
    };
  }, []);

  return { capabilities, loading, error };
}
