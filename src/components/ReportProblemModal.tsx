import { useState } from "react";
import {
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { brandColors } from "@/lib/brandColors";

interface ReportProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROBLEM_AREAS = [
  { value: "login", label: "Login" },
  { value: "forgot-password", label: "Forgot Password" },
  { value: "dashboard", label: "Dashboard" },
  { value: "results", label: "Results" },
  { value: "archive", label: "Archive" },
  { value: "audit-log", label: "Audit Log" },
];

export default function ReportProblemModal({ isOpen, onClose }: ReportProblemModalProps) {
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [details, setDetails] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedArea || !details.trim()) {
      alert("Please select an area and provide details");
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: Implement API call to submit report
      // await submitProblemReport({ area: selectedArea, details });
      console.log("Submitting problem report:", { area: selectedArea, details });
      onClose();
      setSelectedArea("");
      setDetails("");
    } catch (error) {
      console.error("Failed to submit report:", error);
      alert("Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedArea("");
    setDetails("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 min-h-screen w-screen flex items-center justify-center bg-black/80">
      <Card className={cn("mx-4 w-full max-w-md shadow-lg border-amber-200 bg-white", brandColors.surfaces.primaryCard)}>
        <CardHeader className="border-b border-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-amber-600" />
            <CardTitle className="text-amber-600">
              Something went wrong
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 py-6">
          {/* Area Selection */}
          <div className="space-y-2">
            <label htmlFor="problem-area" className="block text-sm font-medium text-white">
              Choose an area
            </label>
            <Select value={selectedArea} onValueChange={setSelectedArea}>
              <SelectTrigger
                id="problem-area"
                className="rounded-xl border border-slate-300 bg-white text-slate-700"
              >
                <SelectValue placeholder="Select problem area..." />
              </SelectTrigger>
              <SelectContent>
                {PROBLEM_AREAS.map((area) => (
                  <SelectItem key={area.value} value={area.value}>
                    {area.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Details Textarea */}
          <div className="space-y-2">
            <label htmlFor="problem-details" className="block text-sm font-medium text-white">
              Details
            </label>
            <Textarea
              id="problem-details"
              placeholder="Describe what went wrong..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="min-h-24 rounded-xl border border-slate-300 bg-white text-slate-700 placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedArea || !details.trim()}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
