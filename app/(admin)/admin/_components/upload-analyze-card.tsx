"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UploadAnalyzeCard() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string>("");
  const [model, setModel] = useState("qwen3.5:latest");
  const [titleOverride, setTitleOverride] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [doneResult, setDoneResult] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setProgressLog((prev) => [...prev, "Uploading..."]);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setUploadedFilename(data.filename);
      setProgressLog((prev) => [...prev, `Upload success: ${data.filename}`]);
    } catch (err: any) {
      setProgressLog((prev) => [...prev, `Upload error: ${err.message}`]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAnalyze = () => {
    if (!uploadedFilename) return;
    setIsAnalyzing(true);
    setDoneResult(null);
    setProgressLog((prev) => [...prev, "Starting analysis..."]);

    const pdfParam = encodeURIComponent(
      `lib/analyzer/books/${uploadedFilename}`,
    );
    const modelParam = encodeURIComponent(model);
    const titleParam = encodeURIComponent(titleOverride);
    const url = `/api/admin/analyze?pdf=${pdfParam}&model=${modelParam}&title=${titleParam}`;

    const sse = new EventSource(url);

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "progress") {
          setProgressLog((prev) => [...prev, data.message]);
        } else if (data.type === "done") {
          setProgressLog((prev) => [
            ...prev,
            `Done! Output saved to: ${data.outputPath}`,
          ]);
          setDoneResult(data.outputPath);
          sse.close();
          setIsAnalyzing(false);
        } else if (data.type === "error") {
          setProgressLog((prev) => [...prev, `Error: ${data.message}`]);
          sse.close();
          setIsAnalyzing(false);
        }
      } catch {
        setProgressLog((prev) => [...prev, event.data]);
      }
    };

    sse.onerror = () => {
      setProgressLog((prev) => [...prev, "SSE connection error."]);
      sse.close();
      setIsAnalyzing(false);
    };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload & Analyze</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <Button onClick={handleUpload} disabled={!file || isUploading}>
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
        {uploadedFilename && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Model</label>
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. qwen3.5:latest"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Title Override (Optional)
                </label>
                <Input
                  value={titleOverride}
                  onChange={(e) => setTitleOverride(e.target.value)}
                  placeholder="Leave blank to auto-detect"
                />
              </div>
            </div>
            <Button onClick={handleAnalyze} disabled={isAnalyzing}>
              {isAnalyzing ? "Analyzing..." : "Analyze"}
            </Button>
          </>
        )}
        {progressLog.length > 0 && (
          <div className="bg-muted p-4 rounded-md max-h-64 overflow-y-auto">
            <pre className="text-xs whitespace-pre-wrap">
              {progressLog.join("\n")}
            </pre>
          </div>
        )}
        {doneResult && (
          <div className="text-sm font-medium text-green-600">
            Analysis complete! Saved at: {doneResult}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
