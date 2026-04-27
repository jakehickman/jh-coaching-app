import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upload, Trash2, GitCompare, Camera } from "lucide-react";
import { toast } from "sonner";
import { STANDARD_POSES, ATHLETE_POSES } from "../../../../drizzle/schema";

const POSE_LABELS: Record<string, string> = {
  front: "Front",
  side: "Side",
  back: "Back",
  front_relaxed: "Front Relaxed",
  side_relaxed: "Side Relaxed",
  rear_relaxed: "Rear Relaxed",
  front_double_biceps: "Front Double Biceps",
  front_lat_spread: "Front Lat Spread",
  side_chest: "Side Chest",
  side_triceps: "Side Triceps",
  rear_double_biceps: "Rear Double Biceps",
  rear_lat_spread: "Rear Lat Spread",
  abdominals_thighs: "Abdominals & Thighs",
  most_muscular: "Most Muscular",
};

interface Props {
  clientId: number;
  photoType: "standard" | "athlete";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip data:image/jpeg;base64, prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ProgressPhotosTab({ clientId, photoType }: Props) {
  const poses: string[] = photoType === "athlete" ? [...ATHLETE_POSES] : [...STANDARD_POSES];
  const utils = trpc.useUtils();

  // Fetch available weeks from check-in history
  const { data: historyData } = trpc.checkIn.clientHistory.useQuery({ clientId });
  const availableWeeks = Array.from(
    new Set(
      (historyData ?? [])
        .map((h) => h.weekNumber)
        .filter((w): w is number => w !== null && w > 0)
    )
  ).sort((a, b) => a - b);

  const [uploadWeek, setUploadWeek] = useState<number | null>(null);
  const [compareWeekA, setCompareWeekA] = useState<number | null>(null);
  const [compareWeekB, setCompareWeekB] = useState<number | null>(null);
  const [uploadingPose, setUploadingPose] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingPose, setPendingPose] = useState<string | null>(null);

  const { data: weekPhotos, isLoading: loadingWeekPhotos } = trpc.progressPhotos.getByWeek.useQuery(
    { clientId, weekNumber: uploadWeek! },
    { enabled: uploadWeek !== null }
  );

  const { data: comparePhotos } = trpc.progressPhotos.getForCompare.useQuery(
    { clientId, weekA: compareWeekA!, weekB: compareWeekB! },
    { enabled: compareWeekA !== null && compareWeekB !== null }
  );

  const uploadMutation = trpc.progressPhotos.upload.useMutation({
    onSuccess: () => {
      utils.progressPhotos.getByWeek.invalidate({ clientId, weekNumber: uploadWeek! });
      utils.progressPhotos.getWeeks.invalidate({ clientId });
      toast.success("Photo uploaded");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.progressPhotos.delete.useMutation({
    onSuccess: () => {
      utils.progressPhotos.getByWeek.invalidate({ clientId, weekNumber: uploadWeek! });
      utils.progressPhotos.getWeeks.invalidate({ clientId });
      toast.success("Photo deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleUploadClick(pose: string) {
    setPendingPose(pose);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pendingPose || uploadWeek === null) return;
    e.target.value = "";
    const mimeType = file.type as "image/jpeg" | "image/png" | "image/webp";
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      toast.error("Only JPEG, PNG, or WebP images are supported");
      return;
    }
    setUploadingPose(pendingPose);
    try {
      const imageBase64 = await fileToBase64(file);
      await uploadMutation.mutateAsync({ clientId, weekNumber: uploadWeek, pose: pendingPose, imageBase64, mimeType });
    } finally {
      setUploadingPose(null);
      setPendingPose(null);
    }
  }

  const photosByPose = Object.fromEntries(
    (weekPhotos ?? []).map((p) => [p.pose, p])
  );

  // Build comparison grid: for each pose, show weekA photo vs weekB photo
  type PhotoItem = { id: number; coachId: number; weekNumber: number; clientId: number; pose: string; photoUrl: string; s3Key: string; uploadedAt: Date };
  const compareByPoseWeek: Record<string, Record<number, PhotoItem>> = {};
  for (const p of comparePhotos ?? []) {
    if (!compareByPoseWeek[p.pose]) compareByPoseWeek[p.pose] = {};
    compareByPoseWeek[p.pose][p.weekNumber] = p;
  }
  // Show all poses that have at least one photo in either week (not limited to client's pose set)
  const allPosesWithPhotos = Object.keys(compareByPoseWeek).filter(
    (pose) => compareByPoseWeek[pose][compareWeekA!] || compareByPoseWeek[pose][compareWeekB!]
  );
  // Preserve pose order: client's poses first, then any extras
  const posesInOrder = [
    ...poses.filter((p) => allPosesWithPhotos.includes(p)),
    ...allPosesWithPhotos.filter((p) => !poses.includes(p)),
  ];
  const comparePoses = posesInOrder;

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="upload">
            <Camera className="w-4 h-4 mr-2" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="compare">
            <GitCompare className="w-4 h-4 mr-2" />
            Compare
          </TabsTrigger>
        </TabsList>

        {/* ── Upload tab ── */}
        <TabsContent value="upload" className="space-y-4">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">Week:</p>
            <Select
              value={uploadWeek?.toString() ?? ""}
              onValueChange={(v) => setUploadWeek(Number(v))}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Select week" />
              </SelectTrigger>
              <SelectContent>
                {availableWeeks.map((w) => (
                  <SelectItem key={w} value={w.toString()}>
                    Week {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {uploadWeek && (
              <Badge variant="outline" className="text-xs">
                {photoType === "athlete" ? "Athlete — 11 poses" : "Standard — 3 poses"}
              </Badge>
            )}
          </div>

          {!uploadWeek && (
            <p className="text-sm text-muted-foreground py-8 text-center">Select a week to upload photos.</p>
          )}

          {uploadWeek && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {poses.map((pose) => {
                const existing = photosByPose[pose];
                const isUploading = uploadingPose === pose;
                return (
                  <div key={pose} className="relative group rounded-lg border border-border overflow-hidden bg-card">
                    {existing ? (
                      <>
                        <img
                          src={existing.photoUrl}
                          alt={POSE_LABELS[pose]}
                          className="w-full aspect-[3/4] object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                            onClick={() => handleUploadClick(pose)}
                          >
                            <Upload className="w-4 h-4 mr-1" />
                            Replace
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-red-500/20 border-red-400/30 text-red-300 hover:bg-red-500/40"
                            onClick={() => deleteMutation.mutate({ id: existing.id })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() => handleUploadClick(pose)}
                        disabled={isUploading}
                        className="w-full aspect-[3/4] flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      >
                        {isUploading ? (
                          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Upload className="w-6 h-6" />
                        )}
                        <span className="text-xs">{isUploading ? "Uploading..." : "Upload"}</span>
                      </button>
                    )}
                    <div className="px-2 py-1.5 text-[11px] font-medium text-center truncate border-t border-border bg-card">
                      {POSE_LABELS[pose]}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Compare tab ── */}
        <TabsContent value="compare" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">Compare:</p>
            <Select
              value={compareWeekA?.toString() ?? ""}
              onValueChange={(v) => setCompareWeekA(Number(v))}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Week A" />
              </SelectTrigger>
              <SelectContent>
                {availableWeeks.map((w) => (
                  <SelectItem key={w} value={w.toString()}>
                    Week {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground text-sm">vs</span>
            <Select
              value={compareWeekB?.toString() ?? ""}
              onValueChange={(v) => setCompareWeekB(Number(v))}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Week B" />
              </SelectTrigger>
              <SelectContent>
                {availableWeeks.map((w) => (
                  <SelectItem key={w} value={w.toString()}>
                    Week {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(!compareWeekA || !compareWeekB) && (
            <p className="text-sm text-muted-foreground py-8 text-center">Select two weeks to compare.</p>
          )}

          {compareWeekA && compareWeekB && comparePoses.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">No photos found for the selected weeks.</p>
          )}

          {compareWeekA && compareWeekB && comparePoses.length > 0 && (
            <div className="space-y-8">
              {comparePoses.map((pose) => {
                const photoA = compareByPoseWeek[pose]?.[compareWeekA];
                const photoB = compareByPoseWeek[pose]?.[compareWeekB];
                return (
                  <div key={pose} className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {POSE_LABELS[pose]}
                    </p>
                    <div className="grid grid-cols-2 gap-4 max-w-3xl">
                      {/* Week A column */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-center text-muted-foreground">Week {compareWeekA}</p>
                        <div className="rounded-lg overflow-hidden border border-border bg-card">
                          {photoA ? (
                            <img src={photoA.photoUrl} alt={`Week ${compareWeekA} ${POSE_LABELS[pose]}`} className="w-full aspect-[3/4] object-cover" />
                          ) : (
                            <div className="w-full aspect-[3/4] flex items-center justify-center text-xs text-muted-foreground/50 italic">No photo</div>
                          )}
                        </div>
                      </div>
                      {/* Week B column */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-center text-muted-foreground">Week {compareWeekB}</p>
                        <div className="rounded-lg overflow-hidden border border-border bg-card">
                          {photoB ? (
                            <img src={photoB.photoUrl} alt={`Week ${compareWeekB} ${POSE_LABELS[pose]}`} className="w-full aspect-[3/4] object-cover" />
                          ) : (
                            <div className="w-full aspect-[3/4] flex items-center justify-center text-xs text-muted-foreground/50 italic">No photo</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
