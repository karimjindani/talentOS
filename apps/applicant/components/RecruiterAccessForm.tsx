"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle } from "lucide-react";

interface RecruiterAccessFormProps {
  graduateSlug: string;
  graduateName: string;
  onSubmitSuccess?: () => void;
}

export function RecruiterAccessForm({
  graduateSlug,
  graduateName,
  onSubmitSuccess,
}: RecruiterAccessFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    recruiterName: "",
    recruiterEmail: "",
    recruiterOrganization: "",
    recruiterDesignation: "",
    recruiterPhone: "",
    hiringRequirement: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/graduates/${graduateSlug}/request-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit request");
      }

      setSuccess(true);
      setFormData({
        recruiterName: "",
        recruiterEmail: "",
        recruiterOrganization: "",
        recruiterDesignation: "",
        recruiterPhone: "",
        hiringRequirement: "",
      });

      onSubmitSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-lg bg-green-50 p-4">
        <div className="flex gap-3">
          <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600" />
          <div>
            <h3 className="font-semibold text-green-900">Access Request Submitted!</h3>
            <p className="mt-1 text-sm text-green-700">
              Your access request has been submitted successfully. It is currently under review by our admin team.
              Once approved, you will receive an email containing a secure access link to view {graduateName}&apos;s
              full portfolio.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Request Portfolio Access</h3>
        <p className="mt-1 text-sm text-slate-600">
          Submit your details to request access to {graduateName}'s full portfolio.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 flex gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Your Name</label>
          <input
            type="text"
            name="recruiterName"
            value={formData.recruiterName}
            onChange={handleChange}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            placeholder="John Doe"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            name="recruiterEmail"
            value={formData.recruiterEmail}
            onChange={handleChange}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            placeholder="john@company.com"
          />
        </div>

        {/* Organization */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Organization</label>
          <input
            type="text"
            name="recruiterOrganization"
            value={formData.recruiterOrganization}
            onChange={handleChange}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            placeholder="Google"
          />
        </div>

        {/* Designation */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Designation</label>
          <input
            type="text"
            name="recruiterDesignation"
            value={formData.recruiterDesignation}
            onChange={handleChange}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            placeholder="Senior Recruiter"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Phone (Optional)</label>
          <input
            type="tel"
            name="recruiterPhone"
            value={formData.recruiterPhone}
            onChange={handleChange}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            placeholder="+1-650-253-0000"
          />
        </div>
      </div>

      {/* Hiring Requirement */}
      <div>
        <label className="block text-sm font-medium text-slate-700">Hiring Requirement</label>
        <textarea
          name="hiringRequirement"
          value={formData.hiringRequirement}
          onChange={handleChange}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          placeholder="Tell us about the role and team..."
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand-blue py-2.5 text-center font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Submitting..." : "Submit Access Request"}
      </button>
    </form>
  );
}
