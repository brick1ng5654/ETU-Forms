import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { Link, useLocation } from "wouter";

type LoginOk = {
  access_token: string;
  token_type: "bearer";
  user: { user_id: number; email: string; name: string };
};

type LoginErr = {
  detail?: string;
};

function getApiBase(): string{
  return "";
}

function isValidEmail(value: string): boolean {
  return /.+@.+/.test(value);
}

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState("partner");
  const [session, setSession] = useState<LoginOk["user"] | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const { t, i18n } = useTranslation();
  const [, navigate] = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setRetryAfter(null);

    if (activeTab !== "partner") return;

    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm){
      setError(t("auth.emailRequired"));
      return;
    }
    if (!isValidEmail(emailNorm)) {
      setError(t("auth.emailInvalid"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: emailNorm, password }),
      });

      if (res.status === 429) {
        const ra = res.headers.get("retry-after");
        const raNum = ra ? parseInt(ra, 10) : null;
        setRetryAfter(Number.isFinite(raNum as number) ? raNum : null);
    
        const data: LoginErr = await res.json().catch(() => ({}));
        setError(data.detail ?? t("auth.tooManyAttempts"));
        return;
      }
      if (!res.ok) {
        await res.json().catch(() => ({}));
        setError(t("auth.invalidCredentials"));
        return;
      }

      const data: LoginOk = await res.json();
      setAccessToken(data.access_token);
      setSession(data.user);
      // После успешной авторизации перенаправляем на главную страницу
      navigate("/");
    } catch (err) {
      setError(t("auth.networkError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      {/* прямоугольная область авторизации */}
      <Card className="w-full max-w-md">
        <CardHeader className="relative text-center">
          <div className="absolute right-4 top-4">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 h-8 px-2"
              onClick={() => {
                const newLang = i18n.language.startsWith("ru") ? "en" : "ru";
                i18n.changeLanguage(newLang);
              }}
              title={i18n.language.startsWith("ru") ? "Переключить на Английский" : "Switch to Russian"}
            >
              <Languages className="h-4 w-4" />
              <span className="text-xs font-medium">{i18n.language.startsWith("ru") ? "RU" : "EN"}</span>
            </Button>
          </div>
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-lg flex items-center justify-center">
              <img src="/logo_etu.png" alt="ETU_LOGO" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">{t("auth.login")}</CardTitle>
          <CardDescription>{t("auth.loginDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value);
              setError(null);
              setRetryAfter(null);
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="etu">{t("auth.etuId")}</TabsTrigger>
              <TabsTrigger value="partner">{t("auth.partner")}</TabsTrigger>
            </TabsList>
          </Tabs>
          
          {activeTab === "partner" && (
            <form
              noValidate
              onSubmit={handleLogin}
              className="mt-6 space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
            >
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                {/* плейсхолдер для ввода email */}
                <Input
                  id="email"
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                {/* плейсхолдер для ввода пароля */}
                <Input
                  id="password"
                  type="password"
                  placeholder={t("auth.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  required
                />
              </div>
              {error && (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {/* кнопка входа */}
              <Button type="submit" className="w-full" disabled={loading || !!retryAfter}>
                {loading ? t("auth.loading") : t("auth.loginButton")}
              </Button>
            </form>
          )}
          
          {activeTab === "etu" && (
            <div className="mt-6 text-center animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
              <p className="text-muted-foreground">{t("auth.etuIdPlaceholder")}</p>
              {/* кнопка входа с etu id */}
              <Button className="w-full mt-4" disabled>
                {t("auth.loginWithEtuId")}
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col">
          {activeTab === "partner" && (
            <p className="text-sm text-muted-foreground text-center">
              {t("auth.footerText")}
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

