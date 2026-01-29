import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState("partner");
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Здесь будет логика авторизации
    console.log("Login attempt with:", { email, password, activeTab });
    // После успешной авторизации перенаправляем на главную страницу
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      {/* прямоугольная область авторизации */}
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-lg flex items-center justify-center">
              <img src="/logo_etu.png" alt="ETU_LOGO" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">{t("auth.login")}</CardTitle>
          <CardDescription>{t("auth.loginDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="etu">{t("auth.etuId")}</TabsTrigger>
              <TabsTrigger value="partner">{t("auth.partner")}</TabsTrigger>
            </TabsList>
          </Tabs>
          
          {activeTab === "partner" && (
            <form onSubmit={handleLogin} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                {/* плейсхолдер для ввода email */}
                <Input
                  id="email"
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {/* кнопка входа */}
              <Button type="submit" className="w-full">
                {t("auth.loginButton")}
              </Button>
            </form>
          )}
          
          {activeTab === "etu" && (
            <div className="mt-6 text-center">
              <p className="text-muted-foreground">{t("auth.etuIdPlaceholder")}</p>
              {/* кнопка входа с etu id */}
              <Button className="w-full mt-4" disabled>
                {t("auth.loginWithEtuId")}
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col">
          <p className="text-sm text-muted-foreground text-center">
            {t("auth.footerText")}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}