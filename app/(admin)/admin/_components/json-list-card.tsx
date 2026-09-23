"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BookAnalysis } from "@/lib/analyzer/types";
import { PublishDialog } from "./publish-dialog";

interface JsonItem {
  path: string;
  relativePath: string;
  title?: string | null;
  authors?: string;
  language?: string | null;
  characters?: { main: number; secondary: number; minor: number };
  events?: number;
  createdAt: string;
  model?: string | null;
  chunkTokens?: number | null;
  bookSeriesId?: string | null;
}

export function JsonListCard() {
  const [items, setItems] = useState<JsonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<JsonItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fullJson, setFullJson] = useState<BookAnalysis | null>(null);
  const [jsonLoading, setJsonLoading] = useState(false);
  const [publishItem, setPublishItem] = useState<JsonItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/jsons")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch JSON list");
        const data = await res.json();
        if (!cancelled)
          setItems(Array.isArray(data) ? data : (data.jsons ?? []));
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error("Failed to load JSON files");
        console.error(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleItemClick = async (item: JsonItem) => {
    setSelectedItem(item);
    setDialogOpen(true);
    setJsonLoading(true);
    setFullJson(null);
    try {
      const b64Path = btoa(item.path)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const res = await fetch(`/api/admin/jsons/${b64Path}`);
      if (!res.ok) throw new Error("Failed to load JSON content");
      const data = await res.json();
      setFullJson(data);
    } catch (err) {
      toast.error("Failed to load JSON content");
      console.error(err);
    } finally {
      setJsonLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  // Group characters by role
  const mainChars = fullJson?.characters?.main || [];
  const secondaryChars = fullJson?.characters?.secondary || [];
  const minorChars = fullJson?.characters?.minor || [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Analyzed Books (JSONs)</CardTitle>
          <CardDescription>
            List of successfully processed book analyses ready to be published.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No analyzed books found.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.relativePath}
                  onClick={() => handleItemClick(item)}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card text-card-foreground shadow-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <div className="flex flex-col gap-1 overflow-hidden">
                    <span className="font-medium truncate">
                      {item.title ||
                        item.relativePath.split("/").pop() ||
                        "Untitled"}
                    </span>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-1">
                      {item.authors && item.authors.length > 0 && (
                        <span className="truncate">{item.authors}</span>
                      )}
                      <span>•</span>
                      <span>{formatDate(item.createdAt)}</span>
                      {item.characters && (
                        <>
                          <span>•</span>
                          <span>
                            {item.characters.main +
                              item.characters.secondary +
                              item.characters.minor}{" "}
                            перс., {item.events ?? 0} соб.
                          </span>
                        </>
                      )}
                    </div>
                    {(item.model || item.bookSeriesId) && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {item.model && (
                          <Badge variant="outline">{item.model}</Badge>
                        )}
                        {item.chunkTokens && (
                          <Badge variant="outline">
                            {Math.round(item.chunkTokens / 1000)}k / фрагмент
                          </Badge>
                        )}
                        {item.bookSeriesId && (
                          <Badge variant="secondary">серия задана</Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPublishItem(item);
                    }}
                  >
                    Publish
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {publishItem && (
        <PublishDialog
          open
          onOpenChange={(open) => {
            if (!open) setPublishItem(null);
          }}
          jsonPath={publishItem.relativePath}
          title={publishItem.title ?? undefined}
          initialSeriesId={publishItem.bookSeriesId ?? null}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedItem?.title ||
                selectedItem?.relativePath.split("/").pop() ||
                "Book Analysis"}
            </DialogTitle>
            <DialogDescription>{selectedItem?.authors}</DialogDescription>
          </DialogHeader>

          <Tabs
            defaultValue="overview"
            className="flex-1 overflow-hidden flex flex-col mt-4"
          >
            <TabsList className="w-full justify-start border-b rounded-none pb-0 h-auto bg-transparent">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="raw"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
              >
                Raw JSON
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4 pr-2">
              <TabsContent value="overview" className="mt-0">
                {jsonLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : fullJson ? (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">
                        Title & Authors
                      </h3>
                      <p className="text-sm">
                        <strong>Title:</strong>{" "}
                        {fullJson.title || selectedItem?.title || "N/A"}
                      </p>
                      <p className="text-sm">
                        <strong>Authors:</strong>{" "}
                        {fullJson.authors || selectedItem?.authors || "N/A"}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-3">Characters</h3>
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-sm">Main</h4>
                            <Badge variant="secondary">
                              {mainChars.length}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {mainChars.length > 0 ? (
                              mainChars.map((c) => (
                                <Badge key={c.name} variant="outline">
                                  {c.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                None
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-sm">Secondary</h4>
                            <Badge variant="secondary">
                              {secondaryChars.length}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {secondaryChars.length > 0 ? (
                              secondaryChars.map((c) => (
                                <Badge key={c.name} variant="outline">
                                  {c.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                None
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-sm">Minor</h4>
                            <Badge variant="secondary">
                              {minorChars.length}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {minorChars.length > 0 ? (
                              minorChars.map((c) => (
                                <Badge key={c.name} variant="outline">
                                  {c.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                None
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No data available
                  </div>
                )}
              </TabsContent>

              <TabsContent value="raw" className="mt-0">
                {jsonLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <div className="bg-muted p-4 rounded-md overflow-auto max-h-96">
                    <pre className="text-xs">
                      {JSON.stringify(fullJson, null, 2)}
                    </pre>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
