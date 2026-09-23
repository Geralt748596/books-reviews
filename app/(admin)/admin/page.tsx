import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { JsonListCard } from "./_components/json-list-card";
import { WipeDatabaseCard } from "./_components/wipe-database-card";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        <p className="text-muted-foreground">
          Select a section below to manage books.
        </p>
      </div>

      <Link href="/admin/analyze" className="block">
        <Card className="transition-colors hover:bg-accent">
          <CardHeader>
            <CardTitle>Анализ книги</CardTitle>
            <CardDescription>
              Мастер из трёх шагов: PDF и серия → размер фрагмента и модель →
              живой лог выполнения и публикация.
            </CardDescription>
          </CardHeader>
        </Card>
      </Link>

      <JsonListCard />
      <WipeDatabaseCard />
    </div>
  );
}
