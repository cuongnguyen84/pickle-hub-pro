import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { ArrowLeft, Shield, Mail } from "lucide-react";
import { TheLineLayout } from "@/components/layout";

const Privacy = () => {
  const { t } = useI18n();
  const p = t.privacy;

  return (
    <TheLineLayout title={p.title} description={p.intro.description}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
          <div className="container mx-auto px-4 h-14 flex items-center">
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 text-foreground-secondary hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">{t.errors.goHome}</span>
            </Link>
          </div>
        </header>

        {/* Main content */}
        <main className="container mx-auto px-4 py-8 max-w-3xl">
          {/* Title */}
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {p.title}
            </h1>
          </div>

          <div className="space-y-8 text-foreground-secondary leading-relaxed">
            {/* Introduction */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{p.intro.title}</h2>
              <p>{p.intro.description}</p>
              <p className="mt-2">{p.intro.commitment}</p>
            </section>

            {/* Data Collection */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{p.dataCollection.title}</h2>
              <p className="mb-2">{p.dataCollection.description}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{p.dataCollection.items.email}</li>
                <li>{p.dataCollection.items.displayName}</li>
                <li>{p.dataCollection.items.avatar}</li>
                <li>{p.dataCollection.items.usage}</li>
              </ul>
            </section>

            {/* Purpose */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{p.purpose.title}</h2>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{p.purpose.items.auth}</li>
                <li>{p.purpose.items.tournament}</li>
                <li>{p.purpose.items.display}</li>
                <li>{p.purpose.items.improve}</li>
              </ul>
            </section>

            {/* Google OAuth disclosure */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{p.googleData.title}</h2>
              <p className="mb-2">{p.googleData.description}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{p.googleData.items.access}</li>
                <li>{p.googleData.items.use}</li>
                <li>{p.googleData.items.storage}</li>
                <li>{p.googleData.items.sharing}</li>
                <li>{p.googleData.items.advertising}</li>
              </ul>
            </section>

            {/* Data Sharing */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{p.sharing.title}</h2>
              <p className="mb-2">{p.sharing.description}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{p.sharing.items.oauth}</li>
                <li>{p.sharing.items.legal}</li>
              </ul>
            </section>

            {/* Shop */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{p.shop.title}</h2>
              <p className="mb-2">{p.shop.description}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{p.shop.groups.public}</li>
                <li>{p.shop.groups.internal}</li>
                <li>{p.shop.groups.consent}</li>
                <li>{p.shop.groups.moderation}</li>
              </ul>
              <p className="mt-2">{p.shop.purpose}</p>
              <p className="mt-2">{p.shop.retention}</p>
            </section>

            {/* Security */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{p.security.title}</h2>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{p.security.items.storage}</li>
                <li>{p.security.items.measures}</li>
                <li>{p.security.items.access}</li>
                <li>{p.security.items.retention}</li>
              </ul>
            </section>

            {/* User Rights */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{p.rights.title}</h2>
              <p className="mb-2">{p.rights.description}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{p.rights.items.view}</li>
                <li>{p.rights.items.edit}</li>
                <li>{p.rights.items.stop}</li>
              </ul>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{p.contact.title}</h2>
              <p className="mb-3">{p.contact.description}</p>
              <a 
                href="mailto:tapickleballvn@gmail.com"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <Mail className="w-4 h-4" />
                tapickleballvn@gmail.com
              </a>
            </section>

            {/* Effective Date */}
            <section className="pt-4 border-t border-border">
              <p className="text-sm text-foreground-muted">
                {p.effective.text.replace("{date}", "28/08/2026")}
              </p>
              <p className="text-sm text-foreground-muted mt-1">
                {p.effective.update}
              </p>
            </section>
          </div>
        </main>
      </div>
    </TheLineLayout>
  );
};

export default Privacy;
