"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input, PageHeader } from "@/components/ui";
import { Calendar, GraduationCap, Phone, Users } from "lucide-react";
import { useUser } from "@/lib/UserContext";

type ClassOption = { id: string; name: string };

type AddForm = {
  firstName: string;
  middleName: string;
  lastName: string;
  gender: "" | "MALE" | "FEMALE";
  dateOfBirth: string;
  classId: string;
  address: string;
  guardianName: string;
  guardianPhone: string;
  guardianAddress: string;
};

const EMPTY_FORM: AddForm = {
  firstName: "",
  middleName: "",
  lastName: "",
  gender: "",
  dateOfBirth: "",
  classId: "",
  address: "",
  guardianName: "",
  guardianPhone: "",
  guardianAddress: "",
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

export default function AddStudentPageClient() {
  const router = useRouter();
  const { loading: userLoading, isAdmin, isClassTeacher, myClassId } = useUser();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState("");

  const [form, setForm] = useState<AddForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof AddForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  const set =
    (field: keyof AddForm) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setErrors((e2) => ({ ...e2, [field]: undefined }));
    };

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setClassesLoading(true);
      setClassesError("");
      try {
        const token = localStorage.getItem("accessToken");
        const res = await fetch(`${apiBaseUrl}/classes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message ?? "Failed to load classes");
        }
        const items: ClassOption[] = Array.isArray(data)
          ? data.map((c: { id: string; name: string }) => ({
              id: c.id,
              name: c.name,
            }))
          : Array.isArray(data?.data)
            ? data.data.map((c: { id: string; name: string }) => ({
                id: c.id,
                name: c.name,
              }))
            : Array.isArray(data?.classes)
              ? data.classes.map((c: { id: string; name: string }) => ({
                  id: c.id,
                  name: c.name,
                }))
              : [];

        if (!cancelled) setClasses(items);
      } catch (err) {
        if (!cancelled) {
          setClassesError(
            err instanceof Error ? err.message : "Failed to load classes",
          );
        }
      } finally {
        if (!cancelled) setClassesLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedClasses = useMemo(
    () => {
      const base = [...classes].sort((a, b) => a.name.localeCompare(b.name));
      if (isClassTeacher && myClassId) {
        return base.filter((c) => c.id === myClassId);
      }
      return base;
    },
    [classes, isClassTeacher, myClassId],
  );

  useEffect(() => {
    if (isClassTeacher && myClassId) {
      setForm((prev) => ({ ...prev, classId: myClassId }));
    }
  }, [isClassTeacher, myClassId]);

  const validate = () => {
    const errs: Partial<Record<keyof AddForm, string>> = {};
    if (!form.firstName.trim()) errs.firstName = "First name is required";
    if (!form.lastName.trim()) errs.lastName = "Last name is required";
    if (!form.gender) errs.gender = "Gender is required";
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    setApiError("");
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`${apiBaseUrl}/students`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          middleName: form.middleName.trim() || undefined,
          lastName: form.lastName.trim(),
          dateOfBirth: form.dateOfBirth || undefined,
          gender: form.gender,
          address: form.address.trim() || undefined,
          classId: form.classId || undefined,
          guardianName: form.guardianName.trim() || undefined,
          guardianPhone: form.guardianPhone.trim() || undefined,
          guardianAddress: form.guardianAddress.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to add student");

      setForm(EMPTY_FORM);
      router.push("/students");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to add student");
    } finally {
      setSubmitting(false);
    }
  };

  if (userLoading) return null;

  const canAddStudent = isAdmin || isClassTeacher;
  if (!canAddStudent) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <p className="text-xl font-bold text-gray-900 mb-2">Access Restricted</p>
        <p className="text-gray-500 max-w-md">
          Only administrators and assigned class teachers can add new students.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1600px] w-full mx-auto animate-in fade-in duration-500">
      <PageHeader
        title="Add New Student"
        subtitle="Create a new student record."
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => router.push("/students")}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={submitting}>
              Add Student
            </Button>
          </div>
        }
      />

      <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm shadow-gray-200/50">
        <div className="space-y-5">
          {apiError && (
            <Alert
              type="error"
              message={apiError}
              onDismiss={() => setApiError("")}
            />
          )}
          {classesError && (
            <Alert
              type="error"
              message={classesError}
              onDismiss={() => setClassesError("")}
            />
          )}

          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <GraduationCap className="w-3.5 h-3.5" /> Student Information
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <Input
                label="First Name *"
                placeholder="e.g. Kofi"
                value={form.firstName}
                onChange={set("firstName")}
                error={errors.firstName}
              />
              <Input
                label="Middle Name"
                placeholder="Optional"
                value={form.middleName}
                onChange={set("middleName")}
              />
              <Input
                label="Last Name *"
                placeholder="e.g. Mensah"
                value={form.lastName}
                onChange={set("lastName")}
                error={errors.lastName}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Gender *
                </label>
                <select
                  value={form.gender}
                  onChange={set("gender")}
                  className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all ${
                    errors.gender ? "border-danger-500" : "border-gray-200"
                  }`}
                >
                  <option value="">Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
                {errors.gender && (
                  <p className="mt-1 text-xs font-medium text-danger-600">
                    {errors.gender}
                  </p>
                )}
              </div>

              <Input
                label="Date of Birth"
                type="date"
                value={form.dateOfBirth}
                onChange={set("dateOfBirth")}
                icon={<Calendar className="w-4 h-4" />}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Class
                </label>
                <select
                  value={form.classId}
                  onChange={set("classId")}
                  disabled={classesLoading || (isClassTeacher && !!myClassId)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all disabled:opacity-60"
                >
                  <option value="">No class assigned</option>
                  {sortedClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Address"
                placeholder="Home address"
                value={form.address}
                onChange={set("address")}
              />
            </div>
          </div>

          <div className="border-t border-gray-100" />

          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Users className="w-3.5 h-3.5" /> Guardian / Parent
            </p>
            <p className="text-xs text-gray-500 mb-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              If the guardian&apos;s phone matches an existing parent account, the
              student will be linked automatically.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <Input
                label="Guardian Name"
                placeholder="e.g. Ama Mensah"
                value={form.guardianName}
                onChange={set("guardianName")}
              />
              <Input
                label="Guardian Phone"
                placeholder="e.g. 0241234567"
                type="tel"
                value={form.guardianPhone}
                onChange={set("guardianPhone")}
                icon={<Phone className="w-4 h-4" />}
              />
            </div>
            <Input
              label="Guardian Address"
              placeholder="If different from student's address"
              value={form.guardianAddress}
              onChange={set("guardianAddress")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

