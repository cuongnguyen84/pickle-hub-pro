import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-6">
        <div className="text-8xl font-bold text-foreground-muted">404</div>
        <h1 className="text-2xl font-semibold text-foreground">{t.errors.notFound}</h1>
        <p className="text-foreground-secondary">{t.errors.notFoundDesc}</p>
        <Link to="/">
          <Button className="gap-2">
            <Home className="w-4 h-4" />
            {t.errors.goHome}
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
