import { CreatorLayout } from "@/components/creator/CreatorLayout";
import { useCreatorAuth } from "@/hooks/useCreatorAuth";
import { useCreatorOrganization } from "@/hooks/useCreatorData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CreatorSettings() {
  const { organizationId } = useCreatorAuth();
  const { data: organization, isLoading } = useCreatorOrganization(organizationId);

  return (
    <CreatorLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-foreground-secondary mt-1">
            View and manage your organization settings
          </p>
        </div>

        {/* Organization Info */}
        <Card className="bg-surface border-border-subtle">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Organization
            </CardTitle>
            <CardDescription>
              Your organization details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : organization ? (
              <>
                <div className="flex items-center gap-4">
                  {organization.logo_url ? (
                    <img
                      src={organization.logo_url}
                      alt={organization.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                      <Building2 className="w-8 h-8 text-foreground-muted" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {organization.name}
                    </h3>
                    <p className="text-sm text-foreground-secondary">
                      @{organization.slug}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={organization.name} readOnly disabled />
                </div>

                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={organization.slug} readOnly disabled />
                </div>

                <div className="space-y-2">
                  <Label>Logo URL</Label>
                  <Input value={organization.logo_url ?? ""} readOnly disabled />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={organization.description ?? ""} readOnly disabled />
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Để thay đổi thông tin organization, vui lòng liên hệ Admin.
                  </AlertDescription>
                </Alert>
              </>
            ) : (
              <p className="text-foreground-secondary text-center py-8">
                No organization data found
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </CreatorLayout>
  );
}
