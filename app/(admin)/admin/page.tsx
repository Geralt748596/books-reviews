import { UploadAnalyzeCard } from "./_components/upload-analyze-card";
import { JsonListCard } from "./_components/json-list-card";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        <p className="text-muted-foreground">
          Select a section below to manage books.
        </p>
      </div>

      <UploadAnalyzeCard />
      <JsonListCard />
    </div>
  );
}
