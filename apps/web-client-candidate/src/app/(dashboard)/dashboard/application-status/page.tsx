import { Card, CardContent, CardHeader, CardTitle } from "@starter/ui/card";

export default function ApplicationStatusPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Application status
        </h2>
        <p className="text-sm text-text-secondary">
          Track the progress of your submitted applications.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Coming soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-tertiary">
              Application tracking is under development.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
