"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle, X } from "lucide-react";

interface RecruiterAccessModalProps {
  open: boolean;
  onClose: () => void;
}

export function RecruiterAccessModal({ open, onClose }: RecruiterAccessModalProps) {
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
      const response = await fetch(`/api/graduates/request-access`, {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setError(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">Request Full Profile Access</h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {success ? (
            <div className="rounded-lg bg-green-50 p-4">
              <div className="flex gap-3">
                <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-900">Access Request Submitted!</h3>
                  <p className="mt-1 text-sm text-green-700">
                    Your access request has been submitted successfully. It is currently under review by our admin team.
                    Once approved, you will receive an email containing a secure access link to view all graduate
                    portfolios.
                  </p>
                  <button
                    onClick={handleClose}
                    className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-slate-600">
                Fill out this form once to request access to all public graduate portfolios. Our admin team will
                review your request and email you a secure access link upon approval.
              </p>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 flex gap-2">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
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
                  <div className="sm:col-span-2">
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
