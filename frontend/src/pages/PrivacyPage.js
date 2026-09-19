import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const LOGO_URL = "/logo192.png";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#05050A] p-6 pb-24">
      <Link to="/profile" className="inline-flex items-center gap-2 text-[#b8b8d1] hover:text-white mb-8">
        <ChevronLeft className="w-5 h-5" />
        Back
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-14 h-14 rounded-full bg-[#1a1a2e] flex items-center justify-center overflow-hidden">
          <img src={LOGO_URL} alt="horMoscope" className="w-16 h-16 object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-[#F5F5F5]" >
          Privacy Policy
        </h1>
      </div>

      <div className="glass-card p-6 space-y-6 text-[#A0A0A0]">
        <section>
          <h2 className="text-lg font-semibold text-[#F5F5F5] mb-3" >
            Your Privacy Matters
          </h2>
          <p>
            At HORMOscope, we understand the sensitive nature of the information you share with us. 
            We are committed to protecting your privacy and ensuring your data is handled with the utmost care and security.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#F5F5F5] mb-3" >
            Information We Collect
          </h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Account information (email, name)</li>
            <li>Cycle tracking data (period dates, cycle length)</li>
            <li>Health-related notes and symptoms you choose to log</li>
            <li>Journal entries and notes you choose to log</li>
            <li>Intimacy tracking data (premium users only)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#F5F5F5] mb-3" >
            How We Use Your Data
          </h2>
          <ul className="list-disc list-inside space-y-2">
            <li>To provide personalized cycle insights and predictions</li>
            <li>To improve our services and user experience</li>
            <li>To send you relevant notifications (with your consent)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#F5F5F5] mb-3" >
            Data Security
          </h2>
          <p>
            We implement industry-standard security measures to protect your data. 
            Your information is encrypted in transit and at rest. We never sell your personal data to third parties.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#F5F5F5] mb-3" >
            Your Rights
          </h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Access your personal data at any time</li>
            <li>Request deletion of your account and data</li>
            <li>Export your cycle tracking history</li>
            <li>Opt out of non-essential data collection</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#F5F5F5] mb-3" >
            Contact Us
          </h2>
          <p>
            If you have any questions about our privacy practices, please contact us at privacy@hormoscope.app
          </p>
        </section>

        <p className="text-[#505050] text-sm pt-4 border-t border-[#12121A]">
          Last updated: December 2025
        </p>
      </div>
    </div>
  );
}
