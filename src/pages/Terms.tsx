import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { ArrowLeft, FileText, Mail } from "lucide-react";
import { DynamicMeta } from "@/components/seo";

const Terms = () => {
  const { t } = useI18n();
  const terms = t.terms;

  return (
    <>
      <DynamicMeta
        title={terms.title}
        description={terms.intro.description}
      />
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
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {terms.title}
            </h1>
          </div>

          <div className="space-y-8 text-foreground-secondary leading-relaxed">
            {/* Introduction */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{terms.intro.title}</h2>
              <p>{terms.intro.description}</p>
              <p className="mt-2">{terms.intro.acceptance}</p>
            </section>

            {/* Account Terms */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{terms.account.title}</h2>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{terms.account.items.age}</li>
                <li>{terms.account.items.accuracy}</li>
                <li>{terms.account.items.security}</li>
                <li>{terms.account.items.responsibility}</li>
              </ul>
            </section>

            {/* Acceptable Use */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{terms.acceptableUse.title}</h2>
              <p className="mb-2">{terms.acceptableUse.description}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{terms.acceptableUse.items.noIllegal}</li>
                <li>{terms.acceptableUse.items.noHarassment}</li>
                <li>{terms.acceptableUse.items.noSpam}</li>
                <li>{terms.acceptableUse.items.noImpersonation}</li>
                <li>{terms.acceptableUse.items.noMalware}</li>
              </ul>
            </section>

            {/* User Content */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{terms.userContent.title}</h2>
              <p className="mb-2">{terms.userContent.description}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{terms.userContent.items.ownership}</li>
                <li>{terms.userContent.items.license}</li>
                <li>{terms.userContent.items.moderation}</li>
              </ul>
            </section>

            {/* Intellectual Property */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{terms.intellectualProperty.title}</h2>
              <p>{terms.intellectualProperty.description}</p>
            </section>

            {/* Limitation of Liability */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{terms.liability.title}</h2>
              <p className="mb-2">{terms.liability.description}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{terms.liability.items.asIs}</li>
                <li>{terms.liability.items.noWarranty}</li>
                <li>{terms.liability.items.limitation}</li>
              </ul>
            </section>

            {/* Termination */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{terms.termination.title}</h2>
              <p className="mb-2">{terms.termination.description}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{terms.termination.items.userRight}</li>
                <li>{terms.termination.items.platformRight}</li>
                <li>{terms.termination.items.effect}</li>
              </ul>
            </section>

            {/* Changes to Terms */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{terms.changes.title}</h2>
              <p>{terms.changes.description}</p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">{terms.contact.title}</h2>
              <p className="mb-3">{terms.contact.description}</p>
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
                {terms.effective.text.replace("{date}", "23/01/2026")}
              </p>
              <p className="text-sm text-foreground-muted mt-1">
                {terms.effective.update}
              </p>
            </section>
          </div>
        </main>
      </div>
    </>
  );
};

export default Terms;
