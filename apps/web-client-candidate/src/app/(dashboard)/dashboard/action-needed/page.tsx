import { Card, CardContent, CardHeader, CardTitle } from "@starter/ui/card";

export default function ActionNeededPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Action Needed
        </h2>
        <p className="text-sm text-text-secondary">
          Items that require your attention right now.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Coming soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-tertiary">
              Action items will appear here once implemented.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
