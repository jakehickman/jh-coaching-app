import { useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

/**
 * Landing page for invite links: /invite/:token
 * Validates the token, then redirects to Manus OAuth with the token embedded in state.
 */
export default function InvitePage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = trpc.invites.validate.useQuery(
    { token: token ?? "" },
    { enabled: !!token, retry: false }
  );

  const handleAccept = () => {
    if (!token) return;
    const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
    const appId = import.meta.env.VITE_APP_ID;
    const redirectUri = `${window.location.origin}/api/oauth/callback`;
    // Encode both redirectUri and inviteToken in state as JSON base64
    const state = btoa(JSON.stringify({ redirectUri, inviteToken: token }));
    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");
    window.location.href = url.toString();
  };

  // Auto-redirect if token is valid (no need to show a button)
  useEffect(() => {
    if (data?.valid) {
      handleAccept();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Validating invite…</p>
        </div>
      </div>
    );
  }

  if (error || !data?.valid) {
    const msg = (error as { message?: string })?.message ?? "This invite link is invalid or has already been used.";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-4xl">🔗</div>
          <h1 className="text-xl font-bold text-foreground">Invalid Invite</h1>
          <p className="text-muted-foreground text-sm">{msg}</p>
          <p className="text-muted-foreground text-xs">
            Contact your coach for a new invite link.
          </p>
        </div>
      </div>
    );
  }

  // Shown briefly while the auto-redirect fires
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-4xl">👋</div>
        <h1 className="text-xl font-bold text-foreground">
          {data.label ? `Welcome, ${data.label}` : "You've been invited"}
        </h1>
        <p className="text-muted-foreground text-sm">
          Redirecting you to sign in…
        </p>
        <Button onClick={handleAccept} className="w-full">
          Sign in to continue
        </Button>
      </div>
    </div>
  );
}
