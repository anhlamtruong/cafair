import { Card, CardContent, CardHeader, CardTitle } from "@starter/ui/card";

export default function RoleMatchesPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Role matches
        </h2>
        <p className="text-sm text-text-secondary">
          Discover roles that match your profile and preferences.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Coming soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-tertiary">
              AI-powered role matching is being built. Check back shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
