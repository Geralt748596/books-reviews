import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyzeWizard } from "./_components/analyze-wizard";

export default function AnalyzePage({
  searchParams,
}: PageProps<"/admin/analyze">) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Анализ книги</h2>
        <p className="text-muted-foreground">
          PDF → извлечение персонажей и сюжета моделью → JSON → публикация в
          базу.
        </p>
      </div>
      {/* searchParams читаются на этапе запроса, поэтому под Suspense */}
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <WizardWithJob searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function WizardWithJob({
  searchParams,
}: {
  searchParams: PageProps<"/admin/analyze">["searchParams"];
}) {
  const { job } = await searchParams;
  const initialJobId = typeof job === "string" && job.length > 0 ? job : null;
  return <AnalyzeWizard initialJobId={initialJobId} />;
}
