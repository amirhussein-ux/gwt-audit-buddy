import { FormEvent, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth, type UserSettings } from '@/contexts/AuthContext';
import { BellRing, Gauge, KeyRound, LayoutDashboard, Shield, SlidersHorizontal } from 'lucide-react';
import { brandColors } from '@/lib/brandColors';
import { cn } from '@/lib/utils';

const createSettingsState = (settings?: UserSettings): UserSettings => ({
  auditDefaults: {
    maxPages: settings?.auditDefaults?.maxPages ?? 20,
    maxDepth: settings?.auditDefaults?.maxDepth ?? 3,
    concurrency: settings?.auditDefaults?.concurrency ?? 3,
  },
  notifications: {
    inAppEnabled: settings?.notifications?.inAppEnabled ?? true,
    emailEnabled: settings?.notifications?.emailEnabled ?? true,
    auditCompleted: settings?.notifications?.auditCompleted ?? true,
    auditFailed: settings?.notifications?.auditFailed ?? true,
    archiveEvents: settings?.notifications?.archiveEvents ?? true,
    complianceDigest: settings?.notifications?.complianceDigest ?? false,
  },
  dashboard: {
    landingPage: settings?.dashboard?.landingPage ?? 'dashboard',
    showAgencyLeaderboard: settings?.dashboard?.showAgencyLeaderboard ?? true,
    showTrendChart: settings?.dashboard?.showTrendChart ?? true,
    showCriticalAlerts: settings?.dashboard?.showCriticalAlerts ?? true,
  },
});

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, updateSettings, changePassword, refreshUser } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(() => createSettingsState(user?.settings));
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    setSettings(createSettingsState(user?.settings));
  }, [user?.settings]);

  useEffect(() => {
    refreshUser().catch(() => {
      // Keep existing settings if the refresh request fails.
    });
  }, [refreshUser]);

  const handleSettingsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingSettings(true);

    try {
      await updateSettings(settings);
      toast({
        title: 'Settings updated',
        description: 'Your MASID preferences are now active.',
      });
    } catch (error) {
      toast({
        title: 'Unable to save settings',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: 'Password mismatch',
        description: 'The new password confirmation does not match.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingPassword(true);
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast({
        title: 'Password updated',
        description: 'Your sign-in password has been changed successfully.',
      });
    } catch (error) {
      toast({
        title: 'Unable to change password',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const landingOptions =
    user?.role === 'admin'
      ? [
          { value: 'dashboard', label: 'Dashboard' },
          { value: 'results', label: 'Results' },
          { value: 'audit-log', label: 'Audit Log' },
          { value: 'archive', label: 'Archive' },
        ]
      : [
          { value: 'dashboard', label: 'Dashboard' },
          { value: 'results', label: 'Results' },
          { value: 'audit-log', label: 'Audit Log' },
        ];

  const inputClassName =
    'rounded-2xl border-white/70 bg-white/85 shadow-[0_10px_24px_rgba(148,163,184,0.08)]';
  const toggleRowClassName =
    'flex items-center justify-between rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm';

  return (
    <div className={cn('min-h-full space-y-8 py-8', brandColors.appShell.contentPadding)}>
      <section className="space-y-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-800">Settings</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Configure how MASID behaves for your role, audit workflow, and security needs.
          </p>
        </div>
      </section>

      <section className="space-y-6">
        <Card className={cn(brandColors.surfaces.heroCard, 'overflow-hidden')}>
          <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="rounded-full bg-slate-900 text-white hover:bg-slate-900">{user?.role}</Badge>
                <Badge variant="outline" className="rounded-full border-white/70 bg-white/70">
                  {settings.dashboard.landingPage} default
                </Badge>
              </div>
              <h2 className="mt-3 text-xl font-semibold text-slate-900">
                {user?.role === 'admin' ? 'Administrative preferences' : 'Auditor preferences'}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {user?.role === 'admin'
                  ? 'Tune oversight views, archive notices, and default crawl behavior for cross-agency operations.'
                  : 'Tune audit execution defaults, dashboard visibility, and alert handling for your assigned work.'}
              </p>
            </div>
            <div className="rounded-[24px] border border-white/60 bg-[linear-gradient(135deg,rgba(224,231,255,0.78),rgba(239,246,255,0.74))] px-4 py-3 text-sm text-blue-900 shadow-[0_14px_32px_rgba(129,140,248,0.10)]">
              Preferences are saved to your account and follow you across sessions.
            </div>
          </CardContent>
        </Card>

        <form className="space-y-6" onSubmit={handleSettingsSubmit}>
          <Card className={brandColors.surfaces.dashboardCard}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-slate-500" />
                <CardTitle>Audit Defaults</CardTitle>
              </div>
              <CardDescription>
                Pre-fill the crawler settings used when you launch a new government website audit.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Max Pages</label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={settings.auditDefaults.maxPages}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      auditDefaults: { ...current.auditDefaults, maxPages: Number(event.target.value) || 1 },
                    }))
                  }
                  className={inputClassName}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Max Depth</label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={settings.auditDefaults.maxDepth}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      auditDefaults: { ...current.auditDefaults, maxDepth: Number(event.target.value) || 0 },
                    }))
                  }
                  className={inputClassName}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Concurrency</label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={settings.auditDefaults.concurrency}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      auditDefaults: { ...current.auditDefaults, concurrency: Number(event.target.value) || 1 },
                    }))
                  }
                  className={inputClassName}
                />
              </div>
            </CardContent>
          </Card>

          <Card className={brandColors.surfaces.dashboardCard}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BellRing className="h-5 w-5 text-slate-500" />
                <CardTitle>Notifications</CardTitle>
              </div>
              <CardDescription>
                Decide which compliance events deserve attention in your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  label: 'In-app alerts',
                  description: 'Keep notifications visible inside MASID.',
                  checked: settings.notifications.inAppEnabled,
                  onCheckedChange: (value: boolean) =>
                    setSettings((current) => ({
                      ...current,
                      notifications: { ...current.notifications, inAppEnabled: value },
                    })),
                },
                {
                  label: 'Email alerts',
                  description: 'Send the same alerts to your registered government email.',
                  checked: settings.notifications.emailEnabled,
                  onCheckedChange: (value: boolean) =>
                    setSettings((current) => ({
                      ...current,
                      notifications: { ...current.notifications, emailEnabled: value },
                    })),
                },
                {
                  label: 'Audit completion notices',
                  description: 'Receive confirmation when queued audits finish.',
                  checked: settings.notifications.auditCompleted,
                  onCheckedChange: (value: boolean) =>
                    setSettings((current) => ({
                      ...current,
                      notifications: { ...current.notifications, auditCompleted: value },
                    })),
                },
                {
                  label: 'Audit failure notices',
                  description: 'Highlight failed or interrupted scans that need follow-up.',
                  checked: settings.notifications.auditFailed,
                  onCheckedChange: (value: boolean) =>
                    setSettings((current) => ({
                      ...current,
                      notifications: { ...current.notifications, auditFailed: value },
                    })),
                },
              ].map((item) => (
                <div key={item.label} className={toggleRowClassName}>
                  <div className="pr-6">
                    <p className="text-sm font-medium text-slate-900">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.description}</p>
                  </div>
                  <Switch checked={item.checked} onCheckedChange={item.onCheckedChange} />
                </div>
              ))}

              {user?.role === 'admin' && (
                <>
                  <div className={toggleRowClassName}>
                    <div className="pr-6">
                      <p className="text-sm font-medium text-slate-900">Archive and restore events</p>
                      <p className="text-xs text-slate-500">
                        Track when audit records are archived or restored by administrators.
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifications.archiveEvents}
                      onCheckedChange={(value) =>
                        setSettings((current) => ({
                          ...current,
                          notifications: { ...current.notifications, archiveEvents: value },
                        }))
                      }
                    />
                  </div>
                  <div className={toggleRowClassName}>
                    <div className="pr-6">
                      <p className="text-sm font-medium text-slate-900">Compliance digest flag</p>
                      <p className="text-xs text-slate-500">
                        Mark your account to receive periodic high-level compliance summaries.
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifications.complianceDigest}
                      onCheckedChange={(value) =>
                        setSettings((current) => ({
                          ...current,
                          notifications: { ...current.notifications, complianceDigest: value },
                        }))
                      }
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={brandColors.surfaces.dashboardCard}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-slate-500" />
                <CardTitle>Dashboard Preferences</CardTitle>
              </div>
              <CardDescription>
                Control the first screen and analytics cards you see after signing in.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Default landing page</label>
                <Select
                  value={settings.dashboard.landingPage}
                  onValueChange={(value: UserSettings['dashboard']['landingPage']) =>
                    setSettings((current) => ({
                      ...current,
                      dashboard: { ...current.dashboard, landingPage: value },
                    }))
                  }
                >
                  <SelectTrigger className="max-w-sm rounded-2xl border-white/70 bg-white/85 shadow-[0_10px_24px_rgba(148,163,184,0.08)]">
                    <SelectValue placeholder="Choose a default page" />
                  </SelectTrigger>
                  <SelectContent>
                    {landingOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {[
                {
                  label: 'Show agency leaderboard',
                  description: 'Keep the ranked agency comparison table on the dashboard.',
                  checked: settings.dashboard.showAgencyLeaderboard,
                  onCheckedChange: (value: boolean) =>
                    setSettings((current) => ({
                      ...current,
                      dashboard: { ...current.dashboard, showAgencyLeaderboard: value },
                    })),
                },
                {
                  label: 'Show compliance trend chart',
                  description: 'Display longitudinal compliance movement across audits.',
                  checked: settings.dashboard.showTrendChart,
                  onCheckedChange: (value: boolean) =>
                    setSettings((current) => ({
                      ...current,
                      dashboard: { ...current.dashboard, showTrendChart: value },
                    })),
                },
                {
                  label: 'Show critical alerts panel',
                  description: 'Surface the most urgent agency issues on the home dashboard.',
                  checked: settings.dashboard.showCriticalAlerts,
                  onCheckedChange: (value: boolean) =>
                    setSettings((current) => ({
                      ...current,
                      dashboard: { ...current.dashboard, showCriticalAlerts: value },
                    })),
                },
              ].map((item) => (
                <div key={item.label} className={toggleRowClassName}>
                  <div className="pr-6">
                    <p className="text-sm font-medium text-slate-900">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.description}</p>
                  </div>
                  <Switch checked={item.checked} onCheckedChange={item.onCheckedChange} />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-500 text-white hover:from-violet-500 hover:to-indigo-500"
              disabled={isSavingSettings}
            >
              {isSavingSettings ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </form>

        <Card className={brandColors.surfaces.dashboardCard}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-slate-500" />
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>
              Protect your account before using it for shared government audit operations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-3" onSubmit={handlePasswordSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Current Password</label>
                <Input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))
                  }
                  className={inputClassName}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">New Password</label>
                <Input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))
                  }
                  className={inputClassName}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Confirm Password</label>
                <Input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))
                  }
                  className={inputClassName}
                />
              </div>

              <div className="md:col-span-3 flex items-center justify-between rounded-2xl border border-white/60 bg-white/70 px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <KeyRound className="h-5 w-5 text-slate-500" />
                  <p className="text-sm text-slate-700">
                    Use a strong password with at least 8 characters before sharing system access internally.
                  </p>
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={isSavingPassword}
                  className="rounded-2xl border-white/70 bg-white/80 hover:bg-white"
                >
                  {isSavingPassword ? 'Updating...' : 'Change Password'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className={brandColors.surfaces.dashboardCard}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-slate-500" />
              <CardTitle>Role Notes</CardTitle>
            </div>
            <CardDescription>
              Settings are tailored to the actual permissions present in your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-slate-700">
            {user?.role === 'admin'
              ? 'Administrator settings emphasize multi-agency monitoring, archive oversight, and broader compliance signal management.'
              : 'Auditor settings emphasize efficient audit execution, focused notification flow, and a cleaner dashboard for day-to-day assessment work.'}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
