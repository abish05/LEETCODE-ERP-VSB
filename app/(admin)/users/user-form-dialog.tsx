"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEPARTMENTS, SECTIONS, YEARS } from "@/lib/constants";
import { mutateJson } from "@/lib/hooks";
import type { TrackedUserDTO } from "@/lib/types";

interface FormValues {
  registerNo: string;
  name: string;
  department: string;
  year: string;
  section: string;
  role: "STUDENT" | "STAFF";
  leetcodeUsername: string;
  email: string;
}

const BLANK: FormValues = {
  registerNo: "",
  name: "",
  department: "CSE",
  year: "1",
  section: "A",
  role: "STUDENT",
  leetcodeUsername: "",
  email: "",
};

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; omitted when adding. */
  user?: TrackedUserDTO | null;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<FormValues>(BLANK);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(user);

  useEffect(() => {
    if (!open) return;
    setValues(
      user
        ? {
            registerNo: user.registerNo,
            name: user.name,
            department: user.department,
            year: user.year ?? "1",
            section: user.section ?? "A",
            role: user.role,
            leetcodeUsername: user.leetcodeUsername,
            email: user.email ?? "",
          }
        : BLANK,
    );
  }, [open, user]);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        registerNo: values.registerNo.trim(),
        name: values.name.trim(),
        department: values.department.trim(),
        year: values.role === "STAFF" ? null : values.year,
        section: values.role === "STAFF" ? null : values.section,
        role: values.role,
        leetcodeUsername: values.leetcodeUsername.trim(),
        email: values.email.trim() || null,
      };

      if (editing && user) {
        await mutateJson(`/api/users/${user.id}`, "PATCH", payload);
        toast.success(`${payload.name} updated.`);
      } else {
        await mutateJson("/api/users", "POST", payload);
        toast.success(
          `${payload.name} added. Their statistics appear after the next sync.`,
        );
      }

      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The user could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  // The department list combines the standard branches with whatever the
  // spreadsheet actually contained, so an edit never loses an unusual value.
  const departmentOptions = Array.from(
    new Set([...DEPARTMENTS, values.department].filter(Boolean)),
  ).sort();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit user" : "Add user"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the record. Changing the LeetCode username resets the profile status until the next sync."
              : "Add a single student or staff member. For bulk additions use the Import page."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="registerNo">Register number *</Label>
            <Input
              id="registerNo"
              value={values.registerNo}
              onChange={(event) => set("registerNo", event.target.value)}
              placeholder="23CS001"
              required
              maxLength={40}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Full name *</Label>
            <Input
              id="name"
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="Abish A"
              required
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select
              value={values.role}
              onValueChange={(next) => set("role", next as FormValues["role"])}
            >
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STUDENT">Student</SelectItem>
                <SelectItem value="STAFF">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department *</Label>
            <Select
              value={values.department}
              onValueChange={(next) => set("department", next)}
            >
              <SelectTrigger id="department">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {departmentOptions.map((department) => (
                  <SelectItem key={department} value={department}>
                    {department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {values.role === "STUDENT" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Select
                  value={values.year}
                  onValueChange={(next) => set("year", next)}
                >
                  <SelectTrigger id="year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((year) => (
                      <SelectItem key={year} value={year}>
                        Year {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="section">Section</Label>
                <Select
                  value={values.section}
                  onValueChange={(next) => set("section", next)}
                >
                  <SelectTrigger id="section">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTIONS.map((section) => (
                      <SelectItem key={section} value={section}>
                        Section {section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="leetcodeUsername">LeetCode username *</Label>
            <Input
              id="leetcodeUsername"
              value={values.leetcodeUsername}
              onChange={(event) => set("leetcodeUsername", event.target.value)}
              placeholder="abish05"
              required
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              The handle from leetcode.com/u/&lt;username&gt;. A full profile URL
              is accepted too.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              value={values.email}
              onChange={(event) => set("email", event.target.value)}
              placeholder="student@vsbcetc.ac.in"
            />
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              {editing ? "Save changes" : "Add user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
