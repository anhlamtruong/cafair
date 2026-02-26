export default async function CandidateDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    return (
        <div className="p-6">
            <div className="text-lg font-semibold">Candidate Detail</div>
            <div className="text-sm text-muted-foreground">Candidate ID: {id}</div>
        </div>
    );
}