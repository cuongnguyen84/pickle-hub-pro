import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRegistration, type RegistrationFormData, type Registration, type SkillRatingSystem } from '@/hooks/useRegistration';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserPlus, CheckCircle2, Clock, XCircle, AlertCircle, LogIn } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '@/i18n';

interface RegistrationFormProps {
  tableId: string;
  tableName: string;
  requiresSkillLevel?: boolean;
  registrationMessage?: string | null;
  existingRegistration?: Registration | null;
  onRegistrationComplete?: () => void;
}

export function RegistrationForm({
  tableId,
  tableName,
  requiresSkillLevel = true,
  registrationMessage,
  existingRegistration,
  onRegistrationComplete,
}: RegistrationFormProps) {
  const { user } = useAuth();
  const t = useTranslation();
  const { submitRegistration, updateRegistration, cancelRegistration, loading } = useRegistration();
  const navigate = useNavigate();
  const location = useLocation();

  const [displayName, setDisplayName] = useState(existingRegistration?.display_name || '');
  const [team, setTeam] = useState(existingRegistration?.team || '');
  const [ratingSystem, setRatingSystem] = useState<SkillRatingSystem>(
    existingRegistration?.rating_system || 'none'
  );
  const [skillLevel, setSkillLevel] = useState(existingRegistration?.skill_level?.toString() || '');
  const [skillSystemName, setSkillSystemName] = useState(existingRegistration?.skill_system_name || '');
  const [skillDescription, setSkillDescription] = useState(existingRegistration?.skill_description || '');
  const [profileLink, setProfileLink] = useState(existingRegistration?.profile_link || '');

  const handleLoginClick = () => {
    const returnUrl = location.pathname + location.search;
    navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`);
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <LogIn className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
          <p className="text-foreground-secondary mb-4">
            {t.quickTable.loginToRegister}
          </p>
          <Button onClick={handleLoginClick}>{t.quickTable.login}</Button>
        </CardContent>
      </Card>
    );
  }

  // Show approved status
  if (existingRegistration && existingRegistration.status === 'approved') {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
            <h3 className="font-semibold text-lg mb-1">{t.quickTable.registration.approvedTitle}</h3>
            <p className="text-foreground-secondary">
              {t.quickTable.registration.approvedDesc} <strong>{tableName}</strong>.
            </p>
            <p className="text-foreground-muted mt-2">
              {t.quickTable.registration.approvedWaiting}
            </p>
          </div>
          
          <div className="border-t border-border pt-4 mt-4">
            <h4 className="font-medium mb-2">{t.quickTable.registration.infoTitle}</h4>
            <RegistrationInfo registration={existingRegistration} t={t} />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show rejected status
  if (existingRegistration && existingRegistration.status === 'rejected') {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center">
            <XCircle className="w-12 h-12 mx-auto mb-3 text-red-500" />
            <h3 className="font-semibold text-lg mb-1">{t.quickTable.registration.rejected}</h3>
            <p className="text-foreground-secondary">
              {t.quickTable.registration.rejected}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show pending registration
  if (existingRegistration && existingRegistration.status === 'pending') {
    return (
      <Card>
        <CardContent className="py-6 space-y-4">
          <div className="text-center">
            <Clock className="w-12 h-12 mx-auto mb-3 text-yellow-500" />
            <h3 className="font-semibold text-lg mb-1">{t.quickTable.registration.pendingTitle}</h3>
            <p className="text-foreground-secondary">
              {t.quickTable.registration.pendingDesc}
            </p>
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="font-medium mb-2">{t.quickTable.registration.infoTitle}</h4>
            <RegistrationInfo registration={existingRegistration} t={t} />
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              if (confirm(t.quickTable.registration.cancelConfirm)) {
                await cancelRegistration(existingRegistration.id);
                onRegistrationComplete?.();
              }
            }}
            disabled={loading}
          >
            {t.quickTable.registration.cancelRegistration}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) return;
    if (ratingSystem === 'other' && !skillSystemName.trim()) return;
    if (requiresSkillLevel && ratingSystem === 'none' && !skillDescription.trim()) return;

    const formData: RegistrationFormData = {
      display_name: displayName,
      team: team || undefined,
      rating_system: ratingSystem,
      skill_level: skillLevel ? parseFloat(skillLevel) : undefined,
      skill_description: ratingSystem === 'none' ? skillDescription : undefined,
      skill_system_name: ratingSystem === 'other' ? skillSystemName : undefined,
      profile_link: profileLink || undefined,
    };

    const result = await submitRegistration(tableId, formData);
    if (result) {
      onRegistrationComplete?.();
    }
  };

  const skillDescOptions = t.quickTable.skillDescOptions;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" />
          {t.quickTable.registration.title}
        </CardTitle>
        <CardDescription>
          {t.quickTable.registerDesc} <strong>{tableName}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {registrationMessage && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{registrationMessage}</AlertDescription>
            </Alert>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">{t.quickTable.registration.displayName} *</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t.quickTable.registration.displayName}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="team">{t.quickTable.registration.teamClub}</Label>
              <Input
                id="team"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                placeholder={t.quickTable.exampleClub}
              />
            </div>
          </div>

          {/* Skill Level */}
          <div className="space-y-4">
            <Label>{t.quickTable.registration.skillLevel} {requiresSkillLevel && '*'}</Label>
            
            <RadioGroup
              value={ratingSystem}
              onValueChange={(v) => setRatingSystem(v as SkillRatingSystem)}
              className="space-y-3"
            >
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="DUPR" id="dupr" />
                <div className="flex-1">
                  <Label htmlFor="dupr" className="cursor-pointer font-medium">{t.quickTable.registration.dupr}</Label>
                  <p className="text-sm text-foreground-muted">{t.quickTable.registration.duprDesc}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <RadioGroupItem value="other" id="other" />
                <div className="flex-1">
                  <Label htmlFor="other" className="cursor-pointer font-medium">{t.quickTable.registration.otherSystem}</Label>
                  <p className="text-sm text-foreground-muted">{t.quickTable.registration.otherSystemDesc}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <RadioGroupItem value="none" id="none" />
                <div className="flex-1">
                  <Label htmlFor="none" className="cursor-pointer font-medium">{t.quickTable.registration.noRating}</Label>
                  <p className="text-sm text-foreground-muted">{t.quickTable.registration.noRatingDesc}</p>
                </div>
              </div>
            </RadioGroup>

            {/* DUPR rating input */}
            {ratingSystem === 'DUPR' && (
              <div className="pl-6 space-y-3 border-l-2 border-primary/20">
                <div className="space-y-2">
                  <Label htmlFor="skillLevel">{t.quickTable.registration.duprScore} (VD: 3.25, 4.1)</Label>
                  <Input
                    id="skillLevel"
                    type="number"
                    step="0.01"
                    min="1"
                    max="8"
                    value={skillLevel}
                    onChange={(e) => setSkillLevel(e.target.value)}
                    placeholder="3.50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profileLink">{t.quickTable.registration.duprLink}</Label>
                  <Input
                    id="profileLink"
                    type="url"
                    value={profileLink}
                    onChange={(e) => setProfileLink(e.target.value)}
                    placeholder={t.quickTable.exampleDuprLink}
                  />
                </div>
              </div>
            )}

            {/* Other rating system input */}
            {ratingSystem === 'other' && (
              <div className="pl-6 space-y-3 border-l-2 border-primary/20">
                <div className="space-y-2">
                  <Label htmlFor="skillSystemName">{t.quickTable.registration.systemName} *</Label>
                  <Input
                    id="skillSystemName"
                    value={skillSystemName}
                    onChange={(e) => setSkillSystemName(e.target.value)}
                    placeholder={t.quickTable.registration.systemNamePlaceholder}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="skillLevelOther">{t.quickTable.registration.skillScore}</Label>
                  <Input
                    id="skillLevelOther"
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={skillLevel}
                    onChange={(e) => setSkillLevel(e.target.value)}
                    placeholder={t.quickTable.registration.skillScore}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profileLinkOther">{t.quickTable.registration.duprLink}</Label>
                  <Input
                    id="profileLinkOther"
                    type="url"
                    value={profileLink}
                    onChange={(e) => setProfileLink(e.target.value)}
                    placeholder={t.quickTable.exampleDuprLink}
                  />
                </div>
              </div>
            )}

            {/* No rating - description required */}
            {ratingSystem === 'none' && (
              <div className="pl-6 space-y-3 border-l-2 border-primary/20">
                <div className="space-y-2">
                  <Label htmlFor="skillDescription">{t.quickTable.registration.skillDescription} *</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {skillDescOptions.map((desc) => (
                      <Badge
                        key={desc}
                        variant={skillDescription === desc ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => setSkillDescription(desc)}
                      >
                        {desc}
                      </Badge>
                    ))}
                  </div>
                  <Textarea
                    id="skillDescription"
                    value={skillDescription}
                    onChange={(e) => setSkillDescription(e.target.value)}
                    placeholder={t.quickTable.exampleSkillDesc}
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>

          <Alert variant="default" className="bg-muted/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {t.quickTable.registration.disclaimer}
            </AlertDescription>
          </Alert>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t.quickTable.registration.submitting : t.quickTable.registration.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Helper component for displaying registration info
function RegistrationInfo({ registration, t }: { registration: Registration; t: any }) {
  return (
    <dl className="space-y-1 text-sm">
      <div className="flex justify-between">
        <dt className="text-foreground-muted">{t.quickTable.registration.infoName}:</dt>
        <dd>{registration.display_name}</dd>
      </div>
      {registration.team && (
        <div className="flex justify-between">
          <dt className="text-foreground-muted">{t.quickTable.registration.teamClub}:</dt>
          <dd>{registration.team}</dd>
        </div>
      )}
      <div className="flex justify-between">
        <dt className="text-foreground-muted">{t.quickTable.registration.skillLevel}:</dt>
        <dd>
          {registration.rating_system === 'DUPR' && `DUPR ${registration.skill_level}`}
          {registration.rating_system === 'other' && (
            <>
              {registration.skill_system_name || t.quickTable.registration.otherSystem}: {registration.skill_level}
            </>
          )}
          {registration.rating_system === 'none' && (registration.skill_description || t.quickTable.registration.noRating)}
        </dd>
      </div>
    </dl>
  );
}

export default RegistrationForm;
