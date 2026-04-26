import { FormEvent, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, IdCard, Mail, Phone, ShieldCheck, UserCircle2 } from 'lucide-react';

type ProfileFormState = {
  username: string;
  fullName: string;
  positionTitle: string;
  officePhone: string;
  mobileNumber: string;
};

const createProfileForm = (user: ReturnType<typeof useAuth>['user']): ProfileFormState => ({
  username: user?.username || '',
  fullName: user?.fullName || '',
  positionTitle: user?.positionTitle || '',
  officePhone: user?.officePhone || '',
  mobileNumber: user?.mobileNumber || '',
});

export default function ProfilePage() {
  const { toast } = useToast();
  const { user, updateProfile, refreshUser } = useAuth();
  const [form, setForm] = useState<ProfileFormState>(() => createProfileForm(user));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm(createProfileForm(user));
  }, [user]);

  useEffect(() => {
    refreshUser().catch(() => {
      // The page can still render the cached user shape if refresh fails.
    });
  }, [refreshUser]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      await updateProfile(form);
      toast({
        title: 'Profile updated',
        description: 'Your government account profile has been saved.',
      });
    } catch (error) {
      toast({
        title: 'Unable to update profile',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const agency = user?.agency && typeof user.agency === 'object' ? user.agency : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-5">
          <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
          <p className="text-sm text-slate-600">
            Maintain the official identity details attached to your MASID account.
          </p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-6">
        <Card className="border-slate-200">
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <UserCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {user?.fullName || user?.username}
                  </h2>
                  <p className="text-sm text-slate-600">{user?.positionTitle || 'Government system user'}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge className="bg-slate-900 text-white hover:bg-slate-900">{user?.role}</Badge>
                    <Badge variant="outline" className="border-green-300 text-green-700">
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                      {user?.isEmailVerified ? 'Verified account' : 'Verification pending'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Mail className="h-4 w-4 text-slate-500" />
                    Official email
                  </div>
                  <p className="text-sm text-slate-900">{user?.email}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Building2 className="h-4 w-4 text-slate-500" />
                    Assigned agency
                  </div>
                  <p className="text-sm text-slate-900">{agency?.name || 'Cross-agency access'}</p>
                  <p className="text-xs text-slate-500">{agency?.region || 'Nationwide oversight'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
              <h3 className="text-sm font-semibold text-blue-950">
                {user?.role === 'admin' ? 'Administrator scope' : 'Auditor scope'}
              </h3>
              <p className="mt-2 text-sm leading-6 text-blue-900">
                {user?.role === 'admin'
                  ? 'Your account can oversee audits across agencies, monitor archives, and manage higher-risk compliance events.'
                  : 'Your account is optimized for running audits, reviewing compliance findings, and maintaining agency-specific audit records.'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>
              Update the information shown across audit records and internal notifications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Username</label>
                  <Input
                    value={form.username}
                    onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                    placeholder="agency.auditor"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Full Name</label>
                  <Input
                    value={form.fullName}
                    onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                    placeholder="Juan Dela Cruz"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Position / Office</label>
                  <Input
                    value={form.positionTitle}
                    onChange={(event) => setForm((current) => ({ ...current, positionTitle: event.target.value }))}
                    placeholder="Information Systems Analyst III"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Office Phone</label>
                  <Input
                    value={form.officePhone}
                    onChange={(event) => setForm((current) => ({ ...current, officePhone: event.target.value }))}
                    placeholder="(02) 8123 4567"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Mobile Number</label>
                  <Input
                    value={form.mobileNumber}
                    onChange={(event) => setForm((current) => ({ ...current, mobileNumber: event.target.value }))}
                    placeholder="+63 917 123 4567"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Email Address</label>
                  <Input value={user?.email || ''} disabled />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <IdCard className="h-5 w-5 text-slate-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Agency assignment</p>
                    <p className="text-xs text-slate-500">
                      Agency membership is maintained by the system administrator.
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">{agency?.acronym || agency?.name || 'N/A'}</p>
                  <p className="text-xs text-slate-500">{agency?.domainUrl || 'Not assigned'}</p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Use in Audit Trails</CardTitle>
            <CardDescription>
              These details support internal ownership, follow-up, and escalation inside MASID.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Phone className="h-4 w-4 text-slate-500" />
                Office contact
              </div>
              <p className="text-sm text-slate-900">{user?.officePhone || 'Not provided'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Phone className="h-4 w-4 text-slate-500" />
                Mobile contact
              </div>
              <p className="text-sm text-slate-900">{user?.mobileNumber || 'Not provided'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Building2 className="h-4 w-4 text-slate-500" />
                Role context
              </div>
              <p className="text-sm text-slate-900">
                {user?.role === 'admin' ? 'Oversight and archive control' : 'Audit execution and review'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
